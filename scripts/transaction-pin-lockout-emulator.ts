import assert from 'node:assert/strict';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import {
  TRANSACTION_PIN_LOCKOUT_MS,
  TRANSACTION_PIN_MAX_FAILURES,
  TRANSACTION_PIN_SECURITY_COLLECTION,
  verifyTransactionPinWithLockout,
} from '../src/server/transactionPinSecurity';

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error('Refusing to run emulator integration tests without FIRESTORE_EMULATOR_HOST.');
}
const app = initializeApp({ projectId: 'demo-uniqueplatform-pin-lockout' }, 'transaction-pin-emulator-test');
const db = getFirestore(app);
const uid = 'pin-lockout-emulator-' + process.pid;
const stateRef = db.collection(TRANSACTION_PIN_SECURITY_COLLECTION).doc(uid);
const credentialRef = db.collection('authCredentials').doc(uid);
const matcher = (credential: Record<string, unknown>, pin: unknown) =>
  pin === '2468' && credential.transactionPinHash === 'test-valid';
const verify = (pin: unknown) => verifyTransactionPinWithLockout(db, uid, pin, matcher);

try {
  await Promise.all([stateRef.delete(), credentialRef.delete()]);
  await credentialRef.set({ transactionPinHash: 'test-valid' });

  for (let i = 0; i < TRANSACTION_PIN_MAX_FAILURES - 1; i++) {
    assert.equal(await verify('0000'), false, 'incorrect PIN must fail');
  }
  assert.equal((await stateRef.get()).data()?.failedAttempts, 4, 'first four failures must be recorded');
  assert.equal((await stateRef.get()).data()?.lockedUntil, null, 'first four failures must not lock');

  assert.equal(await verify('0000'), false, 'fifth incorrect PIN must fail');
  const locked = (await stateRef.get()).data()!;
  assert.equal(locked.failedAttempts, 5, 'fifth failure must be recorded');
  assert.ok(locked.lockedUntil.toMillis() > Date.now(), 'fifth failure must set a future lockout');
  const originalExpiry = locked.lockedUntil.toMillis();
  assert.equal(TRANSACTION_PIN_LOCKOUT_MS, 15 * 60_000, 'lockout is fifteen minutes');
  assert.equal(await verify('2468'), false, 'correct PIN must not bypass active lockout');
  assert.equal((await stateRef.get()).data()?.lockedUntil.toMillis(), originalExpiry, 'blocked attempts must not extend lockout');

  await stateRef.set({
    failedAttempts: 5,
    windowStartedAt: Timestamp.fromMillis(Date.now() - 60_000),
    lockedUntil: Timestamp.fromMillis(Date.now() - 1_000),
  });
  assert.equal(await verify('2468'), true, 'correct PIN works after lockout expires');
  const reset = (await stateRef.get()).data()!;
  assert.equal(reset.failedAttempts, 0, 'success resets failed attempts');
  assert.equal(reset.lockedUntil, null, 'success clears lockout');

  const concurrentUid = uid + '-concurrent';
  const concurrentState = db.collection(TRANSACTION_PIN_SECURITY_COLLECTION).doc(concurrentUid);
  const concurrentCredential = db.collection('authCredentials').doc(concurrentUid);
  await concurrentCredential.set({ transactionPinHash: 'test-valid' });
  const outcomes = await Promise.all(Array.from({ length: 20 }, () =>
    verifyTransactionPinWithLockout(db, concurrentUid, '0000', matcher)));
  assert.equal(outcomes.filter(Boolean).length, 0, 'all concurrent incorrect PIN attempts must fail');
  const concurrentFinal = (await concurrentState.get()).data()!;
  assert.equal(concurrentFinal.failedAttempts, 5, 'Firestore transactions preserve concurrent failure counts');
  assert.ok(concurrentFinal.lockedUntil.toMillis() > Date.now(), 'concurrent failures leave account locked');

  const missingUid = uid + '-missing-credential';
  const missingResult = await verifyTransactionPinWithLockout(db, missingUid, '0000', matcher);
  assert.equal(missingResult, false, 'missing credentials must fail closed');
  assert.equal((await db.collection(TRANSACTION_PIN_SECURITY_COLLECTION).doc(missingUid).get()).data()?.failedAttempts, 1,
    'missing credentials count as a failed attempt');

  console.log('Firestore Emulator Transaction PIN lockout integration tests passed.');
} finally {
  await Promise.all([
    stateRef.delete(),
    credentialRef.delete(),
    db.collection(TRANSACTION_PIN_SECURITY_COLLECTION).doc(uid + '-concurrent').delete(),
    db.collection('authCredentials').doc(uid + '-concurrent').delete(),
    db.collection(TRANSACTION_PIN_SECURITY_COLLECTION).doc(uid + '-missing-credential').delete(),
  ]);
  await app.delete();
}
