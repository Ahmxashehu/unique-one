import type {
  CommunicationMessageType,
} from './src/lib/os/communication-types';

/**
 * Communication Core server-side validation foundation.
 *
 * This module provides small, reusable, framework-agnostic validation
 * helpers for the Communication Core (conversations/messages). It mirrors
 * the existing validation conventions used in `server.ts` for UniquePay
 * (small pure functions, explicit allow-lists, safe-integer/length checks).
 *
 * Scope (Step 3 — server foundation only):
 *  - Validate the authenticated user (never trust client-provided senderId).
 *  - Validate conversation IDs, user IDs, message types, and message text.
 *  - Validate request/profile metadata length limits.
 *  - Produce server-authored timestamps.
 *  - Validate a full message "draft" shape prior to persistence.
 *
 * This module intentionally does NOT implement:
 *  - Firestore reads/writes, security rules, or real-time subscriptions.
 *  - HTTP routes, WebSockets/Socket.IO, or UI.
 *  - Voice/video calls or external messaging providers.
 *  - Any UniquePay wallet/transfer/ledger logic. Communication Core stays
 *    completely separate from financial/payment operations.
 *
 * Integration note (Step 3 correction):
 * There is currently no Communication Core HTTP route in `server.ts` (no
 * messaging endpoints exist yet — by design, per the current step scope).
 * Genuine request-level enforcement of this validation therefore requires
 * an endpoint that calls `validateMessageDraft()` on an incoming request
 * body. Creating such an endpoint is explicitly out of scope for this
 * correction. This module is written so that any future endpoint can
 * import and call these functions directly (mirroring how `server.ts`
 * already calls `validateTransferRequest()` before performing wallet
 * writes), but no route wiring is added here.
 */

/** Minimal shape of an authenticated request user, as attached by existing auth middleware. */
export interface AuthenticatedUser {
  uid: string;
}

export type CommunicationErrorCode =
  | 'UNAUTHENTICATED'
  | 'INVALID_CONVERSATION_ID'
  | 'INVALID_USER_ID'
  | 'INVALID_MESSAGE_TYPE'
  | 'INVALID_MESSAGE_TEXT'
  | 'INVALID_METADATA'
  | 'INVALID_ATTACHMENT'
  | 'INVALID_REQUEST';

export class CommunicationValidationError extends Error {
  code: CommunicationErrorCode;
  constructor(code: CommunicationErrorCode, message: string) {
    super(message);
    this.name = 'CommunicationValidationError';
    this.code = code;
  }
}

const MAX_MESSAGE_TEXT_LENGTH = 4000;
const MAX_METADATA_LENGTH = 500;

const ALLOWED_MESSAGE_TYPES = new Set<CommunicationMessageType>([
  'text',
  'image',
  'file',
  'voice',
  'system',
]);

/**
 * Firebase Auth UIDs are bounded identifiers, not arbitrary Firestore paths.
 * Reused shape matches the existing `isSafeFirebaseUid` convention in server.ts.
 */
function isBoundedIdentifier(value: unknown, maxLength: number): value is string {
  return (
    typeof value === 'string' &&
    value.length >= 1 &&
    value.length <= maxLength &&
    /^[A-Za-z0-9_-]+$/.test(value)
  );
}

/**
 * Derives the sender from the verified authenticated user attached by existing
 * auth middleware (e.g. `req.user` set by `authenticate` in server.ts).
 * Never trust a client-provided senderId.
 */
export function validateAuthenticatedUser(user: unknown): AuthenticatedUser {
  if (
    !user ||
    typeof user !== 'object' ||
    typeof (user as { uid?: unknown }).uid !== 'string' ||
    !isBoundedIdentifier((user as { uid: string }).uid, 128)
  ) {
    throw new CommunicationValidationError('UNAUTHENTICATED', 'Authentication is required.');
  }
  return { uid: (user as { uid: string }).uid };
}

/** Validates a conversation ID. */
export function validateConversationId(value: unknown): string {
  if (!isBoundedIdentifier(value, 128)) {
    throw new CommunicationValidationError('INVALID_CONVERSATION_ID', 'A valid conversation ID is required.');
  }
  return value;
}

/** Validates a user ID (e.g. a conversation participant), independent of the caller's own auth. */
export function validateUserId(value: unknown): string {
  if (!isBoundedIdentifier(value, 128)) {
    throw new CommunicationValidationError('INVALID_USER_ID', 'A valid user ID is required.');
  }
  return value;
}

/** Validates a message type against the Communication Core's supported set. */
export function validateMessageType(value: unknown): CommunicationMessageType {
  if (typeof value !== 'string' || !ALLOWED_MESSAGE_TYPES.has(value as CommunicationMessageType)) {
    throw new CommunicationValidationError('INVALID_MESSAGE_TYPE', 'An unsupported message type was provided.');
  }
  return value as CommunicationMessageType;
}

/** Validates message text. Rejects empty, non-string, or overly long text. */
export function validateMessageText(value: unknown): string {
  if (typeof value !== 'string') {
    throw new CommunicationValidationError('INVALID_MESSAGE_TEXT', 'Message text must be a string.');
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new CommunicationValidationError('INVALID_MESSAGE_TEXT', 'Message text must not be empty.');
  }
  if (trimmed.length > MAX_MESSAGE_TEXT_LENGTH) {
    throw new CommunicationValidationError('INVALID_MESSAGE_TEXT', 'Message text exceeds the maximum allowed length.');
  }
  return trimmed;
}

/**
 * Validates generic request/profile metadata strings (e.g. conversation title,
 * request subject) against a shared, conservative length limit.
 *
 * Whitespace-only input is normalized to `undefined` (treated the same as
 * absent metadata) rather than accepted as an empty string.
 */
export function validateMetadataLength(value: unknown, fieldName: string, maxLength = MAX_METADATA_LENGTH): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') {
    throw new CommunicationValidationError('INVALID_METADATA', `${fieldName} must be a string.`);
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;
  if (trimmed.length > maxLength) {
    throw new CommunicationValidationError('INVALID_METADATA', `${fieldName} exceeds the maximum allowed length of ${maxLength}.`);
  }
  return trimmed;
}

/** Produces a server-authored ISO-8601 timestamp. Never trust a client-supplied timestamp. */
export function serverTimestamp(): string {
  return new Date().toISOString();
}

/** Validated shape of a message draft, ready for persistence by a future step. */
export interface ValidatedMessageAttachment {
  id: string;
  name: string;
  contentType: string;
  sizeBytes: number;
  url: string;
  storagePath: string;
}

export interface ValidatedMessageDraft {
  conversationId: string;
  senderId: string;
  type: CommunicationMessageType;
  text?: string;
  attachments?: ValidatedMessageAttachment[];
  replyToMessageId?: string;
  createdAt: string;
}

/**
 * Raw, untrusted input for a message draft (e.g. an HTTP request body).
 *
 * `senderId` is intentionally typed as `unknown` here (not omitted) so that
 * `validateMessageDraft()` can detect and explicitly reject it if a client
 * attempts to supply one. The server never derives the sender from this
 * field.
 */
export interface MessageDraftInput {
  conversationId: unknown;
  type: unknown;
  text?: unknown;
  attachments?: unknown;
  replyToMessageId?: unknown;
  senderId?: unknown;
}

/**
 * Validates a full message draft prior to persistence.
 *
 * `authenticatedUser` must come from verified server-side authentication
 * (e.g. `req.user` set by the existing `authenticate` middleware). The
 * sender is always derived exclusively from this value. If the raw input
 * includes a `senderId` field at all, the request is rejected outright
 * rather than having that field silently discarded — mirroring the
 * existing `validateTransferRequest()` convention in `server.ts`, which
 * rejects any request body containing a client-supplied `senderUid`.
 */
function validateMessageAttachments(value: unknown, senderId: string, conversationId: string): ValidatedMessageAttachment[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value) || value.length < 1 || value.length > 5) {
    throw new CommunicationValidationError('INVALID_ATTACHMENT', 'Up to 5 attachments are allowed.');
  }
  const result: ValidatedMessageAttachment[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') throw new CommunicationValidationError('INVALID_ATTACHMENT', 'Invalid attachment metadata.');
    const attachment = item as Record<string, unknown>;
    const id = attachment.id;
    const name = attachment.name;
    const contentType = attachment.contentType;
    const sizeBytes = attachment.sizeBytes;
    const url = attachment.url;
    const storagePath = attachment.storagePath;
    if (
      typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(id) ||
      typeof name !== 'string' || name.trim().length < 1 || name.length > 255 ||
      typeof contentType !== 'string' || contentType.length < 1 || contentType.length > 128 ||
      typeof sizeBytes !== 'number' || !Number.isSafeInteger(sizeBytes) || sizeBytes <= 0 || sizeBytes > 20 * 1024 * 1024 ||
      typeof url !== 'string' || url.length < 1 || url.length > 4096 ||
      typeof storagePath !== 'string' || storagePath !== `messages/${conversationId}/${senderId}/${id}.webp` && !storagePath.startsWith(`messages/${conversationId}/${senderId}/`)
    ) {
      throw new CommunicationValidationError('INVALID_ATTACHMENT', 'Invalid attachment metadata.');
    }
    if (!/^(image\/(jpeg|png|webp|gif)|application\/pdf|text\/plain|application\/msword|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document|application\/vnd\.ms-excel|application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet)$/.test(contentType)) {
      throw new CommunicationValidationError('INVALID_ATTACHMENT', 'Unsupported attachment type.');
    }
    result.push({ id, name: name.trim(), contentType, sizeBytes, url, storagePath });
  }
  return result;
}

export function validateMessageDraft(input: MessageDraftInput, authenticatedUser: unknown): ValidatedMessageDraft {
  if (typeof input !== 'object' || input === null) {
    throw new CommunicationValidationError('INVALID_REQUEST', 'The message draft payload must be a plain object.');
  }
  if (Object.prototype.hasOwnProperty.call(input, 'senderId') && input.senderId !== undefined) {
    throw new CommunicationValidationError('INVALID_REQUEST', 'senderId must not be provided by the client; it is derived from the authenticated user.');
  }
  const { uid } = validateAuthenticatedUser(authenticatedUser);
  const conversationId = validateConversationId(input.conversationId);
  const type = validateMessageType(input.type);
  const hasText = typeof input.text === 'string' && input.text.trim().length > 0;
  const text = hasText ? validateMessageText(input.text) : undefined;
  const attachments = validateMessageAttachments(input.attachments, uid, conversationId);
  if (!text && !attachments?.length) {
    throw new CommunicationValidationError('INVALID_MESSAGE_TEXT', 'Message text or an attachment is required.');
  }
  if (type === 'text' && !text) {
    throw new CommunicationValidationError('INVALID_MESSAGE_TYPE', 'Text messages require message text.');
  }
  if (type !== 'text' && !attachments?.length) {
    throw new CommunicationValidationError('INVALID_MESSAGE_TYPE', 'This message type requires an attachment.');
  }
  let replyToMessageId: string | undefined;
  if (input.replyToMessageId !== undefined && input.replyToMessageId !== null && input.replyToMessageId !== '') {
    if (!isBoundedIdentifier(input.replyToMessageId, 128)) throw new CommunicationValidationError('INVALID_REQUEST', 'replyToMessageId must be a valid message ID.');
    replyToMessageId = input.replyToMessageId;
  }
  return {
    conversationId,
    senderId: uid,
    type,
    ...(text ? { text } : {}),
    ...(attachments ? { attachments } : {}),
    ...(replyToMessageId ? { replyToMessageId } : {}),
    createdAt: serverTimestamp(),
  };
}
