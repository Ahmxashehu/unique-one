import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
  console.log("PASS:", message);
};

const packageJson = JSON.parse(read("package.json"));
assert(packageJson.scripts?.lint === "tsc --noEmit", "TypeScript lint script is present");
assert(packageJson.scripts?.build === "vite build && esbuild server.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --outfile=dist/server.cjs", "production build script is present");
assert(packageJson.scripts?.["store:reconcile-inventory"] === "node scripts/reconcile-store-inventory.mjs", "Store inventory reconciliation command is present");
assert(fs.existsSync(path.join(root, "scripts/reconcile-store-inventory.mjs")), "Store inventory reconciliation script exists");
assert(packageJson.scripts?.["store:migrate-legacy-inventory"] === "node scripts/migrate-legacy-store-inventory.mjs", "Controlled legacy inventory migration command is present");
assert(fs.existsSync(path.join(root, "scripts/migrate-legacy-store-inventory.mjs")), "Legacy inventory migration script exists");
const legacyMigration = read("scripts/migrate-legacy-store-inventory.mjs");
for (const required of ["--apply", "LEGACY_INVENTORY_OPERATOR_UID", "LEGACY_INVENTORY_APPROVAL_REF", "LEGACY_MIGRATION_OPERATOR_UNAUTHORIZED", "store_inventory_legacy_migration"]) {
  assert(legacyMigration.includes(required), `legacy inventory migration safeguard exists: ${required}`);
}
assert(legacyMigration.includes("PRODUCT_ALREADY_HAS_LEDGER"), "legacy migration refuses products with existing ledger history");

const i18n = read("src/lib/i18n.ts");
for (const language of ["en", "ha", "fr", "ig", "yo", "pcm"]) {
  assert(new RegExp("^  " + language + ": \\{", "m").test(i18n), `language dictionary exists: ${language}`);
}
assert(!/window\.location\.reload\s*\(/.test(i18n), "language switching does not force a page reload");
assert(i18n.includes("unique-language-change"), "language switching emits the global change event");

const globalLanguage = read("src/components/GlobalLanguageLayer.tsx");
const globalTranslations = read("src/lib/globalTranslations.ts");
for (const phrase of ["Home", "Search", "Log in", "Sign Up", "Checkout", "Wallet", "Transactions", "Delivery", "Add to cart", "Buy now"]) {
  assert(globalTranslations.includes(`"${phrase}":`) || globalTranslations.includes(`${phrase}:`), `global language coverage includes: ${phrase}`);
}
assert(globalLanguage.includes("MutationObserver"), "dynamic UI text is observed for translation");
assert(globalLanguage.includes("placeholder"), "form placeholders are included in translation handling");

const sendMoneySource = read("src/pages/pay/SendMoneyPage.tsx");
assert(sendMoneySource.includes("pendingTransferRef = useRef"), "wallet transfer retries retain an idempotency key across re-renders");
assert(sendMoneySource.includes("pendingTransferRef.current?.fingerprint !== transferFingerprint"), "wallet transfer idempotency key is scoped to the exact transfer details");
assert(sendMoneySource.includes("pendingTransferRef.current = null;") && sendMoneySource.includes("payload?.error?.code !== 'TRANSFER_IN_PROGRESS'"), "wallet transfer clears keys only after success or definitive rejection, preserving ambiguous retries");
assert(sendMoneySource.includes("const idempotencyKey = pendingTransferRef.current.key"), "wallet transfer submits the persistent idempotency key");
assert(sendMoneySource.includes("uniqueplatform:pending-wallet-transfer:"), "wallet transfer idempotency key is persisted across page reloads");
assert(sendMoneySource.includes("window.localStorage.setItem(pendingStorageKey"), "pending wallet transfer key is durably stored when browser storage is available");
assert(sendMoneySource.includes("window.localStorage.removeItem(pendingStorageKey)"), "pending wallet transfer key is cleared after success or definitive rejection");
assert(sendMoneySource.includes("A previous transfer still has an uncertain outcome"), "wallet transfer blocks changed requests until an ambiguous transfer is resolved");

const backendSources = [
  ["server.ts", read("server.ts")],
  ["src/server/ajoRoutes.ts", read("src/server/ajoRoutes.ts")],
  ["src/server/identityVerificationRoutes.ts", read("src/server/identityVerificationRoutes.ts")],
  ["src/server/uniqueOtpRoutes.ts", read("src/server/uniqueOtpRoutes.ts")],
  ["src/server/uniqueOtpRegistrationRoutes.ts", read("src/server/uniqueOtpRegistrationRoutes.ts")],
  ["src/server/uniqueShareRoutes.ts", read("src/server/uniqueShareRoutes.ts")],
];
for (const route of ["/api/health", "/api/communication", "/api/unique-share", "/api/ajo", "/api/verification", "/api/auth/unique-otp"]) {
  assert(backendSources.some(([, source]) => source.includes(route)), `backend route surface includes: ${route}`);
}

const restaurantPaymentSource = read("server.ts");
const restaurantPayRoute = restaurantPaymentSource.slice(restaurantPaymentSource.indexOf('app.post("/api/restaurant/pay", authenticate'), restaurantPaymentSource.indexOf('app.post("/api/restaurant/pay", authenticate') + 700);
assert(restaurantPayRoute.includes("windowMs: 60_000, limit: 5"), "Restaurant payment attempts are limited to five per UID per minute");
const restaurantBiometricRoute = restaurantPaymentSource.slice(restaurantPaymentSource.indexOf('app.post("/api/restaurant/pay", authenticate'), restaurantPaymentSource.indexOf('app.post("/api/restaurant/pay", authenticate') + 6500);
for (const required of [
  "transaction.delete(challengeRef)",
  "clientData.type !== 'webauthn.get'",
  "clientData.challenge !== challengeData.challenge",
  "authenticatorData.subarray(0, 32).equals(crypto.createHash('sha256').update(rpId).digest())",
  "(authenticatorData[32] & 0x05) !== 0x05",
  "crypto.verify('sha256', signedData, publicKey, signature)",
  "previousCount > 0 && signCount > 0 && signCount <= previousCount",
  "'restaurant_payment|' + uid + '|' + orderId + '|' + preflightAmountMinor + '|NGN'",
]) {
  assert(restaurantBiometricRoute.includes(required), `Restaurant biometric payment protection includes: ${required}`);
}
const restaurantMenuSource = read("src/server/restaurantRoutes.ts");
for (const required of [
  "stockTracked === true",
  "There is not enough stock for one or more items",
  "transaction.update(adjustment.ref",
  "Number(menu.priceMinor) !== Number(item.unitPriceMinor)",
  "const inventoryQuantities = new Map",
  "const combinedQuantity = (prior?.quantity || 0) + quantity",
  "if (amountMinor !== preflightAmountMinor) throw new RequestValidationError",
]) {
  assert(restaurantPaymentSource.includes(required), `Restaurant payment integrity includes: ${required}`);
}
for (const required of [
  "stockQuantityProvided",
  "updates.stockTracked = true",
  "stockQuantity === 0",
]) {
  assert(restaurantMenuSource.includes(required), `Restaurant menu stock management includes: ${required}`);
}

for (const required of [
  "src/lib/i18n.ts",
  "src/components/GlobalLanguageLayer.tsx",
  "src/components/AppearanceControls.tsx",
  "src/pages/UniqueAiPage.tsx",
  "src/pages/store/StoreCartPage.tsx",
  "src/pages/UniqueMediaPage.tsx",
  "src/pages/UniqueSharePage.tsx",
  "android-native/app/build.gradle.kts",
  ".github/workflows/android-apk.yml",
]) {
  assert(fs.existsSync(path.join(root, required)), `critical platform file exists: ${required}`);
}

for (const forbidden of ["demo rice order", "featured providers"]) {
  const matches = [];
  const scan = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (["node_modules", ".git", "dist", "scripts"].includes(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) scan(full);
      else if (/\.(ts|tsx|js|jsx|json|md)$/.test(entry.name)) {
        const source = fs.readFileSync(full, "utf8").toLowerCase();
        if (source.includes(forbidden)) matches.push(path.relative(root, full));
      }
    }
  };
  scan(root);
  assert(matches.length === 0, `obsolete placeholder phrase removed: ${forbidden}`);
}

assert(fs.existsSync(path.join(root, "dist/sw.js")), "production PWA service worker exists");
assert(fs.existsSync(path.join(root, "dist/server.cjs")), "production server bundle exists");
console.log("\nUniquePlatform smoke verification: ALL CHECKS PASSED");
