import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync("src/server/cheapDataHubRoutes.ts", "utf8");
const server = readFileSync("server.ts", "utf8");

assert.match(route, /CHEAPDATAHUB_API_KEY/);
assert.match(route, /Authorization:\s*`Bearer \\${apiKey}`/);
assert.match(route, /\/api\/cheapdatahub\/connection-check/);
assert.match(route, /super_admin.*platform_admin|platform_admin.*super_admin/);
assert.match(route, /wallet\/balance\//);
assert.match(route, /purchaseEnabled:\s*false/);
assert.doesNotMatch(route, /airtime\/purchase|data\/purchase/);
assert.doesNotMatch(route, /console\.log\([^\n]*apiKey/i);
assert.match(server, /registerCheapDataHubRoutes\(app, authenticate\)/);

console.log("CheapDataHub read-only connection-check assertions passed.");
