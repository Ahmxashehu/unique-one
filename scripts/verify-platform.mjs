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
