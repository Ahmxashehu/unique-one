# UniquePay external Nigerian bank payout — audit and gated proposal

**Status: NOT IMPLEMENTED / LIVE PAYOUTS DISABLED.** This document is a readiness proposal, not evidence of a successful bank transfer. No provider credentials are stored here and no live payment was initiated.

## Audit result (repository main at audit time)

- `src/server/paystackRoutes.ts` implements Paystack wallet funding/verification, and `apiSecret()` deliberately accepts only `sk_test_` secrets. Do not weaken that guard as part of payout work.
- The internal `POST /api/wallet/transfer` route transfers between UniquePlatform wallets. It is not an external bank payout.
- No registered Monnify disbursement adapter, external-bank payout route, recipient name-enquiry route, payout status reconciler, or external payout ledger settlement flow was found in the inspected server code.
- The user's recent Monnify dashboard details (contract name/code and payment methods) identify a Monnify merchant setup, but do **not** prove that the separate Disbursements capability has been enabled, funded, IP-whitelisted, or approved for live use.
- Recommended first candidate: **Monnify Disbursements**, subject to merchant-account approval and sandbox tests. Paystack Transfers is a viable alternative only if the merchant account has Transfers enabled and the Paystack transfer balance/funding model is confirmed. Do not implement both providers in the first release.

## Configuration required (secrets belong only in Render environment variables)

Sandbox first:
- `MONNIFY_BASE_URL=https://sandbox.monnify.com`
- `MONNIFY_API_KEY`
- `MONNIFY_SECRET_KEY`
- `MONNIFY_CONTRACT_CODE`
- `UNIQUEPAY_BANK_PAYOUTS_ENABLED=false` (hard-off default)
- `MONNIFY_SOURCE_ACCOUNT_NUMBER` only after the provider confirms the disbursement source account required by the account's product configuration.

Before any live use, the merchant must separately confirm live credentials, the funded disbursement source/wallet, provider approval for third-party disbursements, a stable outbound IP whitelisted by Monnify, and the correct live base URL. The account's contract code alone is not a payout account or proof of disbursement enablement. Never put credentials in GitHub, source files, chat, client code, or logs.

## Proposed API and processing model

Implement only after the merchant confirms sandbox access:
1. Authenticated account-name enquiry / bank list routes backed by Monnify. Validate bank code and account number server-side; show the resolved account name and require user confirmation.
2. Authenticated `POST /api/wallet/bank-payouts`, gated by `UNIQUEPAY_BANK_PAYOUTS_ENABLED === "true"` and a separate `MONNIFY_ENVIRONMENT=sandbox` until live readiness is signed off. Require transaction PIN and existing risk/step-up verification; rate-limit and apply server-defined per-transaction/daily limits.
3. Use integer minor units internally, validate NGN and fees, create an immutable payout intent with a server-generated idempotency/reference key, and reserve/debit funds atomically before dispatch. Do not trust client-supplied sender UID, fee, status, or provider reference.
4. Use a durable state machine: `created -> reserved -> submitted/pending_authorization -> processing -> succeeded | failed | reversed | needs_reconciliation`. A provider acceptance response is not proof of recipient credit. Keep ambiguous outcomes reserved; never retry a non-idempotent provider call blindly.
5. Verify provider status through authenticated server-to-server status queries and verify webhook authenticity according to Monnify's current documented mechanism. Webhooks must be idempotent, tolerate reordering, and only settle on verified final statuses.
6. Maintain balanced ledger entries for wallet reservation/debit, payout clearing, provider fees, and release/reversal. Add reconciliation jobs comparing local pending/settled payouts with provider transaction listings and source-wallet balance. Alert on stale pending, mismatch, duplicate references, reversals, or insufficient provider float.
7. Persist masked beneficiary details only as needed; encrypt sensitive data at rest where supported, avoid logging full account numbers, enforce authorization on history/status endpoints, and audit every state transition.
8. No live enablement until compliance/merchant approval, sandbox success/failure/reversal/timeout/duplicate/webhook tests, operational reconciliation, and an explicit release review are complete.

## Required tests before integration is considered ready

- Missing credentials and disabled feature flag reject payout before any provider request.
- Sandbox name enquiry success, invalid account, invalid bank, provider timeout, malformed provider response.
- PIN failure, authentication failure, rate limit, amount bounds, insufficient wallet funds, daily limit, duplicate idempotency key, concurrent requests.
- Provider accepted but pending/OTP required; wrong/expired OTP; timeout after provider acceptance; retry/replay; out-of-order/duplicate webhook.
- Verified success settles once; verified failure releases reservation once; reversal posts compensating entries; provider/local amount, currency, account, reference mismatch is quarantined for reconciliation.
- Fees and NGN minor-unit arithmetic reconcile exactly; no client can mark a payout completed.
- Live credentials must not be accepted while the release gate is false.

## Provider references

- Monnify disbursement overview: https://developers.monnify.com/docs/disbursements
- Monnify single transfer flow, IP allowlisting, OTP/MFA, account-name validation, and status handling: https://monnify-docs.playground.monnify.com/docs/disbursements/single-transfers
- Paystack transfer docs (alternative only): https://paystack.com/docs/transfers/
