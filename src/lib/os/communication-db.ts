import {
  collection,
  doc,
  documentId,
  getDoc,
  getDocs,
  limit as fbLimit,
  orderBy,
  onSnapshot,
  query,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import type {
  Conversation,
  ConversationMember,
  Message,
  MessageAttachmentMetadata,
  MessageRequest,
  Notification,
  UserPresence,
} from './communication-types';

/**
 * Communication Core Firestore data-access foundation.
 *
 * Uses the existing Firebase client app, Auth instance, and Firestore client
 * from `src/lib/firebase.ts`. All reads are one-shot reads; this module does
 * not add writes, listeners, server endpoints, or legacy-message access.
 *
 * Current-user helpers derive their UID exclusively from `auth.currentUser`.
 * They intentionally do not accept caller-provided user IDs.
 */

const CONVERSATIONS_COLLECTION = 'conversations';
const CONVERSATION_MEMBERS_COLLECTION = 'conversationMembers';
const MESSAGES_COLLECTION = 'messages';
const MESSAGE_REQUESTS_COLLECTION = 'messageRequests';
const USER_PRESENCE_COLLECTION = 'userPresence';
const NOTIFICATIONS_COLLECTION = 'notifications';

const DEFAULT_MESSAGE_LIMIT = 50;
const MAX_MESSAGE_LIMIT = 200;
const MAX_IN_QUERY_IDS = 30;

export type CommunicationDbErrorCode =
  | 'UNAUTHENTICATED'
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

function isBoundedIdentifier(value: unknown, maxLength = 128): value is string {
  return (
    typeof value === 'string'
    && value.length >= 1
    && value.length <= maxLength
    && /^[A-Za-z0-9_-]+$/.test(value)
  );
}

function requireId(value: unknown, fieldName: string): string {
  if (!isBoundedIdentifier(value)) {
    throw new CommunicationDbError('INVALID_ID', `${fieldName} must be a non-empty, bounded identifier.`);
  }
  return value;
}

/** Derives the UID from the repository's existing Firebase Auth client instance. */
function requireAuthenticatedUid(): string {
  const uid = auth.currentUser?.uid;
  if (!isBoundedIdentifier(uid)) {
    throw new CommunicationDbError('UNAUTHENTICATED', 'Authentication is required to read private Communication Core data.');
  }
  return uid;
}

async function safeRead<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (_) {
    throw new CommunicationDbError('READ_FAILED', 'Failed to read Communication Core data from Firestore.');
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function coerceTimestampToIso(value: unknown, fieldName: string): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && typeof (value as { toDate?: unknown }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  throw new CommunicationDbError('INVALID_DOCUMENT_SHAPE', `${fieldName} is missing or is not a valid timestamp.`);
}

function coerceOptionalTimestampToIso(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  return coerceTimestampToIso(value, 'optional timestamp field');
}

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
  if (typeof data.lastMessageId === 'string') conversation.lastMessageId = data.lastMessageId;
  const lastMessageAt = coerceOptionalTimestampToIso(data.lastMessageAt);
  if (lastMessageAt !== undefined) conversation.lastMessageAt = lastMessageAt;
  return conversation;
}

/** Reads one new Communication Core conversation by ID. */
export async function getConversation(conversationId: string): Promise<Conversation> {
  const uid = requireAuthenticatedUid();
  const id = requireId(conversationId, 'conversationId');
  const membershipSnapshot = await safeRead(() => getDoc(doc(db, CONVERSATION_MEMBERS_COLLECTION, `${id}_${uid}`)));
  if (!membershipSnapshot.exists()) {
    throw new CommunicationDbError('NOT_FOUND', `Conversation ${id} was not found.`);
  }
  const snapshot = await safeRead(() => getDoc(doc(db, CONVERSATIONS_COLLECTION, id)));
  if (!snapshot.exists()) {
    throw new CommunicationDbError('NOT_FOUND', `Conversation ${id} was not found.`);
  }
  return mapConversation(snapshot.id, snapshot.data());
}

function mapConversationMember(data: DocumentData | undefined): ConversationMember {
  if (!isPlainObject(data) || typeof data.conversationId !== 'string' || typeof data.uid !== 'string' || typeof data.role !== 'string') {
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

/** Reads membership records for a conversation. Firestore rules enforce membership. */
export async function getConversationMembers(conversationId: string): Promise<ConversationMember[]> {
  const uid = requireAuthenticatedUid();
  const id = requireId(conversationId, 'conversationId');
  const membershipSnapshot = await safeRead(() => getDoc(doc(db, CONVERSATION_MEMBERS_COLLECTION, `${id}_${uid}`)));
  if (!membershipSnapshot.exists()) {
    return [];
  }
  const memberQuery = query(collection(db, CONVERSATION_MEMBERS_COLLECTION), where('conversationId', '==', id));
  const snapshot = await safeRead(() => getDocs(memberQuery));
  return snapshot.docs.map((item: QueryDocumentSnapshot<DocumentData>) => mapConversationMember(item.data()));
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

/** Reads conversations for the currently authenticated Firebase user. */
export async function getUserConversations(): Promise<Conversation[]> {
  const uid = requireAuthenticatedUid();
  const memberQuery = query(collection(db, CONVERSATION_MEMBERS_COLLECTION), where('uid', '==', uid));
  const membershipSnapshot = await safeRead(() => getDocs(memberQuery));
  const conversationIds = membershipSnapshot.docs
    .map((item: QueryDocumentSnapshot<DocumentData>) => item.data().conversationId)
    .filter((value: unknown): value is string => isBoundedIdentifier(value));
  const uniqueConversationIds = Array.from(new Set(conversationIds));
  if (uniqueConversationIds.length === 0) return [];

  const conversationsById = new Map<string, Conversation>();
  const idChunks = chunkArray(uniqueConversationIds, MAX_IN_QUERY_IDS);
  for (const idChunk of idChunks) {
    const conversationsQuery = query(
      collection(db, CONVERSATIONS_COLLECTION),
      where(documentId(), 'in', idChunk),
    );
    const conversationsSnapshot = await safeRead(() => getDocs(conversationsQuery));
    for (const conversationDoc of conversationsSnapshot.docs) {
      conversationsById.set(conversationDoc.id, mapConversation(conversationDoc.id, conversationDoc.data()));
    }
  }
  return uniqueConversationIds
    .map((conversationId) => conversationsById.get(conversationId))
    .filter((conversation): conversation is Conversation => conversation !== undefined);
}

function isMessageAttachmentMetadata(value: unknown): value is MessageAttachmentMetadata {
  if (!isPlainObject(value)) return false;
  return (
    typeof value.id === 'string'
    && typeof value.name === 'string'
    && typeof value.contentType === 'string'
    && typeof value.url === 'string'
    && Number.isSafeInteger(value.sizeBytes)
    && Number(value.sizeBytes) >= 0
  );
}

function mapMessage(snapshotId: string, data: DocumentData | undefined): Message {
  if (!isPlainObject(data) || typeof data.conversationId !== 'string' || typeof data.senderId !== 'string' || typeof data.type !== 'string' || typeof data.status !== 'string') {
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
  if (Array.isArray(data.attachments)) {
    if (!data.attachments.every(isMessageAttachmentMetadata)) {
      throw new CommunicationDbError('INVALID_DOCUMENT_SHAPE', 'Message attachments contain invalid metadata.');
    }
    message.attachments = data.attachments as MessageAttachmentMetadata[];
  }
  if (typeof data.replyToMessageId === 'string') message.replyToMessageId = data.replyToMessageId;
  const updatedAt = coerceOptionalTimestampToIso(data.updatedAt);
  if (updatedAt !== undefined) message.updatedAt = updatedAt;
  return message;
}

function clampMessageLimit(requested: number | undefined): number {
  if (requested === undefined || !Number.isSafeInteger(requested) || requested <= 0) return DEFAULT_MESSAGE_LIMIT;
  return Math.min(requested, MAX_MESSAGE_LIMIT);
}

/** Subscribes to top-level Communication Core messages. Firestore rules still enforce conversation membership. */
export async function subscribeToMessagesForConversation(
  conversationId: string,
  onMessages: (messages: Message[]) => void,
  onError: (error: CommunicationDbError) => void,
  requestedLimit?: number,
): () => void {
  const uid = requireAuthenticatedUid();
  const id = requireId(conversationId, 'conversationId');
  const membershipSnapshot = await safeRead(() => getDoc(doc(db, CONVERSATION_MEMBERS_COLLECTION, `${id}_${uid}`)));
  if (!membershipSnapshot.exists()) {
    onMessages([]);
    onError(new CommunicationDbError('NOT_FOUND', `Conversation ${id} was not found.`));
    return () => undefined;
  }
  const messageQuery = query(
    collection(db, MESSAGES_COLLECTION),
    where('conversationId', '==', id),
    orderBy('createdAt', 'asc'),
    fbLimit(clampMessageLimit(requestedLimit)),
  );
  return onSnapshot(messageQuery, (snapshot) => {
    try {
      onMessages(snapshot.docs.map((item: QueryDocumentSnapshot<DocumentData>) => mapMessage(item.id, item.data())));
    } catch (error) {
      onError(error instanceof CommunicationDbError ? error : new CommunicationDbError('INVALID_DOCUMENT_SHAPE', 'A message document is malformed.'));
    }
  }, (error) => {
    console.error('Communication message subscription failed:', error);
    onError(new CommunicationDbError('READ_FAILED', 'Failed to receive live Communication messages.'));
  });
}

/** Reads top-level Communication Core messages, never legacy nested messages. */
export async function getMessagesForConversation(conversationId: string, limit?: number): Promise<Message[]> {
  const uid = requireAuthenticatedUid();
  const id = requireId(conversationId, 'conversationId');
  const membershipSnapshot = await safeRead(() => getDoc(doc(db, CONVERSATION_MEMBERS_COLLECTION, `${id}_${uid}`)));
  if (!membershipSnapshot.exists()) {
    return [];
  }
  const messageQuery = query(
    collection(db, MESSAGES_COLLECTION),
    where('conversationId', '==', id),
    orderBy('createdAt', 'asc'),
    fbLimit(clampMessageLimit(limit)),
  );
  const snapshot = await safeRead(() => getDocs(messageQuery));
  return snapshot.docs.map((item: QueryDocumentSnapshot<DocumentData>) => mapMessage(item.id, item.data()));
}

/** Reads a message from the top-level Communication Core messages collection. */
export async function getMessage(messageId: string): Promise<Message> {
  const uid = requireAuthenticatedUid();
  const id = requireId(messageId, 'messageId');
  const snapshot = await safeRead(() => getDoc(doc(db, MESSAGES_COLLECTION, id)));
  if (!snapshot.exists()) {
    throw new CommunicationDbError('NOT_FOUND', `Message ${id} was not found.`);
  }
  const message = mapMessage(snapshot.id, snapshot.data());
  const membershipSnapshot = await safeRead(() => getDoc(doc(db, CONVERSATION_MEMBERS_COLLECTION, `${message.conversationId}_${uid}`)));
  if (!membershipSnapshot.exists()) {
    throw new CommunicationDbError('NOT_FOUND', `Message ${id} was not found.`);
  }
  return message;
}

function mapMessageRequest(snapshotId: string, data: DocumentData | undefined): MessageRequest {
  if (!isPlainObject(data) || typeof data.fromUid !== 'string' || typeof data.toUid !== 'string' || typeof data.status !== 'string') {
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

/** Reads message requests addressed to the currently authenticated user. */
export async function getIncomingMessageRequests(): Promise<MessageRequest[]> {
  const uid = requireAuthenticatedUid();
  const requestsQuery = query(collection(db, MESSAGE_REQUESTS_COLLECTION), where('toUid', '==', uid));
  const snapshot = await safeRead(() => getDocs(requestsQuery));
  return snapshot.docs.map((item: QueryDocumentSnapshot<DocumentData>) => mapMessageRequest(item.id, item.data()));
}

/** Reads message requests sent by the currently authenticated user. */
export async function getOutgoingMessageRequests(): Promise<MessageRequest[]> {
  const uid = requireAuthenticatedUid();
  const requestsQuery = query(collection(db, MESSAGE_REQUESTS_COLLECTION), where('fromUid', '==', uid));
  const snapshot = await safeRead(() => getDocs(requestsQuery));
  return snapshot.docs.map((item: QueryDocumentSnapshot<DocumentData>) => mapMessageRequest(item.id, item.data()));
}

function mapUserPresence(data: DocumentData | undefined, uid: string): UserPresence {
  if (!isPlainObject(data) || typeof data.status !== 'string') {
    throw new CommunicationDbError('INVALID_DOCUMENT_SHAPE', 'UserPresence document is missing required fields.');
  }
  return {
    uid,
    status: data.status as UserPresence['status'],
    lastSeenAt: coerceTimestampToIso(data.lastSeenAt, 'lastSeenAt'),
  };
}

/** Reads presence only for the currently authenticated user. */
export async function getUserPresence(): Promise<UserPresence> {
  const uid = requireAuthenticatedUid();
  const snapshot = await safeRead(() => getDoc(doc(db, USER_PRESENCE_COLLECTION, uid)));
  if (!snapshot.exists()) {
    throw new CommunicationDbError('NOT_FOUND', 'Presence for the authenticated user was not found.');
  }
  return mapUserPresence(snapshot.data(), uid);
}

function mapNotification(snapshotId: string, data: DocumentData | undefined): Notification {
  if (!isPlainObject(data) || typeof data.uid !== 'string' || typeof data.type !== 'string' || typeof data.title !== 'string' || typeof data.body !== 'string' || typeof data.read !== 'boolean') {
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

/** Reads notifications only for the currently authenticated user. */
export async function getNotifications(): Promise<Notification[]> {
  const uid = requireAuthenticatedUid();
  const notificationsQuery = query(collection(db, NOTIFICATIONS_COLLECTION), where('uid', '==', uid));
  const snapshot = await safeRead(() => getDocs(notificationsQuery));
  return snapshot.docs.map((item: QueryDocumentSnapshot<DocumentData>) => mapNotification(item.id, item.data()));
}
