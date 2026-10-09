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

const transactionPinSource = read("server.ts");
const firestoreRulesSource = read("firestore.rules");
assert(firestoreRulesSource.includes("match /transactionPinSecurity/{userId} { allow read, write: if false; }"), "clients cannot read or tamper with server-side Transaction PIN lockout state");
assert(transactionPinSource.includes("const TRANSACTION_PIN_SECURITY_COLLECTION = 'transactionPinSecurity'"), "Transaction PIN security uses persistent server-side state");
assert(transactionPinSource.includes("const TRANSACTION_PIN_MAX_FAILURES = 5"), "Transaction PIN lockout threshold is five failed attempts");
assert(transactionPinSource.includes("const TRANSACTION_PIN_LOCKOUT_MS = 15 * 60_000"), "Transaction PIN lockout duration is fifteen minutes");
assert(transactionPinSource.includes("return adminDb.runTransaction(async transaction => {"), "Transaction PIN security updates are atomic");
assert(transactionPinSource.includes("transaction.set(securityRef, {\n        failedAttempts: 0"), "successful Transaction PIN verification resets failed attempts");
assert(transactionPinSource.includes("failedAttempts >= TRANSACTION_PIN_MAX_FAILURES"), "repeated incorrect Transaction PIN attempts trigger lockout");
assert(transactionPinSource.includes("if (lockedUntilMs > nowMs) return false"), "an active Transaction PIN lockout blocks verification inside the atomic check");
assert(transactionPinSource.includes("transaction.get(credentialRef)"), "PIN credential reads participate in the atomic lockout transaction");

const restaurantPaymentSource = read("server.ts");
const restaurantPayStart = restaurantPaymentSource.indexOf('app.post("/api/restaurant/pay", authenticate');
const restaurantPayRoute = restaurantPaymentSource.slice(restaurantPayStart, restaurantPayStart + 700);
const restaurantPayFullRoute = restaurantPaymentSource.slice(restaurantPayStart, restaurantPaymentSource.indexOf('app.post("/api/store/checkout", authenticate', restaurantPayStart));
const retryLookupIndex = restaurantPayFullRoute.indexOf("const completedRetry = await idempotencyRef.get()");
const pinVerificationIndex = restaurantPayFullRoute.indexOf("verifyTransactionPin(uid, req.body.transactionPin)");
const mutableOrderPreflightIndex = restaurantPayFullRoute.indexOf("const preflightOrder = await adminDb.collection('restaurantOrders').doc(orderId).get()");
assert(retryLookupIndex >= 0 && retryLookupIndex < pinVerificationIndex && retryLookupIndex < mutableOrderPreflightIndex, "Restaurant completed payment retries are checked before PIN re-verification and mutable order preflight");
assert(restaurantPayFullRoute.includes("saved.uid !== uid") && restaurantPayFullRoute.includes("saved.requestFingerprint !== uid + '|' + orderId"), "Restaurant completed payment replay validates owner and order fingerprint");
assert(restaurantPayFullRoute.includes("return res.status(200).json({ ...saved.result, replayed: true })"), "Restaurant completed payment replay returns saved result without repeating financial mutations");
assert(restaurantPayFullRoute.includes("const originalTransactionSnap = await transaction.get(originalTransactionRef);") && restaurantPayFullRoute.includes("originalTransaction.id !== originalTransactionId") && restaurantPayFullRoute.includes("!isSafeFirebaseUid(originalTransaction.recipientId)") && restaurantPayFullRoute.includes("Number(originalTransaction.amount) !== Number(order.totalMinor)") && restaurantPayFullRoute.includes("originalTransaction.relatedOrderIds.includes(orderId)") && restaurantPayFullRoute.includes("transaction.create(idempotencyRef, {") && restaurantPayFullRoute.includes("transactionId: originalTransactionId"), "Concurrent Restaurant payment replay validates receipt identity, recipient and amount and persists a stable idempotency alias");
assert(restaurantPayRoute.includes("windowMs: 60_000, limit: 5"), "Restaurant payment attempts are limited to five per UID per minute");
const restaurantBiometricRoute = restaurantPaymentSource.slice(restaurantPaymentSource.indexOf('app.post("/api/restaurant/pay", authenticate'), restaurantPaymentSource.indexOf('app.post("/api/restaurant/pay", authenticate') + 9000);
for (const required of [
  "transaction.delete(challengeRef)",
  "clientData.type !== 'webauthn.get'",
  "clientData.challenge !== challengeData.challenge",
  "authenticatorData.subarray(0, 32).equals(crypto.createHash('sha256').update(rpId).digest())",
  "(authenticatorData[32] & 0x05) !== 0x05",
  "crypto.verify('sha256', signedData, publicKey, signature)",
  "const counterAccepted = await adminDb.runTransaction(async transaction => {",
  "const latestCredentialSnap = await transaction.get(credentialRef);",
  "if (latestCount > 0 && signCount > 0 && signCount <= latestCount) return false;",
  "transaction.update(credentialRef, { signCount, lastUsedAt: Timestamp.now() });",
  "if (!counterAccepted)",
  "'restaurant_payment|' + uid + '|' + orderId + '|' + preflightAmountMinor + '|NGN'",
]) {
  assert(restaurantBiometricRoute.includes(required), `Restaurant biometric payment protection includes: ${required}`);
}
const paymentBindingCheckIndex = restaurantBiometricRoute.indexOf("if (challengeData.transactionBinding !== expectedBinding)");
const passkeyCounterUpdateIndex = restaurantBiometricRoute.indexOf("const counterAccepted = await adminDb.runTransaction(async transaction => {");
assert(paymentBindingCheckIndex >= 0 && paymentBindingCheckIndex < passkeyCounterUpdateIndex, "Restaurant biometric payment binding is validated before advancing the passkey counter");

const storePaymentSource = read("server.ts");
const storePayStart = storePaymentSource.indexOf('app.post("/api/store/pay", authenticate');
const storePayEnd = storePaymentSource.indexOf('app.post("/api/store/orders/:orderId/cancel", authenticate', storePayStart);
const storeBiometricRoute = storePaymentSource.slice(storePayStart, storePayEnd);
for (const required of [
  "const expectedBinding = 'store_payment|' + uid + '|' + orderIds.join(',') + '|' + amountMinor + '|NGN';",
  "if (challengeData.transactionBinding !== expectedBinding)",
  "const counterAccepted = await adminDb.runTransaction(async transaction => {",
  "const latestCredentialSnap = await transaction.get(credentialRef);",
  "if (latestCount > 0 && signCount > 0 && signCount <= latestCount) return false;",
  "transaction.update(credentialRef, { signCount, lastUsedAt: Timestamp.now() });",
  "if (!counterAccepted)",
]) {
  assert(storeBiometricRoute.includes(required), `Store biometric payment protection includes: ${required}`);
}
const storeBindingIndex = storeBiometricRoute.indexOf("if (challengeData.transactionBinding !== expectedBinding)");
const storeCounterIndex = storeBiometricRoute.indexOf("const counterAccepted = await adminDb.runTransaction(async transaction => {");
assert(storeBindingIndex >= 0 && storeBindingIndex < storeCounterIndex, "Store biometric payment binding is validated before advancing the passkey counter");

const restaurantMenuSource = read("src/server/restaurantRoutes.ts");
for (const required of [
  "stockTracked === true",
  "There is not enough stock for one or more items",
  "transaction.update(adjustment.ref",
  "Number(menu.priceMinor) !== Number(item.unitPriceMinor)",
  "const inventoryQuantities = new Map",
  "const combinedQuantity = (prior?.quantity || 0) + quantity",
  "restaurant_inventory_movements",
  "movementType: 'checkout_sale'",
  "quantityDelta: -adjustment.quantity",
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


const storeSource = read("server.ts");
const storeCheckoutStart = storeSource.indexOf('app.post("/api/store/checkout", authenticate');
const storePaymentStart = storeSource.indexOf('app.post("/api/store/pay", authenticate');
const storeCancelStart = storeSource.indexOf('app.post("/api/store/orders/:orderId/cancel", authenticate');
const storeDisputeStart = storeSource.indexOf('app.post("/api/store/orders/:orderId/dispute", authenticate');
const storeCheckoutRoute = storeSource.slice(storeCheckoutStart, storePaymentStart);
const storePaymentRoute = storeSource.slice(storePaymentStart, storeCancelStart);
const storeCancelRoute = storeSource.slice(storeCancelStart, storeDisputeStart);
for (const required of [
  "const requestedByProduct = new Map<string, number>();",
  "if (!Number.isSafeInteger(requested) || requested > available)",
  "movementType: 'checkout_reservation'",
  "transaction.update(snapshot.ref, {",
  "carts.forEach((cart) => transaction.delete(cart.ref))",
  "transaction.create(idempotencyRef, { uid, idempotencyKey, orderIds",
]) {
  assert(storeCheckoutRoute.includes(required), `Store checkout inventory and idempotency protection includes: ${required}`);
}
for (const required of [
  "data.requestFingerprint !== fingerprint",
  "order.status !== 'pending'",
  "customerWallet.availableBalanceMinor < amountMinor",
  "transaction.update(customerWalletRef, { availableBalanceMinor: customerBalanceAfter",
  "paymentStatus: 'paid'",
  "transaction.create(idempotencyRef, { uid, orderIds, amountMinor, requestFingerprint: fingerprint",
  "const completedRetry = await idempotencyRef.get()",
  "saved.uid !== uid",
  "saved.result?.idempotencyKey !== idempotencyKey",
  "return res.status(200).json({ ...savedResult, replayed: true })",
]) {
  assert(storePaymentRoute.includes(required), `Store payment atomicity includes: ${required}`);
}
const storeRetryLookupIndex = storePaymentRoute.indexOf("const completedRetry = await idempotencyRef.get()");
const storePinCheckIndex = storePaymentRoute.indexOf("verifyTransactionPin(uid, req.body.transactionPin)");
const storeOrderPreflightIndex = storePaymentRoute.indexOf("const orderSnapshots = await Promise.all(orderIds.map");
assert(storeRetryLookupIndex >= 0 && storeRetryLookupIndex < storePinCheckIndex && storeRetryLookupIndex < storeOrderPreflightIndex,
  "Store completed payment retries are checked before PIN re-verification and mutable order preflight");
for (const required of [
  "order.status !== 'pending'",
  "movementType: 'order_cancellation_release'",
  "transaction.update(orderRef, {",
  "status: 'cancelled'",
]) {
  assert(storeCancelRoute.includes(required), `Store unpaid-order cancellation releases reserved inventory: ${required}`);
}
const restaurantRefundKeySource = read("server.ts");
const financialRefundServiceSource = read("src/server/financialRefundService.ts");
assert(restaurantRefundKeySource.includes("return 'restaurant_refund_' + createHash('sha256').update(orderId).digest('hex');"), "Restaurant refund operation keys remain bounded for maximum-length order IDs");
const restaurantRefundRouteStart = restaurantRefundKeySource.indexOf('app.post("/api/restaurant/orders/:orderId/refund"');
const restaurantRefundRoute = restaurantRefundKeySource.slice(restaurantRefundRouteStart, restaurantRefundRouteStart + 6500);
assert(restaurantRefundRoute.includes("if (String(order.refundStatus || '') === 'completed')") &&
  restaurantRefundRoute.includes("completedObligation.status || '') === 'completed'") &&
  restaurantRefundRoute.includes("replayed: true") &&
  restaurantRefundRoute.indexOf("if (String(order.refundStatus || '') === 'completed')") < restaurantRefundRoute.indexOf("String(order.refundStatus || '') !== 'required'"),
  "Restaurant refund retry returns verified completed receipt before enforcing the mutable required-refund state");
assert(financialRefundServiceSource.includes("!isSafeId(input.idempotencyKey)"), "financial refund service enforces its idempotency key size/character boundary");
for (const required of [
  "payment.recordKind !== 'financial'",
  "payment.schemaVersion !== 2",
  "payment.amountUnit !== 'minor'",
  "Number(payment.amount) !== amountMinor",
  "String(payment.sourceModule || '') !== 'unique_restaurant.checkout'",
  "String(payment.relatedOrderIds?.[0] || '') !== orderId",
  "transaction.create(obligationRef, {",
  "status: 'required', attemptCount: 0",
  "if (String(obligation.customerUid || '') !== actorUid)",
  "status === 'processing' && leaseExpiresAt <= Date.now()",
  "status: 'processing', attemptCount: attemptCount + 1",
]) {
  assert(restaurantRefundKeySource.includes(required), `Restaurant refund obligation safeguards include: ${required}`);
}
for (const required of [
  "const refundSnapshots = await transaction.get(refundQuery)",
  "input.amountMinor > originalAmount - refundedMinor",
  "transaction.update(customerWalletRef",
  "transaction.update(sellerWalletRef",
]) {
  assert(financialRefundServiceSource.includes(required), `Financial refund engine includes: ${required}`);
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
