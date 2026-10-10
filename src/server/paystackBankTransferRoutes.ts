import type { Express, Request, RequestHandler } from "express";
import rateLimit from "express-rate-limit";
import type { Firestore } from "firebase-admin/firestore";
import { Timestamp } from "firebase-admin/firestore";
import { createHash, createHmac, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";

const API = "https://api.paystack.co";
const enabled = () => process.env.UNIQUEPAY_EXTERNAL_PAYOUTS_ENABLED === "true";
const secret = () => {
  const key = process.env.PAYSTACK_SECRET_KEY?.trim() || "";
  return key.startsWith("sk_test_") ? key : null; // Live mode deliberately unsupported in this release.
};
const uidOf = (req: Request) => {
  const uid = (req as Request & { user?: { uid?: unknown } }).user?.uid;
  return typeof uid === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(uid) ? uid : null;
};
const str = (v: unknown, n = 120) => typeof v === "string" ? v.trim().slice(0, n) : "";
function verifyPin(profile: any, pin: string) {
  if (!/^\d{4}$/.test(pin)) return false;
  const salt = typeof profile?.transactionPinSalt === "string" ? Buffer.from(profile.transactionPinSalt, "utf8") : null;
  const digest = typeof profile?.transactionPinHash === "string" ? Buffer.from(profile.transactionPinHash, "hex") : null;
  if (!salt || !digest || salt.length < 16 || digest.length !== 64) return false;
  return timingSafeEqual(scryptSync(pin, salt, 64), digest);
}
async function request(path: string, method = "GET", body?: Record<string, unknown>) {
  const key = secret();
  if (!key) throw new Error("PAYSTACK_TEST_KEY_REQUIRED");
  const response = await fetch(API + path, {
    method, headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(12_000),
  });
  const json = await response.json().catch(() => null) as any;
  if (!response.ok || json?.status !== true) throw new Error("PAYSTACK_REQUEST_FAILED");
  return json.data;
}
function signatureOk(req: Request) {
  const raw = (req as Request & { rawBody?: Buffer }).rawBody;
  const sig = req.headers["x-paystack-signature"];
  const key = secret();
  if (!key || !Buffer.isBuffer(raw) || typeof sig !== "string" || !/^[a-f0-9]{128}$/i.test(sig)) return false;
  const expected = createHmac("sha512", key).update(raw).digest();
  const given = Buffer.from(sig, "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export function registerPaystackBankTransferRoutes(app: Express, authenticate: RequestHandler, db: Firestore) {
  const limiter = rateLimit({ windowMs: 60_000, limit: 8, standardHeaders: true, legacyHeaders: false });
  app.get("/api/paystack/transfers/banks", limiter, authenticate, async (_req, res) => {
    try {
      const banks = await request("/bank?currency=NGN");
      return res.json({ banks: Array.isArray(banks) ? banks.filter((b: any) => b.active && b.currency === "NGN").map((b: any) => ({ name: str(b.name, 100), code: str(b.code, 20) })) : [] });
    } catch {
      return res.status(503).json({ error: { code: "BANK_LIST_UNAVAILABLE", message: "Bank list is unavailable. No transfer was made." } });
    }
  });

  app.get("/api/paystack/transfers/resolve-account", limiter, authenticate, async (req, res) => {
    const accountNumber = str(req.query.accountNumber, 10);
    const bankCode = str(req.query.bankCode, 20);
    if (!/^\d{10}$/.test(accountNumber) || !/^[A-Za-z0-9_-]{1,20}$/.test(bankCode)) {
      return res.status(400).json({ error: { code: "INVALID_ACCOUNT", message: "Enter a valid 10-digit account number and select a bank." } });
    }
    try {
      const data = await request("/bank/resolve?account_number=" + encodeURIComponent(accountNumber) + "&bank_code=" + encodeURIComponent(bankCode));
      return res.json({ accountNumber, bankCode, accountName: str(data?.account_name, 120), verified: Boolean(data?.account_name) });
    } catch {
      return res.status(422).json({ error: { code: "ACCOUNT_NOT_RESOLVED", message: "Paystack could not verify this bank account. Check the bank and account number." } });
    }
  });

  app.post("/api/paystack/transfers/send", limiter, authenticate, async (req, res) => {
    const uid = uidOf(req);
    if (!uid) return res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Sign in before sending money." } });
    if (!enabled()) return res.status(503).json({ error: { code: "BANK_PAYOUTS_DISABLED", message: "External bank transfers are not enabled yet. No money was moved." } });
    if (!secret()) return res.status(503).json({ error: { code: "PAYSTACK_TEST_KEY_REQUIRED", message: "Only the Paystack test environment is enabled for this integration." } });
    const accountNumber = str(req.body?.accountNumber, 10);
    const bankCode = str(req.body?.bankCode, 20);
    const accountName = str(req.body?.accountName, 120);
    const pin = str(req.body?.transactionPin, 4);
    const amountMinor = Number(req.body?.amountMinor);
    const idempotencyKey = str(req.body?.idempotencyKey, 100);
    const reason = str(req.body?.reason, 100) || "UniquePay bank transfer";
    if (!/^\d{10}$/.test(accountNumber) || !/^[A-Za-z0-9_-]{1,20}$/.test(bankCode) ||
        !accountName || !/^\d{4}$/.test(pin) || !Number.isSafeInteger(amountMinor) ||
        amountMinor < 100 || amountMinor > 5_000_000 || !/^[A-Za-z0-9._:-]{12,100}$/.test(idempotencyKey)) {
      return res.status(400).json({ error: { code: "INVALID_REQUEST", message: "Provide verified bank details, a valid amount (₦1–₦50,000), your 4-digit transaction PIN, and a unique request key." } });
    }
    try {
      const profileSnap = await db.collection("users").doc(uid).get();
      const profile = profileSnap.data() || {};
      if (!profileSnap.exists || !verifyPin(profile, pin)) return res.status(403).json({ error: { code: "PIN_INVALID", message: "Transaction PIN is invalid. No transfer was made." } });
      const resolved = await request("/bank/resolve?account_number=" + encodeURIComponent(accountNumber) + "&bank_code=" + encodeURIComponent(bankCode));
      const providerName = str(resolved?.account_name, 120);
      if (!providerName || providerName.toLowerCase() !== accountName.toLowerCase()) {
        return res.status(409).json({ error: { code: "RECIPIENT_MISMATCH", message: "The confirmed account name changed. Verify the recipient again." } });
      }
      const idemRef = db.collection("paystackExternalTransfers").doc(uid + "_" + idempotencyKey);
      const existing = await idemRef.get();
      if (existing.exists) {
        const saved = existing.data() || {};
        if (Number(saved.amountMinor) !== amountMinor || saved.accountNumber !== accountNumber || saved.bankCode !== bankCode) {
          return res.status(409).json({ error: { code: "IDEMPOTENCY_CONFLICT", message: "This request key was already used for different transfer details." } });
        }
        return res.status(200).json({ status: saved.status, reference: saved.reference, replayed: true, mode: "test" });
      }
      const reference = "upbank_" + randomUUID().replace(/-/g, "");
      const now = Timestamp.now();
      await idemRef.create({
        uid, reference, amountMinor, accountNumber, bankCode, accountName: providerName,
        currency: "NGN", provider: "paystack", status: "creating", mode: "test",
        idempotencyKey, createdAt: now, updatedAt: now,
      });
      try {
        const recipient = await request("/transferrecipient", "POST", {
          type: "nuban", name: providerName, account_number: accountNumber,
          bank_code: bankCode, currency: "NGN", description: "UniquePay bank recipient",
        });
        const transfer = await request("/transfer", "POST", {
          source: "balance", amount: amountMinor, recipient: str(recipient?.recipient_code, 100),
          reference, reason, currency: "NGN",
        });
        const status = str(transfer?.status, 24) || "pending";
        await idemRef.update({
          recipientCode: str(recipient?.recipient_code, 100), providerTransferId: String(transfer?.id || ""),
          transferCode: str(transfer?.transfer_code, 100), status, updatedAt: Timestamp.now(),
        });
        return res.status(202).json({ status, reference, mode: "test", message: "Paystack test transfer requested. Test transfers do not move real money." });
      } catch (e) {
        await idemRef.update({ status: "failed", failureCode: e instanceof Error ? e.message : "PROVIDER_ERROR", updatedAt: Timestamp.now() });
        throw e;
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "";
      console.error("Paystack test bank transfer failed:", message || "unknown");
      return res.status(503).json({ error: { code: "TRANSFER_REQUEST_FAILED", message: "The test transfer could not be requested. Check Paystack transfer access and balance. No UniquePay wallet balance was debited." } });
    }
  });

  app.post("/api/paystack/transfers/webhook", async (req, res) => {
    if (!signatureOk(req)) return res.status(401).json({ error: "Invalid signature." });
    const event = req.body;
    if (!["transfer.success", "transfer.failed", "transfer.reversed"].includes(String(event?.event || ""))) return res.status(200).json({ received: true, ignored: true });
    const reference = str(event?.data?.reference, 100);
    if (!/^upbank_[a-f0-9]{32}$/.test(reference)) return res.status(200).json({ received: true, ignored: true });
    try {
      const matches = await db.collection("paystackExternalTransfers").where("reference", "==", reference).limit(1).get();
      if (matches.empty) return res.status(200).json({ received: true, ignored: true });
      const doc = matches.docs[0];
      const current = doc.data();
      if (current.mode !== "test") return res.status(200).json({ received: true, ignored: true });
      const status = event.event === "transfer.success" ? "success" : event.event === "transfer.reversed" ? "reversed" : "failed";
      await doc.ref.update({ status, providerStatus: str(event?.data?.status, 32), updatedAt: Timestamp.now() });
      return res.status(200).json({ received: true });
    } catch {
      return res.status(503).json({ received: false });
    }
  });
}
