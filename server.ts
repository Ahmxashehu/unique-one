import express, { Request, Response, NextFunction } from "express";
import http from "http";
import path from "path";
import { randomUUID } from "node:crypto";
import { createServer as createViteServer } from "vite";
import { initializeApp, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

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
  | 'TRANSFER_IN_PROGRESS' | 'WALLET_NOT_FOUND' | 'WALLET_UNAVAILABLE' | 'INSUFFICIENT_FUNDS'
  | 'TRANSACTION_FAILED' | 'SERVICE_UNAVAILABLE';
interface TransferErrorResponse { error: { code: TransferErrorCode; message: string } }
interface TransferRequestInput { recipientId: string; amountMinor: number; currency: 'NGN'; idempotencyKey: string; description?: string }
const WALLET_CURRENCY = 'NGN';
const WALLET_STATUSES = new Set<WalletDocument['status']>(['active', 'suspended', 'locked']);
const MAX_DESCRIPTION_LENGTH = 500;
const MAX_IDEMPOTENCY_KEY_LENGTH = 128;
const transferErrorStatus: Record<TransferErrorCode, number> = {
  UNAUTHENTICATED: 401, INVALID_REQUEST: 400, INVALID_RECIPIENT: 400, RECIPIENT_NOT_FOUND: 404,
  SELF_TRANSFER_NOT_ALLOWED: 400, INVALID_AMOUNT: 400, INVALID_CURRENCY: 400, INVALID_IDEMPOTENCY_KEY: 400,
  IDEMPOTENCY_KEY_CONFLICT: 409, TRANSFER_ALREADY_COMPLETED: 200, TRANSFER_IN_PROGRESS: 409,
  WALLET_NOT_FOUND: 404, WALLET_UNAVAILABLE: 403, INSUFFICIENT_FUNDS: 409, TRANSACTION_FAILED: 500,
  SERVICE_UNAVAILABLE: 503,
};
if (getApps().length === 0) initializeApp({ projectId: "gen-lang-client-0680695304" });
const adminDb = getFirestore();
function errorResponse(res: Response, code: TransferErrorCode, message: string, statusOverride?: number) {
  return res.status(statusOverride ?? transferErrorStatus[code] ?? 500).json({ error: { code, message } });
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
function transferResultPayload(transactionId: string, reference: string, senderUid: string, recipientId: string, amountMinor: number, currency: string, description: string | undefined, status: 'completed' | 'failed') {
  const payload: Record<string, unknown> = { id: transactionId, reference, senderId: senderUid, recipientId, amount: amountMinor, currency, type: 'transfer', sourceModule: 'unique_pay.wallet_transfer', provider: 'unique_pay_internal_wallet', status, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), recordKind: 'financial', schemaVersion: 2, amountUnit: 'minor' };
  if (description !== undefined) payload.description = description;
  return payload;
}
async function readUserExists(uid: string): Promise<boolean> {
  try { await getAuth().getUser(uid); return true; } catch (_) { return false; }
}
function idempotencyDocumentId(senderUid: string, idempotencyKey: string) { return `${senderUid}_${idempotencyKey}`; }
async function startServer() {
  const app = express();
  const PORT = 3000;
  const httpServer = http.createServer(app);
  app.use(express.json());
  const authenticate = async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return errorResponse(res, 'UNAUTHENTICATED', 'Authentication is required to access this resource.');
    try { (req as any).user = await getAuth().verifyIdToken(authHeader.split('Bearer ')[1]); next(); }
    catch (_) { return errorResponse(res, 'UNAUTHENTICATED', 'The supplied Firebase token is invalid or expired.'); }
  };
  app.get("/api/health", (req, res) => res.json({ status: "ok", ecosystem: "Unique One", version: "1.0.0" }));
  app.get("/api/wallet", authenticate, async (req, res) => {
    const uid = (req as any).user?.uid as string | undefined;
    if (!uid) return errorResponse(res, 'UNAUTHENTICATED', 'Missing authenticated user.');
    try {
      const snapshot = await adminDb.collection('wallets').doc(uid).get();
      if (!snapshot.exists) return errorResponse(res, 'WALLET_NOT_FOUND', 'No wallet exists for this user.', 404);
      return res.status(200).json(validateWalletDocument(snapshot.data(), uid));
    } catch (error) { console.error('Error fetching wallet:', error); return errorResponse(res, 'SERVICE_UNAVAILABLE', 'Failed to fetch wallet.'); }
  });
  app.post("/api/wallet", authenticate, async (req, res) => {
    const uid = (req as any).user?.uid as string | undefined;
    if (!uid) return errorResponse(res, 'UNAUTHENTICATED', 'Missing authenticated user.');
    try {
      const wallet = await ensureWalletForUser(uid);
      return res.status(200).json({ uid: wallet.uid, currency: wallet.currency, availableBalanceMinor: wallet.availableBalanceMinor, status: wallet.status, createdAt: wallet.createdAt.toDate().toISOString(), updatedAt: wallet.updatedAt.toDate().toISOString() });
    } catch (error) { console.error("Error initializing wallet:", error); return errorResponse(res, 'SERVICE_UNAVAILABLE', 'Failed to initialize wallet.'); }
  });
  app.post("/api/wallet/transfer", authenticate, async (req, res) => {
    const senderUid = (req as any).user?.uid as string | undefined;
    if (!senderUid) return errorResponse(res, 'UNAUTHENTICATED', 'Authentication is required to initiate a transfer.');
    let validatedRequest: TransferRequestInput;
    try { validatedRequest = validateTransferRequest(req.body, senderUid); }
    catch (error) {
      const code = (error as Error).message as TransferErrorCode;
      const messages: Record<TransferErrorCode, string> = {
        UNAUTHENTICATED: 'Authentication is required to initiate a transfer.', INVALID_REQUEST: 'The transfer request body is malformed or contains unsupported fields.', INVALID_RECIPIENT: 'A valid recipient UID is required.', RECIPIENT_NOT_FOUND: 'The recipient does not exist.', SELF_TRANSFER_NOT_ALLOWED: 'A wallet transfer to yourself is not allowed.', INVALID_AMOUNT: 'Transfer amount must be a positive integer minor-unit amount.', INVALID_CURRENCY: 'Only NGN transfers are supported.', INVALID_IDEMPOTENCY_KEY: 'The idempotency key is invalid or exceeds the allowed length.', IDEMPOTENCY_KEY_CONFLICT: 'This idempotency key was already used with different transfer parameters.', TRANSFER_ALREADY_COMPLETED: 'This transfer has already been completed.', TRANSFER_IN_PROGRESS: 'A transfer with this idempotency key is already in progress.', WALLET_NOT_FOUND: 'A wallet record is missing for this transfer.', WALLET_UNAVAILABLE: 'The wallet status or currency configuration is not valid for transfer.', INSUFFICIENT_FUNDS: 'The sender wallet does not have enough funds.', TRANSACTION_FAILED: 'The transfer failed while processing the transaction.', SERVICE_UNAVAILABLE: 'The transfer service is temporarily unavailable.'
      };
      return errorResponse(res, code, messages[code] ?? 'Invalid transfer request.');
    }
    const { recipientId, amountMinor, currency, idempotencyKey, description } = validatedRequest;
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
        // This external lookup is intentionally after the transactional idempotency read.
        // A committed final result is authoritative and never requires Auth availability.
        if (!(await readUserExists(recipientId))) return { error: { code: 'RECIPIENT_NOT_FOUND' as TransferErrorCode, message: 'The recipient user does not exist.' } } as TransferErrorResponse;
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
        const now = Timestamp.now(); const transactionId = adminDb.collection('transactions').doc().id; const reference = `UP-WT-${Date.now()}-${randomUUID().slice(0, 8)}`;
        const transactionRecord = { id: transactionId, reference, senderId: senderUid, recipientId, amount: amountMinor, currency, type: 'transfer', sourceModule: 'unique_pay.wallet_transfer', provider: 'unique_pay_internal_wallet', status: 'completed', createdAt: now, updatedAt: now, recordKind: 'financial', schemaVersion: 2, amountUnit: 'minor' };
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
