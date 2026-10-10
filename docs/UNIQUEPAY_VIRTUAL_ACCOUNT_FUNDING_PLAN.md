# UniquePay virtual-account funding readiness

## Current state
- The existing Paystack route initializes and verifies checkout deposits only; its secret-key helper accepts test keys only.
- The Pay page does not yet load or display a provider-issued dedicated virtual account.
- A dedicated virtual account must be issued by Paystack or Monnify. UniquePlatform must never fabricate account numbers.

## Required implementation
1. Keep account generation disabled by default behind `UNIQUEPAY_DVA_ENABLED=false` until provider approval and environment setup are verified.
2. Use an authenticated, rate-limited server endpoint and explicit customer consent.
3. Read customer identity fields from the trusted server-side profile; do not accept them from the browser as authoritative.
4. Use provider-issued customer/account IDs and an idempotent per-user record to prevent duplicate account assignments.
5. Process assignment webhooks only after HMAC verification, persist only verified provider-returned account details, and scope all reads to the authenticated user.
6. Incoming transfers must be reconciled to the provider's confirmed transaction before wallet credit; account-assignment success alone must never credit funds.
7. Keep test accounts clearly labelled as test-only. Do not enable live account generation until Paystack confirms go-live eligibility and required customer-validation requirements are met.
8. Add automated tests for disabled-by-default behavior, authentication, consent, duplicate requests, webhook signatures, malformed provider payloads, and idempotent deposit reconciliation.

## Provider prerequisites
Paystack documents dedicated virtual accounts for eligible Nigerian businesses that have completed go-live. Test mode uses `preferred_bank: test-bank` and cannot receive real money. Certain business categories require customer identity validation before account creation. Do not collect BVN/NIN through an improvised frontend flow; use the provider's approved validation process.

## Acceptance criteria
- With the feature flag absent/false, no account creation call is made.
- A test account appears only after a signed provider assignment-success event.
- No browser-supplied amount, account number, or status can alter wallet balances.
- Live bank-transfer funding remains unavailable until provider go-live, webhook setup, and reconciliation tests are confirmed.
