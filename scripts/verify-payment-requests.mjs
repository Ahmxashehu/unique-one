import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const routes = readFileSync('src/server/adminAuditRoutes.ts', 'utf8');
const page = readFileSync('src/pages/PaymentRequestsPage.tsx', 'utf8');
const rules = readFileSync('firestore.rules', 'utf8');
const server = readFileSync('server.ts', 'utf8');

assert.ok(routes.includes("app.get('/api/payment-requests'"), 'requests must be listed through the server API');
assert.ok(routes.includes("app.patch('/api/payment-requests/:requestId/status'"), 'status changes must use the server API');
assert.ok(routes.includes('await db.runTransaction('), 'status changes must be transaction-protected');
assert.ok(routes.includes("nextStatus === 'approved' && recipient && ['sent', 'viewed'].includes(current)"), 'only recipients may approve sent/viewed requests');
assert.ok(routes.includes("nextStatus === 'rejected' && recipient && ['sent', 'viewed'].includes(current)"), 'only recipients may reject sent/viewed requests');
assert.ok(routes.includes("nextStatus === 'sent' && sender && current === 'draft'"), 'only the sender may send a draft');
assert.ok(routes.includes('payment_request.status_changed'), 'status changes must be audited');
assert.ok(!routes.includes("nextStatus === 'paid'") && !routes.includes("status: 'paid'"), 'status API must never mark a request paid');
assert.ok(!routes.includes("collection('wallets')") && !routes.includes('availableBalanceMinor'), 'status API must not move wallet funds');
assert.ok(page.includes("changeStatus(r, 'approved')") && page.includes('Approve request'), 'recipient approval action must be visible');
assert.ok(page.includes("changeStatus(r, 'rejected')") && page.includes('Reject'), 'recipient rejection action must be visible');
assert.ok(page.includes("fetch('/api/payment-requests'"), 'page must load requests through the server API');
assert.ok(!page.includes('firebase/firestore'), 'page must not read requests directly from Firestore');
const start = rules.indexOf('match /payment_requests/{reqId}');
const end = rules.indexOf('\\n    match /', start + 1);
assert.ok(start >= 0 && end > start, 'payment request rules must exist');
assert.ok(rules.slice(start, end).includes('allow update: if false;'), 'client status writes must be blocked completely');
assert.ok(server.includes('const amountMinor = Math.round(amount * 100)'), 'request amounts must be normalized to integer minor units');
console.log('Payment request lifecycle contract checks passed (static checks; live Firestore integration still required).');
