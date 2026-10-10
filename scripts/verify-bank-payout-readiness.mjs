import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

// This is a safety regression guard for the current pre-integration state.
// It intentionally verifies that bank payouts are NOT available yet.
const paystack = readFileSync("src/server/paystackRoutes.ts", "utf8");
const server = readFileSync("server.ts", "utf8");
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));

assert.match(paystack, /value\.startsWith\("sk_test_"/, "Paystack must remain test-secret-only");
assert.doesNotMatch(server, /app\.(?:post|put|patch)\(["']\/api\/wallet\/bank-payouts?["']/, "No external bank payout route may be exposed before gated implementation");
assert.doesNotMatch(server, /registerMonnify(?:Routes|DisbursementRoutes)\s*\(/, "No Monnify disbursement adapter may be registered before sandbox review");
assert.equal(existsSync("src/server/monnifyDisbursementRoutes.ts"), false, "No unreviewed Monnify payout adapter should exist yet");
assert.equal(packageJson.scripts.test.includes("verify-bank-payout-readiness.mjs"), true, "Readiness guard must run in npm test");

process.stdout.write("PASS Paystack stays test-only\n");
process.stdout.write("PASS external bank payout endpoint is not exposed\n");
process.stdout.write("PASS Monnify disbursement adapter is not registered\n");
process.stdout.write("PASS bank payout readiness guard is wired into npm test\n");
process.stdout.write("PASS: payouts remain disabled pending provider approval and sandbox verification\n");
