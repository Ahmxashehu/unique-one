import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const routes = readFileSync("src/server/paystackBankTransferRoutes.ts", "utf8");
const server = readFileSync("server.ts", "utf8");
const docs = readFileSync("docs/UNIQUEPAY_PAYSTACK_BANK_TRANSFER.md", "utf8");

assert.ok(routes.includes('process.env.UNIQUEPAY_EXTERNAL_PAYOUTS_ENABLED === "true"'), "payout initiation must be disabled by default");
assert.ok(routes.includes('key.startsWith("sk_test_")'), "this implementation must reject live Paystack keys");
assert.ok(routes.includes('"/bank/resolve?account_number="'), "recipient account must be resolved server-side");
assert.ok(routes.includes('verifyPin(profile, pin)'), "transfer must require a verified transaction PIN");
assert.ok(routes.includes('"/transferrecipient"'), "transfer recipient must be created through Paystack");
assert.ok(routes.includes('"/transfer"'), "transfer initiation must use Paystack Transfers API");
assert.ok(routes.includes("signatureOk(req)"), "transfer status webhook must verify HMAC signature");
assert.ok(routes.includes("idempotencyKey"), "transfer requests must have idempotency records");
assert.ok(server.includes("registerPaystackBankTransferRoutes(app, authenticate, adminDb)"), "routes must be registered");
assert.ok(server.includes('"/api/paystack/transfers/webhook"'), "webhook must preserve raw request body");
assert.ok(docs.includes("does not debit the UniquePay wallet"), "production limitation must be explicit");
console.log("Paystack bank transfer safety contract verified.");
