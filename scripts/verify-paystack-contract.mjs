import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const routes = readFileSync("src/server/paystackRoutes.ts", "utf8");
const page = readFileSync("src/pages/PayPage.tsx", "utf8");
const server = readFileSync("server.ts", "utf8");

const checks = [
  ["test secret only", /value\.startsWith\("sk_test_"\)/.test(routes)],
  ["initialization requires authentication", /app\.post\("\/api\/paystack\/initialize"[^\n]*authenticate/.test(routes)],
  ["verification requires authentication", /app\.get\("\/api\/paystack\/verify\/:reference"[^\n]*authenticate/.test(routes)],
  ["amount has lower and upper bounds", /body\.amountMinor < 100/.test(routes) && /body\.amountMinor > MAX_DEPOSIT_MINOR/.test(routes)],
  ["reference is validated", /function safeReference/.test(routes) && /if \(!safeReference\(reference\)\)/.test(routes)],
  ["provider verification checks success/reference/amount/currency", /verified\?\.status !== "success"/.test(routes) && /verified\?\.reference !== reference/.test(routes) && /Number\(verified\?\.amount\) !== amountMinor/.test(routes) && /verified\?\.currency !== "NGN"/.test(routes)],
  ["wallet must be active NGN and owned by uid", /wallet\.uid !== uid/.test(routes) && /wallet\.currency !== "NGN"/.test(routes) && /wallet\.status !== "active"/.test(routes)],
  ["idempotency protects settlement", /currentDeposit\.status === "completed"/.test(routes) && /existingTxSnap\.exists/.test(routes)],
  ["webhook uses HMAC SHA-512 and timing-safe comparison", /createHmac\("sha512"/.test(routes) && /timingSafeEqual\(supplied, expected\)/.test(routes)],
  ["webhook captures raw request body", /rawBody/.test(routes) && /\/api\/paystack\/webhook/.test(server)],
  ["frontend only redirects to Paystack checkout host", /https:\\\/\\\/checkout\\.paystack\\.com\\\//.test(page)],
  ["frontend asks server to verify returned reference", /\/api\/paystack\/verify\//.test(page)],
];

for (const [label, passed] of checks) {
  assert.equal(passed, true, `Paystack contract check failed: ${label}`);
  process.stdout.write(`PASS ${label}\n`);
}
process.stdout.write(`Passed ${checks.length} Paystack contract checks. These are source-contract checks, not a live payment test.\n`);
