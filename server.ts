import express, { Request, Response, NextFunction } from "express";
import http from "http";
import { createHash, randomUUID } from "crypto";
import path from "path";
import { createServer as createViteServer } from "vite";
import rateLimit, { ipKeyGenerator, type Store } from "express-rate-limit";
import { initializeApp, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import type { Conversation, ConversationMember, ConversationType, Message, MessageRequest } from "./src/lib/os/communication-types";
import { validateMessageDraft, CommunicationValidationError } from "./communicationCore";
import { generateUniqueAiResponse, UniqueAiValidationError } from "./src/lib/ai/uniqueAiService";
import { registerIdentityVerificationRoutes } from "./src/server/identityVerificationRoutes";
import { registerAjoRoutes } from "./src/server/ajoRoutes";

interface WalletDocument {
  uid: string;
  currency: string;
  availableBalanceMinor: number;
  status: 'active' | 'suspended' | 'locked';
  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
}

type TransferErrorCode =
  | 'UNAUTHENTICATED' | 'INVALID_REQUEST' | 'INVALID_RECIPIENT' | 'RECIPIENT_NOT_FOUND'
  | 'SELF_TRANSFER_NOT_ALLOWED' | 'INVALID_AMOUNT' | 'INVALID_CURRENCY'
  | 'INVALID_IDEMPOTENCY_KEY' | 'IDEMPOTENCY_KEY_CONFLICT' | 'TRANSFER_ALREADY_COMPLETED'
  | 'TRANSFER_IN_PROGRESS' | 'WALLET_NOT_FOUND' | 'WALLET_UNAVAILABLE' | 'INSUFFICIENT_FUNDS' | 'RATE_LIMITED'
  | 'TRANSACTION_FAILED' | 'SERVICE_UNAVAILABLE' | 'NOT_FOUND' | 'BLOCKED' | 'FORBIDDEN' | 'INSUFFICIENT_STOCK';
interface TransferErrorResponse { error: { code: TransferErrorCode; message: string } }
interface TransferRequestInput { recipientId: string; amountMinor: number; currency: 'NGN'; idempotencyKey: string; description?: string }
interface CreateConversationRequestInput { type: ConversationType; title?: string; avatarUrl?: string; memberUids: string[] }
const WALLET_CURRENCY = 'NGN';
const WALLET_STATUSES = new Set<WalletDocument['status']>(['active', 'suspended', 'locked']);
const MAX_DESCRIPTION_LENGTH = 500;
const MAX_IDEMPOTENCY_KEY_LENGTH = 128;
const MAX_CONVERSATION_TITLE_LENGTH = 500;
const MAX_CONVERSATION_AVATAR_URL_LENGTH = 2048;
const MAX_CONVERSATION_MEMBER_COUNT = 50;
const CONVERSATION_CREATE_WINDOW_MS = 60_000;
const MAX_CONVERSATION_CREATES_PER_WINDOW = 10;
const COMMUNICATION_CONVERSATION_TYPES = new Set<ConversationType>(['direct', 'group', 'business']);
const transferErrorStatus: Record<TransferErrorCode, number> = {
  UNAUTHENTICATED: 401, INVALID_REQUEST: 400, INVALID_RECIPIENT: 400, RECIPIENT_NOT_FOUND: 404,
  SELF_TRANSFER_NOT_ALLOWED: 400, INVALID_AMOUNT: 400, INVALID_CURRENCY: 400, INVALID_IDEMPOTENCY_KEY: 400,
  IDEMPOTENCY_KEY_CONFLICT: 409, TRANSFER_ALREADY_COMPLETED: 200, TRANSFER_IN_PROGRESS: 409, RATE_LIMITED: 429,
  WALLET_NOT_FOUND: 404, WALLET_UNAVAILABLE: 403, INSUFFICIENT_FUNDS: 409, TRANSACTION_FAILED: 500,
  SERVICE_UNAVAILABLE: 503, NOT_FOUND: 404, BLOCKED: 403, FORBIDDEN: 403, INSUFFICIENT_STOCK: 409,
};
class RequestValidationError extends Error {
  code: 'UNAUTHENTICATED' | 'INVALID_REQUEST';
  constructor(code: 'UNAUTHENTICATED' | 'INVALID_REQUEST', message: string) {
    super(message);
    this.name = 'RequestValidationError';
    this.code = code;
  }
}
if (getApps().length === 0) initializeApp({
  projectId: "unique-one-9731b",
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "unique-one-9731b.firebasestorage.app",
});
const FIRESTORE_DATABASE_ID = process.env.FIRESTORE_DATABASE_ID || "(default)";
const adminDb = getFirestore(FIRESTORE_DATABASE_ID);
function errorResponse(res: Response, code: TransferErrorCode, message: string, statusOverride?: number) {
  return res.status(statusOverride ?? transferErrorStatus[code] ?? 500).json({ error: { code, message } });
}
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function sanitizeDescription(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') throw new Error('INVALID_REQUEST');
  const trimmed = value.trim();
  if (trimmed.length > MAX_DESCRIPTION_LENGTH) throw new Error('INVALID_REQUEST');
  return trimmed;
}
function isSafeTransferAmount(amount: unknown): amount is number {
  return typeof amount === 'number' && Number.isInteger(amount) && Number.isSafeInteger(amount) && amount > 0;
}
function isSafeIdempotencyKey(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= MAX_IDEMPOTENCY_KEY_LENGTH && /^[A-Za-z0-9._:-]+$/.test(value.trim());
}
// Firebase Auth UIDs are bounded identifiers, not arbitrary Firestore paths.
function isSafeFirebaseUid(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 1 && value.length <= 128 && /^[A-Za-z0-9_-]+$/.test(value);
}
function isSafeConversationId(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 1 && value.length <= 128 && /^[A-Za-z0-9_-]+$/.test(value);
}
function buildRequestFingerprint(senderUid: string, recipientId: string, amountMinor: number, currency: string, description?: string) {
  return [senderUid, recipientId, String(amountMinor), currency, description ?? ''].join('|');
}
function validateWalletDocument(data: FirebaseFirestore.DocumentData | undefined, uid: string): WalletDocument {
  if (!data || data.uid !== uid) throw new Error('Invalid wallet: document UID does not match authenticated user');
  if (!Number.isSafeInteger(data.availableBalanceMinor) || data.availableBalanceMinor < 0) {
    throw new Error('Invalid wallet: availableBalanceMinor must be a non-negative safe integer');
  }
  if (data.currency !== WALLET_CURRENCY) throw new Error(`Invalid wallet: currency must be ${WALLET_CURRENCY}`);
  if (typeof data.status !== 'string' || !WALLET_STATUSES.has(data.status as WalletDocument['status'])) throw new Error('Invalid wallet: status is not supported');
  if (!(data.createdAt instanceof Timestamp) || !(data.updatedAt instanceof Timestamp)) throw new Error('Invalid wallet: timestamps are required');
  return data as WalletDocument;
}
async function ensureWalletForUser(uid: string): Promise<WalletDocument> {
  if (!uid || typeof uid !== 'string') throw new Error('Invalid authenticated UID');
  const walletRef = adminDb.collection('wallets').doc(uid);
  return adminDb.runTransaction(async transaction => {
    const walletSnapshot = await transaction.get(walletRef);
    if (walletSnapshot.exists) return validateWalletDocument(walletSnapshot.data(), uid);
    const now = Timestamp.now();
    const wallet: WalletDocument = { uid, currency: WALLET_CURRENCY, availableBalanceMinor: 0, status: 'active', createdAt: now, updatedAt: now };
    transaction.create(walletRef, wallet);
    return wallet;
  });
}
function validateTransferRequest(body: unknown, senderUid: string): TransferRequestInput {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('INVALID_REQUEST');
  const payload = body as Record<string, unknown>;
  const allowedKeys = new Set(['recipientId', 'amountMinor', 'currency', 'idempotencyKey', 'description', 'senderUid']);
  for (const key of Object.keys(payload)) if (!allowedKeys.has(key)) throw new Error('INVALID_REQUEST');
  if ('senderUid' in payload) throw new Error('INVALID_REQUEST');
  if (typeof payload.recipientId !== 'string') throw new Error('INVALID_RECIPIENT');
  const recipientId = payload.recipientId.trim();
  if (!isSafeFirebaseUid(recipientId)) throw new Error('INVALID_RECIPIENT');
  if (recipientId === senderUid) throw new Error('SELF_TRANSFER_NOT_ALLOWED');
  if (!isSafeTransferAmount(payload.amountMinor)) throw new Error('INVALID_AMOUNT');
  if (payload.currency !== WALLET_CURRENCY) throw new Error('INVALID_CURRENCY');
  if (!isSafeIdempotencyKey(payload.idempotencyKey)) throw new Error('INVALID_IDEMPOTENCY_KEY');
  const description = sanitizeDescription(payload.description);
  return { recipientId, amountMinor: payload.amountMinor, currency: 'NGN', idempotencyKey: payload.idempotencyKey.trim(), description };
}
function sanitizeRequiredAuthUid(value: unknown): string {
  if (!isSafeFirebaseUid(value)) {
    throw new RequestValidationError('UNAUTHENTICATED', 'Missing authenticated user.');
  }
  return value;
}
function sanitizeOptionalConversationText(value: unknown, fieldName: 'title' | 'avatarUrl', maxLength: number): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') {
    throw new RequestValidationError('INVALID_REQUEST', `${fieldName} must be a string when provided.`);
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new RequestValidationError('INVALID_REQUEST', `${fieldName} must not be empty.`);
  }
  if (trimmed.length > maxLength) {
    throw new RequestValidationError('INVALID_REQUEST', `${fieldName} exceeds the maximum allowed length of ${maxLength}.`);
  }
  return trimmed;
}