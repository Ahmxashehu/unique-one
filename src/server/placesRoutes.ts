import type { Express } from "express";
import rateLimit from "express-rate-limit";
import { searchGooglePlaces } from "../lib/ai/googlePlaces";

function coordinate(value: unknown, min: number, max: number): number | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : undefined;
}

export function registerPlacesRoutes(app: Express) {
  app.get(
    "/api/places/search",
    rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: true, legacyHeaders: false }),
    async (req, res) => {
      const query = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 160) : "";
      if (!query) {
        return res.status(400).json({ ok: false, code: "INVALID_QUERY", message: "Enter a business or service to search for." });
      }

      const apiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();
      if (!apiKey) {
        return res.status(503).json({
          ok: false,
          code: "MAPS_NOT_CONFIGURED",
          configured: false,
          message: "Google Places is not configured yet. Add GOOGLE_MAPS_API_KEY to the Render service environment, enable Places API (New), and ensure billing is enabled for the Google Cloud project.",
        });
      }

      const latitude = coordinate(req.query.lat, -90, 90);
      const longitude = coordinate(req.query.lng, -180, 180);
      const location = latitude !== undefined && longitude !== undefined
        ? { latitude, longitude, radiusMeters: coordinate(req.query.radius, 100, 50_000) ?? 5_000 }
        : undefined;

      try {
        const places = await searchGooglePlaces(query, location);
        return res.json({ ok: true, source: "google_places", count: places.length, places });
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        console.error("Google Places search failed:", message.slice(0, 240));
        return res.status(502).json({
          ok: false,
          code: "PLACES_PROVIDER_ERROR",
          message: "The places provider could not complete the search. Check the Google Maps API key restrictions, Places API (New), and billing configuration.",
        });
      }
    },
  );
}
