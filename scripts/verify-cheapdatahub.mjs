import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync("src/server/cheapDataHubRoutes.ts", "utf8");
const server = readFileSync("server.ts", "utf8");

assert.ok(route.includes("CHEAPDATAHUB_API_KEY"), "API key must be read from server environment");
assert.ok(route.includes("Authorization: `Bearer ${apiKey}`"), "API key must be sent in Authorization header");
assert.ok(route.includes("/api/cheapdatahub/connection-check"), "connection check endpoint must exist");
assert.ok(route.includes('role === "super_admin" || role === "platform_admin"'), "connection check must be restricted to platform admins");
assert.ok(route.includes("/api/v1/resellers/wallet/balance/"), "check must use read-only balance endpoint");
assert.ok(route.includes("purchaseEnabled: false"), "purchases must remain disabled during connection verification");
assert.ok(!route.includes("/airtime/purchase/") && !route.includes("/data/purchase/"), "verification route must not submit purchases");
assert.ok(!route.includes("console.log(apiKey"), "API key must never be logged");
assert.ok(server.includes("registerCheapDataHubRoutes(app, authenticate);"), "route must be registered");

console.log("CheapDataHub read-only connection-check assertions passed.");
