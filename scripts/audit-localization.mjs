import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const sourceRoots = ["src", "android-native/app/src/main"];
const extensions = new Set([".ts", ".tsx", ".js", ".jsx", ".kt", ".java", ".xml"]);
const ignored = new Set(["node_modules", ".git", "dist", "dev-dist", "scripts"]);
const technical = /^(https?:\/\/|\/[a-zA-Z0-9_{}:$.-]+|[A-Z][A-Z0-9_]+$|[a-zA-Z0-9_.-]+\.(svg|png|jpg|jpeg|webp|json|ts|tsx|js|jsx|kt|java))|^(true|false|null|undefined)$/;

const files = [];
function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (extensions.has(path.extname(entry.name))) files.push(full);
  }
}
for (const dir of sourceRoots) walk(path.join(root, dir));

const findings = new Map();
const add = (file, line, text, kind) => {
  const value = text.replace(/\s+/g, " ").trim();
  if (!value || value.length < 2 || technical.test(value)) return;
  if (!/[A-Za-zÀ-ÿ]/.test(value)) return;
  if (/^[A-Za-z_$][\w$]*(\\.[A-Za-z_$][\w$]*)*$/.test(value)) return;
  const key = path.relative(root, file);
  if (!findings.has(key)) findings.set(key, []);
  findings.get(key).push({ line, kind, value });
};

for (const file of files) {
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  lines.forEach((line, index) => {
    const lineNo = index + 1;
    // JSX/HTML attributes that are commonly visible to users.
    for (const m of line.matchAll(/\b(placeholder|title|aria-label|alt)\s*=\s*["']([^"']+)["']/g)) add(file, lineNo, m[2], m[1]);
    // JSX text nodes: conservative, ignores tags and expressions.
    const stripped = line.replace(/<[^>]*>/g, " ").replace(/\{[^{}]*\}/g, " ");
    for (const m of stripped.matchAll(/(?:^|>)[ \\t]*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9 ,.'!?&/()_:+-]{2,})[ \\t]*(?:<|$)/g)) add(file, lineNo, m[1], "jsx-text");
    // User-visible prompt/error/toast/confirm strings and common string props.
    for (const m of line.matchAll(/\b(?:prompt|confirm|alert)\s*\(\s*["']([^"']+)["']/g)) add(file, lineNo, m[1], "dialog");
    for (const m of line.matchAll(/(?:setError|setMessage|setStatus|setNotice)\(\s*["']([^"']+)["']/g)) add(file, lineNo, m[1], "state-message");
  });
}

let total = 0;
console.log("UniquePlatform localization audit");
console.log("Static user-facing candidates:", [...findings.values()].reduce((n, x) => n + x.length, 0));
for (const [file, entries] of [...findings.entries()].sort()) {
  const unique = [...new Map(entries.map(e => [e.kind + "::" + e.value, e])).values()];
  if (!unique.length) continue;
  total += unique.length;
  console.log("\n" + file);
  for (const item of unique.slice(0, 80)) console.log("  " + item.line + " [" + item.kind + "] " + item.value);
  if (unique.length > 80) console.log("  ... " + (unique.length - 80) + " more");
}
console.log("\nAudit total:", total);
if (process.argv.includes("--strict") && total > 0) {
  console.error("\nSTRICT localization audit failed: user-facing literals remain.");
  process.exit(1);
}
