import { Timestamp, type Firestore } from 'firebase-admin/firestore';

export const TRANSACTION_PIN_SECURITY_COLLECTION = 'transactionPinSecurity';
export const TRANSACTION_PIN_MAX_FAILURES = 5;
export const TRANSACTION_PIN_FAILURE_WINDOW_MS = 15 * 60_000;
export const TRANSACTION_PIN_LOCKOUT_MS = 15 * 60_000;

export type TransactionPinMatcher = (credential: Record<string, unknown>, pin: unknown) => boolean;

/**
 * Shared persistent lockout for all server-side Transaction PIN protected flows.
 * The credential and lock-state reads plus counter mutation are one Firestore transaction,
 * so simultaneous failures cannot overwrite one another.
 */
export async function verifyTransactionPinWithLockout(
  db: Firestore,
  uid: string,
  pin: unknown,
  matchesPin: TransactionPinMatcher,
): Promise<boolean> {
  const securityRef = db.collection(TRANSACTION_PIN_SECURITY_COLLECTION).doc(uid);
  const credentialRef = db.collection('authCredentials').doc(uid);

  return db.runTransaction(async transaction => {
    const [securitySnap, credentialSnap] = await Promise.all([
      transaction.get(securityRef),
      transaction.get(credentialRef),
    ]);
    const state = securitySnap.data() || {};
    const nowMs = Date.now();
    const lockedUntil = state.lockedUntil;
    const lockedUntilMs = typeof lockedUntil?.toMillis === 'function' ? lockedUntil.toMillis() : 0;
    if (lockedUntilMs > nowMs) return false;

    const credential = credentialSnap.exists
      ? (credentialSnap.data() || {}) as Record<string, unknown>
      : {};
    if (credentialSnap.exists && matchesPin(credential, pin)) {
      transaction.set(securityRef, {
        failedAttempts: 0,
        windowStartedAt: null,
        lockedUntil: null,
        lastSuccessAt: Timestamp.fromMillis(nowMs),
        updatedAt: Timestamp.fromMillis(nowMs),
      }, { merge: true });
      return true;
    }

    const windowStartedAt = state.windowStartedAt;
    const windowStartedAtMs = typeof windowStartedAt?.toMillis === 'function' ? windowStartedAt.toMillis() : 0;
    const withinWindow = windowStartedAtMs > 0 && nowMs - windowStartedAtMs < TRANSACTION_PIN_FAILURE_WINDOW_MS;
    const previousFailures = withinWindow && Number.isSafeInteger(state.failedAttempts) ? state.failedAttempts : 0;
    const failedAttempts = previousFailures + 1;
    transaction.set(securityRef, {
      failedAttempts,
      windowStartedAt: withinWindow ? windowStartedAt : Timestamp.fromMillis(nowMs),
      lockedUntil: failedAttempts >= TRANSACTION_PIN_MAX_FAILURES
        ? Timestamp.fromMillis(nowMs + TRANSACTION_PIN_LOCKOUT_MS)
        : null,
      lastFailureAt: Timestamp.fromMillis(nowMs),
      updatedAt: Timestamp.fromMillis(nowMs),
    }, { merge: true });
    return false;
  });
}
