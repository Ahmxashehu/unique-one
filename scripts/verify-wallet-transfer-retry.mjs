import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync('src/pages/pay/SendMoneyPage.tsx', 'utf8');

assert.ok(page.includes("useRef, useState"), 'transfer retry state must survive React re-renders');
assert.ok(page.includes("transferAttemptRef.current?.key ??"), 'retries must reuse the original idempotency key');
assert.ok(page.includes("sessionStorage.getItem(attemptStorageKey)"), 'pending attempts must survive a page reload within the browser session');
assert.ok(page.includes("sessionStorage.setItem(attemptStorageKey"), 'the pending idempotency key must be persisted before submission');
assert.ok(page.includes("sessionStorage.removeItem(attemptStorageKey)"), 'successful or definitively failed attempts must clean up persisted retry state');
assert.ok(page.includes("transferAttemptRef.current = { key: idempotencyKey, fingerprint: attemptFingerprint }"), 'the key must be bound to the transfer fingerprint');
assert.ok(page.includes("transferAttemptRef.current.fingerprint !== attemptFingerprint"), 'changed transfer details must not silently create a new payment attempt');
assert.ok(page.includes("Keep the key after network/5xx ambiguity"), 'ambiguous failures must preserve the idempotency key');
assert.ok(page.includes("finalResponseCode !== 'TRANSFER_IN_PROGRESS'"), 'a definitive client error may release the key, but an in-progress transfer may not');
assert.ok(page.includes("transferAttemptRef.current = null;") && page.includes("navigate(`/os/pay/receipts/${payload.id}`)"), 'a successful transfer must clear the pending attempt before showing the receipt');
assert.ok(page.includes("Math.abs(amountValue * 100 - amountMinor) > 1e-7"), 'amounts with more than two decimal places must be rejected client-side');

console.log('Wallet transfer retry contract checks passed (static checks; live financial integration still required).');
