import type { Express, RequestHandler } from "express";
import rateLimit from "express-rate-limit";
import { getFirestore } from "firebase-admin/firestore";

const CHEAPDATAHUB_BALANCE_URL = "https://www.cheapdatahub.ng/api/v1/resellers/wallet/balance/";

function isPlatformAdminRoles(value: unknown): boolean {
  return Array.isArray(value) && value.some(role => role === "super_admin" || role === "platform_admin");
}

export function registerCheapDataHubRoutes(app: Express, authenticate: RequestHandler) {
  app.get(
    "/api/cheapdatahub/connection-check",
    authenticate,
    rateLimit({ windowMs: 60_000, limit: 5, standardHeaders: true, legacyHeaders: false }),
    async (req, res) => {
      const uid = typeof (req as any).user?.uid === "string" ? (req as any).user.uid.trim() : "";
      if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid)) {
        return res.status(401).json({ ok: false, code: "UNAUTHENTICATED", message: "Authentication is required." });
      }

      try {
        const userSnap = await getFirestore().collection("users").doc(uid).get();
        if (!userSnap.exists || !isPlatformAdminRoles(userSnap.data()?.roles)) {
          return res.status(403).json({ ok: false, code: "FORBIDDEN", message: "Platform administrator access is required." });
        }

        const apiKey = process.env.CHEAPDATAHUB_API_KEY?.trim();
        if (!apiKey || apiKey === "YOUR_API_KEY") {
          return res.status(503).json({
            ok: false,
            configured: false,
            connection: "not_configured",
            message: "CheapDataHub credentials are not configured on the server.",
          });
        }

        const response = await fetch(CHEAPDATAHUB_BALANCE_URL, {
          method: "GET",
          headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
          signal: AbortSignal.timeout(10_000),
        });

        if (response.status === 401 || response.status === 403) {
          return res.status(502).json({
            ok: false,
            configured: true,
            connection: "credentials_rejected",
            message: "CheapDataHub rejected the configured credentials. Check the key in Render.",
          });
        }

        if (!response.ok) {
          return res.status(502).json({
            ok: false,
            configured: true,
            connection: "provider_unavailable",
            message: "CheapDataHub could not verify the reseller account. No purchase was submitted.",
          });
        }

        const payload = await response.json() as {
          status?: unknown;
          data?: { balance?: unknown };
        };
        const balance = Number(payload?.data?.balance);
        if (String(payload?.status).toLowerCase() !== "true" || !Number.isFinite(balance) || balance < 0) {
          return res.status(502).json({
            ok: false,
            configured: true,
            connection: "invalid_provider_response",
            message: "CheapDataHub returned an unexpected balance response. No purchase was submitted.",
          });
        }

        return res.json({
          ok: true,
          configured: true,
          connection: "connected",
          provider: "CheapDataHub",
          providerBalanceNaira: balance,
          currency: "NGN",
          checkedAt: new Date().toISOString(),
          purchaseEnabled: false,
          message: "Read-only connection verified. Airtime and data purchases remain disabled until the wallet debit, idempotency, and reconciliation flows pass tests.",
        });
      } catch (error) {
        const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
        console.error("CheapDataHub read-only connection check failed:", timedOut ? "timeout" : "provider/network error");
        return res.status(502).json({
          ok: false,
          configured: Boolean(process.env.CHEAPDATAHUB_API_KEY?.trim()),
          connection: timedOut ? "timeout" : "network_error",
          message: "CheapDataHub could not be reached for a read-only check. No purchase was submitted.",
        });
      }
    },
  );
}
