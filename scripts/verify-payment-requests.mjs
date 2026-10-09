import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const routes = readFileSync("src/server/adminAuditRoutes.ts", "utf8");
const page = readFileSync("src/pages/PaymentRequestsPage.tsx", "utf8");

assert.match(routes, /app\.get\(['"]\/api\/payment-requests['"]/,
  "payment requests must be listed through an authenticated server route");
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
  "the page must load requests through the authenticated API");
assert.match(page, /\/api\/payment-requests\/['"]? \+ encodeURIComponent\(item\.id\)/,
  "status actions must target the selected request on the API");
assert.doesNotMatch(page, /from ['"]firebase\/firestore['"]/,
  "the page must not bypass server authorization with direct Firestore reads");

console.log("Payment request contract checks passed (static checks; not a live Firestore integration test).");
