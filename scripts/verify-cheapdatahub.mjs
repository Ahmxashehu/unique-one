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

const catalogRoute = readFileSync("src/server/cheapDataHubVtuCatalogRoutes.ts", "utf8");
const airtimeDataPage = readFileSync("src/pages/pay/AirtimeDataPage.tsx", "utf8");

assert.ok(server.includes("registerCheapDataHubVtuCatalogRoutes(app, authenticate);"), "provider catalogue route must be registered");
assert.ok(catalogRoute.includes('"/api/cheapdatahub/vtu/catalog"'), "catalogue endpoint must exist");
assert.ok(catalogRoute.includes("authenticate"), "catalogue endpoint must require authentication");
assert.ok(catalogRoute.includes("limit: 20"), "catalogue endpoint must be rate limited");
assert.ok(catalogRoute.includes("AbortSignal.timeout(8_000)"), "provider catalogue fetch must have a timeout");
assert.ok(catalogRoute.includes("CACHE_MS = 5 * 60_000"), "provider catalogue must be cached");
assert.ok(catalogRoute.includes("/unavailable/i.test(name)"), "unavailable data plans must be excluded");
assert.ok(catalogRoute.includes("dataPlans.length === 0 || airtimeNetworks.size < 4"), "incomplete provider catalogue must fail closed");
assert.ok(!catalogRoute.includes("/airtime/purchase/") && !catalogRoute.includes("/data/purchase/"), "catalogue endpoint must never submit purchases");
assert.ok(airtimeDataPage.includes("Purchase submission remains locked"), "UI must communicate that purchases are locked");
assert.ok(airtimeDataPage.includes("No money was taken and no provider purchase was submitted"), "UI must not imply a purchase occurred");
assert.ok(!airtimeDataPage.includes("/api/v1/resellers/airtime/purchase/") && !airtimeDataPage.includes("/api/v1/resellers/data/purchase/"), "client must never call provider purchase endpoints directly");

console.log("CheapDataHub catalogue and purchase-lock regression assertions passed.");
