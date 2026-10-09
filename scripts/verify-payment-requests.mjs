import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const routes = readFileSync("src/server/adminAuditRoutes.ts", "utf8");
const server = readFileSync("server.ts", "utf8");
const page = readFileSync("src/pages/PaymentRequestsPage.tsx", "utf8");
const rules = readFileSync("firestore.rules", "utf8");

assert.match(server, /const amountMinor = Math\.round\(amount \* 100\)/,
  "payment request amount must be converted to integer minor units");
assert.match(server, /Math\.abs\(amount \* 100 - amountMinor\) > 1e-7/,
  "payment request amount must reject more than two decimal places");
assert.match(server, /amount: normalizedAmount, amountMinor, currency: 'NGN'/,
  "payment request must persist both normalized NGN amount and integer minor units");

assert.match(routes, /app\.get\(['"]\/api\/payment-requests['"]/,
  "payment requests must be listed through a server route");
assert.match(routes, /rateLimit\(\{ windowMs: 60_000, limit: 60/,
  "request listing must be rate limited");
assert.match(routes, /rateLimit\(\{ windowMs: 60_000, limit: 30/,
  "request status updates must be rate limited");
assert.match(routes, /where\(['"]senderId['"],\s*['"]==['"],\s*uid\)/,
  "sent requests must be scoped to the authenticated sender");
assert.match(routes, /where\(['"]recipientId['"],\s*['"]==['"],\s*uid\)/,
  "received requests must be scoped to the authenticated recipient");
assert.match(routes, /app\.patch\(['"]\/api\/payment-requests\/:requestId\/status['"]/,
  "status transitions must use the server endpoint");
assert.match(routes, /await db\.runTransaction\(/,
  "status changes must use a Firestore transaction");
assert.match(routes, /!sender && !recipient/,
  "non-participants must be rejected");
assert.match(routes, /payment_request\.status_changed/,
  "status transitions must emit an audit record");

assert.match(page, /fetch\(['"]\/api\/payment-requests['"]/,
  "the page must load requests through the API");
assert.ok(page.includes("fetch('/api/payment-requests/' + encodeURIComponent(item.id) + '/status'"),
  "status actions must target the selected request on the API");
assert.doesNotMatch(page, /from ['"]firebase\/firestore['"]/,
  "the page must not bypass server authorization with direct Firestore reads");

const requestRulesStart = rules.indexOf("match /payment_requests/{reqId}");
const requestRulesEnd = rules.indexOf("\n    match /", requestRulesStart + 1);
assert.ok(requestRulesStart >= 0 && requestRulesEnd > requestRulesStart,
  "payment request Firestore rules block must exist");
const requestRules = rules.slice(requestRulesStart, requestRulesEnd);
assert.match(requestRules, /allow update: if isPlatformAdmin\(\);/,
  "clients must not bypass server-authoritative payment request transitions");
assert.doesNotMatch(requestRules, /allow update:[\s\S]*?request\.auth\.uid/,
  "participant client updates must not be allowed directly");

assert.match(routes, /nextStatus === 'sent' && sender && current === 'draft'/,
  "request owners must be able to send a saved draft");
assert.ok(page.includes("canSend && <button") && page.includes("changeStatus(r, 'sent')"),
  "the page must expose a send action for saved drafts");


const statusRouteStart = routes.indexOf("app.patch('/api/payment-requests/:requestId/status'");
const statusRouteEnd = routes.indexOf("app.get('/api/admin/audit-logs'", statusRouteStart);
assert.ok(statusRouteStart >= 0 && statusRouteEnd > statusRouteStart,
  "payment request status route boundaries must be identifiable");
const statusRoute = routes.slice(statusRouteStart, statusRouteEnd);
assert.match(statusRoute, /!\\['sent', 'viewed', 'rejected', 'cancelled'\\]\\.includes\\(nextStatus\\)/,
  "the status endpoint must reject unsupported statuses including paid");
assert.doesNotMatch(statusRoute, /nextStatus\\s*===?\\s*['"]paid['"]|status:\\s*['"]paid['"]/,
  "a request status update must never mark a request paid without settlement");
assert.doesNotMatch(statusRoute, /collection\\(['"]wallets['"]\\)|availableBalanceMinor|ledgerEntries|walletIdempotency/,
  "status-only endpoint must not pretend to settle a wallet transfer");

console.log("Payment request contract checks passed (static checks; not a live Firestore integration test).");
