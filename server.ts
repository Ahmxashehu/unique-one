import express, { Request, Response, NextFunction } from "express";
import http from "http";
import { createHash } from "crypto";
import path from "path";
import { createServer as createViteServer } from "vite";
import rateLimit, { type Store } from "express-rate-limit";
import { initializeApp, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import type { Conversation, ConversationMember, ConversationType, Message, MessageRequest } from "./src/lib/os/communication-types";
import { validateMessageDraft, CommunicationValidationError } from "./communicationCore";

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
  | 'TRANSACTION_FAILED' | 'SERVICE_UNAVAILABLE';
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
  SERVICE_UNAVAILABLE: 503,
};
class RequestValidationError extends Error {
  code: 'UNAUTHENTICATED' | 'INVALID_REQUEST';
  constructor(code: 'UNAUTHENTICATED' | 'INVALID_REQUEST', message: string) {
    super(message);
    this.name = 'RequestValidationError';
    this.code = code;
  }
}
if (getApps().length === 0) initializeApp({ projectId: "gen-lang-client-0680695304" });
const adminDb = getFirestore();
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
function idempotencyDocumentId(senderUid: string, idempotencyKey: string) { return `${senderUid}_${idempotencyKey}`; }
async function startServer() {
  const app = express();
  const PORT = 3000;
  const httpServer = http.createServer(app);
  app.use(express.json());
  app.use(rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: true, legacyHeaders: false }));
  const authenticate = async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return errorResponse(res, 'UNAUTHENTICATED', 'Authentication is required to access this resource.');
    try { (req as any).user = await getAuth().verifyIdToken(authHeader.split('Bearer ')[1]); next(); }
    catch (_) { return errorResponse(res, 'UNAUTHENTICATED', 'The supplied Firebase token is invalid or expired.'); }
  };
  app.get("/api/health", (req, res) => res.json({ status: "ok", ecosystem: "Unique One", version: "1.0.0" }));
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
  app.post("/api/wallet/transfer", rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: true, legacyHeaders: false, handler: (_req, res) => errorResponse(res, 'RATE_LIMITED', 'Too many transfer requests were made. Please try again shortly.') }), authenticate, async (req, res) => {
    const senderUid = (req as any).user?.uid as string | undefined;
    if (!senderUid) return errorResponse(res, 'UNAUTHENTICATED', 'Authentication is required to initiate a transfer.');
    let validatedRequest: TransferRequestInput;
    try { validatedRequest = validateTransferRequest(req.body, senderUid); }
    catch (error) {
      const code = (error as Error).message as TransferErrorCode;
      const messages: Record<TransferErrorCode, string> = {
        UNAUTHENTICATED: 'Authentication is required to initiate a transfer.', INVALID_REQUEST: 'The transfer request body is malformed or contains unsupported fields.', INVALID_RECIPIENT: 'A valid recipient UID is required.', RECIPIENT_NOT_FOUND: 'The recipient does not exist.', SELF_TRANSFER_NOT_ALLOWED: 'A wallet transfer to yourself is not allowed.', INVALID_AMOUNT: 'Transfer amount must be a positive integer minor-unit amount.', INVALID_CURRENCY: 'Only NGN transfers are supported.', INVALID_IDEMPOTENCY_KEY: 'The idempotency key is invalid or exceeds the allowed length.', IDEMPOTENCY_KEY_CONFLICT: 'This idempotency key was already used with different transfer parameters.', TRANSFER_ALREADY_COMPLETED: 'This transfer has already been completed.', TRANSFER_IN_PROGRESS: 'A transfer with this idempotency key is already in progress.', WALLET_NOT_FOUND: 'A wallet record is missing for this transfer.', WALLET_UNAVAILABLE: 'The wallet status or currency configuration is not valid for transfer.', INSUFFICIENT_FUNDS: 'The sender wallet does not have enough funds.', TRANSACTION_FAILED: 'The transfer failed while processing the transaction.', SERVICE_UNAVAILABLE: 'The transfer service is temporarily unavailable.',
        RATE_LIMITED: 'Too many requests were made. Please try again shortly.',
      };
      return errorResponse(res, code, messages[code] ?? 'Invalid transfer request.');
    }
    const { recipientId, amountMinor, currency, idempotencyKey, description } = validatedRequest;
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
        // Step 11A-2: Double-entry ledger. Two server-generated ledgerEntries documents
        // (LedgerEntryRecord schema) are written atomically within this same transaction:
        // one debit for the sender, one credit for the recipient. Both share the same
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
      return isSafeFirebaseUid(uid) ? uid : (req.ip || 'anonymous');
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

  app.get("/api/communication/conversations/:conversationId/presence", authenticate, rateLimit({
    windowMs: 60_000,
    limit: 120,
    standardHeaders: true,
    legacyHeaders: false,
    store: createFirestoreRateLimitStore('communicationPresenceReadRateLimits', 60_000),
    keyGenerator: (req) => {
      const uid = (req as any).user?.uid;
      return isSafeFirebaseUid(uid) ? uid : (req.ip || 'anonymous');
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
        return errorResponse(res, 'INVALID_REQUEST', 'You are not a member of this conversation.', 403);
      }
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

  app.post("/api/communication/message-requests", authenticate, rateLimit({
    windowMs: 60_000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
    store: createFirestoreRateLimitStore('communicationMessageRequestRateLimits', 60_000),
    keyGenerator: (req) => {
      const uid = (req as any).user?.uid;
      if (isSafeFirebaseUid(uid)) return uid;
      return req.ip || 'anonymous';
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
      return isSafeFirebaseUid(uid) ? uid : (req.ip || 'anonymous');
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
          return {
            request: { ...requestData, id: requestId, status: 'declined', updatedAt: now },
            conversation: undefined,
            alreadyHandled: false,
          };
        }

        const memberUids = [requestData.fromUid, responderUid].sort();
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
      const ip = req.ip;
      return typeof ip === 'string' && ip.length > 0 ? ip : 'anonymous';
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
      const conversationRef = adminDb.collection('conversations').doc();
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
  app.post("/api/communication/messages/:messageId/delivery", authenticate, rateLimit({
    windowMs: 60_000,
    limit: 120,
    standardHeaders: true,
    legacyHeaders: false,
    store: createFirestoreRateLimitStore('communicationMessageDeliveryRateLimits', 60_000),
    keyGenerator: (req) => {
      const uid = (req as any).user?.uid;
      return isSafeFirebaseUid(uid) ? uid : (req.ip || 'anonymous');
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

        const deliverySnapshot = await transaction.get(deliveryRef);
        const nowIso = Timestamp.now().toDate().toISOString();
        const current = deliverySnapshot.exists ? deliverySnapshot.data() as Record<string, unknown> : {};
        const currentStatus = current.status === 'read' ? 'read' : current.status === 'delivered' ? 'delivered' : 'sent';
        const nextStatus = action === 'read' ? 'read' : (currentStatus === 'read' ? 'read' : 'delivered');
        const delivery = {
          messageId,
          uid,
          status: nextStatus,
          ...(nextStatus !== 'sent' ? { deliveredAt: typeof current.deliveredAt === 'string' ? current.deliveredAt : nowIso } : {}),
          ...(nextStatus === 'read' ? { readAt: typeof current.readAt === 'string' ? current.readAt : nowIso } : {}),
        };
        if (deliverySnapshot.exists) transaction.update(deliveryRef, delivery);
        else transaction.create(deliveryRef, delivery);

        if (message.senderId !== uid) {
          const messageStatus = nextStatus === 'read' ? 'read' : 'delivered';
          if (message.status !== 'read') transaction.update(messageRef, { status: messageStatus, updatedAt: nowIso });
        }
        return { delivery, messageStatus: message.senderId === uid ? message.status : (nextStatus === 'read' ? 'read' : 'delivered') };
      });
      return res.status(200).json(result);
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      if (code === 'MESSAGE_NOT_FOUND') return errorResponse(res, 'INVALID_REQUEST', 'The message was not found.', 404);
      if (code === 'FORBIDDEN') return errorResponse(res, 'INVALID_REQUEST', 'You are not a member of this conversation.', 403);
      console.error('Message delivery update failed:', error);
      return errorResponse(res, 'SERVICE_UNAVAILABLE', 'Failed to update message delivery status.');
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
      const ip = req.ip;
      return typeof ip === 'string' && ip.length > 0 ? ip : 'anonymous';
    },
    handler: (_req, res) => errorResponse(res, 'RATE_LIMITED', 'Too many message requests. Please try again shortly.'),
  }), async (req, res) => {
    let senderUid: string;
    let draft: ReturnType<typeof validateMessageDraft>;
    try {
      senderUid = sanitizeRequiredAuthUid((req as any).user?.uid);
      draft = validateMessageDraft(req.body, { uid: senderUid });
      if (draft.type !== 'text') {
        return errorResponse(res, 'INVALID_REQUEST', 'Only text messages are enabled in this communication step.');
      }
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
      const messageRef = adminDb.collection('messages').doc();
      const now = Timestamp.now();
      const nowIso = now.toDate().toISOString();
      const message: Message = {
        id: messageRef.id,
        conversationId: draft.conversationId,
        senderId: senderUid,
        type: 'text',
        text: draft.text,
        createdAt: nowIso,
        updatedAt: nowIso,
        status: 'sent',
      };
      await adminDb.runTransaction(async (transaction) => {
        const membershipRef = adminDb.collection('conversationMembers').doc(conversationMemberDocumentId(draft.conversationId, senderUid));
        const [conversationSnapshot, membershipSnapshot] = await Promise.all([
          transaction.get(conversationRef),
          transaction.get(membershipRef),
        ]);
        if (!conversationSnapshot.exists || !membershipSnapshot.exists) {
          throw new RequestValidationError('INVALID_REQUEST', 'You are not a member of this conversation.');
        }
        transaction.create(messageRef, message);
        transaction.update(conversationRef, {
          lastMessageId: messageRef.id,
          lastMessageAt: nowIso,
          updatedAt: nowIso,
        });
      });
      return res.status(201).json({ message });
    } catch (error) {
      if (error instanceof RequestValidationError) {
        return errorResponse(res, error.code, error.message);
      }
      console.error('Message creation failed:', error);
      return errorResponse(res, 'SERVICE_UNAVAILABLE', 'Failed to send the message.');
    }
  });
  app.get("/api/calendar/events", async (req, res) => {
    try {
      const authHeader = req.headers.authorization; if (!authHeader) return res.status(401).json({ error: "No authorization header" });
      const response = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=" + new Date().toISOString() + "&maxResults=10&singleEvents=true&orderBy=startTime", { headers: { Authorization: authHeader, Accept: "application/json" } });
      if (!response.ok) return res.status(response.status).json(await response.json());
      return res.json(await response.json());
    } catch (error) { console.error("Calendar API Error:", error); return res.status(500).json({ error: "Failed to fetch calendar events" }); }
  });
  if (process.env.NODE_ENV !== "production") { const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" }); app.use(vite.middlewares); }
  else { const distPath = path.join(process.cwd(), "dist"); app.use(express.static(distPath)); app.get("*", (req, res) => res.sendFile(path.join(distPath, "index.html"))); }
  httpServer.listen(PORT, "0.0.0.0", () => console.log(`UniqueOS Server running on http://localhost:${PORT}`));
}
startServer();
