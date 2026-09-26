# Communication Core Data Models

`communication-types.ts` defines Firestore-ready TypeScript contracts for conversations, membership, messages, delivery state, message requests, presence, and notifications.

- These models use Firebase Auth UIDs to reference existing `UniqueUser` records; they do not duplicate the user model.
- All timestamps follow the existing OS convention of ISO-8601 strings at the application boundary.
- `Message` reuses the existing `MessageStatus` lifecycle from `src/lib/os/types.ts`.
- Communication documents must remain independent of UniquePay: they must not store wallet balances, ledger entries, transaction credentials, or payment-provider credentials.
- Conversation creation is server-authored: the trusted endpoint creates one `conversations/{conversationId}` document plus deterministic `conversationMembers/{conversationId}_{uid}` membership documents atomically.
- Conversation and membership writes persist only schema-defined fields, derive `createdBy` from verified Firebase Auth, and store timestamps as ISO-8601 strings generated from server-authored time.

Current foundation includes read helpers plus one trusted server-side conversation-creation endpoint. It still intentionally excludes client-authored conversation writes, real-time subscriptions, message UI, and external messaging integration.
