import assert from 'node:assert/strict';
import { Timestamp, type Firestore } from 'firebase-admin/firestore';
import {
  TRANSACTION_PIN_LOCKOUT_MS,
  TRANSACTION_PIN_MAX_FAILURES,
  TRANSACTION_PIN_SECURITY_COLLECTION,
  verifyTransactionPinWithLockout,
} from '../src/server/transactionPinSecurity';

type Doc = Record<string, any>;
type Ref = { path: string };
type Write = { ref: Ref; data: Doc; merge: boolean };

/**
 * In-memory adapter for deterministic unit tests of the production verifier.
 * It deliberately has no Firebase credentials and never connects to production.
 * Transactions are serialized to model atomic read/modify/write behavior; this is
 * a unit test, not a substitute for Firestore Emulator integration testing.
 */
class MemoryFirestore {
  readonly documents = new Map<string, Doc>();
  private tail: Promise<void> = Promise.resolve();

  collection(name: string) {
    return { doc: (id: string): Ref => ({ path: name + '/' + id }) };
  }

  async runTransaction<T>(callback: (transaction: any) => Promise<T>): Promise<T> {
    const previous = this.tail;
    let release!: () => void;
    this.tail = new Promise<void>(resolve => { release = resolve; });
    await previous;
    try {
      const writes: Write[] = [];
      const transaction = {
        get: async (ref: Ref) => {
          const value = this.documents.get(ref.path);
          return {
            exists: value !== undefined,
            data: () => value === undefined ? undefined : { ...value },
          };
        },
        set: (ref: Ref, data: Doc, options?: { merge?: boolean }) => {
          writes.push({ ref, data: { ...data }, merge: options?.merge === true });
        },
      };
      const result = await callback(transaction);
      for (const write of writes) {
        const previousDoc = this.documents.get(write.ref.path) || {};
        this.documents.set(write.ref.path, write.merge ? { ...previousDoc, ...write.data } : write.data);
      }
      return result;
    } finally {
      release();
    }
  }
}

const matcher = (credential: Record<string, unknown>, pin: unknown) =>
  pin === '2468' && credential.transactionPinHash === 'test-valid';
const db = new MemoryFirestore();
const firestore = db as unknown as Firestore;
const uid = 'unit-test-user';
db.documents.set('authCredentials/' + uid, { transactionPinHash: 'test-valid' });
const verify = (pin: unknown) => verifyTransactionPinWithLockout(firestore, uid, pin, matcher);
const statePath = TRANSACTION_PIN_SECURITY_COLLECTION + '/' + uid;

for (let i = 0; i < TRANSACTION_PIN_MAX_FAILURES - 1; i++) {
  assert.equal(await verify('0000'), false, 'incorrect PIN must fail');
}
assert.equal(db.documents.get(statePath)?.failedAttempts, 4, 'four failures must be recorded');
assert.equal(db.documents.get(statePath)?.lockedUntil, null, 'four failures must not lock the account');

assert.equal(await verify('0000'), false, 'fifth incorrect PIN must fail');
const locked = db.documents.get(statePath)!;
assert.equal(locked.failedAttempts, 5, 'fifth failure must be recorded');
assert.ok(locked.lockedUntil.toMillis() > Date.now(), 'fifth failure must trigger a future lockout');
const lockExpiry = locked.lockedUntil.toMillis();
assert.equal(TRANSACTION_PIN_LOCKOUT_MS, 15 * 60_000, 'lockout duration must be fifteen minutes');
assert.equal(await verify('2468'), false, 'correct PIN must not bypass an active lockout');
assert.equal(db.documents.get(statePath)?.lockedUntil.toMillis(), lockExpiry, 'blocked attempts must not extend the lockout');

db.documents.set(statePath, {
  failedAttempts: 5,
  windowStartedAt: Timestamp.fromMillis(Date.now() - 60_000),
  lockedUntil: Timestamp.fromMillis(Date.now() - 1_000),
});
assert.equal(await verify('2468'), true, 'correct PIN must work after lockout expiry');
assert.equal(db.documents.get(statePath)?.failedAttempts, 0, 'successful verification must reset failures');
assert.equal(db.documents.get(statePath)?.lockedUntil, null, 'successful verification must clear lockout');

const concurrentDb = new MemoryFirestore();
const concurrentFirestore = concurrentDb as unknown as Firestore;
const concurrentUid = 'concurrent-unit-test-user';
concurrentDb.documents.set('authCredentials/' + concurrentUid, { transactionPinHash: 'test-valid' });
const outcomes = await Promise.all(Array.from({ length: 20 }, () =>
  verifyTransactionPinWithLockout(concurrentFirestore, concurrentUid, '0000', matcher)));
assert.equal(outcomes.filter(Boolean).length, 0, 'all concurrent incorrect PIN attempts must fail');
assert.equal(concurrentDb.documents.get(TRANSACTION_PIN_SECURITY_COLLECTION + '/' + concurrentUid)?.failedAttempts, 5,
  'concurrent attempts must not lose increments or continue incrementing after lockout');
assert.ok(concurrentDb.documents.get(TRANSACTION_PIN_SECURITY_COLLECTION + '/' + concurrentUid)?.lockedUntil.toMillis() > Date.now(),
  'concurrent failures must leave the account locked');

console.log('Transaction PIN lockout unit tests passed (in-memory adapter; no production Firebase access).');
