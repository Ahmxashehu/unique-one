# Monnify collection integration

This integration is server-side only. It supports UniquePay wallet funding through Monnify-hosted checkout; it does not enable payouts or transfers from Monnify.

## Render environment variables

Add these in the `unique-one` service's Environment page. Never use `VITE_` prefixes for credentials.

- `MONNIFY_API_KEY`: API key from Monnify Developer settings.
- `MONNIFY_SECRET_KEY`: secret key from Monnify Developer settings.
- `MONNIFY_CONTRACT_CODE`: approved Monnify contract code.
- `MONNIFY_BASE_URL`: use `https://sandbox.monnify.com` for sandbox. Production base URL is `https://api.monnify.com`.
- `MONNIFY_REDIRECT_URL`: set to `https://unique-one-162s.onrender.com/os/pay` for this deployment. The server appends the server-generated `paymentReference` to the return URL. The UniquePay page then calls the authenticated verification endpoint; redirect parameters are never proof of payment.
- `MONNIFY_LIVE_ENABLED`: keep unset or `false` during sandbox testing. Setting `true` is not a substitute for Monnify business activation, testing, or operational approval.

The integration fails closed if required credentials are missing or the base URL is not one of the documented Monnify hosts. Secrets are never returned by the configuration endpoint.

## Webhook

Set the Monnify successful collection/transaction completion webhook to:

`https://unique-one-162s.onrender.com/api/webhooks/monnify/collection`

For production, Monnify's `monnify-signature` header is checked against the raw request body with HMAC-SHA512 using the secret key. Monnify documents webhook source IP `35.242.133.146`; use it as an additional network-level allowlist where the hosting/network layer supports it, while retaining signature validation. The webhook then queries Monnify's transaction verification API and only credits a wallet if the provider confirms a paid NGN transaction with the exact expected amount and reference. Sandbox notifications may not include the signature, so server-side transaction verification is still mandatory.

## Wallet funding API

The UniquePay page includes a **Fund wallet** flow that calls authenticated `POST /api/payments/monnify/initialize` with `{ "amountMinor": 500000, "description": "UniquePay wallet funding" }` (amount is integer kobo; example is ₦5,000). The server returns a hosted `checkoutUrl` and a `paymentReference`. The client redirects to the hosted checkout and verifies the returned reference against Monnify server-to-server.

After checkout, the authenticated client can call `GET /api/payments/monnify/verify/:paymentReference`. The client redirect/callback is never treated as proof of payment.

Wallet funding minimum is ₦20 and maximum is ₦500,000 per transaction in this first release. Only an existing active NGN wallet can be credited. Wallet mutation, financial transaction, ledger credit, and intent status update happen atomically and are idempotent by payment reference.

## Release gates

1. Complete Monnify business activation and ensure the registered business name matches the official registration documents.
2. Add sandbox credentials to Render and keep the sandbox base URL.
3. Test successful, failed, pending, mismatched-amount, duplicate webhook, and repeat-verification cases with Monnify sandbox.
4. Confirm CI and deployed smoke tests pass.
5. Only after Monnify approves the account and the production webhook is verified should the live base URL and `MONNIFY_LIVE_ENABLED=true` be configured.


## Sandbox acceptance matrix

Run these cases with Monnify sandbox credentials and test instruments only. Record the provider reference, expected amount, provider status, wallet balance before/after, transaction document, both ledger entries, and intent status for each case. Do not record API keys, secret keys, access tokens, or full payment credentials.

| Case | Action | Required result |
| --- | --- | --- |
| Successful funding | Complete hosted checkout for an eligible amount | Server-side query confirms `PAID`, exact reference, NGN and exact amount; wallet and both ledger entries update once; intent becomes `credited`. |
| Customer cancels / failed payment | Cancel checkout or use a sandbox failure scenario | Wallet remains unchanged; no completed funding transaction or credit ledger entry is created. |
| Pending payment | Return before provider confirms payment | UI says unconfirmed/pending; wallet remains unchanged; payment reference stays available for retry. |
| Amount mismatch | Use a controlled test response/event that does not match the intent amount | No wallet credit; intent remains uncredited; investigation evidence is retained without trusting webhook payload values. |
| Currency mismatch | Use a controlled test response/event with a non-NGN currency | No wallet credit. |
| Duplicate webhook | Deliver the same successful event more than once | At most one wallet increment, one funding transaction and one pair of ledger entries for the payment reference. |
| Concurrent verification | Trigger verification and webhook processing close together | Firestore transaction/idempotency allows at most one credit. |
| Repeat verification | Verify after the intent is credited | Returns the credited state without changing the balance or adding financial records. |
| Unauthenticated verification | Call the verification endpoint without a valid Firebase token | Request is rejected; no payment data is exposed and no wallet changes. |
| Wrong customer | Verify another customer's payment reference | Not found / rejected; no payment data leak and no wallet changes. |
| Initialization failure | Force provider initialization to fail | No wallet balance change; intent is marked `initialization_failed`; UI displays a safe error. |

### Evidence required to close the gate

- CI run is green for the exact PR head.
- Each case above has a recorded result from the sandbox; source-level assertions alone do not count.
- For every successful and duplicate case, compare wallet balance deltas with the transaction record and exactly two ledger entries sharing the same payment reference and idempotency key.
- Confirm the Monnify webhook reaches the deployed sandbox endpoint and provider-query failures return a retryable response rather than crediting from webhook payload alone.
- Keep `MONNIFY_BASE_URL=https://sandbox.monnify.com` and `MONNIFY_LIVE_ENABLED=false` throughout acceptance testing.
- Do not enable production collection until business activation, production webhook signature handling, operational monitoring, and explicit release approval are complete.
