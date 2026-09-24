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
  | 'INVALID_METADATA';

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
 */
export function validateMetadataLength(value: unknown, fieldName: string, maxLength = MAX_METADATA_LENGTH): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') {
    throw new CommunicationValidationError('INVALID_METADATA', `${fieldName} must be a string.`);
  }
  const trimmed = value.trim();
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
export interface ValidatedMessageDraft {
  conversationId: string;
  senderId: string;
  type: CommunicationMessageType;
  text: string;
  createdAt: string;
}

/** Raw, untrusted input for a message draft (e.g. an HTTP request body). */
export interface MessageDraftInput {
  conversationId: unknown;
  type: unknown;
  text: unknown;
}

/**
 * Validates a full message draft prior to persistence.
 *
 * `authenticatedUser` must come from verified server-side authentication
 * (e.g. `req.user` set by the existing `authenticate` middleware). The
 * sender is always derived from this value; any `senderId` present on the
 * raw input is ignored.
 */
export function validateMessageDraft(input: MessageDraftInput, authenticatedUser: unknown): ValidatedMessageDraft {
  const { uid } = validateAuthenticatedUser(authenticatedUser);
  const conversationId = validateConversationId(input.conversationId);
  const type = validateMessageType(input.type);
  const text = validateMessageText(input.text);
  return {
    conversationId,
    senderId: uid,
    type,
    text,
    createdAt: serverTimestamp(),
  };
}
