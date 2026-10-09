import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const routes = await readFile(new URL("../src/server/monnifyRoutes.ts", import.meta.url), "utf8");
const server = await readFile(new URL("../server.ts", import.meta.url), "utf8");
const payPage = await readFile(new URL("../src/pages/PayPage.tsx", import.meta.url), "utf8");

const checks = [
  ["only approved Monnify API base URLs are accepted", routes.includes('["https://sandbox.monnify.com", "https://api.monnify.com"]')],
  ["redirect must be HTTPS and reject embedded credentials", routes.includes('redirect.protocol !== "https:" || redirect.username || redirect.password')],
  ["return payment reference is added safely while preserving existing redirect query parameters", routes.includes('new URL(cfg.redirectUrl)') && routes.includes('redirectUrl.searchParams.set("paymentReference", paymentReference)') && routes.includes('redirectUrl: redirectUrl.toString()')],
  ["live collections require explicit enablement", routes.includes('process.env.MONNIFY_LIVE_ENABLED === "true"')],
  ["initialization is authenticated and has per-user plus IP limits", routes.includes('authenticate, initializePaymentLimiter, initializePaymentIpLimiter')],
  ["verification is authenticated and has per-user plus IP limits", routes.includes('authenticate, verifyPaymentLimiter, verifyPaymentIpLimiter')],
  ["provider payment status is queried server-side", routes.includes('"/api/v2/merchant/transactions/query?paymentReference="')],
  ["credit requires PAID status and exact reference", routes.includes('providerTx.paymentStatus !== "PAID"') && routes.includes("providerTx.paymentReference !== paymentReference")],
  ["credit validates NGN and exact amount", routes.includes('currency !== "NGN"') && routes.includes("Math.round(providerAmount * 100) !== amountMinor")],
  ["wallet, transaction, both ledger entries and intent are written atomically", routes.includes("db.runTransaction(async (transaction)") && routes.includes("transaction.create(clearingLedgerRef") && routes.includes("transaction.create(walletLedgerRef") && routes.includes('status: "credited"')],
  ["already-credited intents cannot be credited twice", routes.includes('if (intent.status === "credited") return "already_credited"')],
  ["production webhook requires signature verification", routes.includes('cfg.baseUrl === "https://api.monnify.com" && !verifyWebhookSignature(req, cfg)')],
  ["webhook re-queries provider before wallet credit", routes.includes("const providerTx = await queryPayment(cfg, paymentReference)") && routes.includes("await creditVerifiedTopUp(paymentReference, providerTx)")],
  ["raw webhook body is captured by Express JSON parsing", server.includes("rawBody") && server.includes("verify:")],
  ["frontend verifies return references with authenticated server endpoint", payPage.includes("getIdToken()") && payPage.includes("'/api/payments/monnify/verify/'")],
];

for (const [description, passed] of checks) {
  assert.equal(passed, true, `Monnify security regression: ${description}`);
  console.log(`PASS ${description}`);
}

console.log(`Monnify source security regression checks: ALL PASSED (${checks.length} checks)`);
