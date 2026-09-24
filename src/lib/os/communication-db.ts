import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit as fbLimit,
  orderBy,
  query,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase';
import type {
  Conversation,
  ConversationMember,
  Message,
  MessageRequest,
  UserPresence,
  Notification,
} from './communication-types';

/**
 * Communication Core Firestore data-access foundation.
 *
 * Step 4 scope: typed, read-only(-mostly) data access for the new
 * Communication Core collections defined in `communication-types.ts`.
 *
 * This module reuses the repository's existing Firebase client SDK
 * instance (`src/lib/firebase.ts`). It does NOT initialize a second
 * Firebase app and does NOT use the Firebase Admin SDK.
 *
 * This module intentionally does NOT implement:
 *  - Realtime listeners (`onSnapshot`) — reads are one-shot (`getDoc`/`getDocs`).
 *  - Message creation/writes, presence writes, or notification writes.
 *  - Chat UI, WebSockets, Socket.IO, voice/video, or external providers.
 *  - Any UniquePay wallet/transfer/ledger logic.
 *
 * Legacy separation:
 * The existing legacy messaging system (`src/pages/messages/*`) reads and
 * writes a top-level `conversations` collection plus a *nested*
 * `conversations/{conversationId}/messages` subcollection, using the
 * legacy `Conversation`/`Message` shapes from `src/lib/os/types.ts`. This
 * module is intentionally independent: it reads the *new* Communication
 * Core collections (`conversationMembers`, top-level `messages`,
 * `messageRequests`, `userPresence`, `notifications`) and the *new*
 * types from `communication-types.ts`. The legacy `conversations`
 * collection name is shared by both systems (per the Step 4 instructions,
 * which do not introduce an alternate name), but this module's
 * `getConversation`/`getUserConversations` only ever map documents through
 * the new `Conversation` shape and never write to that collection.
 */

const CONVERSATIONS_COLLECTION = 'conversations';
const CONVERSATION_MEMBERS_COLLECTION = 'conversationMembers';
const MESSAGES_COLLECTION = 'messages';
const MESSAGE_REQUESTS_COLLECTION = 'messageRequests';
const USER_PRESENCE_COLLECTION = 'userPresence';
const NOTIFICATIONS_COLLECTION = 'notifications';

const DEFAULT_MESSAGE_LIMIT = 50;
const MAX_MESSAGE_LIMIT = 200;

export type CommunicationDbErrorCode =
  | 'INVALID_ID'
  | 'NOT_FOUND'
  | 'INVALID_DOCUMENT_SHAPE'
  | 'READ_FAILED';

export class CommunicationDbError extends Error {
  code: CommunicationDbErrorCode;
  constructor(code: CommunicationDbErrorCode, message: string) {
    super(message);
    this.name = 'CommunicationDbError';
    this.code = code;
  }
}

/** Bounded identifier check, matching the convention already used by `communicationCore.ts`. */
function isBoundedIdentifier(value: unknown, maxLength = 128): value is string {
  return (
    typeof value === 'string' &&
    value.length >= 1 &&
    value.length <= maxLength &&
    /^[A-Za-z0-9_-]+$/.test(value)
  );
}

function requireId(value: unknown, fieldName: string): string {
  if (!isBoundedIdentifier(value)) {
    throw new CommunicationDbError('INVALID_ID', `${fieldName} must be a non-empty, bounded identifier.`);
  }
  return value;
}

/** Wraps a Firestore read so unexpected SDK failures surface as a typed, safe error. */
async function safeRead<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    throw new CommunicationDbError('READ_FAILED', 'Failed to read Communication Core data from Firestore.');
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Coerces a Firestore Timestamp-like value or ISO string to an ISO-8601 string. Never fabricates a value. */
function coerceTimestampToIso(value: unknown, fieldName: string): string {
  if (typeof value === 'string') return value;
  if (
    value &&
    typeof value === 'object' &&
    typeof (value as { toDate?: unknown }).toDate === 'function'
  ) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  throw new CommunicationDbError('INVALID_DOCUMENT_SHAPE', `${fieldName} is missing or is not a valid timestamp.`);
}

function coerceOptionalTimestampToIso(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  return coerceTimestampToIso(value, 'optional timestamp field');
}

// ---------------------------------------------------------------------------
// Conversations
// ---------------------------------------------------------------------------

function mapConversation(snapshotId: string, data: DocumentData | undefined): Conversation {
  if (!isPlainObject(data)) {
    throw new CommunicationDbError('INVALID_DOCUMENT_SHAPE', 'Conversation document data is missing or malformed.');
  }
  if (typeof data.type !== 'string' || typeof data.createdBy !== 'string' || typeof data.status !== 'string') {
    throw new CommunicationDbError('INVALID_DOCUMENT_SHAPE', 'Conversation document is missing required fields.');
  }
  const conversation: Conversation = {
    id: snapshotId,
    type: data.type as Conversation['type'],
    createdBy: data.createdBy,
    createdAt: coerceTimestampToIso(data.createdAt, 'createdAt'),
    updatedAt: coerceTimestampToIso(data.updatedAt, 'updatedAt'),
    status: data.status as Conversation['status'],
  };
  if (typeof data.title === 'string') conversation.title = data.title;
  if (typeof data.avatarUrl === 'string') conversation.avatarUrl = data.avatarUrl;
  const lastMessageAt = coerceOptionalTimestampToIso(data.lastMessageAt);
  if (lastMessageAt !== undefined) conversation.lastMessageAt = lastMessageAt;
  if (typeof data.lastMessageId === 'string') conversation.lastMessageId = data.lastMessageId;
  return conversation;
}

/** Reads a single Communication Core conversation by ID. Throws if not found or malformed. */
export async function getConversation(conversationId: string): Promise<Conversation> {
  const id = requireId(conversationId, 'conversationId');
  const snapshot = await safeRead(() => getDoc(doc(db, CONVERSATIONS_COLLECTION, id)));
  if (!snapshot.exists()) {
    throw new CommunicationDbError('NOT_FOUND', `Conversation ${id} was not found.`);
  }
  return mapConversation(snapshot.id, snapshot.data());
}

function mapConversationMember(snapshotId: string, data: DocumentData | undefined): ConversationMember {
  if (!isPlainObject(data)) {
    throw new CommunicationDbError('INVALID_DOCUMENT_SHAPE', 'ConversationMember document data is missing or malformed.');
  }
  if (
    typeof data.conversationId !== 'string' ||
    typeof data.uid !== 'string' ||
    typeof data.role !== 'string'
  ) {
    throw new CommunicationDbError('INVALID_DOCUMENT_SHAPE', 'ConversationMember document is missing required fields.');
  }
  const member: ConversationMember = {
    conversationId: data.conversationId,
    uid: data.uid,
    role: data.role as ConversationMember['role'],
    joinedAt: coerceTimestampToIso(data.joinedAt, 'joinedAt'),
  };
  const lastReadAt = coerceOptionalTimestampToIso(data.lastReadAt);
  if (lastReadAt !== undefined) member.lastReadAt = lastReadAt;
  if (typeof data.muted === 'boolean') member.muted = data.muted;
  return member;
}

/** Reads all membership records for a conversation from the `conversationMembers` collection. */
export async function getConversationMembers(conversationId: string): Promise<ConversationMember[]> {
  const id = requireId(conversationId, 'conversationId');
  const membersQuery = query(
    collection(db, CONVERSATION_MEMBERS_COLLECTION),
    where('conversationId', '==', id),
  );
  const snapshot = await safeRead(() => getDocs(membersQuery));
  return snapshot.docs.map((docSnap: QueryDocumentSnapshot<DocumentData>) => mapConversationMember(docSnap.id, docSnap.data()));
}

/**
 * Reads all conversations a given user belongs to, via `conversationMembers`.
 *
 * `userId` must be an already-verified identifier (e.g. the authenticated
 * user's UID from the repository's existing auth context, such as
 * `useAuth().currentUser.uid` on the client or the verified `req.user.uid`
 * on the server). This helper does not perform authentication itself and
 * must not be called with an unauthenticated, caller-supplied ID when the
 * intent is "current user's" data.
 */
export async function getUserConversations(userId: string): Promise<Conversation[]> {
  const uid = requireId(userId, 'userId');
  const membershipQuery = query(
    collection(db, CONVERSATION_MEMBERS_COLLECTION),
    where('uid', '==', uid),
  );
  const membershipSnapshot = await safeRead(() => getDocs(membershipQuery));
  const conversationIds = membershipSnapshot.docs
    .map((docSnap: QueryDocumentSnapshot<DocumentData>) => docSnap.data().conversationId)
    .filter((value: unknown): value is string => typeof value === 'string');

  const conversations: Conversation[] = [];
  for (const conversationId of conversationIds) {
    try {
      conversations.push(await getConversation(conversationId));
    } catch (error) {
      if (error instanceof CommunicationDbError && error.code === 'NOT_FOUND') continue;
      throw error;
    }
  }
  return conversations;
}

// ---------------------------------------------------------------------------
// Messages (new top-level Communication Core collection: "messages")
// ---------------------------------------------------------------------------

function mapMessage(snapshotId: string, data: DocumentData | undefined): Message {
  if (!isPlainObject(data)) {
    throw new CommunicationDbError('INVALID_DOCUMENT_SHAPE', 'Message document data is missing or malformed.');
  }
  if (
    typeof data.conversationId !== 'string' ||
    typeof data.senderId !== 'string' ||
    typeof data.type !== 'string' ||
    typeof data.status !== 'string'
  ) {
    throw new CommunicationDbError('INVALID_DOCUMENT_SHAPE', 'Message document is missing required fields.');
  }
  const message: Message = {
    id: snapshotId,
    conversationId: data.conversationId,
    senderId: data.senderId,
    type: data.type as Message['type'],
    createdAt: coerceTimestampToIso(data.createdAt, 'createdAt'),
    status: data.status as Message['status'],
  };
  if (typeof data.text === 'string') message.text = data.text;
  if (typeof data.replyToMessageId === 'string') message.replyToMessageId = data.replyToMessageId;
  const updatedAt = coerceOptionalTimestampToIso(data.updatedAt);
  if (updatedAt !== undefined) message.updatedAt = updatedAt;
  if (Array.isArray(data.attachments)) message.attachments = data.attachments;
  return message;
}

function clampMessageLimit(requested: number | undefined): number {
  if (requested === undefined) return DEFAULT_MESSAGE_LIMIT;
  if (!Number.isSafeInteger(requested) || requested <= 0) return DEFAULT_MESSAGE_LIMIT;
  return Math.min(requested, MAX_MESSAGE_LIMIT);
}

/**
 * Reads messages for a conversation from the new top-level `messages`
 * collection (NOT the legacy nested
 * `conversations/{conversationId}/messages` subcollection used by
 * `src/pages/messages/ChatView.tsx`). Ordered oldest-first, bounded by
 * `limit` (default 50, max 200).
 */
export async function getMessagesForConversation(conversationId: string, limit?: number): Promise<Message[]> {
  const id = requireId(conversationId, 'conversationId');
  const boundedLimit = clampMessageLimit(limit);
  const messagesQuery = query(
    collection(db, MESSAGES_COLLECTION),
    where('conversationId', '==', id),
    orderBy('createdAt', 'asc'),
    fbLimit(boundedLimit),
  );
  const snapshot = await safeRead(() => getDocs(messagesQuery));
  return snapshot.docs.map((docSnap: QueryDocumentSnapshot<DocumentData>) => mapMessage(docSnap.id, docSnap.data()));
}

/** Reads a single message by ID from the top-level `messages` collection. */
export async function getMessage(messageId: string): Promise<Message> {
  const id = requireId(messageId, 'messageId');
  const snapshot = await safeRead(() => getDoc(doc(db, MESSAGES_COLLECTION, id)));
  if (!snapshot.exists()) {
    throw new CommunicationDbError('NOT_FOUND', `Message ${id} was not found.`);
  }
  return mapMessage(snapshot.id, snapshot.data());
}

// ---------------------------------------------------------------------------
// Message requests
// ---------------------------------------------------------------------------

function mapMessageRequest(snapshotId: string, data: DocumentData | undefined): MessageRequest {
  if (!isPlainObject(data)) {
    throw new CommunicationDbError('INVALID_DOCUMENT_SHAPE', 'MessageRequest document data is missing or malformed.');
  }
  if (
    typeof data.fromUid !== 'string' ||
    typeof data.toUid !== 'string' ||
    typeof data.status !== 'string'
  ) {
    throw new CommunicationDbError('INVALID_DOCUMENT_SHAPE', 'MessageRequest document is missing required fields.');
  }
  const messageRequest: MessageRequest = {
    id: snapshotId,
    fromUid: data.fromUid,
    toUid: data.toUid,
    status: data.status as MessageRequest['status'],
    createdAt: coerceTimestampToIso(data.createdAt, 'createdAt'),
    updatedAt: coerceTimestampToIso(data.updatedAt, 'updatedAt'),
  };
  if (typeof data.conversationId === 'string') messageRequest.conversationId = data.conversationId;
  return messageRequest;
}

/**
 * Reads message requests sent TO the given user.
 * `userId` must be a verified/authenticated identifier; see the note on
 * `getUserConversations`.
 */
export async function getIncomingMessageRequests(userId: string): Promise<MessageRequest[]> {
  const uid = requireId(userId, 'userId');
  const requestsQuery = query(
    collection(db, MESSAGE_REQUESTS_COLLECTION),
    where('toUid', '==', uid),
  );
  const snapshot = await safeRead(() => getDocs(requestsQuery));
  return snapshot.docs.map((docSnap: QueryDocumentSnapshot<DocumentData>) => mapMessageRequest(docSnap.id, docSnap.data()));
}

/**
 * Reads message requests sent FROM the given user.
 * `userId` must be a verified/authenticated identifier; see the note on
 * `getUserConversations`.
 */
export async function getOutgoingMessageRequests(userId: string): Promise<MessageRequest[]> {
  const uid = requireId(userId, 'userId');
  const requestsQuery = query(
    collection(db, MESSAGE_REQUESTS_COLLECTION),
    where('fromUid', '==', uid),
  );
  const snapshot = await safeRead(() => getDocs(requestsQuery));
  return snapshot.docs.map((docSnap: QueryDocumentSnapshot<DocumentData>) => mapMessageRequest(docSnap.id, docSnap.data()));
}

// ---------------------------------------------------------------------------
// Presence
// ---------------------------------------------------------------------------

function mapUserPresence(data: DocumentData | undefined, uid: string): UserPresence {
  if (!isPlainObject(data)) {
    throw new CommunicationDbError('INVALID_DOCUMENT_SHAPE', 'UserPresence document data is missing or malformed.');
  }
  if (typeof data.status !== 'string') {
    throw new CommunicationDbError('INVALID_DOCUMENT_SHAPE', 'UserPresence document is missing required fields.');
  }
  return {
    uid,
    status: data.status as UserPresence['status'],
    lastSeenAt: coerceTimestampToIso(data.lastSeenAt, 'lastSeenAt'),
  };
}

/** Reads a user's Communication Core presence document. Does not write presence. */
export async function getUserPresence(userId: string): Promise<UserPresence> {
  const uid = requireId(userId, 'userId');
  const snapshot = await safeRead(() => getDoc(doc(db, USER_PRESENCE_COLLECTION, uid)));
  if (!snapshot.exists()) {
    throw new CommunicationDbError('NOT_FOUND', `Presence for user ${uid} was not found.`);
  }
  return mapUserPresence(snapshot.data(), uid);
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

function mapNotification(snapshotId: string, data: DocumentData | undefined): Notification {
  if (!isPlainObject(data)) {
    throw new CommunicationDbError('INVALID_DOCUMENT_SHAPE', 'Notification document data is missing or malformed.');
  }
  if (
    typeof data.uid !== 'string' ||
    typeof data.type !== 'string' ||
    typeof data.title !== 'string' ||
    typeof data.body !== 'string' ||
    typeof data.read !== 'boolean'
  ) {
    throw new CommunicationDbError('INVALID_DOCUMENT_SHAPE', 'Notification document is missing required fields.');
  }
  const notification: Notification = {
    id: snapshotId,
    uid: data.uid,
    type: data.type,
    title: data.title,
    body: data.body,
    read: data.read,
    createdAt: coerceTimestampToIso(data.createdAt, 'createdAt'),
  };
  if (typeof data.relatedEntityId === 'string') notification.relatedEntityId = data.relatedEntityId;
  if (typeof data.relatedEntityType === 'string') notification.relatedEntityType = data.relatedEntityType;
  return notification;
}

/**
 * Reads notifications for the given user.
 * `userId` must be a verified/authenticated identifier; see the note on
 * `getUserConversations`.
 */
export async function getNotifications(userId: string): Promise<Notification[]> {
  const uid = requireId(userId, 'userId');
  const notificationsQuery = query(
    collection(db, NOTIFICATIONS_COLLECTION),
    where('uid', '==', uid),
  );
  const snapshot = await safeRead(() => getDocs(notificationsQuery));
  return snapshot.docs.map((docSnap: QueryDocumentSnapshot<DocumentData>) => mapNotification(docSnap.id, docSnap.data()));
}
