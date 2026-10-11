import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const excluded = /(^|\/)([^/]*(?:pay|payment|wallet|transaction|financial|ajo|vtu)[^/]*)(\/|$)/i;
const exists = (file) => fs.existsSync(path.join(root, file));
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

function walk(dir) {
  if (!exists(dir)) return [];
  const result = [];
  for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const relative = path.posix.join(dir, entry.name);
    if (["node_modules", ".git", "dist", "coverage"].includes(entry.name)) continue;
    if (entry.isDirectory()) result.push(...walk(relative));
    else result.push(relative);
  }
  return result;
}

const allPaths = walk("src");
const pages = allPaths.filter((file) => /^src\/pages\/.*\.tsx?$/.test(file) && !excluded.test(file));
const apiRouteFiles = allPaths.filter((file) => /^src\/server\/.*Routes\.ts$/.test(file) && !excluded.test(file));
const appSource = exists("src/App.tsx") ? read("src/App.tsx") : "";
const serverSource = exists("server.ts") ? read("server.ts") : "";
const routePaths = [...new Set([
  ...[...appSource.matchAll(/path\s*=\s*["']([^"']+)["']/g)].map((match) => match[1]),
  ...[...serverSource.matchAll(/app\.(?:get|post|put|patch|delete)\(\s*["']([^"']+)["']/g)].map((match) => match[1]),
])].filter((route) => !excluded.test(route));

const knownProviderBlockers = [
  ["Flights", "src/pages/public/FlightsPage.tsx"],
  ["Hotels & Events", "src/pages/public/HotelsEventsPage.tsx"],
  ["Health & Wellness", "src/pages/HealthWellnessPage.tsx"],
].flatMap(([feature, file]) => {
  if (!exists(file)) return [{ feature, file, status: "NOT_FOUND", evidence: "Expected page file was not found." }];
  const source = read(file);
  const evidence = source.split("\n").map((line) => line.trim()).filter((line) =>
    /unavailable|not connected|not been confirmed|cannot be submitted|not yet/i.test(line)
  ).slice(0, 5);
  return evidence.length ? [{ feature, file, status: "BLOCKED_BY_SOURCE_TEXT", evidence }] : [];
});

const requiredFiles = [
  "src/App.tsx",
  "server.ts",
  "firestore.rules",
  "storage.rules",
  ".github/workflows/ci.yml",
  "scripts/verify-platform.mjs",
];
const missingRequiredFiles = requiredFiles.filter((file) => !exists(file));

const report = {
  scope: "Whole platform excluding UniquePay and payment services",
  generatedAt: new Date().toISOString(),
  note: "Static repository inventory only; it does not prove runtime behavior or provider connectivity.",
  counts: {
    sourcePaths: allPaths.filter((file) => !excluded.test(file)).length,
    pageFiles: pages.length,
    frontendAndBackendRouteStrings: routePaths.length,
    backendRouteFiles: apiRouteFiles.length,
  },
  frontendRouteStrings: routePaths.sort(),
  pageFiles: pages.sort(),
  backendRouteFiles: apiRouteFiles.sort(),
  knownProviderBlockers,
  missingRequiredFiles,
  excludedPathRule: excluded.toString(),
};

console.log(JSON.stringify(report, null, 2));
if (missingRequiredFiles.length) {
  console.error("Non-Pay platform inventory failed: required repository files are missing.");
  process.exitCode = 1;
} else {
  console.log("\nNon-Pay inventory completed. Runtime and end-to-end checks are still required.");
}
