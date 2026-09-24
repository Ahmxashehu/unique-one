# Communication Core Data Models

`communication-types.ts` defines Firestore-ready TypeScript contracts for conversations, membership, messages, delivery state, message requests, presence, and notifications.

- These models use Firebase Auth UIDs to reference existing `UniqueUser` records; they do not duplicate the user model.
- All timestamps follow the existing OS convention of ISO-8601 strings at the application boundary.
- `Message` reuses the existing `MessageStatus` lifecycle from `src/lib/os/types.ts`.
- Communication documents must remain independent of UniquePay: they must not store wallet balances, ledger entries, transaction credentials, or payment-provider credentials.

This step is schema-only. It intentionally adds no Firestore access layer, security rules, real-time subscriptions, message UI, or external messaging integration.
