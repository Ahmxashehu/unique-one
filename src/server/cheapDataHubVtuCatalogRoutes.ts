import type { Express, RequestHandler } from "express";
import rateLimit from "express-rate-limit";

const PLAN_IDS_URL = "https://www.cheapdatahub.ng/api/plan-ids/";
const CACHE_MS = 5 * 60_000;

type DataPlan = {
  network: string;
  name: string;
  bundleId: number;
  priceNaira: number;
  priceMinor: number;
};
type AirtimeNetwork = { network: string; providerId: number };
type Catalog = { dataPlans: DataPlan[]; airtimeNetworks: AirtimeNetwork[]; source: string; fetchedAt: string };

let cache: { expiresAt: number; value: Catalog } | null = null;

function decodeCell(value: string): string {
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function parseCatalog(html: string): Catalog {
  const dataPlans: DataPlan[] = [];
  const airtimeNetworks = new Map<string, number>();
  const rows = html.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) ?? [];

  for (const row of rows) {
    const cells = (row.match(/<t[dh]\b[^>]*>[\s\S]*?<\/t[dh]>/gi) ?? []).map(decodeCell);
    if (cells.length < 6) continue;
    const [networkRaw, serviceRaw, nameRaw, fieldRaw, idRaw, priceRaw] = cells;
    const network = networkRaw.toUpperCase().trim();
    const service = serviceRaw.toLowerCase().trim();
    const name = nameRaw.trim();
    const field = fieldRaw.replace(/[`]/g, "").trim();
    const id = Number(idRaw.replace(/[^0-9]/g, ""));
    if (!Number.isSafeInteger(id) || id <= 0) continue;

    if (service === "airtime" && field === "provider_id") {
      const normalizedNetwork = network.includes("9MOBILE") ? "9mobile"
        : network.includes("AIRTEL") ? "Airtel"
        : network.includes("GLO") ? "Glo"
        : network.includes("MTN") ? "MTN" : "";
      if (normalizedNetwork) airtimeNetworks.set(normalizedNetwork, id);
    }

    if (service !== "data" || field !== "bundle_id" || /unavailable/i.test(name)) continue;
    const priceNaira = Number(priceRaw.replace(/[^0-9.]/g, ""));
    if (!name || !Number.isFinite(priceNaira) || priceNaira <= 0 || priceNaira > 1_000_000) continue;
    const normalizedNetwork = network.includes("9MOBILE") ? "9mobile"
      : network.includes("AIRTEL") ? "Airtel"
      : network.includes("GLO") ? "Glo"
      : network.includes("MTN") ? "MTN" : "";
    if (!normalizedNetwork) continue;
    dataPlans.push({ network: normalizedNetwork, name, bundleId: id, priceNaira, priceMinor: Math.round(priceNaira * 100) });
  }

  if (dataPlans.length === 0 || airtimeNetworks.size < 4) {
    throw new Error("CheapDataHub's public plan catalogue could not be parsed safely.");
  }
  return {
    dataPlans: dataPlans.sort((a, b) => a.network.localeCompare(b.network) || a.priceNaira - b.priceNaira || a.name.localeCompare(b.name)),
    airtimeNetworks: [...airtimeNetworks.entries()].map(([network, providerId]) => ({ network, providerId })).sort((a, b) => a.network.localeCompare(b.network)),
    source: PLAN_IDS_URL,
    fetchedAt: new Date().toISOString(),
  };
}

async function getCatalog(): Promise<Catalog> {
  if (cache && cache.expiresAt > Date.now()) return cache.value;
  const response = await fetch(PLAN_IDS_URL, {
    headers: { Accept: "text/html", "User-Agent": "UniquePlatform/1.0 plan-catalog" },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error("CheapDataHub's public plan catalogue is unavailable.");
  const html = await response.text();
  if (html.length < 1_000 || html.length > 5_000_000) throw new Error("CheapDataHub returned an invalid plan catalogue.");
  const value = parseCatalog(html);
  cache = { value, expiresAt: Date.now() + CACHE_MS };
  return value;
}

export function registerCheapDataHubVtuCatalogRoutes(app: Express, authenticate: RequestHandler) {
  app.get(
    "/api/cheapdatahub/vtu/catalog",
    authenticate,
    rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: true, legacyHeaders: false }),
    async (_req, res) => {
      try {
        const catalog = await getCatalog();
        return res.json({ ok: true, ...catalog });
      } catch (error) {
        console.error("CheapDataHub plan catalogue fetch failed:", error instanceof Error ? error.message : "unknown error");
        return res.status(503).json({
          ok: false,
          code: "PROVIDER_CATALOG_UNAVAILABLE",
          message: "Live provider plans are temporarily unavailable. No purchase was submitted.",
        });
      }
    },
  );
}
