import type { Express, Request, RequestHandler } from "express";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

type MonnifyConfig = {
  apiKey: string;
  secretKey: string;
  contractCode: string;
  baseUrl: string;
  redirectUrl: string;
};

type MonnifyResponse<T> = {
  requestSuccessful?: boolean;
  responseMessage?: string;
  responseCode?: string;
  responseBody?: T;
};

type MonnifyTransaction = {
  paymentReference?: string;
  paymentStatus?: string;
  amountPaid?: number | string;
  totalPayable?: number | string;
  currencyCode?: string;
  currency?: string;
  transactionReference?: string;
};

type MonnifyCheckout = {
  paymentReference?: string;
  transactionReference?: string;
  checkoutUrl?: string;
};

function config(): MonnifyConfig | null {
  const apiKey = process.env.MONNIFY_API_KEY?.trim();
  const secretKey = process.env.MONNIFY_SECRET_KEY?.trim();
  const contractCode = process.env.MONNIFY_CONTRACT_CODE?.trim();
  const baseUrl = (process.env.MONNIFY_BASE_URL?.trim() || "https://sandbox.monnify.com").replace(/\/$/, "");
  const redirectUrl = process.env.MONNIFY_REDIRECT_URL?.trim();
  if (!apiKey || !secretKey || !contractCode || !redirectUrl) return null;
  if (!["https://sandbox.monnify.com", "https://api.monnify.com"].includes(baseUrl)) return null;
  try {
    const redirect = new URL(redirectUrl);
    if (redirect.protocol !== "https:" && redirect.hostname !== "localhost") return null;
  } catch {
    return null;
  }
  return { apiKey, secretKey, contractCode, baseUrl, redirectUrl };
}

function liveModeEnabled(): boolean {
  return process.env.MONNIFY_LIVE_ENABLED === "true";
}

function uidFrom(req: Request): string | null {
  const uid = (req as Request & { user?: { uid?: unknown } }).user?.uid;
  return typeof uid === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(uid) ? uid : null;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function jsonError(res: any, status: number, code: string, message: string) {
  return res.status(status).json({ error: { code, message } });
}

async function getAccessToken(cfg: MonnifyConfig): Promise<string> {
  const response = await fetch(cfg.baseUrl + "/api/v1/auth/login", {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(cfg.apiKey + ":" + cfg.secretKey).toString("base64"),
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error("MONNIFY_AUTH_FAILED");
  const body = await response.json() as MonnifyResponse<{ accessToken?: string }>;
  const token = body.requestSuccessful === true ? body.responseBody?.accessToken : undefined;
  if (typeof token !== "string" || !token) throw new Error("MONNIFY_AUTH_FAILED");
  return token;
}

async function monnifyRequest<T>(cfg: MonnifyConfig, path: string, init: RequestInit = {}): Promise<T> {
  const token = await getAccessToken(cfg);
  const response = await fetch(cfg.baseUrl + path, {
    ...init,
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    signal: AbortSignal.timeout(15_000),
  });
  const body = await response.json().catch(() => null) as MonnifyResponse<T> | null;
  if (!response.ok || !body || body.requestSuccessful !== true || !body.responseBody) {
    throw new Error("MONNIFY_REQUEST_FAILED");
  }
  return body.responseBody;
}

async function queryPayment(cfg: MonnifyConfig, paymentReference: string): Promise<MonnifyTransaction> {
  return monnifyRequest<MonnifyTransaction>(
    cfg,
    "/api/v2/merchant/transactions/query?paymentReference=" + encodeURIComponent(paymentReference),
  );
}

function verifyWebhookSignature(req: Request, cfg: MonnifyConfig): boolean {
  const signature = req.header("monnify-signature");
  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
  if (!signature || !rawBody) return false;
  const expected = createHmac("sha512", cfg.secretKey).update(rawBody).digest("hex");
  const a = Buffer.from(signature.toLowerCase(), "utf8");
  const b = Buffer.from(expected.toLowerCase(), "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

async function creditVerifiedTopUp(paymentReference: string, providerTx: MonnifyTransaction): Promise<"credited" | "already_credited" | "not_eligible"> {
  const db = getFirestore();
  const intentRef = db.collection("monnifyPaymentIntents").doc(paymentReference);
  return db.runTransaction(async (transaction) => {
    const intentSnap = await transaction.get(intentRef);
    if (!intentSnap.exists) return "not_eligible";
    const intent = intentSnap.data() || {};
    if (intent.status === "credited") return "already_credited";
    if (intent.status !== "pending" || intent.provider !== "monnify" || intent.currency !== "NGN") return "not_eligible";

    const amountMinor = Number(intent.amountMinor);
    const providerAmount = Number(providerTx.amountPaid);
    const currency = providerTx.currencyCode || providerTx.currency;
    if (
      providerTx.paymentStatus !== "PAID" ||
      providerTx.paymentReference !== paymentReference ||
      currency !== "NGN" ||
      !Number.isFinite(providerAmount) ||
      Math.round(providerAmount * 100) !== amountMinor ||
      !Number.isSafeInteger(amountMinor) ||
      amountMinor < 2000
    ) return "not_eligible";

    const uid = String(intent.uid || "");
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid)) return "not_eligible";
    const walletRef = db.collection("wallets").doc(uid);
    const txRef = db.collection("transactions").doc();
    const ledgerRef = db.collection("ledgerEntries").doc();
    const walletSnap = await transaction.get(walletRef);
    if (!walletSnap.exists) return "not_eligible";
    const wallet = walletSnap.data() || {};
    const currentBalance = Number(wallet.availableBalanceMinor);
    if (
      wallet.uid !== uid || wallet.currency !== "NGN" || wallet.status !== "active" ||
      !Number.isSafeInteger(currentBalance) || currentBalance < 0 ||
      !Number.isSafeInteger(currentBalance + amountMinor)
    ) return "not_eligible";

    const now = Timestamp.now();
    const transactionId = txRef.id;
    const transactionRecord = {
      id: transactionId,
      reference: paymentReference,
      senderId: "monnify",
      recipientId: uid,
      amount: amountMinor,
      amountMinor,
      amountUnit: "minor",
      recordKind: "financial",
      schemaVersion: 2,
      currency: "NGN",
      type: "payment",
      sourceModule: "unique_pay.monnify_topup",
      provider: "monnify",
      providerReference: String(providerTx.transactionReference || ""),
      status: "completed",
      idempotencyKey: "monnify:" + paymentReference,
      createdAt: now,
      updatedAt: now,
    };
    transaction.update(walletRef, {
      availableBalanceMinor: currentBalance + amountMinor,
      updatedAt: now,
    });
    transaction.create(txRef, transactionRecord);
    transaction.create(ledgerRef, {
      id: ledgerRef.id,
      transactionId,
      reference: paymentReference,
      uid,
      direction: "credit",
      amountMinor,
      currency: "NGN",
      status: "completed",
      idempotencyKey: "monnify:" + paymentReference,
      providerReference: String(providerTx.transactionReference || ""),
      createdAt: now,
    });
    transaction.update(intentRef, {
      status: "credited",
      providerTransactionReference: String(providerTx.transactionReference || ""),
      creditedTransactionId: transactionId,
      verifiedAt: now,
      creditedAt: now,
      updatedAt: now,
    });
    return "credited";
  });
}

export function registerMonnifyRoutes(app: Express, authenticate: RequestHandler) {
  app.get("/api/payments/monnify/config", (_req, res) => {
    const cfg = config();
    return res.json({
      provider: "monnify",
      configured: Boolean(cfg),
      environment: cfg?.baseUrl === "https://api.monnify.com" ? "live" : "sandbox",
      livePaymentsEnabled: Boolean(cfg && cfg.baseUrl === "https://api.monnify.com" && liveModeEnabled()),
    });
  });

  app.post("/api/payments/monnify/initialize", authenticate, async (req, res) => {
    const uid = uidFrom(req);
    if (!uid) return jsonError(res, 401, "UNAUTHENTICATED", "Authentication is required.");
    const cfg = config();
    if (!cfg) return jsonError(res, 503, "PAYMENT_PROVIDER_NOT_CONFIGURED", "Monnify is not configured on the server.");
    if (cfg.baseUrl === "https://api.monnify.com" && !liveModeEnabled()) return jsonError(res, 503, "LIVE_PAYMENTS_DISABLED", "Live payments are disabled until Monnify activation and production checks are complete.");
    if (!isPlainObject(req.body) || Object.keys(req.body).some(key => !["amountMinor", "description"].includes(key))) {
      return jsonError(res, 400, "INVALID_REQUEST", "Only amountMinor and description are accepted.");
    }
    const amountMinor = req.body.amountMinor;
    const description = typeof req.body.description === "string" ? req.body.description.trim() : "UniquePay wallet funding";
    if (!Number.isSafeInteger(amountMinor) || Number(amountMinor) < 2000 || Number(amountMinor) > 50_000_000 ||
        description.length < 1 || description.length > 120) {
      return jsonError(res, 400, "INVALID_REQUEST", "Enter a valid wallet funding amount (₦20 to ₦500,000).");
    }
    try {
      const user = await getAuth().getUser(uid);
      if (!user.email || !user.emailVerified) return jsonError(res, 400, "CUSTOMER_EMAIL_REQUIRED", "Verify an email on your account before funding your wallet.");

      // Reject funding before taking the customer to checkout if no eligible wallet exists.
      // A successful external payment must never be accepted for a wallet we cannot credit.
      const walletSnap = await getFirestore().collection("wallets").doc(uid).get();
      const wallet = walletSnap.data() || {};
      if (!walletSnap.exists || wallet.uid !== uid || wallet.currency !== "NGN" || wallet.status !== "active" ||
          !Number.isSafeInteger(wallet.availableBalanceMinor) || Number(wallet.availableBalanceMinor) < 0) {
        return jsonError(res, 409, "WALLET_UNAVAILABLE", "An active NGN wallet is required before funding.");
      }

      const paymentReference = "UPMONNIFY_" + randomUUID().replace(/-/g, "");
      const now = Timestamp.now();
      const intentRef = getFirestore().collection("monnifyPaymentIntents").doc(paymentReference);
      await intentRef.create({
        paymentReference,
        uid,
        amountMinor: Number(amountMinor),
        currency: "NGN",
        provider: "monnify",
        status: "initializing",
        description,
        createdAt: now,
        updatedAt: now,
      });
      try {
        const checkout = await monnifyRequest<MonnifyCheckout>(cfg, "/api/v1/merchant/transactions/init-transaction", {
          method: "POST",
          body: JSON.stringify({
            amount: Number(amountMinor) / 100,
            customerName: user.displayName || "UniquePlatform customer",
            customerEmail: user.email,
            paymentReference,
            paymentDescription: description,
            currencyCode: "NGN",
            contractCode: cfg.contractCode,
            redirectUrl: cfg.redirectUrl,
            paymentMethods: ["CARD", "ACCOUNT_TRANSFER", "USSD"],
            metadata: { platform: "UniquePlatform", purpose: "wallet_funding", uid },
          }),
        });
        if (checkout.paymentReference !== paymentReference || typeof checkout.checkoutUrl !== "string" ||
            !checkout.checkoutUrl.startsWith(cfg.baseUrl === "https://api.monnify.com" ? "https://checkout.monnify.com/" : "https://sandbox.sdk.monnify.com/")) {
          throw new Error("MONNIFY_INVALID_CHECKOUT");
        }
        await intentRef.update({
          status: "pending",
          providerTransactionReference: checkout.transactionReference || null,
          checkoutUrl: checkout.checkoutUrl,
          updatedAt: Timestamp.now(),
        });
        return res.status(201).json({
          provider: "monnify",
          paymentReference,
          checkoutUrl: checkout.checkoutUrl,
          amountMinor: Number(amountMinor),
          currency: "NGN",
        });
      } catch (error) {
        await intentRef.update({ status: "initialization_failed", updatedAt: Timestamp.now() });
        throw error;
      }
    } catch (error) {
      console.error("Monnify payment initialization failed:", error instanceof Error ? error.message : "unknown error");
      return jsonError(res, 502, "PAYMENT_INITIALIZATION_FAILED", "Monnify could not initialize this payment. No wallet balance was changed.");
    }
  });

  app.get("/api/payments/monnify/verify/:paymentReference", authenticate, async (req, res) => {
    const uid = uidFrom(req);
    if (!uid) return jsonError(res, 401, "UNAUTHENTICATED", "Authentication is required.");
    const cfg = config();
    if (!cfg) return jsonError(res, 503, "PAYMENT_PROVIDER_NOT_CONFIGURED", "Monnify is not configured on the server.");
    if (cfg.baseUrl === "https://api.monnify.com" && !liveModeEnabled()) return jsonError(res, 503, "LIVE_PAYMENTS_DISABLED", "Live payments are disabled until Monnify activation and production checks are complete.");
    const paymentReference = req.params.paymentReference;
    if (!/^UPMONNIFY_[A-Fa-f0-9]{32}$/.test(paymentReference)) return jsonError(res, 400, "INVALID_REQUEST", "Invalid payment reference.");
    try {
      const intentRef = getFirestore().collection("monnifyPaymentIntents").doc(paymentReference);
      const intentSnap = await intentRef.get();
      if (!intentSnap.exists || intentSnap.data()?.uid !== uid) return jsonError(res, 404, "PAYMENT_NOT_FOUND", "Payment not found.");
      const intent = intentSnap.data() || {};
      if (intent.status === "credited") return res.json({ paymentReference, status: "credited" });
      if (intent.status !== "pending") return res.json({ paymentReference, status: intent.status });
      const providerTx = await queryPayment(cfg, paymentReference);
      const result = await creditVerifiedTopUp(paymentReference, providerTx);
      if (result === "not_eligible") return res.json({ paymentReference, status: "pending" });
      return res.json({ paymentReference, status: result });
    } catch (error) {
      console.error("Monnify payment verification failed:", error instanceof Error ? error.message : "unknown error");
      return jsonError(res, 503, "PAYMENT_VERIFICATION_UNAVAILABLE", "Payment status could not be verified. Check again shortly.");
    }
  });

  app.post("/api/webhooks/monnify/collection", async (req, res) => {
    const cfg = config();
    if (!cfg) return res.status(503).json({ accepted: false });
    if (cfg.baseUrl === "https://api.monnify.com" && !liveModeEnabled()) return res.status(503).json({ accepted: false });
    if (cfg.baseUrl === "https://api.monnify.com" && !verifyWebhookSignature(req, cfg)) {
      return res.status(401).json({ accepted: false });
    }
    if (!isPlainObject(req.body) || req.body.eventType !== "SUCCESSFUL_TRANSACTION" || !isPlainObject(req.body.eventData)) {
      return res.status(200).json({ accepted: true, ignored: true });
    }
    const paymentReference = req.body.eventData.paymentReference;
    if (typeof paymentReference !== "string" || !/^UPMONNIFY_[A-Fa-f0-9]{32}$/.test(paymentReference)) {
      return res.status(200).json({ accepted: true, ignored: true });
    }
    try {
      const intentSnap = await getFirestore().collection("monnifyPaymentIntents").doc(paymentReference).get();
      if (!intentSnap.exists || intentSnap.data()?.status === "credited") return res.status(200).json({ accepted: true });
      const intent = intentSnap.data() || {};
      // If Monnify notifies us before the initialize request has persisted the checkout,
      // ask it to retry rather than acknowledging an event we have not processed.
      if (intent.status === "initializing") return res.status(503).json({ accepted: false });
      if (intent.status !== "pending") return res.status(200).json({ accepted: true, ignored: true });
      const providerTx = await queryPayment(cfg, paymentReference);
      await creditVerifiedTopUp(paymentReference, providerTx);
      return res.status(200).json({ accepted: true });
    } catch (error) {
      console.error("Monnify webhook processing failed:", error instanceof Error ? error.message : "unknown error");
      return res.status(503).json({ accepted: false });
    }
  });
}
