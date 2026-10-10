import type { Express, Request, RequestHandler } from "express";
import rateLimit from "express-rate-limit";
import type { Firestore } from "firebase-admin/firestore";
import { Timestamp } from "firebase-admin/firestore";
import { createHash, createHmac, randomUUID, timingSafeEqual } from "crypto";

const MAX_DEPOSIT_MINOR = 100_000_000; // ₦1,000,000 per request; adjust only after risk review.
const PAYSTACK_API = "https://api.paystack.co";

function uidFrom(req: Request): string | null {
  const uid = (req as Request & { user?: { uid?: unknown } }).user?.uid;
  return typeof uid === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(uid) ? uid : null;
}
function safeReference(value: unknown): value is string {
  return typeof value === "string" && /^UP-PS-[A-Za-z0-9_-]{20,80}$/.test(value);
}
function apiSecret(): string | null {
  const value = process.env.PAYSTACK_SECRET_KEY?.trim();
  return value && value.startsWith("sk_test_") ? value : null;
}
async function paystackRequest(path: string, init: RequestInit = {}) {
  const secret = apiSecret();
  if (!secret) throw new Error("PAYSTACK_NOT_CONFIGURED");
  const response = await fetch(PAYSTACK_API + path, {
    ...init,
    headers: { Authorization: "Bearer " + secret, "Content-Type": "application/json", ...(init.headers as Record<string, string> || {}) },
    signal: AbortSignal.timeout(12_000),
  });
  const body = await response.json().catch(() => null) as any;
  if (!response.ok || body?.status !== true) throw new Error("PAYSTACK_REQUEST_FAILED");
  return body.data;
}
function verifyWebhookSignature(req: Request): boolean {
  const secret = apiSecret();
  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
  const signature = req.headers["x-paystack-signature"];
  if (!secret || !Buffer.isBuffer(rawBody) || typeof signature !== "string" || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = createHmac("sha512", secret).update(rawBody).digest();
  const supplied = Buffer.from(signature, "hex");
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export function registerPaystackRoutes(app: Express, authenticate: RequestHandler, db: Firestore) {
  async function settleVerifiedDeposit(reference: string, expectedUid?: string) {
    const depositRef = db.collection("paystackDeposits").doc(reference);
    const depositSnap = await depositRef.get();
    if (!depositSnap.exists) throw new Error("DEPOSIT_NOT_FOUND");
    const deposit = depositSnap.data() || {};
    const uid = String(deposit.uid || "");
    const amountMinor = Number(deposit.amountMinor);
    if (!uid || (expectedUid && uid !== expectedUid) || !Number.isSafeInteger(amountMinor) ||
        amountMinor <= 0 || deposit.currency !== "NGN") throw new Error("DEPOSIT_MISMATCH");
    if (deposit.status === "completed") return { alreadyCompleted: true, reference, amountMinor };
    if (deposit.status !== "pending") throw new Error("DEPOSIT_NOT_PENDING");

    const verified = await paystackRequest("/transaction/verify/" + encodeURIComponent(reference));
    if (verified?.status !== "success" || verified?.reference !== reference ||
        Number(verified?.amount) !== amountMinor || verified?.currency !== "NGN") {
      throw new Error("PAYMENT_NOT_VERIFIED");
    }

    const walletRef = db.collection("wallets").doc(uid);
    const txId = "paystack_" + createHash("sha256").update(reference).digest("hex").slice(0, 40);
    const txRef = db.collection("transactions").doc(txId);
    const walletCreditRef = db.collection("ledgerEntries").doc();
    const clearingDebitRef = db.collection("ledgerEntries").doc();
    const now = Timestamp.now();

    return db.runTransaction(async transaction => {
      const [currentDepositSnap, walletSnap, existingTxSnap] = await Promise.all([
        transaction.get(depositRef), transaction.get(walletRef), transaction.get(txRef),
      ]);
      if (!currentDepositSnap.exists) throw new Error("DEPOSIT_NOT_FOUND");
      const currentDeposit = currentDepositSnap.data() || {};
      if (String(currentDeposit.uid || "") !== uid || Number(currentDeposit.amountMinor) !== amountMinor) {
        throw new Error("DEPOSIT_MISMATCH");
      }
      if (currentDeposit.status === "completed") return { alreadyCompleted: true, reference, amountMinor };
      if (currentDeposit.status !== "pending") throw new Error("DEPOSIT_NOT_PENDING");
      if (existingTxSnap.exists) throw new Error("TRANSACTION_CONFLICT");
      if (!walletSnap.exists) throw new Error("WALLET_NOT_FOUND");
      const wallet = walletSnap.data() || {};
      const balance = Number(wallet.availableBalanceMinor);
      if (wallet.uid !== uid || wallet.currency !== "NGN" || wallet.status !== "active" ||
          !Number.isSafeInteger(balance) || balance < 0 || !Number.isSafeInteger(balance + amountMinor)) {
        throw new Error("WALLET_UNAVAILABLE");
      }
      const idempotencyKey = "paystack:" + reference;
      transaction.create(txRef, {
        id: txId, reference, senderId: "paystack_external", recipientId: uid,
        amount: amountMinor, currency: "NGN", type: "payment",
        sourceModule: "unique_pay.paystack_deposit", provider: "paystack",
        status: "completed", createdAt: now, updatedAt: now,
        recordKind: "financial", schemaVersion: 2, amountUnit: "minor",
      });
      transaction.create(walletCreditRef, {
        id: walletCreditRef.id, transactionId: txId, reference, uid, direction: "credit",
        amountMinor, currency: "NGN", status: "completed", idempotencyKey, createdAt: now,
      });
      transaction.create(clearingDebitRef, {
        id: clearingDebitRef.id, transactionId: txId, reference, uid: "paystack_clearing",
        direction: "debit", amountMinor, currency: "NGN", status: "completed",
        idempotencyKey, createdAt: now, accountType: "external_provider_clearing",
      });
      transaction.update(walletRef, { availableBalanceMinor: balance + amountMinor, updatedAt: now });
      transaction.update(depositRef, {
        status: "completed", providerTransactionId: String(verified?.id || ""),
        paidAt: now, updatedAt: now,
      });
      transaction.create(db.collection("audit_logs").doc(), {
        action: "unique_pay.paystack_deposit_completed", actorUid: uid, targetUid: uid,
        resource: "paystack_deposit", resourceId: reference, transactionId: txId,
        amountMinor, currency: "NGN", provider: "paystack", createdAt: now, timestamp: now,
      });
      return { alreadyCompleted: false, reference, amountMinor, transactionId: txId };
    });
  }

  app.post("/api/paystack/initialize", rateLimit({ windowMs: 60_000, limit: 5, standardHeaders: true, legacyHeaders: false }), authenticate, async (req, res) => {
    const uid = uidFrom(req);
    if (!uid) return res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Sign in to start a payment." } });
    const body = req.body;
    if (!body || typeof body !== "object" || Array.isArray(body) ||
        Object.keys(body).some(key => key !== "amountMinor" && key !== "email") ||
        (body.email !== undefined && (typeof body.email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim()) || body.email.trim().length > 254)) ||
        !Number.isSafeInteger(body.amountMinor) || body.amountMinor < 100 ||
        body.amountMinor > MAX_DEPOSIT_MINOR) {
      return res.status(400).json({ error: { code: "INVALID_AMOUNT", message: "Enter an amount between ₦1 and ₦1,000,000." } });
    }
    if (!apiSecret()) return res.status(503).json({ error: { code: "PAYSTACK_NOT_CONFIGURED", message: "Payment service is not configured." } });
    try {
      const userSnap = await db.collection("users").doc(uid).get();
      const profileEmail = typeof userSnap.data()?.email === "string" ? String(userSnap.data()?.email).trim() : "";
      const email = typeof body.email === "string" && body.email.trim() ? body.email.trim() : profileEmail;
      if (!userSnap.exists || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: { code: "EMAIL_REQUIRED", message: "Add a valid email to your account before starting this payment." } });
      }
      const reference = "UP-PS-" + randomUUID().replace(/-/g, "");
      const now = Timestamp.now();
      await db.collection("paystackDeposits").doc(reference).create({
        reference, uid, amountMinor: body.amountMinor, currency: "NGN",
        provider: "paystack", status: "pending", createdAt: now, updatedAt: now,
      });
      const callbackUrl = process.env.PAYSTACK_CALLBACK_URL?.trim();
      const initialized = await paystackRequest("/transaction/initialize", {
        method: "POST",
        body: JSON.stringify({
          email, amount: body.amountMinor, currency: "NGN", reference,
          ...(callbackUrl ? { callback_url: callbackUrl } : {}),
          metadata: { uniquePlatformUser: uid, paymentPurpose: "wallet_funding" },
        }),
      });
      if (typeof initialized?.authorization_url !== "string" || initialized.reference !== reference) {
        throw new Error("PAYSTACK_RESPONSE_INVALID");
      }
      await db.collection("paystackDeposits").doc(reference).update({
        accessCode: String(initialized.access_code || ""), updatedAt: Timestamp.now(),
      });
      return res.status(201).json({
        reference, authorizationUrl: initialized.authorization_url,
        accessCode: initialized.access_code, amountMinor: body.amountMinor, currency: "NGN",
      });
    } catch (error) {
      console.error("Paystack initialization failed:", error instanceof Error ? error.message : "unknown");
      return res.status(503).json({ error: { code: "PAYMENT_INITIALIZATION_FAILED", message: "The payment could not be initialized. No wallet balance was added." } });
    }
  });

  app.get("/api/paystack/verify/:reference", rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: true, legacyHeaders: false }), authenticate, async (req, res) => {
    const uid = uidFrom(req);
    const reference = req.params.reference;
    if (!uid) return res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Sign in to verify this payment." } });
    if (!safeReference(reference)) return res.status(400).json({ error: { code: "INVALID_REFERENCE", message: "Payment reference is invalid." } });
    try {
      const deposit = await db.collection("paystackDeposits").doc(reference).get();
      if (!deposit.exists || String(deposit.data()?.uid || "") !== uid) {
        return res.status(404).json({ error: { code: "NOT_FOUND", message: "Payment reference was not found for this account." } });
      }
      const result = await settleVerifiedDeposit(reference, uid);
      return res.json({ ok: true, payment: result });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      const status = message === "PAYMENT_NOT_VERIFIED" ? 409 :
        message === "WALLET_NOT_FOUND" || message === "WALLET_UNAVAILABLE" ? 409 :
        message === "DEPOSIT_NOT_FOUND" ? 404 : 503;
      return res.status(status).json({ error: { code: message || "PAYMENT_VERIFICATION_FAILED", message: status === 409 ? "The payment is not confirmed or the wallet is unavailable. No balance was added." : "Payment verification is temporarily unavailable." } });
    }
  });

  app.post("/api/paystack/webhook", async (req, res) => {
    if (!verifyWebhookSignature(req)) return res.status(401).json({ error: "Invalid signature." });
    const event = req.body;
    if (event?.event !== "charge.success" || !safeReference(event?.data?.reference)) {
      return res.status(200).json({ received: true, ignored: true });
    }
    try {
      await settleVerifiedDeposit(event.data.reference);
      return res.status(200).json({ received: true });
    } catch (error) {
      console.error("Paystack webhook processing failed:", error instanceof Error ? error.message : "unknown");
      return res.status(503).json({ received: false });
    }
  });
}
