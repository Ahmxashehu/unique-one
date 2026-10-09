import type { Express, RequestHandler } from "express";
import rateLimit from "express-rate-limit";

const BASE = "https://www.cheapdatahub.ng/api/v1/resellers/";

type ProviderResult = { ok: boolean; status?: unknown; message?: unknown; data?: unknown };

function readApiKey(): string | null {
  const key = process.env.CHEAPDATAHUB_API_KEY?.trim();
  return key && key !== "YOUR_API_KEY" ? key : null;
}

function validPositiveInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0;
}

async function providerRequest(path: string, method: "GET" | "POST", body?: Record<string, unknown>) {
  const key = readApiKey();
  if (!key) return { status: 503, payload: { ok: false, code: "PROVIDER_NOT_CONFIGURED", message: "CheapDataHub is not configured on the server." } };
  try {
    const response = await fetch(BASE + path, {
      method,
      headers: { Authorization: `Bearer ${key}`, Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(10_000),
    });
    const payload = await response.json().catch(() => null) as ProviderResult | null;
    if (!response.ok || !payload || String(payload.status).toLowerCase() !== "true") {
      return {
        status: response.status === 401 || response.status === 403 ? 502 : response.status >= 500 ? 502 : 400,
        payload: { ok: false, code: response.status === 401 || response.status === 403 ? "PROVIDER_CREDENTIALS_REJECTED" : "PROVIDER_REQUEST_FAILED", message: typeof payload?.message === "string" ? payload.message : "CheapDataHub could not complete the validation request." },
      };
    }
    return { status: 200, payload: { ok: true, message: typeof payload.message === "string" ? payload.message : "CheapDataHub response received.", data: payload.data ?? null } };
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    return { status: 502, payload: { ok: false, code: timedOut ? "PROVIDER_TIMEOUT" : "PROVIDER_UNAVAILABLE", message: "CheapDataHub could not be reached. No purchase was submitted." } };
  }
}

export function registerCheapDataHubUtilityRoutes(app: Express, authenticate: RequestHandler) {
  const limiter = rateLimit({ windowMs: 60_000, limit: 10, standardHeaders: true, legacyHeaders: false });

  app.get("/api/cheapdatahub/utilities/exam-products", authenticate, limiter, async (_req, res) => {
    const result = await providerRequest("exam-pin/products/", "GET");
    return res.status(result.status).json(result.payload);
  });

  app.post("/api/cheapdatahub/utilities/electricity/validate", authenticate, limiter, async (req, res) => {
    const discoId = Number(req.body?.disco_id);
    const meterType = req.body?.meter_type;
    const meterNumber = typeof req.body?.meter_number === "string" ? req.body.meter_number.trim() : "";
    if (!validPositiveInteger(discoId) || !["prepaid", "postpaid"].includes(String(meterType)) || !/^[A-Za-z0-9-]{5,30}$/.test(meterNumber)) {
      return res.status(400).json({ ok: false, code: "INVALID_REQUEST", message: "Enter a valid DisCo ID, meter type, and meter number." });
    }
    const result = await providerRequest("electricity/validate/", "POST", { disco_id: discoId, meter_type: meterType, meter_number: meterNumber });
    return res.status(result.status).json(result.payload);
  });

  app.post("/api/cheapdatahub/utilities/cable/validate", authenticate, limiter, async (req, res) => {
    const planId = Number(req.body?.plan_id);
    const smartCardNumber = typeof req.body?.smart_card_number === "string" ? req.body.smart_card_number.trim() : "";
    if (!validPositiveInteger(planId) || !/^[A-Za-z0-9-]{5,30}$/.test(smartCardNumber)) {
      return res.status(400).json({ ok: false, code: "INVALID_REQUEST", message: "Enter a valid cable plan ID and smartcard/IUC number." });
    }
    const result = await providerRequest("cable/validate/", "POST", { plan_id: planId, smart_card_number: smartCardNumber });
    return res.status(result.status).json(result.payload);
  });
}
