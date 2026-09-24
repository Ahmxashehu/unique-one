UniquePay NGN Transfer Contract

Project: Unique One / UniquePay

Status: Design specification — not implemented

Currency: NGN

Scope: Internal wallet transfer foundation

1. Purpose

This document defines the design requirements for a future UniquePay internal wallet transfer system.

The system must support secure, atomic transfers between authenticated UniquePay users.

This document does not authorize live-money processing or establish regulatory approval.

2. Current Implementation Status

Currently implemented

- Firebase Authentication.
- Firebase Admin SDK initialization.
- Express server foundation.
- Authentication middleware definition.
- Wallet foundation planning.
- Transaction History page connected to Firestore.
- Transaction and ledger data model types.

Planned

- Protected wallet transfer endpoint.
- Atomic wallet debit and credit.
- Double-entry ledger records.
- Server-side idempotency enforcement.
- Secure server-created transaction records.
- Transfer validation and status handling.

Requires further decisions

- Payment provider integration.
- Regulatory and licensing requirements.
- Transaction limits and fees.
- Transaction PIN and additional authentication.
- Reversals, disputes, and settlement.
- Production monitoring and operational controls.

3. Security Principles

1. Sender identity must be derived from a verified Firebase ID token.
2. Client-supplied senderId must never be trusted.
3. Client applications must not directly mark transactions as completed.
4. Financial state must be controlled by trusted server-side code.
5. Transfers must be atomic.
6. Repeated requests must be protected by idempotency.
7. No real-money processing is permitted during this development stage.

4. Transfer Request

Planned endpoint:

"POST /api/wallet/transfer"

Request fields:

- recipientId: string
- amountMinor: integer
- currency: "NGN"
- idempotencyKey: string
- description: optional string

The sender is derived from the verified authentication token.

The client must not provide a trusted sender identity.

5. Amount Representation

All internal monetary values must use integer minor units.

For NGN:

- ₦1 = 100 minor units.
- ₦100 = 10,000 minor units.
- Decimal floating-point arithmetic must not be used for balance calculations.

Amounts must be positive integers and validated against configured transaction limits.

Canonical rule:

- All authoritative financial amounts use `amountMinor` integers.
- NGN uses 100 minor units per ₦1.
- Do not maintain competing authoritative `amount` and `amountMinor` fields for wallet transfer records.

5B. Canonical Wallet and Financial Schemas

Wallet collection

- Collection: `wallets`
- Document ID: Firebase Auth UID
- Fields:
  - `uid: string`
  - `currency: "NGN"`
  - `availableBalanceMinor: integer`
  - `status: "active" | "suspended" | "closed"`
  - `createdAt`
  - `updatedAt`

New wallet initialization:

- `availableBalanceMinor = 0`

Transaction collection (server-created only)

- Collection: `transactions`
- Preserved fields:
  - `id` / `reference`
  - `senderId`
  - `recipientId`
  - `amountMinor`
  - `currency`
  - `type`
  - `status`
  - `description` (when provided)
  - `createdAt`
  - `updatedAt`

Ledger collection (server-only)

- Collection: `ledgerEntries`
- Per-entry fields:
  - `transactionId`
  - `reference`
  - `uid`
  - `direction: "debit" | "credit"`
  - `amountMinor`
  - `currency`
  - `status`
  - `idempotencyKey`
  - `createdAt`

Idempotency collection (server-only)

- Collection: `walletIdempotency`
- Identity: deterministic key for `authenticatedSenderUid + idempotencyKey`
- Stored data must be sufficient to:
  - replay identical requests safely
  - detect conflicting key reuse
  - return the original successful result

6. Authentication and Authorization

The endpoint must require a valid Firebase ID token.

The server must:

1. Extract the Bearer token.
2. Verify the token using Firebase Admin SDK.
3. Derive the authenticated sender UID.
4. Validate the recipient.
5. Check sender wallet status.
6. Authorize the requested transfer.

A senderId supplied in the request body must not override the authenticated identity.

7. Validation Rules

The future implementation must reject:

- Missing authentication.
- Invalid or expired authentication tokens.
- Missing recipient.
- Invalid recipient.
- Self-transfers.
- Invalid or zero amounts.
- Unsupported currency.
- Inactive wallets.
- Insufficient available balance.
- Missing or invalid idempotency keys.
- Requests that exceed configured limits.

Exact limits must be decided before production deployment.

8. Atomic Transfer Rules

A transfer must be executed atomically.

The intended operation is:

1. Validate the authenticated sender.
2. Validate the recipient.
3. Check idempotency.
4. Read sender and recipient wallet state.
5. Verify sufficient available balance.
6. Debit the sender.
7. Credit the recipient.
8. Create corresponding ledger entries.
9. Create the transaction record.
10. Save the idempotency result.

If any required operation fails, the transfer must not partially complete.

The implementation must use a suitable Firestore transaction or an equivalent trusted atomic design.

9. Double-Entry Ledger Principles

Every successful transfer must produce balanced accounting entries.

Example:

Sender transfers ₦1,000:

- Sender debit: 100,000 minor units.
- Recipient credit: 100,000 minor units.

The ledger must preserve:

- Transaction reference.
- Account or wallet identifier.
- Entry direction.
- Amount in minor units.
- Currency.
- Creation timestamp.
- Idempotency reference.
- Appropriate status.

The exact accounting model and reconciliation procedures must be reviewed before production use.

10. Idempotency

Each transfer request must include a unique idempotency key for the authenticated sender.

The server must:

- Store the request result.
- Return the existing result for a repeated identical request.
- Reject reuse of a key with conflicting request details.
- Prevent duplicate balance movements.

Planned conflict code:

"IDEMPOTENCY_KEY_CONFLICT"

Idempotency storage and transfer processing must be designed to prevent race conditions.

11. Transfer Statuses

Proposed statuses:

- pending
- completed
- failed
- reversed

The final state machine must define permitted transitions.

A transaction must not be marked completed before the required financial operations have successfully finished.

Reversal behavior must be explicitly designed rather than implemented as an arbitrary balance adjustment.

12. Error Codes

Proposed error codes:

- UNAUTHENTICATED
- INVALID_RECIPIENT
- SELF_TRANSFER_NOT_ALLOWED
- INVALID_AMOUNT
- UNSUPPORTED_CURRENCY
- WALLET_NOT_ACTIVE
- INSUFFICIENT_FUNDS
- IDEMPOTENCY_KEY_REQUIRED
- IDEMPOTENCY_KEY_CONFLICT
- TRANSFER_FAILED
- INTERNAL_ERROR

Responses must avoid exposing sensitive internal information.

13. Transaction References

Every transfer must have a unique server-generated reference.

The reference must allow authorized support and reconciliation processes to identify the transfer.

The client must not be allowed to choose a reference that can cause collisions or impersonate another transaction.

14. Firestore Security

Client-side transaction creation must be restricted before the production transfer flow is enabled.

The server must be the trusted writer for financial transaction records.

Firestore rules must be reviewed and tested to ensure that unauthorized clients cannot create fabricated completed transactions or alter financial records.

Firebase Admin SDK operations bypass Firestore security rules, so server-side authorization and validation remain essential.

15. Future Features

The following features are outside this initial transfer contract:

- Payment provider integration.
- Bank cash-in and cash-out.
- Transaction PIN.
- Two-factor authentication.
- Transfer fees.
- Reversals.
- Dispute handling.
- Settlement and reconciliation.
- Transaction limits based on user verification.
- Regulatory compliance controls.

Each feature requires its own implementation and security review.

16. Development Restrictions

During this design stage:

- Do not process real money.
- Do not connect live payment providers.
- Do not modify the main branch directly.
- Do not implement the transfer endpoint yet.
- Do not change server.ts or firestore.rules as part of this document-only step.
- Preserve the existing React, Vite, Firebase, Express, and routing architecture.

17. Approval Requirements

Before implementation:

1. Review this contract.
2. Confirm the wallet data model.
3. Confirm the transaction and ledger structure.
4. Review Firestore security rules.
5. Define transaction limits and operational requirements.
6. Create a feature branch.
7. Implement and test the transfer endpoint in a controlled development environment.

Document status: Draft — awaiting review and approval.
