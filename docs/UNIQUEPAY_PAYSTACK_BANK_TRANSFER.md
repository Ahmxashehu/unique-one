# UniquePay Paystack Bank Transfer Integration

## Scope delivered in this branch
- Authenticated, rate-limited bank-list endpoint backed by Paystack.
- Authenticated account-resolution endpoint; account name is returned from Paystack, not trusted from browser input.
- A transfer-recipient + transfer initiation endpoint behind `UNIQUEPAY_EXTERNAL_PAYOUTS_ENABLED=true`.
- Four-digit transaction PIN validation against the trusted profile hash.
- Idempotency record per user/request key, recipient re-resolution before transfer, and signed transfer status webhook.
- Strict test-key-only operation. The handler rejects live secret keys by design.

## Important limits
- These endpoints are not live money transfer. Paystack test transfers are simulations and do not move real money.
- The endpoint currently submits from the merchant's Paystack balance (`source: balance`); it does not debit the UniquePay wallet or settle wallet liabilities. It must not be enabled for customer use until wallet debit/reservation, double-entry ledger, fee handling, failed/reversed-transfer compensation, and reconciliation are implemented and tested together.
- Do not enable `UNIQUEPAY_EXTERNAL_PAYOUTS_ENABLED` in production. Leave it unset/false.
- Paystack must approve the registered business for transfers and the merchant must have sufficient Paystack balance including fees before live payouts can work.

## Production acceptance gates
1. Provider confirms live Transfers access for the registered business.
2. Implement wallet balance reservation and a balanced double-entry ledger transaction before calling Paystack.
3. Enforce amount-based biometric/passkey step-up using the existing transaction auth policy.
4. Add durable outbox/retry semantics so provider timeouts cannot cause duplicate sends.
5. Handle signed `transfer.success`, `transfer.failed`, and `transfer.reversed` events idempotently; reconcile provider status and fees.
6. Add tests for insufficient wallet balance, insufficient provider balance, PIN failure/lockout, duplicate idempotency keys, name mismatch, webhook replay, timeout ambiguity, and reversal.
7. Enable live mode only after staging verification and provider go-live approval.
