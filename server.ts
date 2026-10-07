import express, { Request, Response, NextFunction } from "express";
import http from "http";
import { createHash, randomUUID } from "crypto";
import path from "path";
import { createServer as createViteServer } from "vite";
import rateLimit, { ipKeyGenerator, type Store } from "express-rate-limit";
import { applicationDefault, cert, initializeApp, getApps } from "firebase-admin/app";
import { getAuth, type UserRecord } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import type { Conversation, ConversationMember, ConversationType, Message, MessageRequest } from "./src/lib/os/communication-types";
import { validateMessageDraft, CommunicationValidationError } from "./communicationCore";
import { generatePublicUniqueAiResponse, generateUniqueAiResponse, UniqueAiValidationError } from "./src/lib/ai/uniqueAiService";
import { getLiveDiscoveryContext } from "./src/lib/ai/aiTools";
import { registerIdentityVerificationRoutes } from "./src/server/identityVerificationRoutes";
import { registerAjoRoutes } from "./src/server/ajoRoutes";
import { registerUniqueShareRoutes } from "./src/server/uniqueShareRoutes";
import { getTransactionAuthPolicy } from "./src/server/transactionAuthPolicy";
import { registerAdminRbacRoutes } from "./src/server/adminRbacRoutes";
import { registerAdminAuditRoutes } from "./src/server/adminAuditRoutes";
import { hasRolePermission } from "./src/lib/auth/rbac";
import { executeFinancialRefund } from "./src/server/financialRefundService";

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
  | 'TRANSACTION_FAILED' | 'SERVICE_UNAVAILABLE' | 'UNAVAILABLE' | 'NOT_FOUND' | 'BLOCKED' | 'FORBIDDEN' | 'INSUFFICIENT_STOCK' | 'BIOMETRIC_REQUIRED';
interface TransferErrorResponse { error: { code: TransferErrorCode; message: string } }
interface TransferRequestInput { recipientId: string; amountMinor: number; currency: 'NGN'; idempotencyKey: string; description?: string; transactionPin: string }
interface CreateConversationRequestInput { type: ConversationType; title?: string; avatarUrl?: string; memberUids: string[] }
const WALLET_CURRENCY = 'NGN';
const WALLET_STATUSES = new Set<WalletDocument['status']>(['active', 'suspended', 'locked']);
const MAX_DESCRIPTION_LENGTH = 500;
const MAX_IDEMPOTENCY_KEY_LENGTH = 128;
const MAX_CONVERSATION_TITLE_LENGTH = 500;
const MAX_CONVERSATION_AVATAR_URL_LENGTH = 2048;
const MAX_CONVERSATION_MEMBER_COUNT = 50;
const PASSKEY_CHALLENGE_TTL_MS = 5 * 60_000;
const PASSKEY_COLLECTION = 'passkeys';
const PASSKEY_CHALLENGES_COLLECTION = 'passkeyChallenges';
const CONVERSATION_CREATE_WINDOW_MS = 60_000;
const MAX_CONVERSATION_CREATES_PER_WINDOW = 10;
const COMMUNICATION_CONVERSATION_TYPES = new Set<ConversationType>(['direct', 'group', 'business']);
const transferErrorStatus: Record<TransferErrorCode, number> = {
  UNAUTHENTICATED: 401, INVALID_REQUEST: 400, INVALID_RECIPIENT: 400, RECIPIENT_NOT_FOUND: 404,
  SELF_TRANSFER_NOT_ALLOWED: 400, INVALID_AMOUNT: 400, INVALID_CURRENCY: 400, INVALID_IDEMPOTENCY_KEY: 400,
  IDEMPOTENCY_KEY_CONFLICT: 409, TRANSFER_ALREADY_COMPLETED: 200, TRANSFER_IN_PROGRESS: 409, RATE_LIMITED: 429, BIOMETRIC_REQUIRED: 403,
  WALLET_NOT_FOUND: 404, WALLET_UNAVAILABLE: 403, INSUFFICIENT_FUNDS: 409, TRANSACTION_FAILED: 500,
  SERVICE_UNAVAILABLE: 503, UNAVAILABLE: 503, NOT_FOUND: 404, BLOCKED: 403, FORBIDDEN: 403, INSUFFICIENT_STOCK: 409,
};
class RequestValidationError extends Error {
  code: TransferErrorCode;
  constructor(code: TransferErrorCode, message: string) {
    super(message);
    this.name = 'RequestValidationError';
    this.code = code;
  }
}
function getFirebaseAdminCredential() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) return applicationDefault();

  try {
    const serviceAccount = JSON.parse(raw) as {
      project_id?: unknown;
      client_email?: unknown;
      private_key?: unknown;
    };
    if (
      typeof serviceAccount.project_id !== "string" ||
      typeof serviceAccount.client_email !== "string" ||
      typeof serviceAccount.private_key !== "string"
    ) {
      throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is missing required service-account fields.");
    }
    return cert({
      projectId: serviceAccount.project_id,
      clientEmail: serviceAccount.client_email,
      privateKey: serviceAccount.private_key,
    });
  } catch (error) {
    throw new Error(
      `Invalid FIREBASE_SERVICE_ACCOUNT_JSON: ${error instanceof Error ? error.message : "unable to parse credential"}`,
    );
  }
}

if (getApps().length === 0) initializeApp({
  credential: getFirebaseAdminCredential(),
  projectId: "unique-one-9731b",
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "unique-one-9731b.firebasestorage.app",
});
const FIRESTORE_DATABASE_ID = process.env.FIRESTORE_DATABASE_ID || "(default)";
const adminDb = getFirestore(FIRESTORE_DATABASE_ID);
function errorResponse(res: Response, code: TransferErrorCode, message: string, statusOverride?: number) {
  return res.status(statusOverride ?? transferErrorStatus[code] ?? 500).json({ error: { code, message } });
}

function normalizeAuthPhone(value: unknown): string {
  if (typeof value !== 'string') throw new RequestValidationError('INVALID_REQUEST', 'Phone number is required.');
  const trimmed = value.trim().replace(/[\s()-]/g, '');
  const normalized = trimmed.startsWith('+') ? trimmed : /^0\d{10}$/.test(trimmed) ? `+234${trimmed.slice(1)}` : trimmed;
  if (!/^\+\d{8,15}$/.test(normalized)) throw new RequestValidationError('INVALID_REQUEST', 'Enter a valid phone number.');
  return normalized;
}
const WEAK_LOGIN_PASSWORDS = new Set(['000000','111111','222222','333333','444444','555555','666666','777777','888888','999999','123456','654321','121212','212121','112233','123123']);
function validateLoginPassword(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{6}$/.test(value) || WEAK_LOGIN_PASSWORDS.has(value)) throw new RequestValidationError('INVALID_REQUEST', 'Your login password must be exactly 6 digits and cannot be an obvious weak pattern.');
  const digits = value.split('').map(Number);
  const ascending = digits.every((digit,index)=>index===0||digit===digits[index-1]+1);
  const descending = digits.every((digit,index)=>index===0||digit===digits[index-1]-1);
  if (ascending || descending) throw new RequestValidationError('INVALID_REQUEST', 'Choose a Login PIN that is not an obvious sequence.');
  return value;
}
function passwordDigest(password: string, salt: string): string {
  return require('crypto').scryptSync(password, salt, 64).toString('hex');
}
function base64UrlToBuffer(value: string): Buffer {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(normalized + '='.repeat((4 - normalized.length % 4) % 4), 'base64');
}
function bufferToBase64Url(value: Buffer): string {
  return value.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}
function requestWebAuthnOrigin(req: Request): { origin: string; rpId: string } {
  const host = req.hostname;
  if (!host || !/^[A-Za-z0-9.-]+$/.test(host)) throw new Error('INVALID_REQUEST');
  return { origin: req.protocol + '://' + host, rpId: host };
}
function passwordDigestMatches(value: string, salt: string, expectedHex: string): boolean {
  const crypto = require('crypto');
  const actual = crypto.scryptSync(value, salt, 64);
  const expected = Buffer.from(expectedHex, 'hex');
  return expected.length === actual.length && crypto.timingSafeEqual(actual, expected);
}
const WEAK_TRANSACTION_PINS = new Set(['0000','1111','2222','3333','4444','5555','6666','7777','8888','9999','1234','4321','1212','2121']);
function validateTransactionPin(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}$/.test(value)) {
    throw new RequestValidationError('INVALID_REQUEST', 'Your Transaction PIN must be exactly 4 digits.');
  }
  if (WEAK_TRANSACTION_PINS.has(value)) {
    throw new RequestValidationError('INVALID_REQUEST', 'Choose a Transaction PIN that is not an obvious or common pattern.');
  }
  const digits = value.split('').map(Number);
  if (digits.every((digit, index) => index === 0 || digit === digits[0])) {
    throw new RequestValidationError('INVALID_REQUEST', 'Choose a Transaction PIN that is not an obvious repeated pattern.');
  }
  const ascending = digits.every((digit, index) => index === 0 || digit === digits[index - 1] + 1);
  const descending = digits.every((digit, index) => index === 0 || digit === digits[index - 1] - 1);
  if (ascending || descending) {
    throw new RequestValidationError('INVALID_REQUEST', 'Choose a Transaction PIN that is not an obvious sequence.');
  }
  return value;
}
async function verifyTransactionPin(uid: string, pin: unknown): Promise<boolean> {
  const credential = await adminDb.collection('authCredentials').doc(uid).get();
  if (!credential.exists) return false;
  const data = credential.data() as { transactionPinSalt?: unknown; transactionPinHash?: unknown } | undefined;
  if (typeof data?.transactionPinSalt !== 'string' || typeof data.transactionPinHash !== 'string') return false;
  return passwordDigestMatches(String(pin), data.transactionPinSalt, data.transactionPinHash);
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
  const allowedKeys = new Set(['recipientId', 'amountMinor', 'currency', 'idempotencyKey', 'description', 'senderUid', 'transactionPin']);
  for (const key of Object.keys(payload)) if (!allowedKeys.has(key)) throw new Error('INVALID_REQUEST');
  if ('senderUid' in payload) throw new Error('INVALID_REQUEST');
  const transactionPin = validateTransactionPin(payload.transactionPin);
  if (typeof payload.recipientId !== 'string') throw new Error('INVALID_RECIPIENT');
  const recipientId = payload.recipientId.trim();
  if (!isSafeFirebaseUid(recipientId)) throw new Error('INVALID_RECIPIENT');
  if (recipientId === senderUid) throw new Error('SELF_TRANSFER_NOT_ALLOWED');
  if (!isSafeTransferAmount(payload.amountMinor)) throw new Error('INVALID_AMOUNT');
  if (payload.currency !== WALLET_CURRENCY) throw new Error('INVALID_CURRENCY');
  if (!isSafeIdempotencyKey(payload.idempotencyKey)) throw new Error('INVALID_IDEMPOTENCY_KEY');
  const description = sanitizeDescription(payload.description);
  return { recipientId, amountMinor: payload.amountMinor, currency: 'NGN', idempotencyKey: payload.idempotencyKey.trim(), description, transactionPin };
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
function conversationMemberDocumentId(conversationId: string, uid: string) {
  return `${conversationId}_${uid}`;
}
function validateConversationMemberCount(type: ConversationType, memberUids: string[]) {
  switch (type) {
    case 'direct':
      if (memberUids.length !== 2) {
        throw new RequestValidationError('INVALID_REQUEST', 'direct conversations must include exactly two unique members.');
      }
      return;
    case 'group':
      if (memberUids.length < 2 || memberUids.length > MAX_CONVERSATION_MEMBER_COUNT) {
        throw new RequestValidationError('INVALID_REQUEST', 'group conversations must include between 2 and 50 unique members.');
      }
      return;
    case 'business':
      if (memberUids.length < 2 || memberUids.length > MAX_CONVERSATION_MEMBER_COUNT) {
        throw new RequestValidationError('INVALID_REQUEST', 'business conversations must include between 2 and 50 unique members.');
      }
      return;
  }
}
function validateCreateConversationRequest(body: unknown, creatorUid: string): CreateConversationRequestInput {
  if (!isPlainObject(body)) {
    throw new RequestValidationError('INVALID_REQUEST', 'The conversation request body must be a plain object.');
  }
  const payload = body as Record<string, unknown>;
  const forbiddenKeys = new Set(['creatorId', 'ownerId', 'createdBy', 'createdAt', 'updatedAt', 'status', 'role', 'roles', 'membershipRole', 'membershipRoles', 'conversationId']);
  for (const key of Object.keys(payload)) {
    if (forbiddenKeys.has(key)) {
      throw new RequestValidationError('INVALID_REQUEST', `${key} must not be provided by the client.`);
    }
  }
  const allowedKeys = new Set(['type', 'title', 'avatarUrl', 'memberUids']);
  for (const key of Object.keys(payload)) {
    if (!allowedKeys.has(key)) {
      throw new RequestValidationError('INVALID_REQUEST', `Unsupported field: ${key}.`);
    }
  }
  if (typeof payload.type !== 'string' || !COMMUNICATION_CONVERSATION_TYPES.has(payload.type as ConversationType)) {
    throw new RequestValidationError('INVALID_REQUEST', 'type must be one of: direct, group, business.');
  }
  const title = sanitizeOptionalConversationText(payload.title, 'title', MAX_CONVERSATION_TITLE_LENGTH);
  const avatarUrl = sanitizeOptionalConversationText(payload.avatarUrl, 'avatarUrl', MAX_CONVERSATION_AVATAR_URL_LENGTH);
  if (payload.memberUids !== undefined && !Array.isArray(payload.memberUids)) {
    throw new RequestValidationError('INVALID_REQUEST', 'memberUids must be an array of Firebase UIDs when provided.');
  }
  const memberUidSet = new Set<string>([creatorUid]);
  if (Array.isArray(payload.memberUids)) {
    for (const rawUid of payload.memberUids) {
      if (typeof rawUid !== 'string') {
        throw new RequestValidationError('INVALID_REQUEST', 'memberUids must contain only string Firebase UIDs.');
      }
      const candidateUid = rawUid.trim();
      if (!isSafeFirebaseUid(candidateUid)) {
        throw new RequestValidationError('INVALID_REQUEST', 'memberUids contains an invalid Firebase UID.');
      }
      memberUidSet.add(candidateUid);
    }
  }
  if (memberUidSet.size > MAX_CONVERSATION_MEMBER_COUNT) {
    throw new RequestValidationError('INVALID_REQUEST', `A conversation may have at most ${MAX_CONVERSATION_MEMBER_COUNT} unique members.`);
  }
  const memberUids = Array.from(memberUidSet);
  validateConversationMemberCount(payload.type as ConversationType, memberUids);
  return {
    type: payload.type as ConversationType,
    memberUids,
    title,
    avatarUrl,
  };
}
function buildConversationMembers(conversationId: string, memberUids: string[], creatorUid: string, joinedAt: string): ConversationMember[] {
  return memberUids.map((uid) => ({
    conversationId,
    uid,
    role: uid === creatorUid ? 'owner' : 'member',
    joinedAt,
  }));
}
function createFirestoreRateLimitStore(collectionName: string, windowMs: number): Store {
  return {
    localKeys: false,
    prefix: `${collectionName}:`,
    async get(key) {
      const snapshot = await adminDb.collection(collectionName).doc(key).get();
      if (!snapshot.exists) return undefined;
      const data = snapshot.data() as Record<string, unknown> | undefined;
      const totalHits = Number.isSafeInteger(data?.totalHits) ? Number(data?.totalHits) : 0;
      const resetTime = typeof data?.resetTime === 'string' ? new Date(data.resetTime) : undefined;
      if (!resetTime || Number.isNaN(resetTime.getTime()) || resetTime.getTime() <= Date.now()) {
        await snapshot.ref.delete().catch(() => undefined);
        return undefined;
      }
      return { totalHits, resetTime };
    },
    async increment(key) {
      const docRef = adminDb.collection(collectionName).doc(key);
      const now = Timestamp.now();
      const nowIso = now.toDate().toISOString();
      const defaultResetTime = new Date(now.toMillis() + windowMs);
      return adminDb.runTransaction(async transaction => {
        const snapshot = await transaction.get(docRef);
        const data = snapshot.data() as Record<string, unknown> | undefined;
        const existingResetTime = typeof data?.resetTime === 'string' ? new Date(data.resetTime) : undefined;
        const resetTime = existingResetTime && !Number.isNaN(existingResetTime.getTime()) && existingResetTime.getTime() > now.toMillis()
          ? existingResetTime
          : defaultResetTime;
        const previousHits = existingResetTime && existingResetTime.getTime() > now.toMillis() && Number.isSafeInteger(data?.totalHits)
          ? Number(data?.totalHits)
          : 0;
        const totalHits = previousHits + 1;
        transaction.set(docRef, {
          key,
          totalHits,
          resetTime: resetTime.toISOString(),
          createdAt: typeof data?.createdAt === 'string' ? data.createdAt : nowIso,
          updatedAt: nowIso,
        });
        return { totalHits, resetTime };
      });
    },
    async decrement() {
      return;
    },
    async resetKey(key) {
      await adminDb.collection(collectionName).doc(key).delete();
    },
  };
}
function transferResultPayload(transactionId: string, reference: string, senderUid: string, recipientId: string, amountMinor: number, currency: string, description: string | undefined, status: 'completed' | 'failed') {
  const payload: Record<string, unknown> = { id: transactionId, reference, senderId: senderUid, recipientId, amount: amountMinor, currency, type: 'transfer', sourceModule: 'unique_pay.wallet_transfer', provider: 'unique_pay_internal_wallet', status, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), recordKind: 'financial', schemaVersion: 2, amountUnit: 'minor' };
  if (description !== undefined) payload.description = description;
  return payload;
}
async function readUserExists(uid: string): Promise<boolean> {
  try {
    await getAuth().getUser(uid);
    return true;
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && (error as { code?: unknown }).code === 'auth/user-not-found') {
      return false;
    }
    throw error;
  }
}
function idempotencyDocumentId(senderUid: string, idempotencyKey: string) {
  // Hash the composite identity so UID/key combinations cannot collide because
  // of separator characters, while keeping the Firestore document ID bounded.
  return createHash('sha256').update(senderUid + '\0' + idempotencyKey).digest('hex');
}

function resolveAiRequestId(req: Request): string {
  const requestIdHeader = req.headers["x-request-id"];
  const suppliedRequestId = Array.isArray(requestIdHeader) ? requestIdHeader[0] : requestIdHeader;
  if (typeof suppliedRequestId === "string") {
    const trimmed = suppliedRequestId.trim();
    if (/^[A-Za-z0-9._:-]{1,64}$/.test(trimmed)) return trimmed;
  }
  return `ai_${randomUUID().replace(/-/g, "")}`.slice(0, 64);
}
async function startServer() {
  const UNIQUE_AI_CAPABILITIES = {
  version: 1,
  readOnly: true,
  contexts: ["account", "orders", "businesses", "products"],
  mutations: [],
} as const;

const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const httpServer = http.createServer(app);
  // Bind the Render web-service port immediately so the platform can detect the listener while the remaining routes initialize.
  httpServer.listen(PORT, "0.0.0.0", () => console.log(`UniqueOS Server listening on port ${PORT}`));
  // Codespaces forwards requests through a trusted proxy and supplies X-Forwarded-For.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    if (process.env.NODE_ENV === 'production') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
  });
  app.use(express.json({ limit: "10mb" }));
  app.use(rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: true, legacyHeaders: false }));
  const authenticate = async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (typeof authHeader !== 'string') return errorResponse(res, 'UNAUTHENTICATED', 'Authentication is required to access this resource.');
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!token || /\s/.test(token)) return errorResponse(res, 'UNAUTHENTICATED', 'Authentication is required to access this resource.');
    try {
      (req as any).user = await getAuth().verifyIdToken(token);
      return next();
    } catch (_) {
      return errorResponse(res, 'UNAUTHENTICATED', 'The supplied Firebase token is invalid or expired.');
    }
  };

  const requirePermission = (permission: import("./src/lib/os/types").Permission) => async (req: Request, res: Response, next: NextFunction) => {
    const uid = typeof (req as any).user?.uid === 'string' ? (req as any).user.uid : '';
    if (!uid) return errorResponse(res, 'UNAUTHENTICATED', 'Authentication is required to access this resource.');
    try {
      const snap = await adminDb.collection('users').doc(uid).get();
      if (!snap.exists) return errorResponse(res, 'FORBIDDEN', 'User access profile was not found.');
      const data = snap.data() || {};
      const roles = Array.isArray(data.roles) ? data.roles : [];
      const customPermissions = Array.isArray(data.permissions) ? data.permissions : [];
      if (!hasRolePermission(roles, customPermissions, permission)) {
        return errorResponse(res, 'FORBIDDEN', 'You do not have permission to perform this action.');
      }
      return next();
    } catch (error) {
      console.error('Permission check failed:', error);
      return errorResponse(res, 'SERVICE_UNAVAILABLE', 'Permission verification is temporarily unavailable.');
    }
  };

  app.post('/api/conference/create', authenticate, rateLimit({
    windowMs: 60_000, limit: 10, standardHeaders: true, legacyHeaders: false,
    keyGenerator: (req) => ipKeyGenerator(req.ip),
    handler: (_req, res) => errorResponse(res, 'RATE_LIMITED', 'Too many conference creation attempts. Please try again shortly.'),
  }), async (req, res) => {
    try {
      const hostUid = String((req as any).user?.uid || '');
      const title = typeof req.body?.title === 'string' ? req.body.title.trim().slice(0, 120) : 'Unique Conference';
      if (!isSafeFirebaseUid(hostUid) || !title) return errorResponse(res, 'INVALID_REQUEST', 'A valid conference title is required.');
      const conferenceRef = adminDb.collection('conferences').doc();
      const inviteToken = randomUUID() + randomUUID().replace(/-/g, '');
      const inviteHash = createHash('sha256').update(inviteToken).digest('hex');
      const now = Timestamp.now();
      await conferenceRef.set({ title, description: 'Online meeting, lecture or public conference.', public: true, hostUid, status: 'live', createdAt: now });
      await adminDb.collection('conferenceInvites').doc(inviteHash).set({ conferenceId: conferenceRef.id, hostUid, status: 'active', expiresAt: Timestamp.fromMillis(Date.now() + 24 * 60 * 60 * 1000), createdAt: now });
      return res.json({ roomId: conferenceRef.id, inviteUrl: `${req.protocol}://${req.get('host')}/conference/${conferenceRef.id}?invite=${encodeURIComponent(inviteToken)}` });
    } catch (error) {
      console.error('Conference creation failed:', error);
      return errorResponse(res, 'SERVICE_UNAVAILABLE', 'The conference could not be created.');
    }
  });
  app.post('/api/conference/invite', authenticate, rateLimit({
    windowMs: 60_000, limit: 30, standardHeaders: true, legacyHeaders: false,
    keyGenerator: (req) => ipKeyGenerator(req.ip),
    handler: (_req, res) => errorResponse(res, 'RATE_LIMITED', 'Too many conference invitation attempts. Please try again shortly.'),
  }), async (req, res) => {
    try {
      const hostUid = String((req as any).user?.uid || '');
      const roomId = typeof req.body?.roomId === 'string' ? req.body.roomId.trim() : '';
      const targetUniqueId = typeof req.body?.targetUniqueId === 'string' ? req.body.targetUniqueId.trim() : '';
      if (targetUniqueId && !/^\d{11}$/.test(targetUniqueId)) return errorResponse(res, 'INVALID_REQUEST', 'A target Unique ID must be exactly 11 digits.');
      if (!isSafeFirebaseUid(hostUid) || !isSafeFirebaseUid(roomId)) return errorResponse(res, 'INVALID_REQUEST', 'A valid conference is required.');
      const conferenceSnap = await adminDb.collection('conferences').doc(roomId).get();
      if (!conferenceSnap.exists || conferenceSnap.data()?.hostUid !== hostUid || conferenceSnap.data()?.status !== 'live') return errorResponse(res, 'FORBIDDEN', 'Only the active conference host can create invitations.');
      const inviteToken = randomUUID() + randomUUID().replace(/-/g, '');
      const inviteHash = createHash('sha256').update(inviteToken).digest('hex');
      const now = Timestamp.now();
      if (targetUniqueId) {
        const targetSnap = await adminDb.collection('users').where('uniqueOneId', '==', targetUniqueId).limit(1).get();
        if (targetSnap.empty) return errorResponse(res, 'NOT_FOUND', 'The target Unique ID could not be found.');
      }
      await adminDb.collection('conferenceInvites').doc(inviteHash).set({ conferenceId: roomId, hostUid, targetUniqueId: targetUniqueId || null, status: 'active', expiresAt: Timestamp.fromMillis(Date.now() + 24 * 60 * 60 * 1000), createdAt: now });
      return res.json({ inviteUrl: `${req.protocol}://${req.get('host')}/conference/${roomId}?invite=${encodeURIComponent(inviteToken)}`, expiresInSeconds: 86400 });
    } catch (error) {
      console.error('Conference invitation failed:', error);
      return errorResponse(res, 'SERVICE_UNAVAILABLE', 'The conference invitation could not be created.');
    }
  });
  app.post('/api/conference/guest-session', rateLimit({
    windowMs: 60_000, limit: 30, standardHeaders: true, legacyHeaders: false,
    keyGenerator: (req) => ipKeyGenerator(req.ip),
    handler: (_req, res) => errorResponse(res, 'RATE_LIMITED', 'Too many conference access attempts. Please try again shortly.'),
  }), async (req, res) => {
    try {
      const roomId = typeof req.body?.roomId === 'string' ? req.body.roomId.trim() : '';
      const inviteToken = typeof req.body?.inviteToken === 'string' ? req.body.inviteToken.trim() : '';
      const uniqueOneId = typeof req.body?.uniqueOneId === 'string' ? req.body.uniqueOneId.trim() : '';
      if (!isSafeFirebaseUid(roomId) || !/^[A-Za-z0-9_-]{24,256}$/.test(inviteToken)) return errorResponse(res, 'FORBIDDEN', 'This conference invitation is invalid.');
      if (!/^\d{11}$/.test(uniqueOneId)) return errorResponse(res, 'INVALID_REQUEST', 'Enter your 11-digit Unique ID to join this conference.');
      const inviteHash = createHash('sha256').update(inviteToken).digest('hex');
      const inviteRef = adminDb.collection('conferenceInvites').doc(inviteHash);
      const inviteSnap = await inviteRef.get();
      if (!inviteSnap.exists) return errorResponse(res, 'FORBIDDEN', 'This conference invitation is invalid or expired.');
      const invite = inviteSnap.data() || {};
      if (invite.conferenceId !== roomId || invite.status !== 'active' || !(invite.expiresAt instanceof Timestamp) || invite.expiresAt.toMillis() <= Date.now()) return errorResponse(res, 'FORBIDDEN', 'This conference invitation is invalid or expired.');
      if (typeof invite.targetUniqueId === 'string' && invite.targetUniqueId && invite.targetUniqueId !== uniqueOneId) {
        return errorResponse(res, 'FORBIDDEN', 'This invitation was issued to a different Unique ID.');
      }
      const conferenceSnap = await adminDb.collection('conferences').doc(roomId).get();
      if (!conferenceSnap.exists || conferenceSnap.data()?.status !== 'live') return errorResponse(res, 'NOT_FOUND', 'This conference is no longer live.');
      const guestUid = `guest_${randomUUID().replace(/-/g, '')}`;
      const customToken = await getAuth().createCustomToken(guestUid, {
        conferenceGuest: true,
        conferenceId: roomId,
        uniqueOneId,
      });
      await inviteRef.update({ lastUsedAt: Timestamp.now(), useCount: Number(invite.useCount || 0) + 1 });
      return res.json({ customToken, guestUid });
    } catch (error) {
      console.error('Conference guest session failed:', error);
      return errorResponse(res, 'SERVICE_UNAVAILABLE', 'Conference guest access is temporarily unavailable.');
    }
  });
  app.post('/api/auth/phone/register-password', rateLimit({
    windowMs: 10 * 60_000,
    limit: 5,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => ipKeyGenerator(req.ip),
    handler: (_req, res) => errorResponse(res, 'RATE_LIMITED', 'Too many registration attempts. Please try again later.'),
  }), async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) return errorResponse(res, 'UNAUTHENTICATED', 'Phone verification is required.');
      const decoded = await getAuth().verifyIdToken(authHeader.slice(7));
      const phone = normalizeAuthPhone(req.body?.phone);
      if (decoded.phone_number !== phone) return errorResponse(res, 'FORBIDDEN', 'The verified phone number does not match the registration phone number.');
      const password = validateLoginPassword(req.body?.password);
      const confirmPassword = validateLoginPassword(req.body?.confirmPassword);
      if (password !== confirmPassword) return errorResponse(res, 'INVALID_REQUEST', 'The 6-digit login passwords do not match.');
      const transactionPin = typeof req.body?.transactionPin === 'string' ? req.body.transactionPin : '';
      const confirmTransactionPin = typeof req.body?.confirmTransactionPin === 'string' ? req.body.confirmTransactionPin : '';
      if (!/^\d{4}$/.test(transactionPin) || !/^\d{4}$/.test(confirmTransactionPin)) return errorResponse(res, 'INVALID_REQUEST', 'Your Transaction PIN must be exactly 4 digits.');
      if (transactionPin !== confirmTransactionPin) return errorResponse(res, 'INVALID_REQUEST', 'The Transaction PINs do not match.');
      const fullName = typeof req.body?.fullName === 'string' ? req.body.fullName.trim().slice(0, 120) : '';
      const now = Timestamp.now();
      const loginSalt = randomUUID().replace(/-/g, '');
      const pinSalt = randomUUID().replace(/-/g, '');
      await adminDb.collection('authCredentials').doc(decoded.uid).set({
        uid: decoded.uid, phone, loginPasswordSalt: loginSalt, loginPasswordHash: passwordDigest(password, loginSalt),
        transactionPinSalt: pinSalt, transactionPinHash: passwordDigest(transactionPin, pinSalt),
        createdAt: now, updatedAt: now
      }, { merge: true });
      const uniqueOneId = `U1-${decoded.uid.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10).toUpperCase() || 'ACCOUNT'}`;
      await adminDb.collection('users').doc(decoded.uid).set({
        uid: decoded.uid,email: decoded.email || '',phone,fullName: fullName || 'Unique One User',uniqueOneId,
        roles: ['customer'],permissions: [],status: 'active',preferredLanguage: 'en',
        createdAt: now.toDate().toISOString(),lastLogin: now.toDate().toISOString(),
        verificationStatus: 'phone_verified',hasSecurePin: true,twoFactorEnabled: false
      },{merge:true});
      return res.json({ok:true,uid:decoded.uid,uniqueOneId,hasSecurePin:true});
    } catch (error: any) {
      const code = error?.code === 'auth/id-token-expired' || error?.code === 'auth/argument-error' ? 'UNAUTHENTICATED' : error instanceof RequestValidationError ? error.code : 'INVALID_REQUEST';
      return errorResponse(res, code as TransferErrorCode, error?.message || 'Registration could not be completed.');
    }
  });
  app.post('/api/auth/change-password', authenticate, rateLimit({
    windowMs: 10 * 60_000,
    limit: 5,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => ipKeyGenerator(req.ip),
    handler: (_req, res) => errorResponse(res, 'RATE_LIMITED', 'Too many password change attempts. Please try again later.'),
  }), async (req, res) => {
    try {
      const uid = typeof (req as any).user?.uid === 'string' ? (req as any).user.uid : '';
      if (!uid) return errorResponse(res, 'UNAUTHENTICATED', 'Authentication is required to change your Login PIN.');
      const currentPassword = validateLoginPassword(req.body?.currentPassword);
      const newPassword = validateLoginPassword(req.body?.newPassword);
      const confirmNewPassword = validateLoginPassword(req.body?.confirmNewPassword);
      if (newPassword !== confirmNewPassword) return errorResponse(res, 'INVALID_REQUEST', 'The new 6-digit Login PINs do not match.');

      if (currentPassword === newPassword) return errorResponse(res, 'INVALID_REQUEST', 'Your new Login PIN must be different from your current Login PIN.');

      const credentialRef = adminDb.collection('authCredentials').doc(uid);
      try {
        await adminDb.runTransaction(async transaction => {
          const snapshot = await transaction.get(credentialRef);
          const credential = snapshot.data() as { loginPasswordSalt?: string; loginPasswordHash?: string } | undefined;
          if (!credential?.loginPasswordSalt || !credential.loginPasswordHash) throw new Error('LOGIN_CREDENTIAL_MISSING');
          if (!passwordDigestMatches(currentPassword, credential.loginPasswordSalt, credential.loginPasswordHash)) {
            throw new Error('CURRENT_LOGIN_PIN_INVALID');
          }
          const loginSalt = randomUUID().replace(/-/g, '');
          transaction.update(credentialRef, {
            loginPasswordSalt: loginSalt,
            loginPasswordHash: passwordDigest(newPassword, loginSalt),
            updatedAt: Timestamp.now(),
          });
        });
      } catch (error: any) {
        if (error?.message === 'LOGIN_CREDENTIAL_MISSING') return errorResponse(res, 'INVALID_REQUEST', 'This account does not have a Login PIN configured.');
        if (error?.message === 'CURRENT_LOGIN_PIN_INVALID') return errorResponse(res, 'UNAUTHENTICATED', 'Your current 6-digit Login PIN is incorrect.');
        throw error;
      }
      try {
        await getAuth().revokeRefreshTokens(uid);
      } catch (revokeError) {
        console.error('Login PIN session revocation failed:', revokeError);
        return errorResponse(res, 'SERVICE_UNAVAILABLE', 'Login PIN changed, but active sessions could not be safely revoked. Please sign in again later.');
      }
      return res.json({ ok: true, passwordChanged: true });
    } catch (error: any) {
      const code = error instanceof RequestValidationError ? error.code : 'INVALID_REQUEST';
      return errorResponse(res, code as TransferErrorCode, error?.message || 'Login PIN could not be changed.');
    }
  });

  app.post('/api/auth/phone/reset-password', rateLimit({
    windowMs: 10 * 60_000,
    limit: 5,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => ipKeyGenerator(req.ip),
    handler: (_req, res) => errorResponse(res, 'RATE_LIMITED', 'Too many password reset attempts. Please try again later.'),
  }), async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
        return errorResponse(res, 'UNAUTHENTICATED', 'Verified phone recovery is required.');
      }
      const decoded = await getAuth().verifyIdToken(authHeader.slice(7));
      const phone = normalizeAuthPhone(req.body?.phone);
      if (decoded.phone_number !== phone) {
        return errorResponse(res, 'FORBIDDEN', 'The verified phone number does not match the recovery phone number.');
      }
      const password = validateLoginPassword(req.body?.password);
      const confirmPassword = validateLoginPassword(req.body?.confirmPassword);
      if (password !== confirmPassword) {
        return errorResponse(res, 'INVALID_REQUEST', 'The 6-digit login passwords do not match.');
      }

      const credentialRef = adminDb.collection('authCredentials').doc(decoded.uid);
      const credentialSnapshot = await credentialRef.get();
      if (!credentialSnapshot.exists) {
        return errorResponse(res, 'INVALID_REQUEST', 'This account does not have a recoverable login credential yet.');
      }
      const credential = credentialSnapshot.data() as { uid?: string; phone?: string; transactionPinSalt?: string; transactionPinHash?: string } | undefined;
      if (!credential?.uid || credential.uid !== decoded.uid || credential.phone !== phone) {
        return errorResponse(res, 'FORBIDDEN', 'The verified phone does not match the account credential.');
      }

      const loginSalt = randomUUID().replace(/-/g, '');
      const now = Timestamp.now();
      await credentialRef.update({
        loginPasswordSalt: loginSalt,
        loginPasswordHash: passwordDigest(password, loginSalt),
        updatedAt: now,
      });
      await adminDb.collection('users').doc(decoded.uid).set({
        lastLogin: now.toDate().toISOString(),
        verificationStatus: 'phone_verified',
      }, { merge: true });
      try {
        await getAuth().revokeRefreshTokens(decoded.uid);
      } catch (revokeError) {
        console.error('Password reset session revocation failed:', revokeError);
        return errorResponse(res, 'SERVICE_UNAVAILABLE', 'Password reset completed, but active sessions could not be safely revoked. Please sign in again later.');
      }
      await adminDb.collection('audit_logs').add({
        action: 'auth.login_password.reset',
        actorUid: decoded.uid,
        targetUid: decoded.uid,
        resource: 'auth_credentials',
        resourceId: decoded.uid,
        timestamp: now,
      });
      return res.json({ ok: true, passwordReset: true });
    } catch (error: any) {
      const code = error?.code === 'auth/id-token-expired' || error?.code === 'auth/argument-error'
        ? 'UNAUTHENTICATED'
        : error instanceof RequestValidationError ? error.code : 'INVALID_REQUEST';
      return errorResponse(res, code as TransferErrorCode, error?.message || 'Password reset could not be completed.');
    }
  });

  app.post('/api/auth/phone/login',
  rateLimit({
    windowMs: 5 * 60_000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => ipKeyGenerator(req.ip),
    handler: (_req, res) => errorResponse(res, 'RATE_LIMITED', 'Too many login attempts. Please try again later.'),
  }),
  rateLimit({
    windowMs: 10 * 60_000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    store: createFirestoreRateLimitStore('authLoginIdentifierRateLimits', 10 * 60_000),
    keyGenerator: (req) => {
      const rawIdentifier = typeof req.body?.identifier === 'string' ? req.body.identifier.trim().toLowerCase() : '';
      const identifierKey = createHash('sha256').update(rawIdentifier || 'missing-identifier').digest('hex');
      return `identifier:${identifierKey}`;
    },
    handler: (_req, res) => errorResponse(res, 'RATE_LIMITED', 'Too many login attempts for this account identifier. Please try again shortly.'),
  }),
  async (req, res) => {
    try {
      const identifier = typeof req.body?.identifier === 'string' ? req.body.identifier.trim().toLowerCase() : '';
      const password = validateLoginPassword(req.body?.password);
      if (!identifier) return errorResponse(res, 'INVALID_REQUEST', 'Enter your phone number, Unique ID, or verified email.');

      let uid = '';
      let user: UserRecord | null = null;

      if (/^0\d{10}$/.test(identifier)) {
        user = await getAuth().getUserByPhoneNumber(normalizeAuthPhone(identifier));
        uid = user.uid;
      } else if (/^\d{10}$/.test(identifier)) {
        user = await getAuth().getUserByPhoneNumber('+234' + identifier);
        uid = user.uid;
      } else if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier)) {
        const emailSnapshot = await adminDb.collection('users').where('email', '==', identifier).limit(1).get();
        if (!emailSnapshot.empty) {
          const data = emailSnapshot.docs[0].data() as { uid?: unknown; emailVerified?: unknown };
          if (data.emailVerified === true && typeof data.uid === 'string') {
            uid = data.uid;
            user = await getAuth().getUser(uid);
          }
        }
      } else {
        return errorResponse(res, 'INVALID_REQUEST', 'Use an 11-digit phone number, 10-digit Unique ID, or verified email.');
      }

      if (!user || !uid) return errorResponse(res, 'UNAUTHENTICATED', 'Invalid login identifier or 6-digit Login PIN.');
      const snap = await adminDb.collection('authCredentials').doc(uid).get();
      const credential = snap.data() as {loginPasswordSalt?:string;loginPasswordHash?:string}|undefined;
      if (!credential?.loginPasswordSalt || !credential.loginPasswordHash || !passwordDigestMatches(password, credential.loginPasswordSalt, credential.loginPasswordHash)) return errorResponse(res,'UNAUTHENTICATED','Invalid login identifier or 6-digit Login PIN.');
      const customToken=await getAuth().createCustomToken(uid);
      await adminDb.collection('users').doc(uid).set({lastLogin:new Date().toISOString()},{merge:true});
      return res.json({customToken});
    } catch(error:any) {
      if(error?.code==='auth/user-not-found') return errorResponse(res,'UNAUTHENTICATED','Invalid login identifier or 6-digit Login PIN.');
      const code=error instanceof RequestValidationError?error.code:'UNAUTHENTICATED';
      return errorResponse(res,code as TransferErrorCode,error?.message||'Unable to sign in.');
    }
  });

  app.get("/api/health", (req, res) => res.json({ status: "ok", ecosystem: "Unique One", version: "1.0.0" }));
  registerIdentityVerificationRoutes(app, authenticate);
  registerAjoRoutes(app, authenticate);
  registerUniqueShareRoutes(app, authenticate);
  registerAdminRbacRoutes(app, authenticate, requirePermission);
  registerAdminAuditRoutes(app, authenticate, requirePermission);

  app.post("/api/ai/discovery", rateLimit({
    windowMs: 60_000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => res.status(429).json({ error: { message: "Too many discovery requests. Please try again shortly." } }),
  }), async (req, res) => {
    try {
      if (!req.body || typeof req.body !== "object" || Array.isArray(req.body) || typeof req.body.message !== "string") {
        return res.status(400).json({ error: { message: "A search message is required." } });
      }
      const message = req.body.message.trim();
      if (!message || message.length > 4_000) {
        return res.status(400).json({ error: { message: "Search message must contain 1-4,000 characters." } });
      }
      const discovery = await getLiveDiscoveryContext(message);
      return res.status(200).json(discovery);
    } catch (error) {
      console.error("Unique AI discovery failed:", error);
      return res.status(503).json({ error: { message: "Live discovery is temporarily unavailable." } });
    }
  });

const AI_GUEST_LIMIT_SECONDS = 5 * 60;
const AI_REGISTERED_DAILY_LIMIT_SECONDS = 60 * 60;
const AI_SUBSCRIBER_LIMIT_SECONDS = 24 * 60 * 60;
const AI_GUEST_SESSION_TTL_MS = 5 * 60_000;
const AI_USAGE_GAP_CAP_SECONDS = 5 * 60;

function aiUsageDayKey(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function isActiveAiSubscription(data: Record<string, unknown> | undefined): boolean {
  if (!data) return false;
  const status = typeof data.status === "string" ? data.status.toLowerCase() : "";
  const subscriptionStatus = typeof data.subscriptionStatus === "string" ? data.subscriptionStatus.toLowerCase() : "";
  const active = status === "active" || subscriptionStatus === "active" || data.active === true;
  if (!active) return false;
  const periodEnd = data.currentPeriodEnd ?? data.expiresAt ?? data.endDate;
  if (periodEnd === undefined || periodEnd === null) return true;
  const millis = periodEnd instanceof Timestamp ? periodEnd.toMillis() : typeof periodEnd === "number" ? periodEnd : typeof periodEnd === "string" ? Date.parse(periodEnd) : NaN;
  return !Number.isFinite(millis) || millis > Date.now();
}

async function getAiAccess(uid: string | undefined, guestSessionId: string | undefined): Promise<{
  mode: "guest" | "registered" | "subscriber";
  limitSeconds: number;
  usedSeconds: number;
  remainingSeconds: number;
}> {
  const now = Date.now();
  if (!uid) {
    if (!guestSessionId || !/^[A-Za-z0-9_-]{16,128}$/.test(guestSessionId)) {
      return { mode: "guest", limitSeconds: AI_GUEST_LIMIT_SECONDS, usedSeconds: 0, remainingSeconds: AI_GUEST_LIMIT_SECONDS };
    }
    const ref = adminDb.collection("aiGuestUsage").doc(guestSessionId);
    const snap = await ref.get();
    const data = snap.data() as Record<string, unknown> | undefined;
    const startedAt = typeof data?.startedAt === "number" ? data.startedAt : now;
    const elapsed = Math.max(0, Math.floor((now - startedAt) / 1000));
    if (!snap.exists) await ref.set({ startedAt, lastSeenAt: now, createdAt: Timestamp.now() }, { merge: true });
    return {
      mode: "guest",
      limitSeconds: AI_GUEST_LIMIT_SECONDS,
      usedSeconds: Math.min(AI_GUEST_LIMIT_SECONDS, elapsed),
      remainingSeconds: Math.max(0, AI_GUEST_LIMIT_SECONDS - elapsed),
    };
  }
  const subscriptionSnap = await adminDb.collection("subscriptions").doc(uid).get();
  let subscribed = isActiveAiSubscription(subscriptionSnap.data() as Record<string, unknown> | undefined);
  if (!subscribed) {
    const userSnap = await adminDb.collection("users").doc(uid).get();
    subscribed = isActiveAiSubscription(userSnap.data() as Record<string, unknown> | undefined);
  }
  if (subscribed) {
    return { mode: "subscriber", limitSeconds: AI_SUBSCRIBER_LIMIT_SECONDS, usedSeconds: 0, remainingSeconds: AI_SUBSCRIBER_LIMIT_SECONDS };
  }
  const dayKey = aiUsageDayKey();
  const ref = adminDb.collection("aiUsage").doc(uid + "_" + dayKey);
  const snap = await ref.get();
  const data = snap.data() as Record<string, unknown> | undefined;
  const usedSeconds = Number.isSafeInteger(data?.usedSeconds) ? Number(data?.usedSeconds) : 0;
  return {
    mode: "registered",
    limitSeconds: AI_REGISTERED_DAILY_LIMIT_SECONDS,
    usedSeconds: Math.max(0, Math.min(AI_REGISTERED_DAILY_LIMIT_SECONDS, usedSeconds)),
    remainingSeconds: Math.max(0, AI_REGISTERED_DAILY_LIMIT_SECONDS - usedSeconds),
  };
}

async function consumeAiAccess(uid: string | undefined, guestSessionId: string | undefined, startedAtMs: number): Promise<ReturnType<typeof getAiAccess> extends Promise<infer T> ? T : never> {
  const now = Date.now();
  if (!uid) {
    if (!guestSessionId || !/^[A-Za-z0-9_-]{16,128}$/.test(guestSessionId)) return await getAiAccess(undefined, guestSessionId);
    const ref = adminDb.collection("aiGuestUsage").doc(guestSessionId);
    const snap = await ref.get();
    const data = snap.data() as Record<string, unknown> | undefined;
    const started = typeof data?.startedAt === "number" ? data.startedAt : startedAtMs;
    const elapsed = Math.floor((now - started) / 1000);
    await ref.set({ startedAt: started, lastSeenAt: now, updatedAt: Timestamp.now() }, { merge: true });
    return getAiAccess(undefined, guestSessionId);
  }
  const access = await getAiAccess(uid, undefined);
  if (access.mode === "subscriber") return access;
  const dayKey = aiUsageDayKey();
  const ref = adminDb.collection("aiUsage").doc(uid + "_" + dayKey);
  const snap = await ref.get();
  const data = snap.data() as Record<string, unknown> | undefined;
  const lastRequestAt = typeof data?.lastRequestAt === "number" ? data.lastRequestAt : startedAtMs;
  const generationSeconds = Math.max(1, Math.ceil((now - startedAtMs) / 1000));
  const gapSeconds = Math.min(AI_USAGE_GAP_CAP_SECONDS, Math.max(0, Math.ceil((startedAtMs - lastRequestAt) / 1000)));
  const chargeSeconds = Math.max(1, generationSeconds + gapSeconds);
  const usedBefore = Number.isSafeInteger(data?.usedSeconds) ? Number(data.usedSeconds) : 0;
  const usedAfter = Math.min(AI_REGISTERED_DAILY_LIMIT_SECONDS, usedBefore + chargeSeconds);
  await ref.set({ usedSeconds: usedAfter, lastRequestAt: now, updatedAt: Timestamp.now() }, { merge: true });
  return getAiAccess(uid, undefined);
}

async function enforceAiAccess(req: Request, res: Response, uid?: string): Promise<{ mode: "guest" | "registered" | "subscriber"; limitSeconds: number; usedSeconds: number; remainingSeconds: number } | null> {
  const guestHeader = req.headers["x-ai-session-id"];
  const guestSessionId = Array.isArray(guestHeader) ? guestHeader[0] : guestHeader;
  const access = await getAiAccess(uid, typeof guestSessionId === "string" ? guestSessionId : undefined);
  res.setHeader("X-AI-Access-Mode", access.mode);
  res.setHeader("X-AI-Remaining-Seconds", String(access.remainingSeconds));
  res.setHeader("Cache-Control", "no-store");
  if (access.remainingSeconds <= 0) {
    res.status(429).json({
      error: { code: "AI_TIME_LIMIT", message: access.mode === "guest" ? "Your 5-minute guest AI session has ended. Register for 1 hour of Unique AI access every day." : "Your 1-hour daily Unique AI allowance has been used. Subscribe for extended AI access." },
      aiAccess: access,
    });
    return null;
  }
  return access;
}

function parseAiLocation(value: unknown): { latitude: number; longitude: number; radiusMeters?: number } | undefined {
  if (value === undefined) return undefined;
  if (!isPlainObject(value)) throw new RequestValidationError('INVALID_REQUEST', 'location must be an object.');
  const latitude = value.latitude;
  const longitude = value.longitude;
  const radiusMeters = value.radiusMeters;
  if (typeof latitude !== 'number' || !Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
      typeof longitude !== 'number' || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new RequestValidationError('INVALID_REQUEST', 'location coordinates are invalid.');
  }
  if (radiusMeters !== undefined && (typeof radiusMeters !== 'number' || !Number.isFinite(radiusMeters) || radiusMeters < 100 || radiusMeters > 50_000)) {
    throw new RequestValidationError('INVALID_REQUEST', 'location radius is invalid.');
  }
  return { latitude, longitude, ...(typeof radiusMeters === 'number' ? { radiusMeters } : {}) };
}

  app.post("/api/ai/public-chat", rateLimit({
    windowMs: 60_000,
    limit: 12,
    standardHeaders: true,
    legacyHeaders: false,
    store: createFirestoreRateLimitStore('publicAiRateLimits', 60_000),
    keyGenerator: (req) => ipKeyGenerator(req.ip),
    handler: (_req, res) => errorResponse(res, 'RATE_LIMITED', 'Too many public AI requests. Please try again shortly.'),
  }), async (req, res) => {
    const resolvedRequestId = resolveAiRequestId(req);
    res.setHeader("X-Request-ID", resolvedRequestId);
    res.setHeader("Cache-Control", "no-store");
    try {
      if (!isPlainObject(req.body)) return errorResponse(res, 'INVALID_REQUEST', 'The AI request body must be a plain object.');
      const payload = req.body as Record<string, unknown>;
      const allowedKeys = new Set(['message', 'history', 'preferredLanguage', 'location']);
      for (const key of Object.keys(payload)) {
        if (!allowedKeys.has(key)) return errorResponse(res, 'INVALID_REQUEST', `Unsupported field: ${key}.`);
      }
      const location = parseAiLocation(payload.location);

      const responseText = await generatePublicUniqueAiResponse({ message: payload.message, history: payload.history, preferredLanguage: typeof payload.preferredLanguage === "string" ? payload.preferredLanguage : undefined, location });
      return res.status(200).json({
        message: responseText,
        public: true,
        registerPrompt: true,
        readOnly: true,
        requestId: resolvedRequestId,
        capabilities: { version: 1, readOnly: true, contexts: [], mutations: [] },
      });
    } catch (error) {
      if (error instanceof UniqueAiValidationError) {
        return res.status(400).json({ error: { code: "INVALID_REQUEST", message: error.message }, requestId: resolvedRequestId });
      }
      console.error('Public Unique AI request failed:', { requestId: resolvedRequestId, error });
      return res.status(503).json({ error: { code: "SERVICE_UNAVAILABLE", message: "Unique AI is temporarily unavailable. Please try again shortly." }, requestId: resolvedRequestId });
    }
  });

  app.post("/api/ai/chat", authenticate, rateLimit({
    windowMs: 60_000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
    store: createFirestoreRateLimitStore('aiChatRateLimits', 60_000),
    keyGenerator: (req) => {
      const uid = (req as any).user?.uid;
      return isSafeFirebaseUid(uid) ? uid : ipKeyGenerator(req.ip);
    },
    handler: (req, res) => {
      const requestId = resolveAiRequestId(req);
      res.setHeader("X-Request-ID", requestId);
      res.setHeader("Cache-Control", "no-store");
      return errorResponse(res, 'RATE_LIMITED', 'Too many AI requests. Please try again shortly.');
    },
  }), async (req, res) => {
    const resolvedRequestId = resolveAiRequestId(req);
    const rawRequestIdHeader = req.headers["x-request-id"];
    const suppliedRequestId = Array.isArray(rawRequestIdHeader) ? rawRequestIdHeader[0] : rawRequestIdHeader;
    res.setHeader("X-Request-ID", resolvedRequestId);
    res.setHeader("Cache-Control", "no-store");
    try {
      if (!isPlainObject(req.body)) {
        return errorResponse(res, 'INVALID_REQUEST', 'The AI request body must be a plain object.');
      }
      const payload = req.body as Record<string, unknown>;
      const allowedKeys = new Set(['message', 'history', 'preferredLanguage', 'location']);
      for (const key of Object.keys(payload)) {
        if (!allowedKeys.has(key)) {
          return errorResponse(res, 'INVALID_REQUEST', `Unsupported field: ${key}.`);
        }
      }
      const uid = sanitizeRequiredAuthUid((req as any).user?.uid);
      if (!uid) {
        return errorResponse(res, 'UNAUTHENTICATED', 'Authentication is required.');
      }
      const message = payload.message;
      const history = payload.history;
      const location = parseAiLocation(payload.location);
      const access = await enforceAiAccess(req, res, uid);
      if (!access) return;
      const usageStartedAt = Date.now();
      if (suppliedRequestId !== undefined && (
        typeof suppliedRequestId !== "string" ||
        !/^[A-Za-z0-9._:-]{1,64}$/.test(suppliedRequestId.trim())
      )) {
        return res.status(400).json({
          error: { code: "INVALID_REQUEST", message: "x-request-id is invalid." },
          requestId: resolvedRequestId,
          capabilities: UNIQUE_AI_CAPABILITIES,
        });
      }
      const preferredLanguage =
        typeof payload.preferredLanguage === "string" ? payload.preferredLanguage.trim().toLowerCase() : undefined;
      const responseText = await generateUniqueAiResponse({
        uid,
        message,
        history,
        requestId: resolvedRequestId,
        preferredLanguage,
        location,
      });
      return res.status(200).json({
        message: responseText,
        readOnly: true,
        requestId: resolvedRequestId,
        capabilities: UNIQUE_AI_CAPABILITIES,
      });
    } catch (error) {
      if (error instanceof UniqueAiValidationError) {
        return res.status(400).json({ error: { code: "INVALID_REQUEST", message: error.message }, requestId: resolvedRequestId, capabilities: UNIQUE_AI_CAPABILITIES });
      }
      console.error('Unique AI request failed:', { requestId: resolvedRequestId, error });
      return res.status(503).json({ error: { code: "SERVICE_UNAVAILABLE", message: "Unique AI is temporarily unavailable. Please try again shortly." }, requestId: resolvedRequestId, capabilities: UNIQUE_AI_CAPABILITIES });
    }
  });


  app.post("/api/ai/public-vision", rateLimit({
    windowMs: 60_000, limit: 12, standardHeaders: true, legacyHeaders: false,
    store: createFirestoreRateLimitStore('publicAiVisionRateLimits', 60_000),
    keyGenerator: (req) => ipKeyGenerator(req.ip),
    handler: (_req, res) => errorResponse(res, 'RATE_LIMITED', 'Too many image analysis requests. Please try again shortly.'),
  }), async (req, res) => {
    const resolvedRequestId = resolveAiRequestId(req);
    res.setHeader("X-Request-ID", resolvedRequestId);
    res.setHeader("Cache-Control", "no-store");
    try {
      if (!isPlainObject(req.body)) return errorResponse(res, 'INVALID_REQUEST', 'The image request body must be a plain object.');
      const payload = req.body as Record<string, unknown>;
      const allowedKeys = new Set(['imageData', 'mimeType', 'prompt', 'preferredLanguage']);
      for (const key of Object.keys(payload)) if (!allowedKeys.has(key)) return errorResponse(res, 'INVALID_REQUEST', `Unsupported field: ${key}.`);
      const { analyzeUniqueAiImage } = await import("./src/lib/ai/uniqueAiService");
      const message = await analyzeUniqueAiImage({
        image: { data: payload.imageData, mimeType: payload.mimeType },
        prompt: payload.prompt,
        preferredLanguage: typeof payload.preferredLanguage === "string" ? payload.preferredLanguage : undefined,
      });
      return res.status(200).json({ message, public: true, readOnly: true, requestId: resolvedRequestId });
    } catch (error) {
      if (error instanceof UniqueAiValidationError) return res.status(400).json({ error: { code: "INVALID_REQUEST", message: error.message }, requestId: resolvedRequestId });
      console.error("Public Unique AI vision request failed:", { requestId: resolvedRequestId, error });
      return res.status(503).json({ error: { code: "SERVICE_UNAVAILABLE", message: "Image analysis is temporarily unavailable. Please try again shortly." }, requestId: resolvedRequestId });
    }
  });

  app.post("/api/ai/vision", authenticate, rateLimit({
    windowMs: 60_000, limit: 20, standardHeaders: true, legacyHeaders: false,
    store: createFirestoreRateLimitStore('aiVisionRateLimits', 60_000),
    keyGenerator: (req) => {
      const uid = (req as any).user?.uid;
      return isSafeFirebaseUid(uid) ? uid : ipKeyGenerator(req.ip);
    },
    handler: (req, res) => {
      const requestId = resolveAiRequestId(req);
      res.setHeader("X-Request-ID", requestId);
      res.setHeader("Cache-Control", "no-store");
      return errorResponse(res, 'RATE_LIMITED', 'Too many image analysis requests. Please try again shortly.');
    },
  }), async (req, res) => {
    const resolvedRequestId = resolveAiRequestId(req);
    res.setHeader("X-Request-ID", resolvedRequestId);
    res.setHeader("Cache-Control", "no-store");
    try {
      if (!isPlainObject(req.body)) return errorResponse(res, 'INVALID_REQUEST', 'The image request body must be a plain object.');
      const payload = req.body as Record<string, unknown>;
      const allowedKeys = new Set(['imageData', 'mimeType', 'prompt', 'preferredLanguage']);
      for (const key of Object.keys(payload)) if (!allowedKeys.has(key)) return errorResponse(res, 'INVALID_REQUEST', `Unsupported field: ${key}.`);
      sanitizeRequiredAuthUid((req as any).user?.uid);
      const { analyzeUniqueAiImage } = await import("./src/lib/ai/uniqueAiService");
      const message = await analyzeUniqueAiImage({
        image: { data: payload.imageData, mimeType: payload.mimeType },
        prompt: payload.prompt,
        preferredLanguage: typeof payload.preferredLanguage === "string" ? payload.preferredLanguage : undefined,
      });
      return res.status(200).json({ message, readOnly: true, requestId: resolvedRequestId });
    } catch (error) {
      if (error instanceof UniqueAiValidationError) return res.status(400).json({ error: { code: "INVALID_REQUEST", message: error.message }, requestId: resolvedRequestId });
      console.error("Unique AI vision request failed:", { requestId: resolvedRequestId, error });
      return res.status(503).json({ error: { code: "SERVICE_UNAVAILABLE", message: "Image analysis is temporarily unavailable. Please try again shortly." }, requestId: resolvedRequestId });
    }
  });

  app.post("/api/business/staff/accept-invite", rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: true, legacyHeaders: false }), authenticate, async (req, res) => {
    const uid = (req as any).user?.uid as string | undefined;
    const email = typeof (req as any).user?.email === 'string' ? String((req as any).user.email).trim().toLowerCase() : '';
    if (!uid || !email) return errorResponse(res, 'UNAUTHENTICATED', 'A verified account with an email address is required.');
    try {
      const inviteId = typeof req.body?.inviteId === 'string' ? req.body.inviteId.trim() : '';
      if (!inviteId || !/^[A-Za-z0-9_-]{1,150}$/.test(inviteId)) return errorResponse(res, 'INVALID_REQUEST', 'A valid invitation is required.');
      const inviteRef = adminDb.collection('staffInvites').doc(inviteId);
      const memberRef = adminDb.collection('staffMembers').doc(uid + '_' + inviteId);
      await adminDb.runTransaction(async transaction => {
        const inviteSnap = await transaction.get(inviteRef);
        if (!inviteSnap.exists) throw new Error('INVITE_NOT_FOUND');
        const invite = inviteSnap.data() as Record<string, unknown>;
        if (String(invite.inviteeEmail || '').trim().toLowerCase() !== email) throw new Error('INVITE_NOT_FOR_USER');
        if (invite.status !== 'pending') throw new Error('INVITE_NOT_PENDING');
        const role = typeof invite.role === 'string' ? invite.role : '';
        const allowedRoles = new Set(['admin','manager','sales','cashier','accountant','inventory','support','delivery','branch_manager','viewer']);
        if (!allowedRoles.has(role)) throw new Error('INVALID_ROLE');
        const ownerUid = typeof invite.businessOwnerUid === 'string' ? invite.businessOwnerUid : '';
        if (!ownerUid || ownerUid === uid) throw new Error('INVALID_OWNER');
        const existingMember = await transaction.get(memberRef);
        if (existingMember.exists) throw new Error('MEMBER_EXISTS');
        transaction.set(memberRef, {
          uid, businessOwnerUid: ownerUid, role,
          branchName: typeof invite.branchName === 'string' ? invite.branchName : null,
          inviteId, status: 'active', createdAt: Timestamp.now(), updatedAt: Timestamp.now()
        });
        transaction.update(inviteRef, { status: 'accepted', acceptedUid: uid, acceptedAt: Timestamp.now() });
      });
      return res.status(200).json({ status: 'accepted' });
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      if (code === 'INVITE_NOT_FOUND') return errorResponse(res, 'NOT_FOUND', 'Invitation not found.', 404);
      if (code === 'INVITE_NOT_FOR_USER') return errorResponse(res, 'FORBIDDEN', 'This invitation belongs to another email address.', 403);
      if (code === 'INVITE_NOT_PENDING') return errorResponse(res, 'INVALID_REQUEST', 'This invitation is no longer pending.');
      if (code === 'INVALID_ROLE' || code === 'INVALID_OWNER') return errorResponse(res, 'INVALID_REQUEST', 'This invitation is invalid.');
      if (code === 'MEMBER_EXISTS') return errorResponse(res, 'INVALID_REQUEST', 'You are already a member for this invitation.');
      console.error('Staff invite acceptance failed:', error);
      return errorResponse(res, 'SERVICE_UNAVAILABLE', 'Unable to accept the invitation right now.');
    }
  });

  // Register Business Platform session middleware before protected Business endpoints.\n  // This prevents inventory and future /api/business routes from bypassing the separate business session.\n  registerAdminRbacRoutes(app, authenticate, requirePermission);\n\n  app.post("/api/business/inventory/adjust", rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: true, legacyHeaders: false }), authenticate, async (req, res) => {
    const uid = (req as any).user?.uid as string | undefined;
    if (!uid) return errorResponse(res, 'UNAUTHENTICATED', 'Authentication is required.');
    try {
      const body = req.body as Record<string, unknown>;
      const productId = typeof body?.productId === 'string' ? body.productId.trim() : '';
      const direction = body?.direction === 'in' ? 'in' : body?.direction === 'out' ? 'out' : '';
      const quantity = body?.quantity;
      const note = typeof body?.note === 'string' ? body.note.trim().slice(0, 300) : '';
      if (!productId || !direction || !Number.isInteger(quantity) || (quantity as number) < 1 || (quantity as number) > 100000000) {
        return errorResponse(res, 'INVALID_REQUEST', 'A valid product, direction, and positive whole quantity are required.');
      }

      const productRef = adminDb.collection('products').doc(productId);
      const movementRef = adminDb.collection('inventory_movements').doc();
      let remaining = 0;
      await adminDb.runTransaction(async transaction => {
        const snapshot = await transaction.get(productRef);
        if (!snapshot.exists) throw new Error('PRODUCT_NOT_FOUND');
        const product = snapshot.data() as Record<string, unknown>;
        if (product.sellerId !== uid) throw new Error('NOT_OWNER');
        const currentQuantity = Number.isInteger(product.quantity) && (product.quantity as number) >= 0 ? product.quantity as number : 0;
        const nextQuantity = direction === 'in' ? currentQuantity + (quantity as number) : currentQuantity - (quantity as number);
        if (nextQuantity < 0) throw new Error('INSUFFICIENT_STOCK');
        remaining = nextQuantity;
        const status = nextQuantity === 0 ? 'out_of_stock' : product.status === 'out_of_stock' ? 'published' : product.status;
        transaction.update(productRef, { quantity: nextQuantity, status, updatedAt: Timestamp.now() });
        transaction.set(movementRef, {
          productId, sellerId: uid, direction, quantity, previousQuantity: currentQuantity,
          remainingQuantity: nextQuantity, note, createdAt: Timestamp.now(),
        });
        const auditRef = adminDb.collection('audit_logs').doc();
        transaction.create(auditRef, {
          action: 'business.inventory.adjusted',
          actorUid: uid,
          targetUid: uid,
          resource: 'inventory',
          resourceId: productId,
          productId,
          movementId: movementRef.id,
          direction,
          quantity,
          previousQuantity: currentQuantity,
          remainingQuantity: nextQuantity,
          note,
          timestamp: Timestamp.now(),
        });
      });

      return res.status(200).json({ productId, direction, quantity, remainingQuantity: remaining });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'PRODUCT_NOT_FOUND') return errorResponse(res, 'NOT_FOUND', 'Product not found.', 404);
        if (error.message === 'NOT_OWNER') return errorResponse(res, 'FORBIDDEN', 'You can only adjust inventory for your own product.', 403);
        if (error.message === 'INSUFFICIENT_STOCK') return errorResponse(res, 'INSUFFICIENT_STOCK', 'Stock out quantity cannot exceed available inventory.', 409);
      }
      console.error('Inventory adjustment failed:', error);
      return errorResponse(res, 'SERVICE_UNAVAILABLE', 'Unable to adjust inventory right now.');
    }
  });

  app.post("/api/business/register", rateLimit({ windowMs: 60_000, limit: 10, standardHeaders: true, legacyHeaders: false }), authenticate, async (req, res) => {
    const uid = (req as any).user?.uid as string | undefined;
    if (!uid) return errorResponse(res, 'UNAUTHENTICATED', 'Authentication is required.');
    try {
      const body = req.body as Record<string, unknown>;
      const applicationType = body?.applicationType === 'join_business' ? 'join_business' : 'create_business';
      const name = typeof body?.name === 'string' ? body.name.trim() : '';
      const registrationNumber = typeof body?.registrationNumber === 'string' ? body.registrationNumber.trim() : '';
      const description = typeof body?.description === 'string' ? body.description.trim() : '';
      const contactEmail = typeof body?.contactEmail === 'string' ? body.contactEmail.trim() : '';
      const contactPhone = typeof body?.contactPhone === 'string' ? body.contactPhone.trim() : '';
      const category = typeof body?.category === 'string' ? body.category.trim() : '';
      const requestedRole = typeof body?.requestedRole === 'string' ? body.requestedRole.trim() : '';
      const organizationName = typeof body?.organizationName === 'string' ? body.organizationName.trim() : '';

      const allowedRoles = new Set([
        'business_owner', 'seller', 'staff_member', 'service_provider',
        'school_administrator', 'finance_officer', 'risk_security_officer',
      ]);

      if (!name || name.length > 200 || description.length > 5000 || contactEmail.length > 320 ||
          contactPhone.length > 50 || category.length > 100 || registrationNumber.length > 100 ||
          requestedRole.length > 80 || organizationName.length > 200) {
        return errorResponse(res, 'INVALID_REQUEST', 'Business application data is invalid.');
      }
      if (!contactEmail || !contactPhone || !category || !description || !requestedRole || !allowedRoles.has(requestedRole)) {
        return errorResponse(res, 'INVALID_REQUEST', 'Complete business details and a valid requested role are required.');
      }
      if (applicationType === 'join_business' && !organizationName) {
        return errorResponse(res, 'INVALID_REQUEST', 'Enter the organization or business you want to join.');
      }

      const existingPending = await adminDb.collection('businessApplications')
        .where('applicantUid', '==', uid)
        .where('status', '==', 'pending')
        .limit(1).get();
      if (!existingPending.empty) {
        return errorResponse(res, 'BLOCKED', 'You already have a business application under review.', 409);
      }

      const now = Timestamp.now();
      const applicationRef = adminDb.collection('businessApplications').doc();
      await applicationRef.set({
        applicantUid: uid,
        applicationType,
        name,
        organizationName: organizationName || null,
        registrationNumber,
        description,
        contactEmail,
        contactPhone,
        category,
        requestedRole,
        status: 'pending',
        verificationStatus: 'unverified',
        createdAt: now,
        updatedAt: now,
      });

      return res.status(201).json({ applicationId: applicationRef.id, status: 'pending' });
    } catch (error) {
      console.error('Business application submission failed:', error);
      return errorResponse(res, 'SERVICE_UNAVAILABLE', 'Unable to submit your business application right now.');
    }
  });

  app.get("/api/business/applications", authenticate, async (req, res) => {
    const uid = (req as any).user?.uid as string | undefined;
    if (!uid) return errorResponse(res, 'UNAUTHENTICATED', 'Authentication is required.');
    try {
      const snapshot = await adminDb.collection('businessApplications')
        .where('applicantUid', '==', uid)
        .orderBy('createdAt', 'desc')
        .limit(20).get();
      return res.status(200).json({
        applications: snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
      });
    } catch (error) {
      console.error('Business application lookup failed:', error);
      return errorResponse(res, 'SERVICE_UNAVAILABLE', 'Unable to load your business applications.');
    }
  });

  app.get("/api/admin/business-applications", authenticate, requirePermission('access:admin_tools'), async (req, res) => {
    const adminUid = (req as any).user?.uid as string | undefined;
    if (!adminUid) return errorResponse(res, 'UNAUTHENTICATED', 'Authentication is required.');
    try {
      const adminSnapshot = await adminDb.collection('users').doc(adminUid).get();
      const roles = Array.isArray(adminSnapshot.data()?.roles) ? adminSnapshot.data()?.roles : [];
      if (!roles.some((role: unknown) => ['platform_admin', 'super_admin', 'administrator'].includes(String(role)))) {
        return errorResponse(res, 'FORBIDDEN', 'Platform administration access is required.', 403);
      }
      const status = typeof req.query.status === 'string' ? req.query.status : 'pending';
      const allowedStatuses = new Set(['pending', 'approved', 'declined', 'all']);
      if (!allowedStatuses.has(status)) return errorResponse(res, 'INVALID_REQUEST', 'Invalid application status.');
      let query: FirebaseFirestore.Query = adminDb.collection('businessApplications').orderBy('createdAt', 'desc').limit(100);
      if (status !== 'all') query = adminDb.collection('businessApplications').where('status', '==', status).orderBy('createdAt', 'desc').limit(100);
      const snapshot = await query.get();
      const applications = await Promise.all(snapshot.docs.map(async (applicationDoc) => {
        const data = applicationDoc.data();
        const applicantSnapshot = await adminDb.collection('users').doc(String(data.applicantUid || '')).get();
        const applicant = applicantSnapshot.data() || {};
        return {
          id: applicationDoc.id,
          ...data,
          applicant: {
            uid: data.applicantUid,
            fullName: applicant.fullName || applicant.displayName || 'Unique One User',
            email: applicant.email || data.contactEmail || '',
            phone: applicant.phone || data.contactPhone || '',
            uniqueOneId: applicant.uniqueOneId || '',
          },
        };
      }));
      return res.status(200).json({ applications });
    } catch (error) {
      console.error('Admin business application lookup failed:', error);
      return errorResponse(res, 'SERVICE_UNAVAILABLE', 'Unable to load business applications.');
    }
  });

  app.patch("/api/admin/business-applications/:id", authenticate, requirePermission('access:admin_tools'), async (req, res) => {
    const adminUid = (req as any).user?.uid as string | undefined;
    if (!adminUid) return errorResponse(res, 'UNAUTHENTICATED', 'Authentication is required.');
    try {
      const adminSnapshot = await adminDb.collection('users').doc(adminUid).get();
      const roles = Array.isArray(adminSnapshot.data()?.roles) ? adminSnapshot.data()?.roles : [];
      if (!roles.some((role: unknown) => ['platform_admin', 'super_admin'].includes(String(role)))) {
        return errorResponse(res, 'FORBIDDEN', 'Platform or Super Admin access is required.', 403);
      }
      const applicationRef = adminDb.collection('businessApplications').doc(req.params.id);
      const applicationSnapshot = await applicationRef.get();
      if (!applicationSnapshot.exists) return errorResponse(res, 'NOT_FOUND', 'Business application not found.', 404);
      const application = applicationSnapshot.data() as Record<string, any>;
      if (application.status !== 'pending') return errorResponse(res, 'INVALID_REQUEST', 'Only pending business applications can be reviewed.', 409);
      const action = req.body?.action === 'approve' ? 'approve' : req.body?.action === 'decline' ? 'decline' : '';
      const reviewNote = typeof req.body?.reviewNote === 'string' ? req.body.reviewNote.trim().slice(0, 2000) : '';
      if (!action) return errorResponse(res, 'INVALID_REQUEST', 'Choose approve or decline.');

      const now = Timestamp.now();
      if (action === 'decline') {
        await applicationRef.update({ status: 'declined', reviewNote, reviewedBy: adminUid, reviewedAt: now, updatedAt: now });
        await adminDb.collection('audit_logs').add({
          action: 'business_application_declined',
          actorUid: adminUid,
          targetId: applicationRef.id,
          applicantUid: application.applicantUid,
          createdAt: now,
          note: reviewNote,
        });
        return res.status(200).json({ status: 'declined' });
      }

      const applicantUid = String(application.applicantUid || '');
      const userRef = adminDb.collection('users').doc(applicantUid);
      const businessRef = adminDb.collection('businesses').doc();
      await adminDb.runTransaction(async (transaction) => {
        const userSnapshot = await transaction.get(userRef);
        if (!userSnapshot.exists) throw new Error('APPLICANT_NOT_FOUND');
        const userData = userSnapshot.data() || {};
        const existingRoles = Array.isArray(userData.roles) ? userData.roles.filter((role: unknown): role is string => typeof role === 'string') : [];
        const requestedRole = String(application.requestedRole || 'business_owner');

        if (application.applicationType === 'create_business') {
          transaction.set(businessRef, {
            ownerUid: applicantUid,
            name: application.name,
            registrationNumber: application.registrationNumber || '',
            description: application.description,
            contactEmail: application.contactEmail,
            contactPhone: application.contactPhone,
            categories: [application.category],
            status: 'active',
            verificationStatus: 'verified',
            createdAt: now,
            updatedAt: now,
            approvedAt: now,
            approvedBy: adminUid,
          });
        }

        transaction.update(userRef, {
          roles: Array.from(new Set([...existingRoles, requestedRole])),
          businessAccessApprovedAt: now,
          businessAccessApprovedBy: adminUid,
        });
        transaction.update(applicationRef, {
          status: 'approved',
          reviewNote,
          reviewedBy: adminUid,
          reviewedAt: now,
          updatedAt: now,
          businessId: application.applicationType === 'create_business' ? businessRef.id : null,
        });
      });

      await adminDb.collection('audit_logs').add({
        action: 'business_application_approved',
        actorUid: adminUid,
        targetId: applicationRef.id,
        applicantUid,
        createdAt: now,
        note: reviewNote,
      });

      return res.status(200).json({ status: 'approved', businessId: application.applicationType === 'create_business' ? businessRef.id : null });
    } catch (error) {
      if (error instanceof Error && error.message === 'APPLICANT_NOT_FOUND') {
        return errorResponse(res, 'NOT_FOUND', 'The applicant account no longer exists.', 404);
      }
      console.error('Admin business application review failed:', error);
      return errorResponse(res, 'SERVICE_UNAVAILABLE', 'Unable to review this business application right now.');
    }
  });

  app.patch("/api/admin/users/verification", rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: true, legacyHeaders: false }), authenticate, requirePermission('manage:verification'), async (req, res) => {
    const adminUid = (req as any).user?.uid as string | undefined;
    if (!adminUid) return errorResponse(res, 'UNAUTHENTICATED', 'Authentication is required.');
    try {
      // Access is enforced centrally by requirePermission('manage:verification').
      // Keep this handler role-neutral so risk_security_officer can use the permission it is granted.

      const body = req.body as Record<string, unknown>;
      const uid = typeof body?.uid === 'string' ? body.uid.trim() : '';
      const allowedStatuses = new Set(['unverified', 'email_verified', 'phone_verified', 'fully_verified']);
      const verificationStatus = typeof body?.verificationStatus === 'string' ? body.verificationStatus : '';
      if (!isSafeFirebaseUid(uid) || !allowedStatuses.has(verificationStatus)) {
        return errorResponse(res, 'INVALID_REQUEST', 'A valid user ID and verification status are required.');
      }
      if (uid === adminUid) return errorResponse(res, 'INVALID_REQUEST', 'Administrator self-verification changes are not allowed through this endpoint.');

      const userRef = adminDb.collection('users').doc(uid);
      const userSnapshot = await userRef.get();
      if (!userSnapshot.exists) return errorResponse(res, 'NOT_FOUND', 'The requested user does not exist.');

      const now = Timestamp.now();
      await adminDb.runTransaction(async transaction => {
        transaction.update(userRef, { verificationStatus, verificationUpdatedAt: now, verificationUpdatedBy: adminUid });
        const auditRef = adminDb.collection('audit_logs').doc();
        transaction.set(auditRef, {
          action: 'user_verification_status_changed',
          actorUid: adminUid,
          targetUid: uid,
          verificationStatus,
          createdAt: now,
        });
      });
      return res.status(200).json({ uid, verificationStatus });
    } catch (error) {
      console.error('Admin verification update failed:', error);
      return errorResponse(res, 'SERVICE_UNAVAILABLE', 'Unable to update verification status right now.');
    }
  });
  app.get("/api/users/resolve", rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: true, legacyHeaders: false }), authenticate, async (req, res) => {
    try {
      const identifier = typeof req.query.identifier === 'string' ? req.query.identifier.trim() : '';
      if (!identifier || identifier.length > 320) {
        return errorResponse(res, 'INVALID_REQUEST', 'A recipient identifier is required.');
      }

      const normalizedEmail = identifier.toLowerCase();
      const [emailSnapshot, phoneSnapshot, uniqueOneIdSnapshot] = await Promise.all([
        adminDb.collection('users').where('email', '==', identifier).limit(1).get(),
        adminDb.collection('users').where('phone', '==', identifier).limit(1).get(),
        adminDb.collection('users').where('uniqueOneId', '==', identifier).limit(1).get(),
      ]);

      const normalizedEmailSnapshot = normalizedEmail !== identifier
        ? await adminDb.collection('users').where('email', '==', normalizedEmail).limit(1).get()
        : null;

      const match = [emailSnapshot, normalizedEmailSnapshot, phoneSnapshot, uniqueOneIdSnapshot]
        .find((snapshot) => snapshot && !snapshot.empty);

      if (!match || match.empty) {
        return errorResponse(res, 'RECIPIENT_NOT_FOUND', 'No Unique One user matches that recipient identifier.');
      }

      const userDoc = match.docs[0];
      const data = userDoc.data() as Record<string, unknown>;
      return res.status(200).json({
        uid: userDoc.id,
        fullName: typeof data.fullName === 'string' ? data.fullName : 'Unique One user',
        uniqueOneId: typeof data.uniqueOneId === 'string' ? data.uniqueOneId : undefined,
        profilePhotoUrl: typeof data.profilePhotoUrl === 'string' ? data.profilePhotoUrl : undefined,
      });
    } catch (error) {
      console.error('Recipient lookup failed:', error);
      return errorResponse(res, 'SERVICE_UNAVAILABLE', 'We could not verify that recipient right now.');
    }
  });
  app.post("/api/payment-requests", authenticate, rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: true, legacyHeaders: false }), async (req, res) => {
    const senderId = (req as any).user?.uid as string | undefined;
    if (!senderId) return errorResponse(res, 'UNAUTHENTICATED', 'Missing authenticated user.');
    try {
      const body = req.body as Record<string, unknown>;
      const recipientIdentifier = typeof body?.recipientIdentifier === 'string' ? body.recipientIdentifier.trim() : '';
      const description = typeof body?.description === 'string' ? body.description.trim() : '';
      const amount = body?.amount;
      const dueDate = typeof body?.dueDate === 'string' ? body.dueDate : undefined;
      const status = body?.status === 'draft' ? 'draft' : body?.status === 'sent' ? 'sent' : '';
      if (!recipientIdentifier || recipientIdentifier.length > 320 || !description || description.length > 500) return errorResponse(res, 'INVALID_REQUEST', 'Recipient and description are required and must be valid.');
      if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0 || amount > 1000000000000) return errorResponse(res, 'INVALID_AMOUNT', 'The payment request amount is invalid.');
      if (!status) return errorResponse(res, 'INVALID_REQUEST', 'A valid payment request status is required.');
      const normalizedEmail = recipientIdentifier.toLowerCase();
      const [emailSnapshot, phoneSnapshot, uniqueOneIdSnapshot] = await Promise.all([
        adminDb.collection('users').where('email', '==', recipientIdentifier).limit(1).get(),
        adminDb.collection('users').where('phone', '==', recipientIdentifier).limit(1).get(),
        adminDb.collection('users').where('uniqueOneId', '==', recipientIdentifier).limit(1).get(),
      ]);
      const normalizedEmailSnapshot = normalizedEmail !== recipientIdentifier ? await adminDb.collection('users').where('email', '==', normalizedEmail).limit(1).get() : null;
      const match = [emailSnapshot, normalizedEmailSnapshot, phoneSnapshot, uniqueOneIdSnapshot].find((snapshot) => snapshot && !snapshot.empty);
      if (!match || match.empty) return errorResponse(res, 'RECIPIENT_NOT_FOUND', 'No Unique One user matches that recipient identifier.');
      const recipientDoc = match.docs[0];
      if (recipientDoc.id === senderId) return errorResponse(res, 'SELF_TRANSFER_NOT_ALLOWED', 'You cannot create a payment request to yourself.');
      const recipientData = recipientDoc.data() as Record<string, unknown>;
      const now = Timestamp.now().toDate().toISOString();
      const ref = adminDb.collection('payment_requests').doc();
      await ref.create({
        senderId, recipientId: recipientDoc.id,
        recipientIdentifier,
        recipientName: typeof recipientData.fullName === 'string' ? recipientData.fullName : 'Unique One user',
        amount: Math.round(amount * 100) / 100, currency: 'NGN', description,
        ...(dueDate ? { dueDate } : {}), status, createdAt: now, updatedAt: now,
      });
      await adminDb.collection('audit_logs').add({
        action: 'payment_request.created',
        actorUid: senderId,
        targetUid: recipientDoc.id,
        resource: 'payment_request',
        resourceId: ref.id,
        amount: Math.round(amount * 100) / 100,
        currency: 'NGN',
        status,
        timestamp: Timestamp.fromDate(new Date(now)),
      });
      return res.status(201).json({ id: ref.id, recipientId: recipientDoc.id, status });
    } catch (error) {
      console.error('Payment request creation failed:', error);
      return errorResponse(res, 'SERVICE_UNAVAILABLE', 'We could not create the payment request right now.');
    }
  });

  app.get("/api/wallet", rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: true, legacyHeaders: false }), authenticate, async (req, res) => {
    const uid = (req as any).user?.uid as string | undefined;
    if (!uid) return errorResponse(res, 'UNAUTHENTICATED', 'Missing authenticated user.');
    try {
      const snapshot = await adminDb.collection('wallets').doc(uid).get();
      if (!snapshot.exists) return errorResponse(res, 'WALLET_NOT_FOUND', 'No wallet exists for this user.', 404);
      return res.status(200).json(validateWalletDocument(snapshot.data(), uid));
    } catch (error) { console.error('Error fetching wallet:', error); return errorResponse(res, 'SERVICE_UNAVAILABLE', 'Failed to fetch wallet.'); }
  });
  app.post("/api/wallet", rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: true, legacyHeaders: false }), authenticate, async (req, res) => {
    const uid = (req as any).user?.uid as string | undefined;
    if (!uid) return errorResponse(res, 'UNAUTHENTICATED', 'Missing authenticated user.');
    try {
      const wallet = await ensureWalletForUser(uid);
      return res.status(200).json({ uid: wallet.uid, currency: wallet.currency, availableBalanceMinor: wallet.availableBalanceMinor, status: wallet.status, createdAt: wallet.createdAt.toDate().toISOString(), updatedAt: wallet.updatedAt.toDate().toISOString() });
    } catch (error) { console.error("Error initializing wallet:", error); return errorResponse(res, 'SERVICE_UNAVAILABLE', 'Failed to initialize wallet.'); }
  });
  app.post('/api/auth/passkey/registration-options', rateLimit({ windowMs: 5 * 60_000, limit: 5, standardHeaders: true, legacyHeaders: false, handler: (_req, res) => errorResponse(res, 'RATE_LIMITED', 'Too many passkey setup attempts. Please try again later.') }), authenticate, async (req, res) => {
    try {
      const uid = sanitizeRequiredAuthUid((req as any).user?.uid);
      const { origin, rpId } = requestWebAuthnOrigin(req);
      const crypto = require('crypto');
      const challenge = crypto.randomBytes(32);
      const challengeId = bufferToBase64Url(crypto.randomBytes(18));
      await adminDb.collection(PASSKEY_CHALLENGES_COLLECTION).doc(challengeId).set({
        uid, type: 'registration', challenge: bufferToBase64Url(challenge), origin, rpId,
        expiresAt: Timestamp.fromMillis(Date.now() + PASSKEY_CHALLENGE_TTL_MS), createdAt: Timestamp.now(),
      });
      const user = await getAuth().getUser(uid);
      return res.json({
        challenge: bufferToBase64Url(challenge), challengeId, rp: { name: 'Unique One', id: rpId },
        user: { id: bufferToBase64Url(Buffer.from(uid, 'utf8')), name: user.email || user.phoneNumber || uid, displayName: user.displayName || uid },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
        authenticatorSelection: { residentKey: 'preferred', userVerification: 'required' }, timeout: 120000, attestation: 'none'
      });
    } catch (error) {
      console.error('Passkey registration options failed:', error);
      return errorResponse(res, 'SERVICE_UNAVAILABLE', 'Unable to prepare biometric security setup.');
    }
  });

  app.post('/api/auth/passkey/register', rateLimit({ windowMs: 5 * 60_000, limit: 5, standardHeaders: true, legacyHeaders: false, handler: (_req, res) => errorResponse(res, 'RATE_LIMITED', 'Too many passkey registration attempts. Please try again later.') }), authenticate, async (req, res) => {
    try {
      const uid = sanitizeRequiredAuthUid((req as any).user?.uid);
      const challengeId = typeof req.body?.challengeId === 'string' ? req.body.challengeId : '';
      const credentialId = typeof req.body?.credentialId === 'string' ? req.body.credentialId : '';
      const clientDataJSON = base64UrlToBuffer(String(req.body?.clientDataJSON || ''));
      const authenticatorData = base64UrlToBuffer(String(req.body?.authenticatorData || ''));
      const publicKey = base64UrlToBuffer(String(req.body?.publicKey || ''));
      if (!challengeId || !credentialId || !/^[A-Za-z0-9_-]{16,1024}$/.test(credentialId) || clientDataJSON.length > 4096 || authenticatorData.length < 37 || publicKey.length < 32 || publicKey.length > 4096) return errorResponse(res, 'INVALID_REQUEST', 'The passkey registration response is invalid.');
      const challengeRef = adminDb.collection(PASSKEY_CHALLENGES_COLLECTION).doc(challengeId);
      const challengeSnap = await challengeRef.get();
      if (!challengeSnap.exists) return errorResponse(res, 'FORBIDDEN', 'The passkey setup challenge is invalid or expired.');
      const challengeData = challengeSnap.data()!;
      await challengeRef.delete();
      if (challengeData.uid !== uid || challengeData.type !== 'registration' || challengeData.expiresAt.toMillis() < Date.now()) return errorResponse(res, 'FORBIDDEN', 'The passkey setup challenge is invalid or expired.');
      const { origin, rpId } = requestWebAuthnOrigin(req);
      let clientData: any;
      try { clientData = JSON.parse(clientDataJSON.toString('utf8')); } catch { return errorResponse(res, 'INVALID_REQUEST', 'The passkey client data is invalid.'); }
      if (challengeData.origin !== origin || challengeData.rpId !== rpId || clientData.type !== 'webauthn.create' || clientData.challenge !== challengeData.challenge || clientData.origin !== origin) return errorResponse(res, 'FORBIDDEN', 'The passkey registration could not be verified.');
      const crypto = require('crypto');
      if (!authenticatorData.subarray(0, 32).equals(crypto.createHash('sha256').update(rpId).digest())) return errorResponse(res, 'FORBIDDEN', 'The passkey relying-party binding is invalid.');
      const flags = authenticatorData[32];
      if ((flags & 0x45) !== 0x45) return errorResponse(res, 'FORBIDDEN', 'Biometric/user verification is required to register this credential.');
      const credentialRef = adminDb.collection('authCredentials').doc(uid).collection(PASSKEY_COLLECTION).doc(credentialId);
      const existingCredential = await credentialRef.get();
      if (existingCredential.exists) return errorResponse(res, 'INVALID_REQUEST', 'This biometric credential is already registered.');
      let parsedPublicKey: ReturnType<typeof crypto.createPublicKey>;
      try {
        parsedPublicKey = crypto.createPublicKey({ key: publicKey, format: 'der', type: 'spki' });
        const keyDetails = parsedPublicKey.asymmetricKeyDetails;
        if (parsedPublicKey.asymmetricKeyType !== 'ec' || keyDetails?.namedCurve !== 'prime256v1') throw new Error('unsupported credential key');
      } catch {
        return errorResponse(res, 'INVALID_REQUEST', 'The biometric credential key is invalid.');
      }
      await credentialRef.create({
        credentialId, publicKey: publicKey.toString('base64'), algorithm: -7, signCount: authenticatorData.readUInt32BE(33),
        createdAt: Timestamp.now(), lastUsedAt: Timestamp.now(), origin, rpId
      });
      return res.json({ ok: true, registered: true });
    } catch (error) {
      console.error('Passkey registration failed:', error);
      return errorResponse(res, 'SERVICE_UNAVAILABLE', 'Unable to register biometric security right now.');
    }
  });

  app.post('/api/auth/passkey/assertion-options', rateLimit({ windowMs: 5 * 60_000, limit: 12, standardHeaders: true, legacyHeaders: false, handler: (_req, res) => errorResponse(res, 'RATE_LIMITED', 'Too many biometric verification attempts. Please try again later.') }), authenticate, async (req, res) => {
    try {
      const uid = sanitizeRequiredAuthUid((req as any).user?.uid);
      const transactionBinding = typeof req.body?.transactionBinding === 'string' && req.body.transactionBinding.length <= 512 ? req.body.transactionBinding : null;
      const credentials = await adminDb.collection('authCredentials').doc(uid).collection(PASSKEY_COLLECTION).get();
      if (credentials.empty) return errorResponse(res, 'NOT_FOUND', 'No biometric security credential is registered on this account.');
      const { origin, rpId } = requestWebAuthnOrigin(req);
      const crypto = require('crypto');
      const challenge = crypto.randomBytes(32);
      const challengeId = bufferToBase64Url(crypto.randomBytes(18));
      await adminDb.collection(PASSKEY_CHALLENGES_COLLECTION).doc(challengeId).set({
        uid, type: 'assertion', challenge: bufferToBase64Url(challenge), origin, rpId,
        ...(transactionBinding ? { transactionBinding } : {}),
        expiresAt: Timestamp.fromMillis(Date.now() + PASSKEY_CHALLENGE_TTL_MS), createdAt: Timestamp.now()
      });
      return res.json({ challenge: bufferToBase64Url(challenge), challengeId, rpId, timeout: 120000, userVerification: 'required', allowCredentials: credentials.docs.map(doc => ({ type: 'public-key', id: doc.id })) });
    } catch (error) {
      console.error('Passkey assertion options failed:', error);
      return errorResponse(res, 'SERVICE_UNAVAILABLE', 'Unable to prepare biometric verification.');
    }
  });

  app.post('/api/auth/passkey/assert', rateLimit({ windowMs: 5 * 60_000, limit: 12, standardHeaders: true, legacyHeaders: false, handler: (_req, res) => errorResponse(res, 'RATE_LIMITED', 'Too many biometric verification attempts. Please try again shortly.') }), authenticate, async (req, res) => {
    try {
      const uid = sanitizeRequiredAuthUid((req as any).user?.uid);
      const challengeId = typeof req.body?.challengeId === 'string' ? req.body.challengeId : '';
      const credentialId = typeof req.body?.credentialId === 'string' ? req.body.credentialId : '';
      const clientDataJSON = base64UrlToBuffer(String(req.body?.clientDataJSON || ''));
      const authenticatorData = base64UrlToBuffer(String(req.body?.authenticatorData || ''));
      const signature = base64UrlToBuffer(String(req.body?.signature || ''));
      if (!challengeId || !credentialId || clientDataJSON.length > 4096 || authenticatorData.length < 37 || signature.length < 32) return errorResponse(res, 'INVALID_REQUEST', 'The biometric response is invalid.');
      const challengeRef = adminDb.collection(PASSKEY_CHALLENGES_COLLECTION).doc(challengeId);
      let challengeData: FirebaseFirestore.DocumentData | undefined;
      try {
        challengeData = await adminDb.runTransaction(async transaction => {
          const challengeSnap = await transaction.get(challengeRef);
          if (!challengeSnap.exists) return undefined;
          const data = challengeSnap.data();
          transaction.delete(challengeRef);
          return data;
        });
      } catch (error) {
        console.error('Passkey challenge consumption failed:', error);
        return errorResponse(res, 'SERVICE_UNAVAILABLE', 'Biometric verification could not be completed safely. Please try again.');
      }
      if (!challengeData || challengeData.uid !== uid || challengeData.type !== 'assertion' || challengeData.expiresAt.toMillis() < Date.now()) return errorResponse(res, 'FORBIDDEN', 'The biometric challenge is invalid or expired.');
      // Transaction-bound challenges must only be consumed by the transaction endpoint that can verify the exact binding.
      // Never allow the generic assertion endpoint to turn a payment-bound challenge into a generic "verified" result.
      if (typeof challengeData.transactionBinding === 'string' && challengeData.transactionBinding.length > 0) {
        return errorResponse(res, 'FORBIDDEN', 'This biometric challenge is reserved for its specific transaction.');
      }
      const { origin, rpId } = requestWebAuthnOrigin(req);
      let clientData: any;
      try { clientData = JSON.parse(clientDataJSON.toString('utf8')); } catch { return errorResponse(res, 'INVALID_REQUEST', 'The biometric client data is invalid.'); }
      if (challengeData.origin !== origin || challengeData.rpId !== rpId || clientData.type !== 'webauthn.get' || clientData.challenge !== challengeData.challenge || clientData.origin !== origin) return errorResponse(res, 'FORBIDDEN', 'The biometric assertion could not be verified.');
      const crypto = require('crypto');
      if (!authenticatorData.subarray(0, 32).equals(crypto.createHash('sha256').update(rpId).digest()) || (authenticatorData[32] & 0x05) !== 0x05) return errorResponse(res, 'FORBIDDEN', 'User verification is required.');
      const credentialRef = adminDb.collection('authCredentials').doc(uid).collection(PASSKEY_COLLECTION).doc(credentialId);
      const credentialSnap = await credentialRef.get();
      if (!credentialSnap.exists) return errorResponse(res, 'FORBIDDEN', 'This biometric credential is not registered for the account.');
      const credential = credentialSnap.data()!;
      const publicKey = crypto.createPublicKey({ key: Buffer.from(String(credential.publicKey), 'base64'), format: 'der', type: 'spki' });
      const signedData = Buffer.concat([authenticatorData, crypto.createHash('sha256').update(clientDataJSON).digest()]);
      if (!crypto.verify('sha256', signedData, publicKey, signature)) return errorResponse(res, 'FORBIDDEN', 'Biometric verification failed.');
      const signCount = authenticatorData.readUInt32BE(33);
      const previousCount = Number(credential.signCount || 0);
      if (previousCount > 0 && signCount > 0 && signCount <= previousCount) return errorResponse(res, 'FORBIDDEN', 'The biometric credential counter is invalid.');
      await credentialRef.update({ signCount, lastUsedAt: Timestamp.now() });
      return res.json({ ok: true, verified: true });
    } catch (error) {
      console.error('Passkey assertion failed:', error);
      return errorResponse(res, 'SERVICE_UNAVAILABLE', 'Biometric verification could not be completed.');
    }
  });

  app.post('/api/auth/transaction-pin/verify', rateLimit({
    windowMs: 5 * 60_000,
    limit: 8,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      const uid = (req as any).user?.uid;
      return isSafeFirebaseUid(uid) ? uid : ipKeyGenerator(req.ip);
    },
    handler: (_req, res) => errorResponse(res, 'RATE_LIMITED', 'Too many PIN attempts. Please try again later.'),
  }), authenticate, async (req, res) => {
    try {
      const uid = sanitizeRequiredAuthUid((req as any).user?.uid);
      const pin = validateTransactionPin(req.body?.transactionPin);
      const valid = await verifyTransactionPin(uid, pin);
      if (!valid) return errorResponse(res, 'FORBIDDEN', 'Incorrect Transaction PIN.');
      return res.json({ ok: true, verified: true });
    } catch (error: any) {
      return errorResponse(res, error instanceof RequestValidationError ? error.code : 'INVALID_REQUEST', error?.message || 'PIN verification failed.');
    }
  });

  app.post("/api/wallet/transfer", rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: true, legacyHeaders: false, handler: (_req, res) => errorResponse(res, 'RATE_LIMITED', 'Too many transfer requests were made. Please try again shortly.') }), authenticate, async (req, res) => {
    const senderUid = (req as any).user?.uid as string | undefined;
    if (!senderUid) return errorResponse(res, 'UNAUTHENTICATED', 'Authentication is required to initiate a transfer.');
    let validatedRequest: TransferRequestInput;
    try { validatedRequest = validateTransferRequest(req.body, senderUid); }
    catch (error) {
      const code = (error as Error).message as TransferErrorCode;
      const messages: Record<TransferErrorCode, string> = {
        UNAUTHENTICATED: 'Authentication is required to initiate a transfer.', INVALID_REQUEST: 'The transfer request body is malformed or contains unsupported fields.', INVALID_RECIPIENT: 'A valid recipient UID is required.', RECIPIENT_NOT_FOUND: 'The recipient does not exist.', SELF_TRANSFER_NOT_ALLOWED: 'A wallet transfer to yourself is not allowed.', INVALID_AMOUNT: 'Transfer amount must be a positive integer minor-unit amount.', INVALID_CURRENCY: 'Only NGN transfers are supported.', INVALID_IDEMPOTENCY_KEY: 'The idempotency key is invalid or exceeds the allowed length.', IDEMPOTENCY_KEY_CONFLICT: 'This idempotency key was already used with different transfer parameters.', TRANSFER_ALREADY_COMPLETED: 'This transfer has already been completed.', TRANSFER_IN_PROGRESS: 'A transfer with this idempotency key is already in progress.', WALLET_NOT_FOUND: 'A wallet record is missing for this transfer.', WALLET_UNAVAILABLE: 'The wallet status or currency configuration is not valid for transfer.', INSUFFICIENT_FUNDS: 'The sender wallet does not have enough funds.', TRANSACTION_FAILED: 'The transfer failed while processing the transaction.', SERVICE_UNAVAILABLE: 'The transfer service is temporarily unavailable.', UNAVAILABLE: 'The requested transfer service is currently unavailable.',
        RATE_LIMITED: 'Too many requests were made. Please try again shortly.', BIOMETRIC_REQUIRED: 'Biometric verification is required for this transfer.', NOT_FOUND: 'The requested resource was not found.', BLOCKED: 'Messaging is unavailable because one of the users has blocked the other.', FORBIDDEN: 'You are not permitted to perform this operation.', INSUFFICIENT_STOCK: 'The requested quantity exceeds available stock.',
      };
      return errorResponse(res, code, messages[code] ?? 'Invalid transfer request.');
    }
    const { recipientId, amountMinor, currency, idempotencyKey, description, transactionPin } = validatedRequest;
    try {
      if (!(await verifyTransactionPin(senderUid, transactionPin))) return errorResponse(res, 'FORBIDDEN', 'Incorrect Transaction PIN.');
    } catch (error) {
      console.error('Transaction PIN verification failed:', error);
      return errorResponse(res, 'SERVICE_UNAVAILABLE', 'Unable to verify the Transaction PIN right now.');
    }
    const previousRecipientTransaction = await adminDb.collection('transactions')
      .where('senderId', '==', senderUid)
      .where('recipientId', '==', recipientId)
      .limit(1)
      .get();
    const isNewRecipient = previousRecipientTransaction.empty;

    const recentTransactionsSnapshot = await adminDb.collection('transactions')
      .where('senderId', '==', senderUid)
      .limit(20)
      .get();
    const velocityWindowStart = Date.now() - 10 * 60 * 1000;
    const recentTransactionCount = recentTransactionsSnapshot.docs.reduce((count, doc) => {
      const createdAt = doc.data().createdAt;
      const createdAtMs = typeof createdAt?.toMillis === 'function' ? createdAt.toMillis() : 0;
      return count + (createdAtMs >= velocityWindowStart ? 1 : 0);
    }, 0);

    const authPolicy = getTransactionAuthPolicy({
      amountMinor,
      transactionType: 'transfer',
      isNewRecipient,
      recentTransactionCount,
    });
    const biometricLevel = authPolicy.biometricLevel;
    const biometricRequired = authPolicy.requiredFactors.includes('biometric');
    if (biometricRequired) {
      const biometricAssertion = req.body?.biometricAssertion;
      if (!biometricAssertion?.challengeId || !biometricAssertion?.credentialId || !biometricAssertion?.clientDataJSON || !biometricAssertion?.authenticatorData || !biometricAssertion?.signature) return errorResponse(res, 'BIOMETRIC_REQUIRED', biometricLevel >= 3 ? 'Biometric verification is required for transfers of ₦500,000 or more.' : biometricLevel >= 2 ? 'Biometric verification is required for transfers of ₦200,000 or more.' : biometricLevel >= 1 ? 'Biometric verification is required for transfers of ₦50,000 or more.' : 'Biometric verification is required for your first wallet transaction.');
      const challengeRef = adminDb.collection(PASSKEY_CHALLENGES_COLLECTION).doc(String(biometricAssertion.challengeId));
      let challengeData: FirebaseFirestore.DocumentData | undefined;
      try {
        challengeData = await adminDb.runTransaction(async transaction => {
          const challengeSnap = await transaction.get(challengeRef);
          if (!challengeSnap.exists) return undefined;
          const data = challengeSnap.data();
          transaction.delete(challengeRef);
          return data;
        });
      } catch (error) {
        console.error('Biometric challenge consumption failed:', error);
        return errorResponse(res, 'SERVICE_UNAVAILABLE', 'Biometric verification could not be completed safely. Please try again.');
      }
      if (!challengeData) return errorResponse(res, 'BIOMETRIC_REQUIRED', 'Biometric verification is required. Please try again.');
      const { origin, rpId } = requestWebAuthnOrigin(req);
      const clientDataJSON = base64UrlToBuffer(String(biometricAssertion.clientDataJSON));
      const authenticatorData = base64UrlToBuffer(String(biometricAssertion.authenticatorData));
      const signature = base64UrlToBuffer(String(biometricAssertion.signature));
      let clientData: any;
      try { clientData = JSON.parse(clientDataJSON.toString('utf8')); } catch { return errorResponse(res, 'BIOMETRIC_REQUIRED', 'Biometric verification could not be verified.'); }
      if (challengeData.uid !== senderUid || challengeData.type !== 'assertion' || challengeData.expiresAt.toMillis() < Date.now() || challengeData.origin !== origin || challengeData.rpId !== rpId || clientData.type !== 'webauthn.get' || clientData.challenge !== challengeData.challenge || clientData.origin !== origin) return errorResponse(res, 'BIOMETRIC_REQUIRED', 'Biometric verification could not be verified.');
      const crypto = require('crypto');
      if (!authenticatorData.subarray(0, 32).equals(crypto.createHash('sha256').update(rpId).digest()) || (authenticatorData[32] & 0x05) !== 0x05) return errorResponse(res, 'BIOMETRIC_REQUIRED', 'Biometric verification requires user verification.');
      const credentialRef = adminDb.collection('authCredentials').doc(senderUid).collection(PASSKEY_COLLECTION).doc(String(biometricAssertion.credentialId));
      const credentialSnap = await credentialRef.get();
      if (!credentialSnap.exists) return errorResponse(res, 'BIOMETRIC_REQUIRED', 'This biometric credential is not registered.');
      const credential = credentialSnap.data()!;
      const publicKey = crypto.createPublicKey({ key: Buffer.from(String(credential.publicKey), 'base64'), format: 'der', type: 'spki' });
      const signedData = Buffer.concat([authenticatorData, crypto.createHash('sha256').update(clientDataJSON).digest()]);
      if (!crypto.verify('sha256', signedData, publicKey, signature)) return errorResponse(res, 'BIOMETRIC_REQUIRED', 'Biometric verification failed.');
      const signCount = authenticatorData.readUInt32BE(33);
      const previousCount = Number(credential.signCount || 0);
      if (previousCount > 0 && signCount > 0 && signCount <= previousCount) return errorResponse(res, 'BIOMETRIC_REQUIRED', 'The biometric credential counter is invalid.');
      await credentialRef.update({ signCount, lastUsedAt: Timestamp.now() });
      const expectedBinding = 'wallet_transfer|' + senderUid + '|' + recipientId + '|' + amountMinor + '|' + currency + '|' + (description ?? '');
      if (challengeData.transactionBinding !== expectedBinding) return errorResponse(res, 'BIOMETRIC_REQUIRED', 'This biometric approval is not bound to this transfer.');
    }
    try {
      if (!(await readUserExists(recipientId))) return errorResponse(res, 'RECIPIENT_NOT_FOUND', 'The recipient user does not exist.');
    } catch (error) {
      console.error('Recipient lookup failed:', error);
      return errorResponse(res, 'SERVICE_UNAVAILABLE', 'Unable to validate the recipient at this time.');
    }
    const fingerprint = buildRequestFingerprint(senderUid, recipientId, amountMinor, currency, description);
    const idempotencyRef = adminDb.collection('walletIdempotency').doc(idempotencyDocumentId(senderUid, idempotencyKey));
    try {
      const transactionResult = await adminDb.runTransaction(async transaction => {
        const idempotencySnapshot = await transaction.get(idempotencyRef);
        if (idempotencySnapshot.exists) {
          const existing = idempotencySnapshot.data() as Record<string, unknown>;
          if (String(existing.requestFingerprint ?? '') !== fingerprint) return { error: { code: 'IDEMPOTENCY_KEY_CONFLICT' as TransferErrorCode, message: 'This idempotency key was already used with different transfer parameters.' } } as TransferErrorResponse;
          if (existing.status === 'completed') return existing.result as Record<string, unknown>;
          if (existing.status === 'failed') return existing.errorResult as Record<string, unknown>;
          if (existing.status === 'in_progress') return { error: { code: 'TRANSFER_IN_PROGRESS' as TransferErrorCode, message: 'A transfer with this idempotency key is already in progress.' } } as TransferErrorResponse;
        }
        const senderWalletRef = adminDb.collection('wallets').doc(senderUid);
        const recipientWalletRef = adminDb.collection('wallets').doc(recipientId);
        const [senderWalletSnapshot, recipientWalletSnapshot] = await Promise.all([transaction.get(senderWalletRef), transaction.get(recipientWalletRef)]);
        const writeFailure = (failure: TransferErrorResponse) => { transaction.set(idempotencyRef, { senderUid, recipientId, amountMinor, currency, description: description ?? '', requestFingerprint: fingerprint, status: 'failed', errorResult: failure, createdAt: Timestamp.now(), updatedAt: Timestamp.now() }); return failure; };
        if (!senderWalletSnapshot.exists || !recipientWalletSnapshot.exists) return writeFailure({ error: { code: 'WALLET_NOT_FOUND', message: 'Both sender and recipient wallets must already exist before transfer.' } });
        let senderWallet: WalletDocument; let recipientWallet: WalletDocument;
        try { senderWallet = validateWalletDocument(senderWalletSnapshot.data(), senderUid); recipientWallet = validateWalletDocument(recipientWalletSnapshot.data(), recipientId); }
        catch (_) { return writeFailure({ error: { code: 'WALLET_UNAVAILABLE', message: 'The wallet status or currency configuration is not valid for transfer.' } }); }
        if (senderWallet.status !== 'active' || recipientWallet.status !== 'active') return writeFailure({ error: { code: 'WALLET_UNAVAILABLE', message: 'One or both wallets are unavailable for transfer.' } });
        const senderBalance = senderWallet.availableBalanceMinor; const recipientBalance = recipientWallet.availableBalanceMinor;
        if (senderBalance < amountMinor) return writeFailure({ error: { code: 'INSUFFICIENT_FUNDS', message: 'Insufficient wallet balance.' } });
        const newSenderBalance = senderBalance - amountMinor; const newRecipientBalance = recipientBalance + amountMinor;
        if (!Number.isSafeInteger(newSenderBalance) || !Number.isSafeInteger(newRecipientBalance)) return writeFailure({ error: { code: 'TRANSACTION_FAILED', message: 'The transfer amount would exceed the safe integer range for wallet accounting.' } });
        const now = Timestamp.now(); const transactionId = adminDb.collection('transactions').doc().id; const reference = `UP-WT-${transactionId}`;
        const transactionRecord = { id: transactionId, reference, senderId: senderUid, recipientId, amount: amountMinor, currency, type: 'transfer', sourceModule: 'unique_pay.wallet_transfer', provider: 'unique_pay_internal_wallet', status: 'completed', ...(description !== undefined ? { description } : {}), createdAt: now, updatedAt: now, recordKind: 'financial', schemaVersion: 2, amountUnit: 'minor' };
        const completedResult = { transaction: transferResultPayload(transactionId, reference, senderUid, recipientId, amountMinor, currency, description, 'completed'), idempotencyKey, status: 'completed' };
        transaction.set(adminDb.collection('transactions').doc(transactionId), transactionRecord);
        transaction.update(senderWalletRef, { availableBalanceMinor: newSenderBalance, updatedAt: now });
        transaction.update(recipientWalletRef, { availableBalanceMinor: newRecipientBalance, updatedAt: now });
        // Double-entry ledger: two server-generated ledgerEntries documents are
        // written atomically with the wallet mutations and financial transaction:
        // one debit for the sender and one credit for the recipient. Both share the
        // transactionId, reference, amountMinor, currency, status, and idempotencyKey.
        const senderLedgerRef = adminDb.collection('ledgerEntries').doc();
        const recipientLedgerRef = adminDb.collection('ledgerEntries').doc();
        const senderLedgerEntry = {
          id: senderLedgerRef.id,
          transactionId,
          reference,
          uid: senderUid,
          direction: 'debit' as const,
          amountMinor,
          currency,
          status: 'completed' as const,
          idempotencyKey,
          createdAt: now,
        };
        const recipientLedgerEntry = {
          id: recipientLedgerRef.id,
          transactionId,
          reference,
          uid: recipientId,
          direction: 'credit' as const,
          amountMinor,
          currency,
          status: 'completed' as const,
          idempotencyKey,
          createdAt: now,
        };
        transaction.set(senderLedgerRef, senderLedgerEntry);
        transaction.set(recipientLedgerRef, recipientLedgerEntry);
        transaction.set(idempotencyRef, { senderUid, recipientId, amountMinor, currency, description: description ?? '', requestFingerprint: fingerprint, status: 'completed', result: completedResult, createdAt: now, updatedAt: now });
        const auditRef = adminDb.collection('audit_logs').doc();
        transaction.create(auditRef, {
          action: 'wallet.transfer.completed',
          actorUid: senderUid,
          targetUid: recipientId,
          resource: 'wallet_transfer',
          resourceId: transactionId,
          transactionId,
          reference,
          amountMinor,
          currency,
          idempotencyKey,
          timestamp: now,
        });
        return completedResult;
      });
      if ((transactionResult as TransferErrorResponse | undefined)?.error) { const { code, message } = (transactionResult as TransferErrorResponse).error; return errorResponse(res, code, message, transferErrorStatus[code] ?? 500); }
      return res.status(200).json(transactionResult);
    } catch (error) { console.error('Transfer execution failed:', error); return errorResponse(res, 'SERVICE_UNAVAILABLE', 'The transfer service is temporarily unavailable.'); }
  });
  app.post("/api/communication/presence", authenticate, rateLimit({
    windowMs: 60_000,
    limit: 120,
    standardHeaders: true,
    legacyHeaders: false,
    store: createFirestoreRateLimitStore('communicationPresenceRateLimits', 60_000),
    keyGenerator: (req) => {
      const uid = (req as any).user?.uid;
      return isSafeFirebaseUid(uid) ? uid : ipKeyGenerator(req.ip);
    },
    handler: (_req, res) => errorResponse(res, 'RATE_LIMITED', 'Too many presence updates. Please try again shortly.'),
  }), async (req, res) => {
    try {
      const uid = sanitizeRequiredAuthUid((req as any).user?.uid);
      if (!isPlainObject(req.body) || (req.body.status !== 'online' && req.body.status !== 'offline')) {
        return errorResponse(res, 'INVALID_REQUEST', 'status must be online or offline.');
      }
      const status = req.body.status as 'online' | 'offline';
      const nowIso = Timestamp.now().toDate().toISOString();
      const ref = adminDb.collection('userPresence').doc(uid);
      await ref.set({ uid, status, lastSeenAt: nowIso }, { merge: true });
      return res.status(200).json({ presence: { uid, status, lastSeenAt: nowIso } });
    } catch (error) {
      console.error('Presence update failed:', error);
      return errorResponse(res, 'SERVICE_UNAVAILABLE', 'Failed to update presence.');
    }
  });

  app.get("/api/communication/conversations/:conversationId", authenticate, rateLimit({
    windowMs: 60_000,
    limit: 120,
    standardHeaders: true,
    legacyHeaders: false,
    store: createFirestoreRateLimitStore('communicationConversationReadRateLimits', 60_000),
    keyGenerator: (req) => {
      const uid = (req as any).user?.uid;
      return isSafeFirebaseUid(uid) ? uid : ipKeyGenerator(req.ip);
    },
    handler: (_req, res) => errorResponse(res, 'RATE_LIMITED', 'Too many conversation reads. Please try again shortly.'),
  }), async (req, res) => {
    try {
      const uid = sanitizeRequiredAuthUid((req as any).user?.uid);
      const conversationId = req.params.conversationId;
      if (!/^[A-Za-z0-9_-]{1,128}$/.test(conversationId)) {
        return errorResponse(res, 'INVALID_REQUEST', 'The conversation ID is invalid.');
      }
      const membershipSnapshot = await adminDb.collection('conversationMembers')
        .doc(conversationMemberDocumentId(conversationId, uid)).get();
      if (!membershipSnapshot.exists) {
        return errorResponse(res, 'INVALID_REQUEST', 'You are not a member of this conversation.', 403);
      }
      const conversationSnapshot = await adminDb.collection('conversations').doc(conversationId).get();
      if (!conversationSnapshot.exists) {
        return errorResponse(res, 'NOT_FOUND', 'The conversation was not found.', 404);
      }
      const membersSnapshot = await adminDb.collection('conversationMembers')
        .where('conversationId', '==', conversationId).get();
      const conversationData = conversationSnapshot.data() as Record<string, unknown>;
      let enrichedConversation = conversationData;
      const otherUid = membersSnapshot.docs
        .map((member) => member.data().uid)
        .find((memberUid) => typeof memberUid === 'string' && memberUid !== uid);
      if (conversationData.type === 'direct' && typeof otherUid === 'string' && isSafeFirebaseUid(otherUid)) {
        const userSnapshot = await adminDb.collection('users').doc(otherUid).get();
        if (userSnapshot.exists) {
          const user = userSnapshot.data() as Record<string, unknown>;
          const fullName = typeof user.fullName === 'string' && user.fullName.trim()
            ? user.fullName.trim()
            : 'Unique One User';
          const avatarUrl = typeof user.profilePhotoUrl === 'string' && user.profilePhotoUrl.trim()
            ? user.profilePhotoUrl.trim()
            : undefined;
          enrichedConversation = {
            ...conversationData,
            title: fullName,
            ...(avatarUrl ? { avatarUrl } : {}),
            otherUid,
          };
        }
      }
      return res.status(200).json({
        conversation: enrichedConversation,
        members: membersSnapshot.docs.map((member) => member.data()),
      });
    } catch (error) {
      console.error('Conversation read failed:', error);
      return errorResponse(res, 'SERVICE_UNAVAILABLE', 'Failed to load the conversation.');
    }
  });

  app.get("/api/communication/conversations/:conversationId/presence", authenticate, rateLimit({
    windowMs: 60_000,
    limit: 120,
    standardHeaders: true,
    legacyHeaders: false,
    store: createFirestoreRateLimitStore('communicationPresenceReadRateLimits', 60_000),
    keyGenerator: (req) => {
      const uid = (req as any).user?.uid;
      return isSafeFirebaseUid(uid) ? uid : ipKeyGenerator(req.ip);
    },
    handler: (_req, res) => errorResponse(res, 'RATE_LIMITED', 'Too many presence requests. Please try again shortly.'),
  }), async (req, res) => {
    try {
      const requesterUid = sanitizeRequiredAuthUid((req as any).user?.uid);
      const conversationId = req.params.conversationId;
      if (!/^[A-Za-z0-9_-]{1,128}$/.test(conversationId)) {
        return errorResponse(res, 'INVALID_REQUEST', 'The conversation ID is invalid.');
      }
      const requesterMembership = await adminDb.collection('conversationMembers')
        .doc(conversationMemberDocumentId(conversationId, requesterUid)).get();
      if (!requesterMembership.exists) {
        return errorResponse(res, 'INVALID_REQUEST', 'You are not a member of this conversation.', 403);      }
      const membersSnapshot = await adminDb.collection('conversationMembers')
        .where('conversationId', '==', conversationId).get();
      const presences = await Promise.all(membersSnapshot.docs.map(async (memberDoc) => {
        const member = memberDoc.data() as Partial<ConversationMember>;
        if (!isSafeFirebaseUid(member.uid)) return null;
        const presenceSnapshot = await adminDb.collection('userPresence').doc(member.uid).get();
        if (!presenceSnapshot.exists) return { uid: member.uid, status: 'offline' as const, lastSeenAt: null };
        const data = presenceSnapshot.data() as Record<string, unknown>;
        return {
          uid: member.uid,
          status: data.status === 'online' ? 'online' as const : 'offline' as const,
          lastSeenAt: typeof data.lastSeenAt === 'string' ? data.lastSeenAt : null,
        };
      }));
      return res.status(200).json({ presences: presences.filter(Boolean) });
    } catch (error) {
      console.error('Presence read failed:', error);
      return errorResponse(res, 'SERVICE_UNAVAILABLE', 'Failed to fetch conversation presence.');
    }
  });


  app.get("/api/communication/users/search", authenticate, rateLimit({
    windowMs: 60_000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false,
    store: createFirestoreRateLimitStore('communicationUserSearchRateLimits', 60_000),
    keyGenerator: (req) => {
      const uid = (req as any).user?.uid;
      return isSafeFirebaseUid(uid) ? uid : ipKeyGenerator(req.ip);
    },
    handler: (_req, res) => errorResponse(res, 'RATE_LIMITED', 'Too many user searches. Please try again shortly.'),
  }), async (req, res) => {
    try {
      const requesterUid = sanitizeRequiredAuthUid((req as any).user?.uid);
      const rawQuery = typeof req.query.q === 'string' ? req.query.q.trim() : '';
      if (rawQuery.length < 2 || rawQuery.length > 128) {
        return errorResponse(res, 'INVALID_REQUEST', 'Search must contain between 2 and 128 characters.');
      }

      const usersRef = adminDb.collection('users');
      const candidates = new Map<string, FirebaseFirestore.DocumentData>();
      const normalized = rawQuery.toLowerCase();
      const addCandidate = (uid: string, data: FirebaseFirestore.DocumentData | undefined) => {
        if (uid !== requesterUid) candidates.set(uid, data ?? {});
      };

      // Support exact and prefix matching for the identifiers users actually see.
      // Prefix queries let "Ham", "@hamza", or "US-ABJ" find a user without
      // requiring a separate search index, while keeping the query bounded.
      const prefixEnd = (value: string) => value + "\uf8ff";
      const queries = [
        usersRef.where('email', '==', rawQuery).limit(10),
        usersRef.where('email', '==', normalized).limit(10),
        usersRef.where('username', '==', rawQuery).limit(10),
        usersRef.where('username', '==', normalized).limit(10),
        usersRef.where('uniqueOneId', '==', rawQuery).limit(10),
        usersRef.where('uniqueOneId', '==', normalized).limit(10),
        usersRef.where('phone', '==', rawQuery).limit(10),
        usersRef.where('fullName', '==', rawQuery).limit(10),
        usersRef.where('fullName', '==', normalized).limit(10),
        usersRef.where('fullName', '>=', rawQuery).where('fullName', '<=', prefixEnd(rawQuery)).limit(10),
        usersRef.where('fullName', '>=', normalized).where('fullName', '<=', prefixEnd(normalized)).limit(10),
        usersRef.where('username', '>=', rawQuery).where('username', '<=', prefixEnd(rawQuery)).limit(10),
        usersRef.where('username', '>=', normalized).where('username', '<=', prefixEnd(normalized)).limit(10),
        usersRef.where('uniqueOneId', '>=', rawQuery).where('uniqueOneId', '<=', prefixEnd(rawQuery)).limit(10),
        usersRef.where('uniqueOneId', '>=', normalized).where('uniqueOneId', '<=', prefixEnd(normalized)).limit(10),
      ];

      const snapshots = await Promise.all(queries.map((query) => query.get()));
      for (const snapshot of snapshots) {
        for (const doc of snapshot.docs) addCandidate(doc.id, doc.data());
      }

      // Firebase Auth fallback covers accounts whose profile document has not
      // copied email/phone yet. Auth does not provide general name search here,
      // so Firestore profile search remains the source for names/usernames/IDs.
      try {
        const auth = getAuth();
        if (rawQuery.includes('@')) {
          const authUser = await auth.getUserByEmail(rawQuery).catch(() => null);
          if (authUser) addCandidate(authUser.uid, {
            fullName: authUser.displayName,
            email: authUser.email,
            profilePhotoUrl: authUser.photoURL,
          });
        }
        if (/^\+?[0-9][0-9\s().-]{6,20}$/.test(rawQuery)) {
          const phone = rawQuery.replace(/[\s().-]/g, '');
          const authUser = await auth.getUserByPhoneNumber(phone).catch(() => null);
          if (authUser) addCandidate(authUser.uid, {
            fullName: authUser.displayName,
            phone: authUser.phoneNumber,
            profilePhotoUrl: authUser.photoURL,
          });
        }
      } catch (error) {
        console.warn('Firebase Auth user lookup skipped:', error);
      }

      const results = Array.from(candidates.entries()).slice(0, 10).map(([uid, data]) => ({
        uid,
        fullName: typeof data.fullName === 'string' && data.fullName.trim() ? data.fullName : 'Unique One User',
        username: typeof data.username === 'string' && data.username.trim() ? data.username : undefined,
        uniqueOneId: typeof data.uniqueOneId === 'string' && data.uniqueOneId.trim() ? data.uniqueOneId : undefined,
        profilePhotoUrl: typeof data.profilePhotoUrl === 'string' ? data.profilePhotoUrl : undefined,
        verificationStatus: typeof data.verificationStatus === 'string' ? data.verificationStatus : 'unverified',
      }));
      return res.status(200).json({ users: results });
    } catch (error) {
      console.error('Communication user search failed:', error);
      return errorResponse(res, 'SERVICE_UNAVAILABLE', 'Failed to search for users.');
    }
  });
  app.post("/api/communication/message-requests", authenticate, rateLimit({
    windowMs: 60_000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
    store: createFirestoreRateLimitStore('communicationMessageRequestRateLimits', 60_000),
    keyGenerator: (req) => {
      const uid = (req as any).user?.uid;
      if (isSafeFirebaseUid(uid)) return uid;
      return ipKeyGenerator(req.ip);
    },
    handler: (_req, res) => errorResponse(res, 'RATE_LIMITED', 'Too many message request attempts. Please try again shortly.'),
  }), async (req, res) => {
    let fromUid: string;
    try {
      fromUid = sanitizeRequiredAuthUid((req as any).user?.uid);
      if (!isPlainObject(req.body)) return errorResponse(res, 'INVALID_REQUEST', 'The message request body must be a plain object.');
      const payload = req.body as Record<string, unknown>;
      const allowedKeys = new Set(['toUid']);
      for (const key of Object.keys(payload)) {
        if (!allowedKeys.has(key)) return errorResponse(res, 'INVALID_REQUEST', `Unsupported field: ${key}.`);
      }
      if (typeof payload.toUid !== 'string' || !isSafeFirebaseUid(payload.toUid.trim())) {
        return errorResponse(res, 'INVALID_REQUEST', 'A valid recipient UID is required.');
      }
      const toUid = payload.toUid.trim();
      if (toUid === fromUid) return errorResponse(res, 'INVALID_REQUEST', 'You cannot send a message request to yourself.');
      if (!(await readUserExists(toUid))) return errorResponse(res, 'INVALID_RECIPIENT', 'The recipient user does not exist.');

      const requestQuery = await adminDb.collection('messageRequests')
        .where('fromUid', '==', fromUid)
        .where('toUid', '==', toUid)
        .where('status', '==', 'pending')
        .limit(1)
        .get();
      if (!requestQuery.empty) return res.status(200).json({ request: requestQuery.docs[0].data(), alreadyPending: true });

      const reverseQuery = await adminDb.collection('messageRequests')
        .where('fromUid', '==', toUid)
        .where('toUid', '==', fromUid)
        .where('status', '==', 'pending')
        .limit(1)
        .get();
      if (!reverseQuery.empty) {
        return errorResponse(res, 'INVALID_REQUEST', 'This user already has a pending message request to you.');
      }

      const blockIds = [
        createHash('sha256').update(fromUid + ':' + toUid).digest('hex').slice(0, 40),
        createHash('sha256').update(toUid + ':' + fromUid).digest('hex').slice(0, 40),
      ];
      const blockSnapshots = await Promise.all(
        blockIds.map((blockId) => adminDb.collection('communicationBlocks').doc(blockId).get()),
      );
      if (blockSnapshots.some((snapshot) => snapshot.exists)) {
        return errorResponse(res, 'FORBIDDEN', 'Message requests are not available between these users.', 403);
      }

      const requestRef = adminDb.collection('messageRequests').doc();
      const now = Timestamp.now();
      const nowIso = now.toDate().toISOString();
      const request: MessageRequest = {
        id: requestRef.id,
        fromUid,
        toUid,
        status: 'pending',
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      await requestRef.create(request);
      await adminDb.collection('audit_logs').add({
        action: 'communication.message_request.created',
        actorUid: fromUid,
        targetUid: toUid,
        resource: 'message_request',
        resourceId: requestRef.id,
        timestamp: now,
      });
      return res.status(201).json({ request });
    } catch (error) {
      if (error instanceof RequestValidationError) return errorResponse(res, error.code, error.message);
      console.error('Message request creation failed:', error);
      return errorResponse(res, 'SERVICE_UNAVAILABLE', 'Failed to create the message request.');
    }
  });

  app.post("/api/communication/message-requests/:requestId/respond", authenticate, rateLimit({
    windowMs: 60_000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false,
    store: createFirestoreRateLimitStore('communicationMessageRequestResponseRateLimits', 60_000),
    keyGenerator: (req) => {
      const uid = (req as any).user?.uid;
      return isSafeFirebaseUid(uid) ? uid : ipKeyGenerator(req.ip);
    },
    handler: (_req, res) => errorResponse(res, 'RATE_LIMITED', 'Too many message request responses. Please try again shortly.'),
  }), async (req, res) => {
    let responderUid: string;
    try {
      responderUid = sanitizeRequiredAuthUid((req as any).user?.uid);
      const requestId = req.params.requestId;
      if (!isSafeFirebaseUid(requestId) && !/^[A-Za-z0-9_-]{1,128}$/.test(requestId)) {
        return errorResponse(res, 'INVALID_REQUEST', 'The message request ID is invalid.');
      }
      if (!isPlainObject(req.body)) return errorResponse(res, 'INVALID_REQUEST', 'The response body must be a plain object.');
      const payload = req.body as Record<string, unknown>;
      if (Object.keys(payload).some((key) => key !== 'action')) {
        return errorResponse(res, 'INVALID_REQUEST', 'Only action is supported.');
      }
      if (payload.action !== 'accept' && payload.action !== 'decline') {
        return errorResponse(res, 'INVALID_REQUEST', 'action must be accept or decline.');
      }
      const action = payload.action as 'accept' | 'decline';
      const requestRef = adminDb.collection('messageRequests').doc(requestId);
      const result = await adminDb.runTransaction(async (transaction) => {
        const requestSnapshot = await transaction.get(requestRef);
        if (!requestSnapshot.exists) throw new Error('REQUEST_NOT_FOUND');
        const requestData = requestSnapshot.data() as Partial<MessageRequest>;
        if (requestData.toUid !== responderUid) throw new Error('FORBIDDEN');
        if (requestData.status !== 'pending') {
          return { request: requestData, conversation: undefined, alreadyHandled: true };
        }
        if (!requestData.fromUid || !isSafeFirebaseUid(requestData.fromUid)) throw new Error('INVALID_REQUEST');
        if (action === 'decline') {
          const now = Timestamp.now().toDate().toISOString();
          transaction.update(requestRef, { status: 'declined', updatedAt: now });
          const auditRef = adminDb.collection('audit_logs').doc();
          transaction.create(auditRef, { action: 'communication.message_request.declined', actorUid: responderUid, targetUid: requestData.fromUid, resource: 'message_request', resourceId: requestId, timestamp: Timestamp.now() });
          return {
            request: { ...requestData, id: requestId, status: 'declined', updatedAt: now },
            conversation: undefined,
            alreadyHandled: false,
          };
        }

        const memberUids = [requestData.fromUid, responderUid].sort();
        const blockIds = [
          createHash('sha256').update(requestData.fromUid + ':' + responderUid).digest('hex').slice(0, 40),
          createHash('sha256').update(responderUid + ':' + requestData.fromUid).digest('hex').slice(0, 40),
        ];
        const blockRefs = blockIds.map((blockId) => adminDb.collection('communicationBlocks').doc(blockId));
        const blockSnapshots = await Promise.all(blockRefs.map((ref) => transaction.get(ref)));
        if (blockSnapshots.some((snapshot) => snapshot.exists)) throw new Error('BLOCKED');
        const conversationId = createHash('sha256').update(memberUids.join(':')).digest('hex').slice(0, 40);
        const conversationRef = adminDb.collection('conversations').doc(conversationId);
        const memberRefs = memberUids.map((uid) =>
          adminDb.collection('conversationMembers').doc(conversationMemberDocumentId(conversationId, uid))
        );
        const conversationSnapshot = await transaction.get(conversationRef);
        const memberSnapshots = await Promise.all(memberRefs.map((ref) => transaction.get(ref)));
        const now = Timestamp.now();
        const nowIso = now.toDate().toISOString();

        const conversation: Conversation = conversationSnapshot.exists
          ? (conversationSnapshot.data() as Conversation)
          : {
              id: conversationId,
              type: 'direct',
              createdBy: requestData.fromUid,
              createdAt: nowIso,
              updatedAt: nowIso,
              status: 'active',
            };

        if (!conversationSnapshot.exists) {
          transaction.create(conversationRef, conversation);
          const members = buildConversationMembers(conversationId, memberUids, requestData.fromUid, nowIso);
          memberRefs.forEach((ref, index) => transaction.create(ref, members[index]));
        } else {
          transaction.update(conversationRef, { status: 'active', updatedAt: nowIso });
          memberRefs.forEach((ref, index) => {
            if (!memberSnapshots[index].exists) {
              const member: ConversationMember = {
                conversationId,
                uid: memberUids[index],
                role: memberUids[index] === requestData.fromUid ? 'owner' : 'member',
                joinedAt: nowIso,
              };
              transaction.create(ref, member);
            }
          });
        }

        transaction.update(requestRef, { status: 'accepted', conversationId, updatedAt: nowIso });
        const auditRef = adminDb.collection('audit_logs').doc();
        transaction.create(auditRef, { action: 'communication.message_request.accepted', actorUid: responderUid, targetUid: requestData.fromUid, resource: 'message_request', resourceId: requestId, conversationId, timestamp: now });
        return {
          request: { ...requestData, id: requestId, status: 'accepted', conversationId, updatedAt: nowIso },
          conversation,
          alreadyHandled: false,
        };
      });

      return res.status(200).json(result);
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      if (code === 'REQUEST_NOT_FOUND') return errorResponse(res, 'INVALID_REQUEST', 'The message request was not found.', 404);
      if (code === 'FORBIDDEN') return errorResponse(res, 'INVALID_REQUEST', 'Only the request recipient can respond to this request.', 403);
      if (code === 'INVALID_REQUEST') return errorResponse(res, 'INVALID_REQUEST', 'The message request data is invalid.');
      if (code === 'BLOCKED') return errorResponse(res, 'FORBIDDEN', 'This message request cannot be accepted because communication is blocked.', 403);
      console.error('Message request response failed:', error);
      return errorResponse(res, 'SERVICE_UNAVAILABLE', 'Failed to respond to the message request.');
    }
  });

  app.post("/api/communication/conversations", authenticate, rateLimit({
    windowMs: CONVERSATION_CREATE_WINDOW_MS,
    limit: MAX_CONVERSATION_CREATES_PER_WINDOW,
    standardHeaders: true,
    legacyHeaders: false,
    store: createFirestoreRateLimitStore('communicationConversationRateLimits', CONVERSATION_CREATE_WINDOW_MS),
    keyGenerator: (req) => {
      const uid = (req as any).user?.uid;
      if (isSafeFirebaseUid(uid)) return uid;
      return ipKeyGenerator(req.ip);
    },
    handler: (_req, res) => errorResponse(res, 'RATE_LIMITED', 'Too many conversation creation requests. Please try again shortly.'),
  }), async (req, res) => {
    let creatorUid: string;
    let validatedRequest: CreateConversationRequestInput;
    try {
      creatorUid = sanitizeRequiredAuthUid((req as any).user?.uid);
      validatedRequest = validateCreateConversationRequest(req.body, creatorUid);
    } catch (error) {
      if (error instanceof RequestValidationError) {
        return errorResponse(res, error.code, error.message);
      }
      console.error('Conversation request validation failed:', error);
      return errorResponse(res, 'INVALID_REQUEST', 'The conversation request is invalid.');
    }
    try {
      if (validatedRequest.type === 'direct' && validatedRequest.memberUids.length === 2) {
        const otherUid = validatedRequest.memberUids.find((uid) => uid !== creatorUid);
        if (!otherUid) {
          return errorResponse(res, 'INVALID_REQUEST', 'A direct conversation requires another user.');
        }
        const blockIds = [
          createHash('sha256').update(creatorUid + ':' + otherUid).digest('hex').slice(0, 40),
          createHash('sha256').update(otherUid + ':' + creatorUid).digest('hex').slice(0, 40),
        ];
        const blockSnapshots = await Promise.all(
          blockIds.map((blockId) => adminDb.collection('communicationBlocks').doc(blockId).get()),
        );
        if (blockSnapshots.some((snapshot) => snapshot.exists)) {
          return errorResponse(res, 'FORBIDDEN', 'A direct conversation cannot be created while communication is blocked.', 403);
        }
      }
      const directConversationId = validatedRequest.type === 'direct' && validatedRequest.memberUids.length === 2
        ? createHash('sha256').update([...validatedRequest.memberUids].sort().join(':')).digest('hex').slice(0, 40)
        : null;
      const conversationRef = directConversationId
        ? adminDb.collection('conversations').doc(directConversationId)
        : adminDb.collection('conversations').doc();
      const existingConversation = await conversationRef.get();
      if (existingConversation.exists) {
        // An existing conversation must still authorize the requester before
        // returning its metadata or repairing membership records. This prevents
        // a caller who knows a deterministic direct-conversation ID from using
        // this endpoint as a conversation-membership oracle.
        const requesterMembershipRef = adminDb.collection('conversationMembers')
          .doc(conversationMemberDocumentId(conversationRef.id, creatorUid));
        const requesterMembership = await requesterMembershipRef.get();
        if (!requesterMembership.exists) {
          return errorResponse(res, 'FORBIDDEN', 'You are not a member of this conversation.', 403);
        }
        // Repair any missing membership records for an existing direct conversation.
        // This is safe because the requester has already been authorized as a member.
        const existingData = existingConversation.data() as Conversation;
        const expectedMembers = buildConversationMembers(
          conversationRef.id,
          validatedRequest.memberUids,
          creatorUid,
          typeof existingData.createdAt === 'string' ? existingData.createdAt : Timestamp.now().toDate().toISOString(),
        );
        const membershipRefs = expectedMembers.map((member) =>
          adminDb.collection('conversationMembers').doc(conversationMemberDocumentId(conversationRef.id, member.uid)),
        );
        const membershipSnapshots = await adminDb.getAll(...membershipRefs);
        const repairBatch = adminDb.batch();
        let repaired = false;
        membershipSnapshots.forEach((snapshot, index) => {
          if (!snapshot.exists) {
            repairBatch.create(membershipRefs[index], expectedMembers[index]);
            repaired = true;
          }
        });
        if (repaired) await repairBatch.commit();
        return res.status(200).json({ conversation: existingData, members: expectedMembers });
      }
      const now = Timestamp.now();
      const nowIso = now.toDate().toISOString();
      const conversation: Conversation = {
        id: conversationRef.id,
        type: validatedRequest.type,
        createdBy: creatorUid,
        createdAt: nowIso,
        updatedAt: nowIso,
        status: 'active',
      };
      if (validatedRequest.title !== undefined) conversation.title = validatedRequest.title;
      if (validatedRequest.avatarUrl !== undefined) conversation.avatarUrl = validatedRequest.avatarUrl;
      const members = buildConversationMembers(conversation.id, validatedRequest.memberUids, creatorUid, nowIso);
      const batch = adminDb.batch();
      batch.create(conversationRef, conversation);
      for (const member of members) {
        batch.create(
          adminDb.collection('conversationMembers').doc(conversationMemberDocumentId(conversation.id, member.uid)),
          member,
        );
      }
      await batch.commit();
      return res.status(201).json({ conversation, members });
    } catch (error) {
      console.error('Conversation creation failed:', error);
      return errorResponse(res, 'SERVICE_UNAVAILABLE', 'Failed to create the conversation.');
    }
  });
  app.get("/api/communication/conversations", authenticate, rateLimit({
    windowMs: 60_000,
    limit: 120,
    standardHeaders: true,
    legacyHeaders: false,
    store: createFirestoreRateLimitStore('communicationConversationListRateLimits', 60_000),
    keyGenerator: (req) => {
      const uid = (req as any).user?.uid;
      return isSafeFirebaseUid(uid) ? uid : ipKeyGenerator(req.ip);
    },
    handler: (_req, res) => errorResponse(res, 'RATE_LIMITED', 'Too many conversation list requests. Please try again shortly.'),
  }), async (req, res) => {
    try {
      const uid = sanitizeRequiredAuthUid((req as any).user?.uid);
      const membershipSnapshot = await adminDb.collection('conversationMembers').where('uid', '==', uid).get();
      const conversationIdSet = new Set<string>(
        membershipSnapshot.docs
          .map((doc) => doc.data().conversationId)
          .filter((id): id is string => typeof id === 'string' && isSafeConversationId(id)),
      );

      // Recover older conversations whose membership record may be missing for
      // this user. Sent messages still identify the conversation, so use them
      // as a safe legacy discovery path and repair the missing membership.
      const sentMessagesSnapshot = await adminDb.collection('messages')
        .where('senderId', '==', uid)
        .limit(100)
        .get();
      for (const messageDoc of sentMessagesSnapshot.docs) {
        const conversationId = messageDoc.data().conversationId;
        if (typeof conversationId === 'string' && isSafeConversationId(conversationId)) {
          conversationIdSet.add(conversationId);
        }
      }

      const conversationIds = Array.from(conversationIdSet);
      if (conversationIds.length === 0) return res.status(200).json({ conversations: [] });
      const conversations = [];
      for (const conversationId of conversationIds.slice(0, 100)) {
        const snapshot = await adminDb.collection('conversations').doc(conversationId).get();
        if (!snapshot.exists) continue;
        const conversation = snapshot.data() as Record<string, unknown>;

        const ownMembershipRef = adminDb.collection('conversationMembers')
          .doc(conversationMemberDocumentId(conversationId, uid));
        const ownMembership = await ownMembershipRef.get();
        if (!ownMembership.exists) {
          const memberSnapshot = await adminDb.collection('conversationMembers')
            .where('conversationId', '==', conversationId).get();
          const existingMembers = memberSnapshot.docs.map((doc) => doc.data().uid).filter((memberUid) => typeof memberUid === 'string');
          if (existingMembers.includes(uid)) {
            // No-op: a differently keyed legacy membership already exists.
          } else {
            // A sent message alone is not proof that the requester is still a
            // member. Do not expose conversation metadata or repair membership
            // unless the canonical membership set already contains this UID.
            continue;
          }
        }

        if (conversation.type === 'direct') {
          const memberSnapshot = await adminDb.collection('conversationMembers')
            .where('conversationId', '==', conversationId).get();
          const otherUid = memberSnapshot.docs
            .map((doc) => doc.data().uid)
            .find((memberUid) => typeof memberUid === 'string' && memberUid !== uid);
          if (typeof otherUid === 'string' && isSafeFirebaseUid(otherUid)) {
            const userSnapshot = await adminDb.collection('users').doc(otherUid).get();
            if (userSnapshot.exists) {
              const user = userSnapshot.data() as Record<string, unknown>;
              const fullName = typeof user.fullName === 'string' && user.fullName.trim()
                ? user.fullName.trim()
                : 'Unique One User';
              const avatarUrl = typeof user.profilePhotoUrl === 'string' && user.profilePhotoUrl.trim()
                ? user.profilePhotoUrl.trim()
                : undefined;
              const memberData = ownMembership.exists ? ownMembership.data() as Record<string, unknown> : {};
              const lastReadAt = typeof memberData.lastReadAt === 'string' ? memberData.lastReadAt : null;
              const unreadSnapshot = await adminDb.collection('messages')
                .where('conversationId', '==', conversationId)
                .get();
              const unreadCount = unreadSnapshot.docs.filter((doc) => {
                const createdAt = doc.data().createdAt;
                return !lastReadAt || (typeof createdAt === 'string' && createdAt > lastReadAt);
              }).length;
              conversations.push({
                ...conversation,
                title: fullName,
                ...(avatarUrl ? { avatarUrl } : {}),
                otherUid,
                muted: memberData.muted === true,
                unreadCount,
              });
              continue;
            }
          }
        }
        conversations.push(conversation);
      }
      conversations.sort((a: any, b: any) =>
        new Date(String(b?.lastMessageAt ?? b?.updatedAt ?? b?.createdAt ?? 0)).getTime()
        - new Date(String(a?.lastMessageAt ?? a?.updatedAt ?? a?.createdAt ?? 0)).getTime()
      );
      return res.status(200).json({ conversations });
    } catch (error) {
      console.error('Conversation list read failed:', error);
      return errorResponse(res, 'SERVICE_UNAVAILABLE', 'Failed to load messages.');
    }
  });

  app.post("/api/communication/media/upload", authenticate, rateLimit({
    windowMs: 60_000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false,
  }), express.raw({ type: 'application/octet-stream', limit: '20mb' }), async (req, res) => {
    try {
      const uid = sanitizeRequiredAuthUid((req as any).user?.uid);
      const conversationId = typeof req.headers['x-conversation-id'] === 'string' ? req.headers['x-conversation-id'].trim() : '';
      const contentType = typeof req.headers['x-content-type'] === 'string' ? req.headers['x-content-type'].trim().toLowerCase() : '';
      const originalName = typeof req.headers['x-original-name'] === 'string' ? req.headers['x-original-name'].trim() : '';
      const body = req.body;
      if (!isSafeConversationId(conversationId)) return errorResponse(res, 'INVALID_REQUEST', 'The conversation ID is invalid.');
      if (!Buffer.isBuffer(body) || body.length <= 0) return errorResponse(res, 'INVALID_REQUEST', 'The attachment body is empty.');
      const allowedTypes = new Set([
        'image/webp', 'image/jpeg', 'image/png', 'image/gif',
        'application/pdf', 'text/plain', 'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ]);
      if (!allowedTypes.has(contentType)) return errorResponse(res, 'INVALID_REQUEST', 'This attachment type is not supported.');
      const maxBytes = contentType.startsWith('image/') ? 5 * 1024 * 1024 : 20 * 1024 * 1024;
      if (body.length > maxBytes) return errorResponse(res, 'INVALID_REQUEST', 'The attachment exceeds the allowed size.');
      if (originalName.length < 1 || originalName.length > 255) return errorResponse(res, 'INVALID_REQUEST', 'The attachment filename is invalid.');
      const membershipSnapshot = await adminDb.collection('conversationMembers').doc(conversationMemberDocumentId(conversationId, uid)).get();
      if (!membershipSnapshot.exists) return errorResponse(res, 'INVALID_REQUEST', 'You are not a member of this conversation.', 403);
      const extension = contentType === 'image/webp' ? 'webp' : (originalName.includes('.') ? originalName.split('.').pop()?.toLowerCase() : 'bin');
      const fileId = randomUUID();
      const storagePath = `messages/${conversationId}/${uid}/${fileId}.${extension}`;
      const bucket = getStorage().bucket();
      const file = bucket.file(storagePath);
      const downloadToken = randomUUID();
      await file.save(body, {
        resumable: false,
        metadata: {
          contentType,
          metadata: {
            firebaseStorageDownloadTokens: downloadToken,
            originalName,
            originalMimeType: contentType,
            originalBytes: String(body.length),
          },
        },
      });
      const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket.name)}/o/${encodeURIComponent(storagePath)}?alt=media&token=${downloadToken}`;
      return res.status(201).json({ fileId, storagePath, downloadUrl, mimeType: contentType, sizeBytes: body.length });
    } catch (error) {
      console.error('Communication media upload failed:', error);
      return errorResponse(res, 'SERVICE_UNAVAILABLE', 'Failed to upload the attachment.');
    }
  });

  app.delete("/api/communication/media/upload", authenticate, rateLimit({
    windowMs: 60_000,
    limit: 60,
    standardHeaders: true,
    legacyHeaders: false,
  }), async (req, res) => {
    try {
      const uid = sanitizeRequiredAuthUid((req as any).user?.uid);
      const conversationId = typeof req.body?.conversationId === 'string' ? req.body.conversationId.trim() : '';
      const storagePath = typeof req.body?.storagePath === 'string' ? req.body.storagePath.trim() : '';
      const fileId = typeof req.body?.fileId === 'string' ? req.body.fileId.trim() : '';
      if (!isSafeConversationId(conversationId) || !/^[A-Za-z0-9_-]{1,128}$/.test(fileId)) {
        return errorResponse(res, 'INVALID_REQUEST', 'The attachment reference is invalid.');
      }
      const membershipSnapshot = await adminDb.collection('conversationMembers').doc(conversationMemberDocumentId(conversationId, uid)).get();
      if (!membershipSnapshot.exists) return errorResponse(res, 'INVALID_REQUEST', 'You are not a member of this conversation.', 403);
      const expectedPrefix = `messages/${conversationId}/${uid}/`;
      const allowedExtensions = ['jpg', 'png', 'webp', 'gif', 'pdf', 'txt', 'doc', 'docx', 'xls', 'xlsx'];
      const ownsStoragePath = allowedExtensions.some((extension) => storagePath === `${expectedPrefix}${fileId}.${extension}`);
      if (!ownsStoragePath) return errorResponse(res, 'INVALID_REQUEST', 'The attachment reference is invalid.');
      const bucket = getStorage().bucket();
      try {
        await bucket.file(storagePath).delete();
      } catch (error: any) {
        if (error?.code !== 404) throw error;
      }
      return res.status(204).send();
    } catch (error) {
      console.error('Communication media cleanup failed:', error);
      return errorResponse(res, 'SERVICE_UNAVAILABLE', 'Failed to clean up the attachment.');
    }
  });

  app.post("/api/communication/media/upload-url", authenticate, rateLimit({
    windowMs: 60_000,
    limit: 60,
    standardHeaders: true,
    legacyHeaders: false,
  }), async (req, res) => {
    try {
      const uid = sanitizeRequiredAuthUid((req as any).user?.uid);
      const conversationId = typeof req.body?.conversationId === 'string' ? req.body.conversationId.trim() : '';
      const contentType = typeof req.body?.contentType === 'string' ? req.body.contentType.trim().toLowerCase() : '';
      const originalName = typeof req.body?.originalName === 'string' ? req.body.originalName.trim() : '';
      const sizeBytes = req.body?.sizeBytes;
      if (!isSafeConversationId(conversationId)) return errorResponse(res, 'INVALID_REQUEST', 'The conversation ID is invalid.');
      if (!Number.isSafeInteger(sizeBytes) || sizeBytes <= 0 || sizeBytes > 100 * 1024 * 1024) return errorResponse(res, 'INVALID_REQUEST', 'The attachment size is invalid or too large.');
      const allowedTypes = new Set([
        'image/jpeg', 'image/png', 'image/webp', 'image/gif',
        'application/pdf', 'text/plain', 'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ]);
      if (!allowedTypes.has(contentType)) return errorResponse(res, 'INVALID_REQUEST', 'This attachment type is not supported.');
      if (originalName.length < 1 || originalName.length > 255) return errorResponse(res, 'INVALID_REQUEST', 'The attachment filename is invalid.');
      const membershipSnapshot = await adminDb.collection('conversationMembers').doc(conversationMemberDocumentId(conversationId, uid)).get();
      if (!membershipSnapshot.exists) return errorResponse(res, 'INVALID_REQUEST', 'You are not a member of this conversation.', 403);
      const isImage = contentType.startsWith('image/');
      const maxBytes = isImage ? 5 * 1024 * 1024 : 20 * 1024 * 1024;
      if (sizeBytes > maxBytes) return errorResponse(res, 'INVALID_REQUEST', 'The attachment exceeds the allowed size.');
      const extension = isImage ? 'webp' : (originalName.includes('.') ? originalName.split('.').pop()?.toLowerCase() : 'bin');
      const fileId = randomUUID();
      const storagePath = `messages/${conversationId}/${uid}/${fileId}.${extension}`;
      const bucket = getStorage().bucket();
      const file = bucket.file(storagePath);
      const token = randomUUID();
      await file.setMetadata({
        contentType: isImage ? 'image/webp' : contentType,
        metadata: {
          firebaseStorageDownloadTokens: token,
          originalName,
          originalMimeType: contentType,
          originalBytes: String(sizeBytes),
        },
      });
      const [uploadUrl] = await file.getSignedUrl({
        version: 'v4',
        action: 'write',
        expires: Date.now() + 15 * 60 * 1000,
        contentType: isImage ? 'image/webp' : contentType,
      });
      const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket.name)}/o/${encodeURIComponent(storagePath)}?alt=media&token=${token}`;
      return res.status(200).json({ fileId, storagePath, uploadUrl, downloadUrl });
    } catch (error) {
      console.error('Communication media upload URL failed:', error);
      return errorResponse(res, 'SERVICE_UNAVAILABLE', 'Failed to prepare the attachment upload.');
    }
  });

  app.post("/api/communication/keys", authenticate, rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: true, legacyHeaders: false }), async (req, res) => {
    try {
      const uid = sanitizeRequiredAuthUid((req as any).user?.uid);
      const key = req.body?.publicKey;
      if (!key || typeof key !== 'object' || Array.isArray(key) || key.kty !== 'EC' || key.crv !== 'P-256' || typeof key.x !== 'string' || typeof key.y !== 'string' || key.x.length > 256 || key.y.length > 256) {
        return errorResponse(res, 'INVALID_REQUEST', 'A valid P-256 public encryption key is required.');
      }
      await adminDb.collection('communicationKeys').doc(uid).set({ uid, publicKey: key, version: 1, updatedAt: Timestamp.now().toDate().toISOString() }, { merge: true });
      return res.status(200).json({ registered: true, version: 1 });
    } catch (error) {
      console.error('Communication encryption key registration failed:', error);
      return errorResponse(res, 'SERVICE_UNAVAILABLE', 'Failed to register the encryption key.');
    }
  });

  app.get("/api/communication/keys/:uid", authenticate, rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: true, legacyHeaders: false }), async (req, res) => {
    try {
      sanitizeRequiredAuthUid((req as any).user?.uid);
      const uid = req.params.uid;
      if (!isSafeFirebaseUid(uid)) return errorResponse(res, 'INVALID_REQUEST', 'The user ID is invalid.');
      const snapshot = await adminDb.collection('communicationKeys').doc(uid).get();
      if (!snapshot.exists) return errorResponse(res, 'NOT_FOUND', 'The user has not registered an encryption key on this device.', 404);
      const data = snapshot.data() as Record<string, unknown>;
      return res.status(200).json({ uid, publicKey: data.publicKey, version: data.version ?? 1 });
    } catch (error) {
      console.error('Communication encryption key read failed:', error);
      return errorResponse(res, 'SERVICE_UNAVAILABLE', 'Failed to read the encryption key.');
    }
  });

  app.get("/api/communication/conversations/:conversationId/messages", authenticate, rateLimit({
    windowMs: 60_000,
    limit: 120,
    standardHeaders: true,
    legacyHeaders: false,
    store: createFirestoreRateLimitStore('communicationMessageReadRateLimits', 60_000),
    keyGenerator: (req) => {
      const uid = (req as any).user?.uid;
      return isSafeFirebaseUid(uid) ? uid : ipKeyGenerator(req.ip);
    },
    handler: (_req, res) => errorResponse(res, 'RATE_LIMITED', 'Too many message reads. Please try again shortly.'),
  }), async (req, res) => {
    try {
      const uid = sanitizeRequiredAuthUid((req as any).user?.uid);
      const conversationId = req.params.conversationId;
      if (!/^[A-Za-z0-9_-]{1,128}$/.test(conversationId)) {
        return errorResponse(res, 'INVALID_REQUEST', 'The conversation ID is invalid.');
      }
      const membershipSnapshot = await adminDb.collection('conversationMembers')
        .doc(conversationMemberDocumentId(conversationId, uid)).get();
      if (!membershipSnapshot.exists) {
        return errorResponse(res, 'INVALID_REQUEST', 'You are not a member of this conversation.', 403);
      }
      const rawLimit = Number(req.query.limit ?? 50);
      const messageLimit = Number.isSafeInteger(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 200) : 50;
      const messagesSnapshot = await adminDb.collection('messages')
        .where('conversationId', '==', conversationId)
        .orderBy('createdAt', 'asc')
        .limit(messageLimit)
        .get();
      const messages = messagesSnapshot.docs.map((message) => message.data() as Record<string, unknown>);
      const reactionSnapshot = await adminDb.collection('messageReactions')
        .where('conversationId', '==', conversationId)
        .get();
      const reactionMap = new Map<string, Array<{ uid: string; reaction: string }>>();
      reactionSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        if (typeof data.messageId === 'string' && typeof data.uid === 'string' && typeof data.reaction === 'string') {
          const list = reactionMap.get(data.messageId) ?? [];
          list.push({ uid: data.uid, reaction: data.reaction });
          reactionMap.set(data.messageId, list);
        }
      });
      const enrichedMessages = messages.map((message) => {
        const reactions = reactionMap.get(String(message.id)) ?? [];
        const counts: Record<string, number> = {};
        reactions.forEach((item) => { counts[item.reaction] = (counts[item.reaction] ?? 0) + 1; });
        const mine = reactions.find((item) => item.uid === uid)?.reaction;
        return { ...message, reactions: counts, ...(mine ? { myReaction: mine } : {}) };
      });
      return res.status(200).json({ messages: enrichedMessages });
    } catch (error) {
      console.error('Conversation message read failed:', error);
      return errorResponse(res, 'SERVICE_UNAVAILABLE', 'Failed to load conversation messages.');
    }
  });

  app.post("/api/communication/messages/:messageId/delivery", authenticate, rateLimit({
    windowMs: 60_000,
    limit: 120,
    standardHeaders: true,
    legacyHeaders: false,
    store: createFirestoreRateLimitStore('communicationMessageDeliveryRateLimits', 60_000),
    keyGenerator: (req) => {
      const uid = (req as any).user?.uid;
      return isSafeFirebaseUid(uid) ? uid : ipKeyGenerator(req.ip);
    },
    handler: (_req, res) => errorResponse(res, 'RATE_LIMITED', 'Too many delivery updates. Please try again shortly.'),
  }), async (req, res) => {
    try {
      const uid = sanitizeRequiredAuthUid((req as any).user?.uid);
      const messageId = req.params.messageId;
      if (!/^[A-Za-z0-9_-]{1,128}$/.test(messageId)) {
        return errorResponse(res, 'INVALID_REQUEST', 'The message ID is invalid.');
      }
      if (!isPlainObject(req.body) || (req.body.action !== 'delivered' && req.body.action !== 'read')) {
        return errorResponse(res, 'INVALID_REQUEST', 'action must be delivered or read.');
      }
      const action = req.body.action as 'delivered' | 'read';
      const messageRef = adminDb.collection('messages').doc(messageId);
      const deliveryRef = adminDb.collection('messageDeliveries').doc(messageId + '_' + uid);
      const result = await adminDb.runTransaction(async (transaction) => {
        const messageSnapshot = await transaction.get(messageRef);
        if (!messageSnapshot.exists) throw new Error('MESSAGE_NOT_FOUND');
        const message = messageSnapshot.data() as Message;
        const membershipRef = adminDb.collection('conversationMembers').doc(conversationMemberDocumentId(message.conversationId, uid));
        const membershipSnapshot = await transaction.get(membershipRef);
        if (!membershipSnapshot.exists) throw new Error('FORBIDDEN');
        if (message.senderId === uid) throw new Error('SENDER_CANNOT_UPDATE_DELIVERY');

        const deliverySnapshot = await transaction.get(deliveryRef);
        const nowIso = Timestamp.now().toDate().toISOString();
        const current = deliverySnapshot.exists ? deliverySnapshot.data() as Record<string, unknown> : {};
        const currentStatus = current.status === 'read' ? 'read' : current.status === 'delivered' ? 'delivered' : 'sent';
        const nextStatus = action === 'read' ? 'read' : (currentStatus === 'read' ? 'read' : 'delivered');
        const delivery = {
          messageId,
          uid,
          status: nextStatus,
          deliveredAt: typeof current.deliveredAt === 'string' ? current.deliveredAt : nowIso,
          ...(nextStatus === 'read' ? { readAt: typeof current.readAt === 'string' ? current.readAt : nowIso } : {}),
        };
        if (deliverySnapshot.exists) transaction.update(deliveryRef, delivery);
        else transaction.create(deliveryRef, delivery);

        if (message.senderId !== uid) {
          const messageStatus = nextStatus === 'read' || message.status === 'read' ? 'read' : 'delivered';
          transaction.update(messageRef, { status: messageStatus, updatedAt: nowIso });
          if (action === 'read') transaction.update(membershipRef, { lastReadAt: nowIso });
        }
        return { delivery, messageStatus: message.senderId === uid ? message.status : (nextStatus === 'read' ? 'read' : 'delivered') };
      });
      return res.status(200).json(result);
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      if (code === 'MESSAGE_NOT_FOUND') return errorResponse(res, 'INVALID_REQUEST', 'The message was not found.', 404);
      if (code === 'FORBIDDEN') return errorResponse(res, 'INVALID_REQUEST', 'You are not a member of this conversation.', 403);
      if (code === 'SENDER_CANNOT_UPDATE_DELIVERY') return errorResponse(res, 'INVALID_REQUEST', 'Only a message recipient can update delivery status.', 403);
      console.error('Message delivery update failed:', error);
      return errorResponse(res, 'SERVICE_UNAVAILABLE', 'Failed to update message delivery status.');
    }
  });

  app.post("/api/communication/messages/:messageId/reactions", authenticate, rateLimit({
    windowMs: 60_000,
    limit: 120,
    standardHeaders: true,
    legacyHeaders: false,
    store: createFirestoreRateLimitStore('communicationReactionRateLimits', 60_000),
    keyGenerator: (req) => {
      const uid = (req as any).user?.uid;
      return isSafeFirebaseUid(uid) ? uid : ipKeyGenerator(req.ip);
    },
    handler: (_req, res) => errorResponse(res, 'RATE_LIMITED', 'Too many reaction requests. Please try again shortly.'),
  }), async (req, res) => {
    try {
      const uid = sanitizeRequiredAuthUid((req as any).user?.uid);
      const messageId = req.params.messageId;
      const reaction = typeof req.body?.reaction === 'string' ? req.body.reaction.trim() : '';
      const allowed = new Set(['👍', '❤️', '😂', '😮', '😢', '🙏']);
      if (!/^[A-Za-z0-9_-]{1,128}$/.test(messageId) || !allowed.has(reaction)) {
        return errorResponse(res, 'INVALID_REQUEST', 'A valid reaction is required.');
      }
      const messageRef = adminDb.collection('messages').doc(messageId);
      const reactionRef = adminDb.collection('messageReactions').doc(messageId + '_' + uid);
      await adminDb.runTransaction(async (transaction) => {
        const messageSnapshot = await transaction.get(messageRef);
        if (!messageSnapshot.exists) throw new RequestValidationError('INVALID_REQUEST', 'The message was not found.');
        const message = messageSnapshot.data() as Partial<Message>;
        const membershipRef = adminDb.collection('conversationMembers').doc(conversationMemberDocumentId(String(message.conversationId), uid));
        const membershipSnapshot = await transaction.get(membershipRef);
        if (!membershipSnapshot.exists) throw new RequestValidationError('INVALID_REQUEST', 'You are not a member of this conversation.');
        transaction.set(reactionRef, {
          messageId,
          conversationId: message.conversationId,
          uid,
          reaction,
          updatedAt: Timestamp.now().toDate().toISOString(),
        }, { merge: true });
      });
      return res.status(200).json({ reaction });
    } catch (error) {
      if (error instanceof RequestValidationError) return errorResponse(res, error.code, error.message);
      console.error('Message reaction failed:', error);
      return errorResponse(res, 'SERVICE_UNAVAILABLE', 'Failed to update the reaction.');
    }
  });

  app.delete("/api/communication/messages/:messageId/reactions", authenticate, rateLimit({
    windowMs: 60_000,
    limit: 120,
    standardHeaders: true,
    legacyHeaders: false,
    store: createFirestoreRateLimitStore('communicationReactionRateLimits', 60_000),
    keyGenerator: (req) => {
      const uid = (req as any).user?.uid;
      return isSafeFirebaseUid(uid) ? uid : ipKeyGenerator(req.ip);
    },
    handler: (_req, res) => errorResponse(res, 'RATE_LIMITED', 'Too many reaction requests. Please try again shortly.'),
  }), async (req, res) => {
    try {
      const uid = sanitizeRequiredAuthUid((req as any).user?.uid);
      const messageId = req.params.messageId;
      if (!/^[A-Za-z0-9_-]{1,128}$/.test(messageId)) return errorResponse(res, 'INVALID_REQUEST', 'The message ID is invalid.');
      const messageRef = adminDb.collection('messages').doc(messageId);
      const reactionRef = adminDb.collection('messageReactions').doc(messageId + '_' + uid);
      await adminDb.runTransaction(async (transaction) => {
        const messageSnapshot = await transaction.get(messageRef);
        if (!messageSnapshot.exists) throw new RequestValidationError('INVALID_REQUEST', 'The message was not found.');
        const message = messageSnapshot.data() as Partial<Message>;
        const membershipRef = adminDb.collection('conversationMembers').doc(conversationMemberDocumentId(String(message.conversationId), uid));
        const membershipSnapshot = await transaction.get(membershipRef);
        if (!membershipSnapshot.exists) throw new RequestValidationError('INVALID_REQUEST', 'You are not a member of this conversation.');
        transaction.delete(reactionRef);
      });
      return res.status(200).json({ reaction: null });
    } catch (error) {
      if (error instanceof RequestValidationError) return errorResponse(res, error.code, error.message);
      console.error('Message reaction removal failed:', error);
      return errorResponse(res, 'SERVICE_UNAVAILABLE', 'Failed to remove the reaction.');
    }
  });

  app.delete("/api/communication/messages/:messageId", authenticate, rateLimit({
    windowMs: 60_000,
    limit: 60,
    standardHeaders: true,
    legacyHeaders: false,
    store: createFirestoreRateLimitStore('communicationMessageDeleteRateLimits', 60_000),
    keyGenerator: (req) => {
      const uid = (req as any).user?.uid;
      return isSafeFirebaseUid(uid) ? uid : ipKeyGenerator(req.ip);
    },
    handler: (_req, res) => errorResponse(res, 'RATE_LIMITED', 'Too many delete requests. Please try again shortly.'),
  }), async (req, res) => {
    try {
      const uid = sanitizeRequiredAuthUid((req as any).user?.uid);
      const messageId = req.params.messageId;
      if (!/^[A-Za-z0-9_-]{1,128}$/.test(messageId)) return errorResponse(res, 'INVALID_REQUEST', 'The message ID is invalid.');
      const messageRef = adminDb.collection('messages').doc(messageId);
      let attachmentStoragePaths: string[] = [];
      await adminDb.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(messageRef);
        if (!snapshot.exists) throw new RequestValidationError('INVALID_REQUEST', 'The message was not found.');
        const message = snapshot.data() as Partial<Message>;
        if (message.senderId !== uid) throw new RequestValidationError('INVALID_REQUEST', 'You can only delete your own messages.');
        if (Array.isArray(message.attachments)) {
          const conversationId = typeof message.conversationId === 'string' ? message.conversationId : '';
          const ownedPrefix = conversationId && isSafeConversationId(conversationId)
            ? `messages/${conversationId}/${uid}/`
            : '';
          attachmentStoragePaths = message.attachments
            .map((attachment) => attachment && typeof attachment === 'object' && 'storagePath' in attachment
              ? (attachment as { storagePath?: unknown }).storagePath
              : undefined)
            .filter((storagePath): storagePath is string =>
              Boolean(ownedPrefix) && typeof storagePath === 'string' && storagePath.startsWith(ownedPrefix) && storagePath.length <= 512);
        }
        const nowIso = Timestamp.now().toDate().toISOString();
        transaction.update(messageRef, {
          text: 'This message was deleted',
          deleted: true,
          deletedAt: nowIso,
          updatedAt: nowIso,
          attachments: [],
          encryptedPayload: null,
        });
        const auditRef = adminDb.collection('audit_logs').doc();
        transaction.create(auditRef, {
          action: 'communication.message.deleted',
          actorUid: uid,
          targetUid: typeof message.conversationId === 'string' ? message.conversationId : null,
          resource: 'communication_message',
          resourceId: messageId,
          conversationId: message.conversationId ?? null,
          timestamp: Timestamp.now(),
        });
      });
      if (attachmentStoragePaths.length > 0) {
        const bucket = getStorage().bucket();
        await Promise.all(attachmentStoragePaths.map(async (storagePath) => {
          try {
            await bucket.file(storagePath).delete();
          } catch (error) {
            const code = typeof error === 'object' && error !== null && 'code' in error
              ? String((error as { code?: unknown }).code)
              : '';
            if (code !== '404') {
              console.error('Failed to delete message attachment from Storage:', { storagePath, error });
            }
          }
        }));
      }
      return res.status(200).json({ deleted: true });
    } catch (error) {
      if (error instanceof RequestValidationError) return errorResponse(res, error.code, error.message);
      console.error('Message deletion failed:', error);
      return errorResponse(res, 'SERVICE_UNAVAILABLE', 'Failed to delete the message.');
    }
  });

  app.post("/api/communication/conversations/:conversationId/mute", authenticate, rateLimit({
    windowMs: 60_000,
    limit: 60,
    standardHeaders: true,
    legacyHeaders: false,
    store: createFirestoreRateLimitStore('communicationMuteRateLimits', 60_000),
    keyGenerator: (req) => {
      const uid = (req as any).user?.uid;
      return isSafeFirebaseUid(uid) ? uid : ipKeyGenerator(req.ip);
    },
    handler: (_req, res) => errorResponse(res, 'RATE_LIMITED', 'Too many mute requests. Please try again shortly.'),
  }), async (req, res) => {
    try {
      const uid = sanitizeRequiredAuthUid((req as any).user?.uid);
      const conversationId = req.params.conversationId;
      if (!/^[A-Za-z0-9_-]{1,128}$/.test(conversationId) || typeof req.body?.muted !== 'boolean') {
        return errorResponse(res, 'INVALID_REQUEST', 'A valid conversation and muted value are required.');
      }
      const membershipRef = adminDb.collection('conversationMembers').doc(conversationMemberDocumentId(conversationId, uid));
      const membershipSnapshot = await membershipRef.get();
      if (!membershipSnapshot.exists) return errorResponse(res, 'INVALID_REQUEST', 'You are not a member of this conversation.', 403);
      await membershipRef.update({ muted: req.body.muted });
      return res.status(200).json({ muted: req.body.muted });
    } catch (error) {
      console.error('Conversation mute failed:', error);
      return errorResponse(res, 'SERVICE_UNAVAILABLE', 'Failed to update mute state.');
    }
  });

  app.post("/api/communication/blocks", authenticate, rateLimit({
    windowMs: 60_000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false,
    store: createFirestoreRateLimitStore('communicationBlockRateLimits', 60_000),
    keyGenerator: (req) => {
      const uid = (req as any).user?.uid;
      return isSafeFirebaseUid(uid) ? uid : ipKeyGenerator(req.ip);
    },
    handler: (_req, res) => errorResponse(res, 'RATE_LIMITED', 'Too many block attempts. Please try again shortly.'),
  }), async (req, res) => {
    try {
      const blockerUid = sanitizeRequiredAuthUid((req as any).user?.uid);
      if (!isPlainObject(req.body) || typeof req.body.blockedUid !== 'string' || !isSafeFirebaseUid(req.body.blockedUid.trim())) {
        return errorResponse(res, 'INVALID_REQUEST', 'A valid blocked user UID is required.');
      }
      const blockedUid = req.body.blockedUid.trim();
      if (blockerUid === blockedUid) return errorResponse(res, 'INVALID_REQUEST', 'You cannot block yourself.');
      if (!(await readUserExists(blockedUid))) return errorResponse(res, 'INVALID_RECIPIENT', 'The user does not exist.');
      const blockId = createHash('sha256').update(blockerUid + ':' + blockedUid).digest('hex').slice(0, 40);
      const now = Timestamp.now();
      await adminDb.collection('communicationBlocks').doc(blockId).set({ id: blockId, blockerUid, blockedUid, createdAt: now.toDate().toISOString() }, { merge: true });
      await adminDb.collection('audit_logs').add({ action: 'communication.user.blocked', actorUid: blockerUid, targetUid: blockedUid, resource: 'communication_block', resourceId: blockId, timestamp: now });
      return res.status(200).json({ blocked: true });
    } catch (error) {
      console.error('Communication block failed:', error);
      return errorResponse(res, 'SERVICE_UNAVAILABLE', 'Failed to block this user.');
    }
  });

  app.post("/api/communication/messages", authenticate, rateLimit({
    windowMs: 60_000,
    limit: 60,
    standardHeaders: true,
    legacyHeaders: false,
    store: createFirestoreRateLimitStore('communicationMessageRateLimits', 60_000),
    keyGenerator: (req) => {
      const uid = (req as any).user?.uid;
      if (isSafeFirebaseUid(uid)) return uid;
      return ipKeyGenerator(req.ip);
    },
    handler: (_req, res) => errorResponse(res, 'RATE_LIMITED', 'Too many message requests. Please try again shortly.'),
  }), async (req, res) => {
    let senderUid: string;
    let draft: ReturnType<typeof validateMessageDraft>;
    try {
      senderUid = sanitizeRequiredAuthUid((req as any).user?.uid);
      draft = validateMessageDraft(req.body, { uid: senderUid });
    } catch (error) {
      if (error instanceof CommunicationValidationError) {
        return errorResponse(res, 'INVALID_REQUEST', error.message);
      }
      if (error instanceof RequestValidationError) {
        return errorResponse(res, error.code, error.message);
      }
      console.error('Message request validation failed:', error);
      return errorResponse(res, 'INVALID_REQUEST', 'The message request is invalid.');
    }
    try {
      const conversationRef = adminDb.collection('conversations').doc(draft.conversationId);
      const membershipQuery = await adminDb.collection('conversationMembers').where('conversationId', '==', draft.conversationId).get();
      const otherUids = membershipQuery.docs.map((doc) => (doc.data() as Partial<ConversationMember>).uid).filter((uid): uid is string => Boolean(uid) && uid !== senderUid);
      if (draft.encryptedPayload && !otherUids.includes(draft.encryptedPayload.recipientId)) {
        return errorResponse(res, 'INVALID_REQUEST', 'The encrypted recipient is not a member of this conversation.');
      }
      for (const otherUid of otherUids) {
        const forwardId = createHash('sha256').update(senderUid + ':' + otherUid).digest('hex').slice(0, 40);
        const reverseId = createHash('sha256').update(otherUid + ':' + senderUid).digest('hex').slice(0, 40);
        const [forwardBlock, reverseBlock] = await Promise.all([
          adminDb.collection('communicationBlocks').doc(forwardId).get(),
          adminDb.collection('communicationBlocks').doc(reverseId).get(),
        ]);
        if (forwardBlock.exists || reverseBlock.exists) return errorResponse(res, 'BLOCKED', 'Messaging is unavailable because one of the users has blocked the other.');
      }
      const idempotencyKey = typeof req.headers['idempotency-key'] === 'string' ? req.headers['idempotency-key'].trim() : '';
      if (!isSafeIdempotencyKey(idempotencyKey)) {
        return errorResponse(res, 'INVALID_REQUEST', 'A valid idempotency key is required.');
      }
      const idempotencyRef = adminDb.collection('communicationMessageIdempotency').doc(idempotencyDocumentId(senderUid, idempotencyKey));
      if (draft.attachments?.length) {
        const bucket = getStorage().bucket();
        for (const attachment of draft.attachments) {
          try {
            const [metadata] = await bucket.file(attachment.storagePath).getMetadata();
            const actualSize = Number(metadata.size);
            const actualContentType = typeof metadata.contentType === 'string' ? metadata.contentType : '';
            if (!Number.isSafeInteger(actualSize) || actualSize <= 0 || actualSize !== attachment.sizeBytes || actualContentType !== attachment.contentType) {
              return errorResponse(res, 'INVALID_REQUEST', 'One or more message attachments are invalid or incomplete.');
            }
          } catch {
            return errorResponse(res, 'INVALID_REQUEST', 'One or more message attachments could not be verified.');
          }
        }
      }
      const messageRef = adminDb.collection('messages').doc();
      const replyMessageRef = draft.replyToMessageId ? adminDb.collection('messages').doc(draft.replyToMessageId) : null;
      const now = Timestamp.now();
      const nowIso = now.toDate().toISOString();
      const message: Message = {
        id: messageRef.id,
        conversationId: draft.conversationId,
        senderId: senderUid,
        type: draft.type,
        ...(draft.text ? { text: draft.text } : {}),
        ...(draft.encryptedPayload ? { encryptedPayload: draft.encryptedPayload } : {}),
        ...(draft.attachments ? { attachments: draft.attachments } : {}),
        createdAt: nowIso,
        updatedAt: nowIso,
        status: 'sent',
        ...(draft.replyToMessageId ? { replyToMessageId: draft.replyToMessageId } : {}),
      };
      const transactionResult = await adminDb.runTransaction(async (transaction) => {
        const existingIdempotency = await transaction.get(idempotencyRef);
        if (existingIdempotency.exists) {
          const data = existingIdempotency.data() || {};
          if (data.uid !== senderUid || data.idempotencyKey !== idempotencyKey || typeof data.messageId !== 'string') {
            throw new RequestValidationError('INVALID_REQUEST', 'Invalid message idempotency record.');
          }
          const existingMessageSnapshot = await transaction.get(adminDb.collection('messages').doc(data.messageId));
          if (!existingMessageSnapshot.exists) {
            throw new RequestValidationError('INVALID_REQUEST', 'The previous message attempt is incomplete. Please try again.');
          }
          return { message: existingMessageSnapshot.data() as Message, replayed: true };
        }
        const membershipRef = adminDb.collection('conversationMembers').doc(conversationMemberDocumentId(draft.conversationId, senderUid));
        const results = await Promise.all([
          transaction.get(conversationRef),
          transaction.get(membershipRef),
          ...(replyMessageRef ? [transaction.get(replyMessageRef)] : []),
        ]);
        const conversationSnapshot = results[0];
        const membershipSnapshot = results[1];
        const replySnapshot = results[2];
        if (!conversationSnapshot.exists || !membershipSnapshot.exists) {
          throw new RequestValidationError('INVALID_REQUEST', 'You are not a member of this conversation.');
        }
        if (replyMessageRef) {
          if (!replySnapshot || !replySnapshot.exists) throw new RequestValidationError('INVALID_REQUEST', 'The message you are replying to was not found.');
          const replyData = replySnapshot.data() as Partial<Message> | undefined;
          if (!replyData || replyData.conversationId !== draft.conversationId) throw new RequestValidationError('INVALID_REQUEST', 'You can only reply to a message in this conversation.');
        }
        transaction.create(messageRef, message);
        transaction.set(idempotencyRef, {
          uid: senderUid,
          idempotencyKey,
          messageId: messageRef.id,
          createdAt: nowIso,
        });
        transaction.update(conversationRef, {
          lastMessageId: messageRef.id,
          lastMessageAt: nowIso,
          updatedAt: nowIso,
        });
        return { message, replayed: false };
      });
      return res.status(transactionResult.replayed ? 200 : 201).json({ message: transactionResult.message });
    } catch (error) {
      if (error instanceof RequestValidationError) {
        return errorResponse(res, error.code, error.message);
      }
      console.error('Message creation failed:', error);
      return errorResponse(res, 'SERVICE_UNAVAILABLE', 'Failed to send the message.');
    }
  });

  app.post("/api/restaurant/orders", authenticate, rateLimit({
    windowMs: 60_000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
    store: createFirestoreRateLimitStore('restaurantOrderRateLimits', 60_000),
    keyGenerator: (req) => {
      const uid = (req as any).user?.uid;
      return isSafeFirebaseUid(uid) ? uid : ipKeyGenerator(req.ip);
    },
    handler: (_req, res) => errorResponse(res, 'RATE_LIMITED', 'Too many restaurant order attempts. Please try again shortly.'),
  }), async (req, res) => {
    try {
      const uid = sanitizeRequiredAuthUid((req as any).user?.uid);
      if (!isPlainObject(req.body) || !isSafeIdempotencyKey(req.body.idempotencyKey)) {
        return errorResponse(res, 'INVALID_REQUEST', 'A valid restaurant order idempotency key is required.');
      }
      const body = req.body as Record<string, unknown>;
      const idempotencyKey = String(body.idempotencyKey).trim();
      const restaurantId = typeof body.restaurantId === 'string' ? body.restaurantId.trim() : '';
      const mode = body.mode;
      const paymentMethod = body.paymentMethod;
      const customerName = typeof body.customerName === 'string' ? body.customerName.trim().slice(0, 120) : '';
      const customerPhone = typeof body.customerPhone === 'string' ? body.customerPhone.trim().slice(0, 30) : '';
      const deliveryAddress = typeof body.deliveryAddress === 'string' ? body.deliveryAddress.trim().slice(0, 500) : '';
      const date = typeof body.date === 'string' ? body.date.trim() : '';
      const time = typeof body.time === 'string' ? body.time.trim() : '';
      const seating = typeof body.seating === 'string' ? body.seating.trim().slice(0, 80) : '';
      const notes = typeof body.notes === 'string' ? body.notes.trim().slice(0, 500) : '';
      const cart = body.cart;
      const subtotal = body.subtotal;
      if (!restaurantId || !['dine-in', 'delivery', 'pickup'].includes(String(mode)) ||
          !['uniquepay', 'bank-transfer'].includes(String(paymentMethod)) ||
          !customerName || !customerPhone || !isPlainObject(cart)) {
        return errorResponse(res, 'INVALID_REQUEST', 'Restaurant order details are incomplete or invalid.');
      }
      if (mode === 'delivery' && !deliveryAddress) return errorResponse(res, 'INVALID_REQUEST', 'A delivery address is required.');
      if (mode === 'dine-in' && (!date || !time)) return errorResponse(res, 'INVALID_REQUEST', 'Date and time are required for dine-in.');
      if (mode === 'pickup' && (!date || !time)) return errorResponse(res, 'INVALID_REQUEST', 'Pickup date and time are required.');
      if (typeof subtotal !== 'number' || !Number.isSafeInteger(subtotal) || subtotal <= 0) return errorResponse(res, 'INVALID_AMOUNT', 'The restaurant subtotal is invalid.');
      const deliveryFee = mode === 'delivery' ? 1500 : 0;
      const serviceFee = Math.max(300, Math.round(subtotal * 0.03));
      const total = subtotal + deliveryFee + serviceFee;
      if (!Number.isSafeInteger(total) || total <= 0) return errorResponse(res, 'INVALID_AMOUNT', 'The restaurant order total is invalid.');
      const items = Object.entries(cart).map(([itemId, quantity]) => ({ itemId, quantity })).filter((item) => Number.isSafeInteger(item.quantity) && Number(item.quantity) > 0);
      if (!items.length) return errorResponse(res, 'INVALID_REQUEST', 'Add at least one menu item before checkout.');
      const fingerprint = createHash('sha256').update(JSON.stringify({ uid, restaurantId, mode, paymentMethod, customerName, customerPhone, deliveryAddress, date, time, seating, notes, items, subtotal, deliveryFee, serviceFee, total })).digest('hex');
      const idempotencyRef = adminDb.collection('restaurantOrderIdempotency').doc(idempotencyDocumentId(uid, idempotencyKey));
      const result = await adminDb.runTransaction(async (transaction) => {
        const existing = await transaction.get(idempotencyRef);
        if (existing.exists) {
          const data = existing.data() || {};
          if (data.requestFingerprint !== fingerprint) throw new RequestValidationError('INVALID_REQUEST', 'This order idempotency key was already used with different order data.');
          return data.result;
        }
        const orderRef = adminDb.collection('restaurantOrders').doc();
        const now = Timestamp.now();
        const order = {
          id: orderRef.id, customerId: uid, restaurantId, mode, paymentMethod,
          customerName, customerPhone, deliveryAddress, date, time, seating, notes, items,
          subtotalMinor: subtotal, deliveryFeeMinor: deliveryFee, serviceFeeMinor: serviceFee, totalMinor: total,
          currency: 'NGN', paymentStatus: 'pending', status: 'pending_payment',
          createdAt: now, updatedAt: now,
          orderTimeline: [{ status: 'pending_payment', at: now }],
        };
        transaction.create(orderRef, order);
        const result = { orderId: orderRef.id, status: 'pending_payment', paymentStatus: 'pending', paymentMethod, totalMinor: total };
        transaction.create(idempotencyRef, { uid, idempotencyKey, requestFingerprint: fingerprint, result, createdAt: now, updatedAt: now });
        return result;
      });
      return res.status(201).json(result);
    } catch (error) {
      if (error instanceof RequestValidationError) return errorResponse(res, error.code, error.message);
      console.error('Restaurant order creation failed:', error);
      return errorResponse(res, 'SERVICE_UNAVAILABLE', 'Restaurant order could not be created. Your checkout details were not lost.');
    }
  });

  app.post("/api/restaurant/pay", authenticate, rateLimit({
    windowMs: 60_000, limit: 15, standardHeaders: true, legacyHeaders: false,
    store: createFirestoreRateLimitStore('restaurantPaymentRateLimits', 60_000),
    keyGenerator: (req) => { const uid = (req as any).user?.uid; return isSafeFirebaseUid(uid) ? uid : ipKeyGenerator(req.ip); },
    handler: (_req, res) => errorResponse(res, 'RATE_LIMITED', 'Too many Restaurant payment attempts. Please try again shortly.'),
  }), async (req, res) => {
    try {
      const uid = sanitizeRequiredAuthUid((req as any).user?.uid);
      if (!isPlainObject(req.body) || !isSafeIdempotencyKey(req.body.idempotencyKey) ||
          typeof req.body.transactionPin !== 'string' || !/^\\d{4}$/.test(req.body.transactionPin) ||
          typeof req.body.orderId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(req.body.orderId)) {
        return errorResponse(res, 'INVALID_REQUEST', 'A valid order ID, payment idempotency key and 4-digit Transaction PIN are required.');
      }
      if (!(await verifyTransactionPin(uid, req.body.transactionPin))) return errorResponse(res, 'FORBIDDEN', 'Incorrect Transaction PIN.');
      const orderId = req.body.orderId.trim(), idempotencyKey = req.body.idempotencyKey.trim();
      const preflightOrder = await adminDb.collection('restaurantOrders').doc(orderId).get();
      if (!preflightOrder.exists) return errorResponse(res, 'NOT_FOUND', 'Restaurant order could not be found.');
      const preflightData = preflightOrder.data() as Record<string, any>;
      if (preflightData.customerId !== uid || preflightData.currency !== 'NGN' || preflightData.paymentMethod !== 'uniquepay' || preflightData.status !== 'pending_payment') return errorResponse(res, 'INVALID_REQUEST', 'This restaurant order is not available for UniquePay payment.');
      const preflightAmountMinor = Number(preflightData.totalMinor);
      if (!Number.isSafeInteger(preflightAmountMinor) || preflightAmountMinor <= 0) return errorResponse(res, 'INVALID_AMOUNT', 'The restaurant payment amount is invalid.');
      const preflightPolicy = getTransactionAuthPolicy({ amountMinor: preflightAmountMinor, transactionType: 'merchant_payment' });
      if (preflightPolicy.requiredFactors.includes('biometric')) {
        const assertion = isPlainObject(req.body.biometricAssertion) ? req.body.biometricAssertion : null;
        if (!assertion?.challengeId || !assertion?.credentialId || !assertion?.clientDataJSON || !assertion?.authenticatorData || !assertion?.signature) return errorResponse(res, 'BIOMETRIC_REQUIRED', 'Biometric verification is required to complete this restaurant payment.');
        const challengeRef = adminDb.collection(PASSKEY_CHALLENGES_COLLECTION).doc(String(assertion.challengeId));
        let challengeData: FirebaseFirestore.DocumentData | undefined;
        try {
          challengeData = await adminDb.runTransaction(async transaction => {
            const snap = await transaction.get(challengeRef);
            if (!snap.exists) return undefined;
            const data = snap.data();
            transaction.delete(challengeRef);
            return data;
          });
        } catch (error) {
          console.error('Restaurant biometric challenge consumption failed:', error);
          return errorResponse(res, 'SERVICE_UNAVAILABLE', 'Biometric verification could not be completed safely. Please try again.');
        }
        if (!challengeData) return errorResponse(res, 'BIOMETRIC_REQUIRED', 'Biometric verification is required. Please try again.');
        const { origin, rpId } = requestWebAuthnOrigin(req);
        try {
          const clientDataJSON = base64UrlToBuffer(String(assertion.clientDataJSON));
          const authenticatorData = base64UrlToBuffer(String(assertion.authenticatorData));
          const signature = base64UrlToBuffer(String(assertion.signature));
          const clientData = JSON.parse(clientDataJSON.toString('utf8'));
          const crypto = require('crypto');
          if (challengeData.uid !== uid || challengeData.type !== 'assertion' || challengeData.expiresAt.toMillis() < Date.now() || challengeData.origin !== origin || challengeData.rpId !== rpId || clientData.type !== 'webauthn.get' || clientData.challenge !== challengeData.challenge || clientData.origin !== origin) return errorResponse(res, 'BIOMETRIC_REQUIRED', 'Biometric verification could not be verified.');
          if (!authenticatorData.subarray(0, 32).equals(crypto.createHash('sha256').update(rpId).digest()) || (authenticatorData[32] & 0x05) !== 0x05) return errorResponse(res, 'BIOMETRIC_REQUIRED', 'Biometric verification requires user verification.');
          const credentialRef = adminDb.collection('authCredentials').doc(uid).collection(PASSKEY_COLLECTION).doc(String(assertion.credentialId));
          const credentialSnap = await credentialRef.get();
          if (!credentialSnap.exists) return errorResponse(res, 'BIOMETRIC_REQUIRED', 'This biometric credential is not registered.');
          const credential = credentialSnap.data()!;
          const publicKey = crypto.createPublicKey({ key: Buffer.from(String(credential.publicKey), 'base64'), format: 'der', type: 'spki' });
          const signedData = Buffer.concat([authenticatorData, crypto.createHash('sha256').update(clientDataJSON).digest()]);
          if (!crypto.verify('sha256', signedData, publicKey, signature)) return errorResponse(res, 'BIOMETRIC_REQUIRED', 'Biometric verification failed.');
          const signCount = authenticatorData.readUInt32BE(33);
          const previousCount = Number(credential.signCount || 0);
          if (previousCount > 0 && signCount > 0 && signCount <= previousCount) return errorResponse(res, 'BIOMETRIC_REQUIRED', 'The biometric credential counter is invalid.');
          await credentialRef.update({ signCount, lastUsedAt: Timestamp.now() });
          const expectedBinding = 'restaurant_payment|' + uid + '|' + orderId + '|' + preflightAmountMinor + '|NGN';
          if (challengeData.transactionBinding !== expectedBinding) return errorResponse(res, 'BIOMETRIC_REQUIRED', 'This biometric approval is not bound to this restaurant payment.');
        } catch {
          return errorResponse(res, 'BIOMETRIC_REQUIRED', 'Biometric verification could not be verified.');
        }
      }
      const idempotencyRef = adminDb.collection('restaurantPaymentIdempotency').doc(idempotencyDocumentId(uid, idempotencyKey));
      const result = await adminDb.runTransaction(async (transaction) => {
        const existing = await transaction.get(idempotencyRef);
        if (existing.exists) {
          const data = existing.data() || {};
          if (data.requestFingerprint !== uid + '|' + orderId) throw new RequestValidationError('INVALID_REQUEST', 'This payment idempotency key was already used with different payment data.');
          return data.result;
        }
        const orderRef = adminDb.collection('restaurantOrders').doc(orderId);
        const orderSnap = await transaction.get(orderRef);
        if (!orderSnap.exists) throw new RequestValidationError('NOT_FOUND', 'Restaurant order could not be found.');
        const order = orderSnap.data() as Record<string, any>;
        if (order.customerId !== uid) throw new RequestValidationError('FORBIDDEN', 'You can only pay for your own restaurant order.');
        if (order.currency !== 'NGN' || order.paymentMethod !== 'uniquepay') throw new RequestValidationError('INVALID_REQUEST', 'This order is not configured for UniquePay.');
        if (order.paymentStatus === 'paid') return { orderId, paymentStatus: 'paid', status: order.status, replayed: true };
        if (order.status !== 'pending_payment') throw new RequestValidationError('INVALID_REQUEST', 'This restaurant order is no longer awaiting payment.');
        const amountMinor = Number(order.totalMinor);
        if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) throw new RequestValidationError('INVALID_AMOUNT', 'The restaurant payment amount is invalid.');
        const restaurantRef = adminDb.collection('restaurants').doc(String(order.restaurantId));
        const restaurantSnap = await transaction.get(restaurantRef);
        if (!restaurantSnap.exists) throw new RequestValidationError('UNAVAILABLE', 'This restaurant is not yet connected to a verified UniquePay merchant wallet.');
        const restaurant = restaurantSnap.data() as Record<string, any>;
        const merchantWalletId = typeof restaurant.merchantWalletId === 'string' && isSafeFirebaseUid(restaurant.merchantWalletId) ? restaurant.merchantWalletId : '';
        if (!merchantWalletId || restaurant.uniquePayStatus !== 'verified') throw new RequestValidationError('UNAVAILABLE', 'This restaurant is not yet connected to a verified UniquePay merchant wallet.');
        if (merchantWalletId === uid) throw new RequestValidationError('INVALID_REQUEST', 'A customer cannot pay their own wallet.');
        const customerWalletRef = adminDb.collection('wallets').doc(uid), merchantWalletRef = adminDb.collection('wallets').doc(merchantWalletId);
        const [customerSnap, merchantSnap] = await Promise.all([transaction.get(customerWalletRef), transaction.get(merchantWalletRef)]);
        if (!customerSnap.exists || !merchantSnap.exists) throw new RequestValidationError('UNAVAILABLE', 'The UniquePay wallet connection is not available.');
        const customerWallet = validateWalletDocument(customerSnap.data(), uid), merchantWallet = validateWalletDocument(merchantSnap.data(), merchantWalletId);
        if (customerWallet.status !== 'active' || merchantWallet.status !== 'active') throw new RequestValidationError('UNAVAILABLE', 'The UniquePay wallets are not available.');
        if (customerWallet.availableBalanceMinor < amountMinor) throw new RequestValidationError('INSUFFICIENT_FUNDS', 'Your UniquePay balance is insufficient for this order.');
        const now = Timestamp.now(), transactionId = adminDb.collection('transactions').doc().id, reference = 'UP-RS-' + transactionId;
        const transactionRef = adminDb.collection('transactions').doc(transactionId);
        transaction.create(transactionRef, { id: transactionId, reference, senderId: uid, recipientId: merchantWalletId, amount: amountMinor, currency: 'NGN', type: 'merchant_payment', sourceModule: 'unique_restaurant.checkout', provider: 'unique_pay_internal_wallet', status: 'completed', relatedOrderIds: [orderId], createdAt: now, updatedAt: now, recordKind: 'financial', schemaVersion: 2, amountUnit: 'minor' });
        const debitRef = adminDb.collection('ledgerEntries').doc(), creditRef = adminDb.collection('ledgerEntries').doc();
        transaction.create(debitRef, { id: debitRef.id, transactionId, reference, uid, direction: 'debit', amountMinor, currency: 'NGN', status: 'completed', idempotencyKey, createdAt: now });
        transaction.create(creditRef, { id: creditRef.id, transactionId, reference, uid: merchantWalletId, direction: 'credit', amountMinor, currency: 'NGN', status: 'completed', idempotencyKey, createdAt: now });
        transaction.update(customerWalletRef, { availableBalanceMinor: customerWallet.availableBalanceMinor - amountMinor, updatedAt: now });
        transaction.update(merchantWalletRef, { availableBalanceMinor: merchantWallet.availableBalanceMinor + amountMinor, updatedAt: now });
        transaction.update(orderRef, { paymentStatus: 'paid', status: 'paid', paidAt: now, updatedAt: now, paymentTransactionId: transactionId, orderTimeline: [...(Array.isArray(order.orderTimeline) ? order.orderTimeline : []), { status: 'paid', at: now }] });
        const paymentResult = { orderId, paymentStatus: 'paid', status: 'paid', transactionId, reference };
        transaction.create(idempotencyRef, { uid, idempotencyKey, requestFingerprint: uid + '|' + orderId, result: paymentResult, createdAt: now, updatedAt: now });
        const auditRef = adminDb.collection('audit_logs').doc();
        transaction.create(auditRef, {
          action: 'restaurant.payment.completed',
          actorUid: uid,
          targetUid: merchantWalletId,
          resource: 'restaurant_order_payment',
          resourceId: orderId,
          orderId,
          transactionId,
          reference,
          amountMinor,
          currency: 'NGN',
          idempotencyKey,
          createdAt: now,
          timestamp: now,
        });
        return paymentResult;
      });
      return res.status(200).json(result);
    } catch (error) {
      if (error instanceof RequestValidationError) return errorResponse(res, error.code, error.message);
      console.error('Restaurant UniquePay payment failed:', error);
      return errorResponse(res, 'SERVICE_UNAVAILABLE', 'Restaurant payment could not be completed. Your order remains protected.');
    }
  });

  app.post("/api/store/checkout", authenticate, rateLimit({
    windowMs: 60_000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
    store: createFirestoreRateLimitStore('storeCheckoutRateLimits', 60_000),
    keyGenerator: (req) => {
      const uid = (req as any).user?.uid;
      return isSafeFirebaseUid(uid) ? uid : ipKeyGenerator(req.ip);
    },
    handler: (_req, res) => errorResponse(res, 'RATE_LIMITED', 'Too many checkout attempts. Please try again shortly.'),
  }), async (req, res) => {
    try {
      const uid = sanitizeRequiredAuthUid((req as any).user?.uid);
      if (!isPlainObject(req.body) || !isSafeIdempotencyKey(req.body.idempotencyKey)) {
        return errorResponse(res, 'INVALID_REQUEST', 'A valid checkout idempotency key is required.');
      }
      const idempotencyKey = req.body.idempotencyKey.trim();
      const idempotencyRef = adminDb.collection('storeCheckoutIdempotency').doc(idempotencyDocumentId(uid, idempotencyKey));
      const result = await adminDb.runTransaction(async (transaction) => {
        const existing = await transaction.get(idempotencyRef);
        if (existing.exists) {
          const data = existing.data() || {};
          if (data.uid !== uid || data.idempotencyKey !== idempotencyKey) {
            throw new RequestValidationError('INVALID_REQUEST', 'Invalid checkout idempotency record.');
          }
          return { orderIds: Array.isArray(data.orderIds) ? data.orderIds : [], replayed: true };
        }
        const cartSnapshot = await transaction.get(adminDb.collection('carts').where('customerId', '==', uid));
        if (cartSnapshot.empty) throw new RequestValidationError('INVALID_REQUEST', 'Your cart is empty.');
        const userSnapshot = await transaction.get(adminDb.collection('users').doc(uid));
        if (!userSnapshot.exists) throw new RequestValidationError('UNAUTHENTICATED', 'Your customer profile could not be found.');
        const userData = userSnapshot.data() as Record<string, unknown>;
        const shippingAddresses = Array.isArray(userData.shippingAddresses) ? userData.shippingAddresses : [];
        const requestedShippingAddressId = typeof req.body.shippingAddressId === 'string' ? req.body.shippingAddressId.trim() : '';
        const defaultShippingAddress = shippingAddresses.find((address: any) => address && address.isDefault === true) || shippingAddresses[0];
        const selectedShippingAddress = requestedShippingAddressId
          ? shippingAddresses.find((address: any) => address && address.id === requestedShippingAddressId)
          : defaultShippingAddress;
        if (!selectedShippingAddress || typeof selectedShippingAddress !== 'object') {
          throw new RequestValidationError('INVALID_REQUEST', 'Select a valid shipping address before checkout.');
        }
        const shippingAddress = {
          id: typeof selectedShippingAddress.id === 'string' ? selectedShippingAddress.id : 'default',
          label: typeof selectedShippingAddress.label === 'string' ? selectedShippingAddress.label.slice(0, 80) : 'Shipping',
          recipientName: typeof selectedShippingAddress.recipientName === 'string' ? selectedShippingAddress.recipientName.slice(0, 120) : '',
          phone: typeof selectedShippingAddress.phone === 'string' ? selectedShippingAddress.phone.slice(0, 30) : '',
          country: typeof selectedShippingAddress.country === 'string' ? selectedShippingAddress.country.slice(0, 80) : 'Nigeria',
          state: typeof selectedShippingAddress.state === 'string' ? selectedShippingAddress.state.slice(0, 80) : '',
          lga: typeof selectedShippingAddress.lga === 'string' ? selectedShippingAddress.lga.slice(0, 100) : '',
          town: typeof selectedShippingAddress.town === 'string' ? selectedShippingAddress.town.slice(0, 100) : '',
          area: typeof selectedShippingAddress.area === 'string' ? selectedShippingAddress.area.slice(0, 120) : '',
          fullAddress: typeof selectedShippingAddress.fullAddress === 'string' ? selectedShippingAddress.fullAddress.slice(0, 300) : '',
          landmark: typeof selectedShippingAddress.landmark === 'string' ? selectedShippingAddress.landmark.slice(0, 160) : '',
        };
        if (!shippingAddress.recipientName || !shippingAddress.phone || !shippingAddress.state || !shippingAddress.lga || !shippingAddress.town || !shippingAddress.area || !shippingAddress.fullAddress) {
          throw new RequestValidationError('INVALID_REQUEST', 'Complete your selected shipping address before checkout.');
        }
        const carts = cartSnapshot.docs.map((snapshot) => ({ ref: snapshot.ref, id: snapshot.id, data: snapshot.data() as Record<string, unknown> }));
        const productSnapshots = new Map<string, FirebaseFirestore.DocumentSnapshot>();
        for (const cart of carts) {
          if (cart.data.customerId !== uid || typeof cart.data.productId !== 'string' || !cart.data.productId.trim() ||
              !Number.isSafeInteger(cart.data.quantity) || Number(cart.data.quantity) <= 0) {
            throw new RequestValidationError('INVALID_REQUEST', 'Your cart contains invalid data.');
          }
          const productId = String(cart.data.productId).trim();
          productSnapshots.set(productId, await transaction.get(adminDb.collection('products').doc(productId)));
        }
        const groups = new Map<string, { cart: typeof carts[number]; product: Record<string, unknown>; productId: string }[]>();
        const requestedByProduct = new Map<string, number>();
        for (const cart of carts) {
          const productId = String(cart.data.productId).trim();
          const snapshot = productSnapshots.get(productId);
          if (!snapshot?.exists) throw new RequestValidationError('INVALID_REQUEST', 'A product in your cart is no longer available.');
          const product = snapshot.data() || {};
          const quantity = Number(cart.data.quantity);
          const sellerId = product.sellerId;
          const price = product.price;
          const available = product.quantity;
          const minOrderQuantity = Number(product.minOrderQuantity || 1);
          if (!isSafeFirebaseUid(sellerId) || product.status !== 'published' || typeof price !== 'number' || !Number.isFinite(price) || price < 0 ||
              product.currency !== 'NGN' || !Number.isSafeInteger(available) || available < 0 ||
              !Number.isSafeInteger(minOrderQuantity) || minOrderQuantity < 1 || quantity < minOrderQuantity) {
            throw new RequestValidationError('INVALID_REQUEST', 'One or more products in your cart are no longer available in the requested quantity.');
          }
          const requested = (requestedByProduct.get(productId) || 0) + quantity;
          if (!Number.isSafeInteger(requested) || requested > available) {
            throw new RequestValidationError('INVALID_REQUEST', 'One or more products in your cart are no longer available in the requested quantity.');
          }
          requestedByProduct.set(productId, requested);
          const group = groups.get(sellerId) || [];
          group.push({ cart, product, productId });
          groups.set(sellerId, group);
        }
        const orderIds: string[] = [];
        const now = Timestamp.now().toDate().toISOString();
        for (const [productId, requestedQuantity] of requestedByProduct) {
          const snapshot = productSnapshots.get(productId);
          if (!snapshot?.exists) throw new RequestValidationError('INVALID_REQUEST', 'A product in your cart is no longer available.');
          const product = snapshot.data() || {};
          const remainingQuantity = Number(product.quantity) - requestedQuantity;
          transaction.update(snapshot.ref, {
            quantity: remainingQuantity,
            status: remainingQuantity === 0 ? 'out_of_stock' : product.status,
            updatedAt: now,
          });
        }
        for (const [sellerId, sellerItems] of groups) {
          const orderRef = adminDb.collection('orders').doc();
          const items = sellerItems.map(({ product, productId, cart }) => ({
            productId,
            name: typeof product.name === 'string' ? product.name : 'Product',
            price: product.price,
            quantity: Number(cart.data.quantity),
            productStatusAtCheckout: product.status,
          }));
          const totalAmountMinor = items.reduce((sum, item) => sum + Math.round(Number(item.price) * 100) * item.quantity, 0);
          if (!Number.isSafeInteger(totalAmountMinor) || totalAmountMinor <= 0) {
            throw new RequestValidationError('INVALID_AMOUNT', 'The Store order amount is invalid.');
          }
          const totalAmount = totalAmountMinor / 100;
          transaction.create(orderRef, {
            id: orderRef.id, customerId: uid, sellerId, items, totalAmount, amountMinor: totalAmountMinor, currency: 'NGN',
            status: 'pending', shippingAddress, createdAt: now, updatedAt: now,
          });
          orderIds.push(orderRef.id);
        }
        carts.forEach((cart) => transaction.delete(cart.ref));
        transaction.create(idempotencyRef, { uid, idempotencyKey, orderIds, createdAt: now, updatedAt: now });
        return { orderIds, replayed: false };
      });
      return res.status(200).json(result);
    } catch (error) {
      if (error instanceof RequestValidationError) return errorResponse(res, error.code, error.message);
      console.error('Store checkout failed:', error);
      return errorResponse(res, 'SERVICE_UNAVAILABLE', 'Checkout could not be completed. Your cart was not cleared.');
    }
  });

  app.post("/api/store/pay", authenticate, rateLimit({
    windowMs: 60_000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
    store: createFirestoreRateLimitStore('storePaymentRateLimits', 60_000),
    keyGenerator: (req) => {
      const uid = (req as any).user?.uid;
      return isSafeFirebaseUid(uid) ? uid : ipKeyGenerator(req.ip);
    },
    handler: (_req, res) => errorResponse(res, 'RATE_LIMITED', 'Too many Store payment attempts. Please try again shortly.'),
  }), async (req, res) => {
    try {
      const uid = sanitizeRequiredAuthUid((req as any).user?.uid);
      const paymentBody = isPlainObject(req.body) ? req.body : {};
      if (!isPlainObject(req.body) || !isSafeIdempotencyKey(req.body.idempotencyKey) ||
          typeof req.body.transactionPin !== 'string' || !/^\d{4}$/.test(req.body.transactionPin)) {
        return errorResponse(res, 'INVALID_REQUEST', 'A valid payment idempotency key and 4-digit Transaction PIN are required.');
      }
      const idempotencyKey = req.body.idempotencyKey.trim();
      if (!(await verifyTransactionPin(uid, req.body.transactionPin))) {
        return errorResponse(res, 'FORBIDDEN', 'Incorrect Transaction PIN.');
      }

      const orders = Array.isArray(req.body.orderIds) ? req.body.orderIds : [];
      if (orders.length < 1 || orders.length > 50 || !orders.every((id) => typeof id === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(id))) {
        return errorResponse(res, 'INVALID_REQUEST', 'One or more order IDs are invalid.');
      }

      const orderIds = Array.from(new Set(orders as string[]));
      const orderSnapshots = await Promise.all(orderIds.map((id) => adminDb.collection('orders').doc(id).get()));
      const sellerTotalsMinor = new Map<string, number>();
      let amountMinor = 0;

      for (const snapshot of orderSnapshots) {
        if (!snapshot.exists) return errorResponse(res, 'NOT_FOUND', 'One or more Store orders could not be found.');
        const order = snapshot.data() as Record<string, unknown>;
        if (order.customerId !== uid || order.currency !== 'NGN') return errorResponse(res, 'FORBIDDEN', 'You can only pay for your own NGN Store orders.');
        if (order.status !== 'pending') return errorResponse(res, 'INVALID_REQUEST', 'One or more Store orders are no longer awaiting payment.');
        if (!isSafeFirebaseUid(order.sellerId) || !Number.isSafeInteger(order.amountMinor) || order.amountMinor <= 0) {
          return errorResponse(res, 'INVALID_REQUEST', 'One or more Store orders have invalid payment data.');
        }
        amountMinor += order.amountMinor;
        if (!Number.isSafeInteger(amountMinor)) return errorResponse(res, 'INVALID_AMOUNT', 'The Store payment amount is invalid.');
        const sellerAmountMinor = (sellerTotalsMinor.get(order.sellerId) || 0) + order.amountMinor;
        if (!Number.isSafeInteger(sellerAmountMinor)) return errorResponse(res, 'INVALID_AMOUNT', 'The Store seller settlement amount is invalid.');
        sellerTotalsMinor.set(order.sellerId, sellerAmountMinor);
      }
      if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) return errorResponse(res, 'INVALID_AMOUNT', 'The Store payment amount is invalid.');

      const authPolicy = getTransactionAuthPolicy({
        amountMinor,
        transactionType: 'merchant_payment',
      });
      const biometricLevel = authPolicy.biometricLevel;
      const biometricRequired = authPolicy.requiredFactors.includes('biometric');
      if (biometricRequired) {
        const assertion = isPlainObject(paymentBody.biometricAssertion) ? paymentBody.biometricAssertion : null;
        if (!assertion?.challengeId || !assertion?.credentialId || !assertion?.clientDataJSON || !assertion?.authenticatorData || !assertion?.signature) {
          return errorResponse(res, 'BIOMETRIC_REQUIRED', biometricLevel >= 3 ? 'Biometric verification is required for Store payments of ₦500,000 or more.' : biometricLevel >= 2 ? 'Biometric verification is required for Store payments of ₦200,000 or more.' : biometricLevel >= 1 ? 'Biometric verification is required for Store payments of ₦50,000 or more.' : 'Biometric verification is required for your first wallet transaction.');
        }
        const challengeRef = adminDb.collection(PASSKEY_CHALLENGES_COLLECTION).doc(String(assertion.challengeId));
        let challengeData: FirebaseFirestore.DocumentData | undefined;
        try {
          challengeData = await adminDb.runTransaction(async transaction => {
            const challengeSnap = await transaction.get(challengeRef);
            if (!challengeSnap.exists) return undefined;
            const data = challengeSnap.data();
            transaction.delete(challengeRef);
            return data;
          });
        } catch (error) {
          console.error('Store biometric challenge consumption failed:', error);
          return errorResponse(res, 'SERVICE_UNAVAILABLE', 'Biometric verification could not be completed safely. Please try again.');
        }
        if (!challengeData) return errorResponse(res, 'BIOMETRIC_REQUIRED', 'Biometric verification is required. Please try again.');
        const { origin, rpId } = requestWebAuthnOrigin(req);
        const clientDataJSON = base64UrlToBuffer(String(assertion.clientDataJSON));
        const authenticatorData = base64UrlToBuffer(String(assertion.authenticatorData));
        const signature = base64UrlToBuffer(String(assertion.signature));
        let clientData: any;
        try { clientData = JSON.parse(clientDataJSON.toString('utf8')); } catch { return errorResponse(res, 'BIOMETRIC_REQUIRED', 'Biometric verification could not be verified.'); }
        if (challengeData.uid !== uid || challengeData.type !== 'assertion' || challengeData.expiresAt.toMillis() < Date.now() || challengeData.origin !== origin || challengeData.rpId !== rpId || clientData.type !== 'webauthn.get' || clientData.challenge !== challengeData.challenge || clientData.origin !== origin) {
          return errorResponse(res, 'BIOMETRIC_REQUIRED', 'Biometric verification could not be verified.');
        }
        const crypto = require('crypto');
        if (!authenticatorData.subarray(0, 32).equals(crypto.createHash('sha256').update(rpId).digest()) || (authenticatorData[32] & 0x05) !== 0x05) {
          return errorResponse(res, 'BIOMETRIC_REQUIRED', 'Biometric verification requires user verification.');
        }
        const credentialRef = adminDb.collection('authCredentials').doc(uid).collection(PASSKEY_COLLECTION).doc(String(assertion.credentialId));
        const credentialSnap = await credentialRef.get();
        if (!credentialSnap.exists) return errorResponse(res, 'BIOMETRIC_REQUIRED', 'This biometric credential is not registered.');
        const credential = credentialSnap.data()!;
        const publicKey = crypto.createPublicKey({ key: Buffer.from(String(credential.publicKey), 'base64'), format: 'der', type: 'spki' });
        const signedData = Buffer.concat([authenticatorData, crypto.createHash('sha256').update(clientDataJSON).digest()]);
        if (!crypto.verify('sha256', signedData, publicKey, signature)) return errorResponse(res, 'BIOMETRIC_REQUIRED', 'Biometric verification failed.');
        const signCount = authenticatorData.readUInt32BE(33);
        const previousCount = Number(credential.signCount || 0);
        if (previousCount > 0 && signCount > 0 && signCount <= previousCount) return errorResponse(res, 'BIOMETRIC_REQUIRED', 'The biometric credential counter is invalid.');
        await credentialRef.update({ signCount, lastUsedAt: Timestamp.now() });
        const expectedBinding = 'store_payment|' + uid + '|' + orderIds.join(',') + '|' + amountMinor + '|NGN';
        if (challengeData.transactionBinding !== expectedBinding) return errorResponse(res, 'BIOMETRIC_REQUIRED', 'This biometric approval is not bound to this Store payment.');
      }

      const idempotencyRef = adminDb.collection('storePaymentIdempotency').doc(idempotencyDocumentId(uid, idempotencyKey));
      const fingerprint = [uid, orderIds.join(','), String(amountMinor), 'NGN'].join('|');
      const result = await adminDb.runTransaction(async (transaction) => {
        const existing = await transaction.get(idempotencyRef);
        if (existing.exists) {
          const data = existing.data() || {};
          if (data.requestFingerprint !== fingerprint) throw new RequestValidationError('INVALID_REQUEST', 'This payment idempotency key was already used with different payment data.');
          return data.result;
        }

        const transactionOrderSnapshots = await Promise.all(orderIds.map((orderId) => transaction.get(adminDb.collection('orders').doc(orderId))));
        const transactionSellerTotalsMinor = new Map<string, number>();
        let transactionAmountMinor = 0;
        transactionOrderSnapshots.forEach((snapshot, index) => {
          if (!snapshot.exists) throw new RequestValidationError('NOT_FOUND', 'One or more Store orders could not be found.');
          const order = snapshot.data() as Record<string, unknown>;
          if (order.customerId !== uid || order.currency !== 'NGN' || order.status !== 'pending' ||
              !isSafeFirebaseUid(order.sellerId) || !Number.isSafeInteger(order.amountMinor) || order.amountMinor <= 0) {
            throw new RequestValidationError('INVALID_REQUEST', 'One or more Store orders changed and must be revalidated before payment.');
          }
          transactionAmountMinor += order.amountMinor;
          const sellerAmountMinor = (transactionSellerTotalsMinor.get(order.sellerId) || 0) + order.amountMinor;
          if (!Number.isSafeInteger(transactionAmountMinor) || !Number.isSafeInteger(sellerAmountMinor)) {
            throw new RequestValidationError('INVALID_AMOUNT', 'The Store payment amount is invalid.');
          }
          transactionSellerTotalsMinor.set(order.sellerId, sellerAmountMinor);
        });
        if (transactionAmountMinor !== amountMinor) {
          throw new RequestValidationError('INVALID_REQUEST', 'The Store payment amount changed; please retry checkout.');
        }

        const walletRefs = Array.from(transactionSellerTotalsMinor.keys()).map((sellerId) => adminDb.collection('wallets').doc(sellerId));
        const customerWalletRef = adminDb.collection('wallets').doc(uid);
        const snapshots = await Promise.all([transaction.get(customerWalletRef), ...walletRefs.map((ref) => transaction.get(ref))]);
        const customerWalletSnap = snapshots[0];
        if (!customerWalletSnap.exists) throw new Error('STORE_WALLET_NOT_FOUND');
        const customerWallet = validateWalletDocument(customerWalletSnap.data(), uid);
        if (customerWallet.status !== 'active') throw new Error('STORE_WALLET_UNAVAILABLE');
        if (customerWallet.availableBalanceMinor < amountMinor) throw new Error('STORE_INSUFFICIENT_FUNDS');

        const sellerWallets = new Map<string, WalletDocument>();
        Array.from(transactionSellerTotalsMinor.keys()).forEach((sellerId, index) => {
          const snap = snapshots[index + 1];
          if (!snap.exists) throw new Error('STORE_SELLER_WALLET_NOT_FOUND');
          const wallet = validateWalletDocument(snap.data(), sellerId);
          if (wallet.status !== 'active') throw new Error('STORE_SELLER_WALLET_UNAVAILABLE');
          sellerWallets.set(sellerId, wallet);
        });

        const now = Timestamp.now();
        const paymentTransactionIds: string[] = [];
        for (const [sellerId, sellerAmountMinor] of transactionSellerTotalsMinor) {
          if (!Number.isSafeInteger(sellerAmountMinor) || sellerAmountMinor <= 0) throw new Error('STORE_INVALID_AMOUNT');
          const sellerWallet = sellerWallets.get(sellerId)!;
          const transactionId = adminDb.collection('transactions').doc().id;
          const reference = `UP-ST-${transactionId}`;
          const transactionRef = adminDb.collection('transactions').doc(transactionId);
          transaction.create(transactionRef, {
            id: transactionId, reference, senderId: uid, recipientId: sellerId, amount: sellerAmountMinor,
            currency: 'NGN', type: 'merchant_payment', sourceModule: 'unique_store.checkout',
            provider: 'unique_pay_internal_wallet', status: 'completed', relatedOrderIds: orderIds,
            createdAt: now, updatedAt: now, recordKind: 'financial', schemaVersion: 2, amountUnit: 'minor',
          });
          const debitRef = adminDb.collection('ledgerEntries').doc();
          const creditRef = adminDb.collection('ledgerEntries').doc();
          transaction.create(debitRef, { id: debitRef.id, transactionId, reference, uid, direction: 'debit', amountMinor: sellerAmountMinor, currency: 'NGN', status: 'completed', idempotencyKey, createdAt: now });
          transaction.create(creditRef, { id: creditRef.id, transactionId, reference, uid: sellerId, direction: 'credit', amountMinor: sellerAmountMinor, currency: 'NGN', status: 'completed', idempotencyKey, createdAt: now });
                    paymentTransactionIds.push(transactionId);
        }

        const customerBalanceAfter = customerWallet.availableBalanceMinor - amountMinor;
        if (!Number.isSafeInteger(customerBalanceAfter) || customerBalanceAfter < 0) throw new Error('STORE_TRANSACTION_FAILED');
        transaction.update(customerWalletRef, { availableBalanceMinor: customerBalanceAfter, updatedAt: now });
        for (const [sellerId, sellerAmountMinor] of transactionSellerTotalsMinor) {
          const sellerWallet = sellerWallets.get(sellerId)!;
          const sellerBalanceAfter = sellerWallet.availableBalanceMinor + sellerAmountMinor;
          if (!Number.isSafeInteger(sellerBalanceAfter)) throw new Error('STORE_TRANSACTION_FAILED');
          transaction.update(adminDb.collection('wallets').doc(sellerId), { availableBalanceMinor: sellerBalanceAfter, updatedAt: now });
        }

        for (const orderId of orderIds) {
          const orderRef = adminDb.collection('orders').doc(orderId);
          transaction.update(orderRef, { status: 'confirmed', paymentStatus: 'paid', paidAt: now, updatedAt: now, paymentTransactionIds });
        }
        const paymentResult = { status: 'completed', orderIds, transactionIds: paymentTransactionIds, amountMinor, idempotencyKey };
        transaction.create(idempotencyRef, { uid, orderIds, amountMinor, requestFingerprint: fingerprint, status: 'completed', result: paymentResult, createdAt: now, updatedAt: now });
        const auditRef = adminDb.collection('audit_logs').doc();
        transaction.create(auditRef, {
          action: 'store.settlement.completed',
          actorUid: uid,
          targetUid: uid,
          resource: 'store_order_payment',
          resourceId: orderIds[0],
          orderIds,
          transactionIds: paymentTransactionIds,
          amountMinor,
          currency: 'NGN',
          idempotencyKey,
          createdAt: now,
          timestamp: now,
        });
        return paymentResult;
      });
      return res.status(200).json(result);
    } catch (error) {
      if (error instanceof RequestValidationError) return errorResponse(res, error.code, error.message);
      const code = error instanceof Error ? error.message : '';
      if (code === 'STORE_WALLET_NOT_FOUND' || code === 'STORE_SELLER_WALLET_NOT_FOUND') return errorResponse(res, 'WALLET_NOT_FOUND', 'A required UniquePay wallet is not available.');
      if (code === 'STORE_WALLET_UNAVAILABLE' || code === 'STORE_SELLER_WALLET_UNAVAILABLE') return errorResponse(res, 'WALLET_UNAVAILABLE', 'A required UniquePay wallet is unavailable.');
      if (code === 'STORE_INSUFFICIENT_FUNDS') return errorResponse(res, 'INSUFFICIENT_FUNDS', 'Insufficient UniquePay wallet balance.');
      if (code === 'STORE_INVALID_AMOUNT') return errorResponse(res, 'INVALID_AMOUNT', 'The Store payment amount is invalid.');
      if (code === 'STORE_TRANSACTION_FAILED') return errorResponse(res, 'TRANSACTION_FAILED', 'The Store payment could not be safely recorded.');
      console.error('Store payment failed:', error);
      return errorResponse(res, 'SERVICE_UNAVAILABLE', 'Store payment could not be completed. Your order remains unpaid.');
    }
  });

  app.post("/api/store/orders/:orderId/cancel", authenticate, rateLimit({
    windowMs: 60_000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
    store: createFirestoreRateLimitStore('storeOrderCancelRateLimits', 60_000),
    keyGenerator: (req) => {
      const uid = (req as any).user?.uid;
      return isSafeFirebaseUid(uid) ? uid : ipKeyGenerator(req.ip);
    },
    handler: (_req, res) => errorResponse(res, 'RATE_LIMITED', 'Too many Store order cancellation requests. Please try again shortly.'),
  }), async (req, res) => {
    try {
      const uid = sanitizeRequiredAuthUid((req as any).user?.uid);
      const orderId = req.params.orderId;
      if (!/^[A-Za-z0-9_-]{1,128}$/.test(orderId)) {
        return errorResponse(res, 'INVALID_REQUEST', 'The order ID is invalid.');
      }
      const result = await adminDb.runTransaction(async (transaction) => {
        const orderRef = adminDb.collection('orders').doc(orderId);
        const orderSnap = await transaction.get(orderRef);
        if (!orderSnap.exists) throw new RequestValidationError('NOT_FOUND', 'The Store order was not found.');
        const order = orderSnap.data() as Record<string, unknown>;
        if (order.customerId !== uid) throw new RequestValidationError('FORBIDDEN', 'You can only cancel your own Store orders.');
        if (order.currency !== 'NGN') throw new RequestValidationError('INVALID_REQUEST', 'Only NGN Store orders can be cancelled here.');
        if (order.paymentStatus === 'paid' || order.status === 'confirmed') {
          throw new RequestValidationError('INVALID_REQUEST', 'A paid Store order cannot be cancelled through the unpaid-order flow.');
        }
        if (order.status !== 'pending') {
          return { orderId, cancelled: false, replayed: true };
        }
        const items = Array.isArray(order.items) ? order.items : [];
        const quantities = new Map<string, number>();
        const statusByProduct = new Map<string, string>();
        for (const item of items) {
          if (!item || typeof item !== 'object') throw new RequestValidationError('INVALID_REQUEST', 'The Store order contains invalid inventory data.');
          const productId = typeof (item as any).productId === 'string' ? (item as any).productId : '';
          const quantity = Number((item as any).quantity);
          if (!productId || !Number.isSafeInteger(quantity) || quantity <= 0) {
            throw new RequestValidationError('INVALID_REQUEST', 'The Store order contains invalid inventory data.');
          }
          quantities.set(productId, (quantities.get(productId) || 0) + quantity);
          const checkoutStatus = typeof (item as any).productStatusAtCheckout === 'string' ? (item as any).productStatusAtCheckout : null;
          if (checkoutStatus) statusByProduct.set(productId, checkoutStatus);
        }
        const productSnaps = await Promise.all(Array.from(quantities.keys()).map((id) => transaction.get(adminDb.collection('products').doc(id))));
        const now = Timestamp.now().toDate().toISOString();
        productSnaps.forEach((snap, index) => {
          if (!snap.exists) return;
          const product = snap.data() as Record<string, unknown>;
          const currentQuantity = Number(product.quantity);
          const restoreQuantity = quantities.get(Array.from(quantities.keys())[index]) || 0;
          if (!Number.isSafeInteger(currentQuantity) || currentQuantity < 0 || !Number.isSafeInteger(restoreQuantity)) {
            throw new RequestValidationError('INVALID_REQUEST', 'Inventory data is invalid; cancellation was not applied.');
          }
          transaction.update(snap.ref, {
            quantity: currentQuantity + restoreQuantity,
            status: statusByProduct.get(Array.from(quantities.keys())[index]) || product.status,
            updatedAt: now,
          });
        });
        transaction.update(orderRef, {
          status: 'cancelled',
          paymentStatus: 'unpaid',
          cancelledAt: now,
          updatedAt: now,
        });
        const auditRef = adminDb.collection('audit_logs').doc();
        transaction.create(auditRef, {
          action: 'store.order.cancelled',
          actorUid: uid,
          targetUid: uid,
          resource: 'store_order',
          resourceId: orderId,
          reason: 'unpaid_order_inventory_release',
          createdAt: now,
          timestamp: Timestamp.now(),
        });
        return { orderId, cancelled: true, replayed: false };
      });
      return res.status(200).json(result);
    } catch (error) {
      if (error instanceof RequestValidationError) return errorResponse(res, error.code, error.message);
      console.error('Store order cancellation failed:', error);
      return errorResponse(res, 'SERVICE_UNAVAILABLE', 'The Store order could not be cancelled safely.');
    }
  });

  app.post("/api/store/orders/:orderId/refund", authenticate, rateLimit({
    windowMs: 60_000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    store: createFirestoreRateLimitStore('storeOrderRefundRateLimits', 60_000),
    keyGenerator: (req) => {
      const uid = (req as any).user?.uid;
      return isSafeFirebaseUid(uid) ? uid : ipKeyGenerator(req.ip);
    },
    handler: (_req, res) => errorResponse(res, 'RATE_LIMITED', 'Too many Store refund requests. Please try again shortly.'),
  }), async (req, res) => {
    try {
      const uid = sanitizeRequiredAuthUid((req as any).user?.uid);
      const orderId = req.params.orderId;
      if (!/^[A-Za-z0-9_-]{1,128}$/.test(orderId)) {
        return errorResponse(res, 'INVALID_REQUEST', 'The order ID is invalid.');
      }
      const idempotencyKey = typeof req.body?.idempotencyKey === 'string' ? req.body.idempotencyKey.trim() : '';
      const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim().slice(0, 500) : '';
      if (!/^[A-Za-z0-9_-]{1,200}$/.test(idempotencyKey) || !reason) {
        return errorResponse(res, 'INVALID_REQUEST', 'A valid idempotency key and refund reason are required.');
      }

      const orderSnap = await adminDb.collection('orders').doc(orderId).get();
      if (!orderSnap.exists) return errorResponse(res, 'NOT_FOUND', 'The Store order was not found.');
      const order = orderSnap.data() as Record<string, unknown>;
      const customerId = typeof order.customerId === 'string' ? order.customerId : '';
      const sellerId = typeof order.sellerId === 'string' ? order.sellerId : '';
      const rolesSnap = await adminDb.collection('users').doc(uid).get();
      const roles = Array.isArray(rolesSnap.data()?.roles) ? rolesSnap.data()?.roles.filter((role: unknown) => typeof role === 'string') as any[] : [];
      const permissions = Array.isArray(rolesSnap.data()?.permissions) ? rolesSnap.data()?.permissions.filter((permission: unknown) => typeof permission === 'string') as any[] : [];
      const canManageDisputes = hasRolePermission(roles, permissions, 'manage:disputes');
      if (uid !== customerId && !canManageDisputes) {
        return errorResponse(res, 'FORBIDDEN', 'You are not permitted to refund this Store order.');
      }
      if (order.currency !== 'NGN' || order.paymentStatus !== 'paid') {
        return errorResponse(res, 'INVALID_REQUEST', 'Only paid NGN Store orders can be refunded.');
      }
      const refundableStatuses = new Set(['confirmed', 'processing', 'ready_for_pickup', 'shipped', 'out_for_delivery', 'delivered', 'completed']);
      if (!refundableStatuses.has(String(order.status))) {
        return errorResponse(res, 'INVALID_REQUEST', 'This Store order is not in a refundable state.');
      }
      const paymentTransactionIds = Array.isArray(order.paymentTransactionIds)
        ? order.paymentTransactionIds.filter((id: unknown) => typeof id === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(id))
        : [];
      if (!paymentTransactionIds.length) {
        return errorResponse(res, 'INVALID_REQUEST', 'The Store order does not have a payment transaction for refund.');
      }
      if (!sellerId || !customerId) {
        return errorResponse(res, 'INVALID_REQUEST', 'The Store order has incomplete payment ownership data.');
      }

      const orderAmountMinor = Number(order.amountMinor);
      if (!Number.isSafeInteger(orderAmountMinor) || orderAmountMinor <= 0) {
        return errorResponse(res, 'INVALID_REQUEST', 'The Store order amount is invalid for refund.');
      }

      const paymentSnaps = await Promise.all(paymentTransactionIds.map((id) => adminDb.collection('transactions').doc(id).get()));
      const candidates = paymentSnaps
        .filter((snap) => snap.exists)
        .map((snap) => ({ id: snap.id, data: snap.data() as Record<string, unknown> }))
        .filter(({ data: payment }) => {
          const amountMinor = Number(payment.amount);
          const relatedOrderIds = Array.isArray(payment.relatedOrderIds) ? payment.relatedOrderIds : [];
          return payment.recordKind === 'financial' &&
            payment.schemaVersion === 2 &&
            payment.amountUnit === 'minor' &&
            payment.currency === 'NGN' &&
            payment.status === 'completed' &&
            payment.type === 'merchant_payment' &&
            payment.sourceModule === 'unique_store.checkout' &&
            payment.senderId === customerId &&
            payment.recipientId === sellerId &&
            relatedOrderIds.includes(orderId) &&
            Number.isSafeInteger(amountMinor) &&
            amountMinor >= orderAmountMinor;
        });

      if (candidates.length !== 1) {
        return errorResponse(res, candidates.length === 0 ? 'NOT_FOUND' : 'INVALID_REQUEST',
          candidates.length === 0
            ? 'The original Store payment transaction was not found.'
            : 'The Store payment could not be uniquely matched to this order.');
      }

      const originalTransactionId = candidates[0].id;
      const payment = candidates[0].data;
      const amountMinor = Number(payment.amount);

      const result = await executeFinancialRefund(adminDb, {
        originalTransactionId,
        amountMinor,
        currency: 'NGN',
        idempotencyKey,
        actorUid: uid,
        reason,
        relatedOrderId: orderId,
        sourceModule: 'unique_store.refund',
      });
      if ('error' in result) {
        const status = result.error.code === 'REFUND_IN_PROGRESS' || result.error.code === 'REFUND_EXCEEDS_REMAINING' || result.error.code === 'IDEMPOTENCY_CONFLICT' ? 409 :
          result.error.code === 'ORIGINAL_NOT_FOUND' ? 404 :
          result.error.code === 'WALLET_NOT_FOUND' ? 404 :
          result.error.code === 'WALLET_UNAVAILABLE' ? 403 :
          result.error.code === 'INSUFFICIENT_FUNDS' ? 409 :
          result.error.code === 'INVALID_REQUEST' ? 400 :
          result.error.code === 'ORIGINAL_NOT_REFUNDABLE' ? 409 : 500;
        return res.status(status).json({ error: result.error });
      }
      return res.status(200).json({ ...result, orderId });
    } catch (error) {
      console.error('Store order refund failed:', error);
      return errorResponse(res, 'SERVICE_UNAVAILABLE', 'The Store order refund could not be completed safely.');
    }
  });

  app.get("/api/store/orders/:orderId/settlement", authenticate, rateLimit({
    windowMs: 60_000,
    limit: 60,
    standardHeaders: true,
    legacyHeaders: false,
    store: createFirestoreRateLimitStore('storeSettlementReadRateLimits', 60_000),
    keyGenerator: (req) => {
      const uid = (req as any).user?.uid;
      return isSafeFirebaseUid(uid) ? uid : ipKeyGenerator(req.ip);
    },
    handler: (_req, res) => errorResponse(res, 'RATE_LIMITED', 'Too many settlement status requests. Please try again shortly.'),
  }), async (req, res) => {
    try {
      const uid = sanitizeRequiredAuthUid((req as any).user?.uid);
      const orderId = req.params.orderId;
      if (!/^[A-Za-z0-9_-]{1,128}$/.test(orderId)) {
        return errorResponse(res, 'INVALID_REQUEST', 'The order ID is invalid.');
      }

      const orderRef = adminDb.collection('orders').doc(orderId);
      const orderSnap = await orderRef.get();
      if (!orderSnap.exists) return errorResponse(res, 'NOT_FOUND', 'The Store order was not found.');

      const order = orderSnap.data() as Record<string, unknown>;
      const customerId = typeof order.customerId === 'string' ? order.customerId : '';
      const sellerId = typeof order.sellerId === 'string' ? order.sellerId : '';
      if (uid !== customerId && uid !== sellerId) {
        return errorResponse(res, 'FORBIDDEN', 'You are not permitted to view this settlement.');
      }

      const txSnap = await adminDb.collection('transactions')
        .where('relatedOrderIds', 'array-contains', orderId)
        .where('recordKind', '==', 'financial')
        .where('amountUnit', '==', 'minor')
        .limit(20)
        .get();

      const settlements = txSnap.docs.map((doc) => {
        const data = doc.data() as Record<string, unknown>;
        return {
          id: doc.id,
          reference: typeof data.reference === 'string' ? data.reference : null,
          senderId: typeof data.senderId === 'string' ? data.senderId : null,
          recipientId: typeof data.recipientId === 'string' ? data.recipientId : null,
          amountMinor: Number.isSafeInteger(data.amount) ? data.amount : null,
          currency: data.currency === 'NGN' ? 'NGN' : null,
          status: typeof data.status === 'string' ? data.status : null,
          type: typeof data.type === 'string' ? data.type : null,
          createdAt: typeof (data.createdAt as { toDate?: unknown })?.toDate === 'function' ? (data.createdAt as { toDate: () => Date }).toDate().toISOString() : null,
        };
      });

      return res.status(200).json({
        orderId,
        paymentStatus: order.paymentStatus === 'paid' ? 'paid' : 'unpaid',
        orderStatus: typeof order.status === 'string' ? order.status : null,
        settlements,
        reconciled: order.paymentStatus === 'paid' && settlements.some((tx) => tx.status === 'completed'),
      });
    } catch (error) {
      console.error('Store settlement reconciliation read failed:', error);
      return errorResponse(res, 'SERVICE_UNAVAILABLE', 'Settlement status is temporarily unavailable.');
    }
  });

  if (process.env.NODE_ENV !== "production") { const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" }); app.use(vite.middlewares); }
  else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath, {
      setHeaders: (res, filePath) => {
        if (filePath.endsWith("index.html") || filePath.endsWith("sw.js") || filePath.endsWith("manifest.webmanifest")) {
          res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
          res.setHeader("Pragma", "no-cache");
          res.setHeader("Expires", "0");
        } else if (/\.(?:js|css|woff2?|png|jpe?g|gif|svg|webp|ico)$/.test(filePath)) {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        }
      },
    }));
    app.get("*", (req, res) => {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      res.sendFile(path.join(distPath, "index.html"));
    });
  }
  console.log(`UniqueOS Server ready on http://localhost:${PORT}`);
}
startServer();