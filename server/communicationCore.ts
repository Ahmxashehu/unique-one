import type { Request } from "express";
import { Timestamp } from "firebase-admin/firestore";

export const COMMUNICATION_ID_MAX_LENGTH = 128;
export const COMMUNICATION_MESSAGE_TEXT_MAX_LENGTH = 4000;
export const COMMUNICATION_REQUEST_TEXT_MAX_LENGTH = 500;
export const COMMUNICATION_DISPLAY_NAME_MAX_LENGTH = 120;
export const COMMUNICATION_AVATAR_URL_MAX_LENGTH = 2048;

export const COMMUNICATION_MESSAGE_TYPES = ["text", "system"] as const;

export type CommunicationMessageType = typeof COMMUNICATION_MESSAGE_TYPES[number];

export type CommunicationValidationErrorCode =
  | "UNAUTHENTICATED"
  | "INVALID_PAYLOAD"
  | "INVALID_CONVERSATION_ID"
  | "INVALID_USER_ID"
  | "INVALID_MESSAGE_TYPE"
  | "INVALID_MESSAGE_TEXT"
  | "INVALID_REQUEST_TEXT"
  | "INVALID_DISPLAY_NAME"
  | "INVALID_AVATAR_URL"
  | "INVALID_TIMESTAMP";

export interface AuthenticatedCommunicationRequest extends Request {
  user?: {
    uid?: unknown;
  };
}

export interface CommunicationMessageDraftInput {
  conversationId: unknown;
  senderId?: unknown;
  type?: unknown;
  text: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
  sentAt?: unknown;
}

export interface ValidatedCommunicationMessageInput {
  conversationId: string;
  senderId: string;
  type: CommunicationMessageType;
  text: string;
}

export interface CommunicationProfileMetadataInput {
  displayName?: unknown;
  avatarUrl?: unknown;
}

export interface ValidatedCommunicationProfileMetadata {
  displayName?: string;
  avatarUrl?: string;
}

export class CommunicationValidationError extends Error {
  readonly code: CommunicationValidationErrorCode;
  readonly field?: string;

  constructor(code: CommunicationValidationErrorCode, message: string, field?: string) {
    super(message);
    this.name = "CommunicationValidationError";
    this.code = code;
    this.field = field;
  }
}

function createValidationError(code: CommunicationValidationErrorCode, message: string, field?: string): never {
  throw new CommunicationValidationError(code, message, field);
}

function isSafeBoundedIdentifier(value: string): boolean {
  return value.length > 0
    && value.length <= COMMUNICATION_ID_MAX_LENGTH
    && /^[A-Za-z0-9_-]+$/.test(value);
}

function normalizeOptionalText(value: unknown, maxLength: number, code: CommunicationValidationErrorCode, field: string): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") createValidationError(code, `${field} must be a string.`, field);
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > maxLength) {
    createValidationError(code, `${field} must be between 1 and ${maxLength} characters.`, field);
  }
  return trimmed;
}

export function validateCommunicationConversationId(value: unknown, field = "conversationId"): string {
  if (typeof value !== "string") createValidationError("INVALID_CONVERSATION_ID", `${field} must be a string.`, field);
  const trimmed = value.trim();
  if (!isSafeBoundedIdentifier(trimmed)) {
    createValidationError("INVALID_CONVERSATION_ID", `${field} must be a safe non-empty identifier no longer than ${COMMUNICATION_ID_MAX_LENGTH} characters.`, field);
  }
  return trimmed;
}

export function validateCommunicationUserId(value: unknown, field = "userId"): string {
  if (typeof value !== "string") createValidationError("INVALID_USER_ID", `${field} must be a string.`, field);
  const trimmed = value.trim();
  if (!isSafeBoundedIdentifier(trimmed)) {
    createValidationError("INVALID_USER_ID", `${field} must be a safe non-empty identifier no longer than ${COMMUNICATION_ID_MAX_LENGTH} characters.`, field);
  }
  return trimmed;
}

export function requireAuthenticatedCommunicationUser(request: AuthenticatedCommunicationRequest): string {
  const uid = request.user?.uid;
  if (typeof uid !== "string" || uid.trim().length === 0) {
    createValidationError("UNAUTHENTICATED", "Authentication is required for communication operations.", "user");
  }
  return validateCommunicationUserId(uid, "user.uid");
}

export function validateCommunicationMessageType(value: unknown): CommunicationMessageType {
  const normalized = value === undefined ? "text" : value;
  if (typeof normalized !== "string" || !COMMUNICATION_MESSAGE_TYPES.includes(normalized as CommunicationMessageType)) {
    createValidationError("INVALID_MESSAGE_TYPE", `message type must be one of: ${COMMUNICATION_MESSAGE_TYPES.join(", ")}.`, "type");
  }
  return normalized as CommunicationMessageType;
}

export function validateCommunicationMessageText(value: unknown, field = "text"): string {
  if (typeof value !== "string") createValidationError("INVALID_MESSAGE_TEXT", `${field} must be a string.`, field);
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > COMMUNICATION_MESSAGE_TEXT_MAX_LENGTH) {
    createValidationError("INVALID_MESSAGE_TEXT", `${field} must be between 1 and ${COMMUNICATION_MESSAGE_TEXT_MAX_LENGTH} characters.`, field);
  }
  return trimmed;
}

export function validateCommunicationRequestText(value: unknown, field = "requestText"): string {
  if (typeof value !== "string") createValidationError("INVALID_REQUEST_TEXT", `${field} must be a string.`, field);
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > COMMUNICATION_REQUEST_TEXT_MAX_LENGTH) {
    createValidationError("INVALID_REQUEST_TEXT", `${field} must be between 1 and ${COMMUNICATION_REQUEST_TEXT_MAX_LENGTH} characters.`, field);
  }
  return trimmed;
}

export function validateCommunicationProfileMetadata(input: CommunicationProfileMetadataInput): ValidatedCommunicationProfileMetadata {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    createValidationError("INVALID_PAYLOAD", "profile metadata must be an object.", "metadata");
  }
  return {
    displayName: normalizeOptionalText(input.displayName, COMMUNICATION_DISPLAY_NAME_MAX_LENGTH, "INVALID_DISPLAY_NAME", "displayName"),
    avatarUrl: normalizeOptionalText(input.avatarUrl, COMMUNICATION_AVATAR_URL_MAX_LENGTH, "INVALID_AVATAR_URL", "avatarUrl"),
  };
}

export function validateCommunicationTimestamp(value: unknown, field = "timestamp"): Date | Timestamp {
  if (value instanceof Timestamp) return value;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  createValidationError("INVALID_TIMESTAMP", `${field} must be a valid Date or Firestore Timestamp.`, field);
}

export function assertServerAuthoredTimestamp(input: CommunicationMessageDraftInput): void {
  for (const field of ["createdAt", "updatedAt", "sentAt"] as const) {
    if (input[field] !== undefined && input[field] !== null) {
      createValidationError("INVALID_TIMESTAMP", `${field} must be generated by the server.`, field);
    }
  }
}

export function createCommunicationServerTimestamps() {
  const now = Timestamp.now();
  return { createdAt: now, updatedAt: now };
}

export function validateCommunicationMessageDraft(
  input: CommunicationMessageDraftInput,
  request: AuthenticatedCommunicationRequest,
): ValidatedCommunicationMessageInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    createValidationError("INVALID_PAYLOAD", "message payload must be an object.", "body");
  }

  assertServerAuthoredTimestamp(input);

  return {
    conversationId: validateCommunicationConversationId(input.conversationId),
    senderId: requireAuthenticatedCommunicationUser(request),
    type: validateCommunicationMessageType(input.type),
    text: validateCommunicationMessageText(input.text),
  };
}
