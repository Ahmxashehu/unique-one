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
