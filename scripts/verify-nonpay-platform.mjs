import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const assert = (condition, message) => {
  if (!condition) {
    console.error("FAIL:", message);
    process.exitCode = 1;
    return;
  }
  console.log("PASS:", message);
};

const requiredFiles = [
  "src/App.tsx",
  "server.ts",
  "src/pages/messages/MessagesPage.tsx",
  "src/pages/UniqueSharePage.tsx",
  "src/pages/StorePage.tsx",
  "src/pages/store/StoreOrdersPage.tsx",
  "src/pages/UniqueAiPage.tsx",
  "src/pages/public/FlightsPage.tsx",
  "src/pages/public/HotelsEventsPage.tsx",
  "src/pages/HealthWellnessPage.tsx",
  "src/pages/EducationHubPage.tsx",
  "src/server/uniqueShareRoutes.ts",
  "src/server/storeOrderLifecycleRoutes.ts",
  "firestore.rules",
  "storage.rules",
];
for (const file of requiredFiles) {
  assert(fs.existsSync(path.join(root, file)), `required non-Pay platform file exists: ${file}`);
}

const app = read("src/App.tsx");
const appRoutes = [...app.matchAll(/path=["']\\/?([^"']+)["']/g)].map((match) => match[1]);
for (const route of [
  "messages/*",
  "unique-share",
  "store",
  "ai",
  "flights",
  "hotels-events",
  "health-wellness",
  "education-hub",
]) {
  assert(appRoutes.includes(route), `frontend route is registered: ${route}`);
}

const server = read("server.ts");
for (const route of [
  '"/api/communication/conversations"',
  '"/api/communication/messages"',
  '"/api/store/checkout"',
  '"/api/ai/public-chat"',
  '"/api/ai/discovery"',
]) {
  assert(server.includes(route), `backend route surface is registered: ${route}`);
}

const share = read("src/server/uniqueShareRoutes.ts");
assert(share.includes('"/api/unique-share/sessions"'), "UniqueShare API routes are registered in their dedicated route module");
for (const safeguard of [
  "authenticate",
  "session.senderUid !== uid && session.receiverUid !== uid",
  "session.receiverUid !== uid",
  "actionLimiter",
]) {
  assert(share.includes(safeguard), `UniqueShare authorization/rate-limit safeguard exists: ${safeguard}`);
}

const storeLifecycle = read("src/server/storeOrderLifecycleRoutes.ts");
for (const safeguard of ["hasRolePermission", "authenticate", "rateLimit"]) {
  assert(storeLifecycle.includes(safeguard), `Store order lifecycle safeguard exists: ${safeguard}`);
}

const communicationDocs = read("src/lib/os/communication-docs.md");
assert(
  /real-time subscriptions, message UI, and external messaging integration/i.test(communicationDocs),
  "communication documentation explicitly records remaining real-time/UI/integration scope",
);

const providerPages = [
  ["Flights", "src/pages/public/FlightsPage.tsx"],
  ["Hotels & Events", "src/pages/public/HotelsEventsPage.tsx"],
  ["Health & Wellness", "src/pages/HealthWellnessPage.tsx"],
];
for (const [feature, file] of providerPages) {
  const source = read(file);
  const hasExplicitStatus = /not connected|not been confirmed|cannot be submitted|unavailable|not yet/i.test(source);
  if (hasExplicitStatus) {
    console.warn(`BLOCKER (not a CI failure): ${feature} source still documents an unavailable/unverified live provider flow.`);
  } else {
    console.log(`REVIEW: ${feature} has no known unavailable-provider phrase; verify live integration manually.`);
  }
}

console.log("\nPay-excluded source-contract checks completed. These checks do not prove runtime behavior, provider connectivity, or end-to-end success.");
