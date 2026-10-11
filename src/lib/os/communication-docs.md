# UniquePlatform Communication: Current Architecture and Verification Status

`communication-types.ts` defines the Firestore-ready contracts for conversations, membership, messages, delivery state, message requests, presence, and notifications.

## Implemented in source (runtime verification still required)

- Firebase Auth UIDs identify users; communication records do not duplicate the user model.
- Conversation creation is server-authored. The trusted endpoint creates a conversation and deterministic membership documents using the verified caller identity.
- The Express server exposes authenticated communication endpoints for conversation creation/listing, message sending, user search, message requests, presence, media uploads, reactions, and delivery/read state.
- The message UI is implemented in `src/pages/messages/`, including conversation list, direct chat, group creation, user search, composer, and attachment flows.
- `communication-db.ts` contains Firestore read helpers and real-time message subscription code using `onSnapshot`; the chat page subscribes to those updates.
- Firestore rules deny direct client writes to conversation, membership, message, delivery, request, and presence records; server-side writes use the trusted backend.
- Communication data must remain independent of UniquePay: do not store wallet balances, ledger entries, transaction credentials, or payment-provider credentials in messaging records.

## Not yet certified

Source presence is not proof that the full messaging journey works in production. Before release, test with two separate authenticated accounts and verify direct and group chat creation, send/receive, live updates, message history after reload, delivery/read state, attachments, membership denial for non-members, blocked-user behavior, and error/reconnect handling. Confirm Firebase indexes/rules and production configuration as part of those tests.

External messaging-provider integration is not implied; this status concerns UniquePlatform's native messaging system.
