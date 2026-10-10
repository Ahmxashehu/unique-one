import type { Express } from "express";
import rateLimit from "express-rate-limit";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { searchGooglePlaces } from "../lib/ai/googlePlaces";

function coordinate(value: unknown, min: number, max: number): number | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : undefined;
}

function iso(value: unknown): string | undefined {
  if (!value) return undefined;
  if (typeof value === "string") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
  }
  if (typeof (value as any)?.toDate === "function") {
    const date = (value as any).toDate();
    return date instanceof Date && !Number.isNaN(date.getTime()) ? date.toISOString() : undefined;
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  return undefined;
}

async function authenticatedUid(req: any): Promise<string> {
  const header = typeof req.headers?.authorization === "string" ? req.headers.authorization : "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) return "";
  try {
    const token = await getAuth().verifyIdToken(match[1]);
    return typeof token.uid === "string" ? token.uid : "";
  } catch {
    return "";
  }
}

export function registerPlacesRoutes(app: Express) {
  const publicLimiter = rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: true, legacyHeaders: false });
  const trackingLimiter = rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: true, legacyHeaders: false });

  // Near Me is a UniquePlatform business directory, not a general external places directory.
  app.get("/api/discovery/businesses", publicLimiter, async (req, res) => {
    const query = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 120).toLowerCase() : "";
    try {
      const snapshot = await getFirestore().collection("businesses").limit(300).get();
      const businesses = snapshot.docs.flatMap((doc) => {
        const data = doc.data() || {};
        if (String(data.status || "") !== "active" || String(data.verificationStatus || "") !== "verified") return [];
        const name = typeof data.name === "string" ? data.name.trim() : typeof data.businessName === "string" ? data.businessName.trim() : "";
        if (!name) return [];
        const categories = Array.isArray(data.categories) ? data.categories.filter((item: unknown): item is string => typeof item === "string").slice(0, 20) : [];
        const description = typeof data.description === "string" ? data.description.slice(0, 500) : "";
        const addressValue = data.address;
        const address = typeof addressValue === "string"
          ? addressValue
          : addressValue && typeof addressValue === "object"
            ? [addressValue.fullAddress, addressValue.address, addressValue.area, addressValue.town, addressValue.lga, addressValue.state].filter((v) => typeof v === "string" && v.trim()).join(", ")
            : "";
        if (query && ![name, description, address, ...categories].join(" ").toLowerCase().includes(query)) return [];
        return [{ id: doc.id, name, description, categories, address: address || undefined }];
      });
      return res.json({ ok: true, source: "uniqueplatform_businesses", count: businesses.length, businesses: businesses.slice(0, 100) });
    } catch (error) {
      console.error("UniquePlatform business discovery failed:", error);
      return res.status(503).json({ ok: false, code: "SERVICE_UNAVAILABLE", message: "Registered business discovery is temporarily unavailable." });
    }
  });

  // Registered users can track orders they participate in. Tracking numbers are order IDs
  // until a dedicated carrier shipment identifier is integrated.
  app.get("/api/logistics/track/:trackingId", trackingLimiter, async (req, res) => {
    const uid = await authenticatedUid(req);
    if (!uid) return res.status(401).json({ ok: false, code: "UNAUTHENTICATED", message: "Sign in to track your order." });
    const trackingId = typeof req.params.trackingId === "string" ? req.params.trackingId.trim() : "";
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(trackingId)) return res.status(400).json({ ok: false, code: "INVALID_TRACKING_ID", message: "Enter a valid UniquePlatform order or tracking number." });
    try {
      const snapshot = await getFirestore().collection("orders").doc(trackingId).get();
      if (!snapshot.exists) return res.status(404).json({ ok: false, code: "TRACKING_NOT_FOUND", message: "No shipment or order was found for that tracking number." });
      const order = snapshot.data() || {};
      const isParticipant = [order.customerId, order.sellerId, order.deliveryActorUid].some((value) => typeof value === "string" && value === uid);
      if (!isParticipant) return res.status(403).json({ ok: false, code: "FORBIDDEN", message: "This shipment is not linked to your account." });
      const timeline = Array.isArray(order.orderTimeline) ? order.orderTimeline.slice(-50).map((entry: any) => ({
        status: typeof entry?.status === "string" ? entry.status : "updated",
        at: iso(entry?.at),
      })) : [];
      return res.json({
        ok: true,
        tracking: {
          trackingId: snapshot.id,
          status: typeof order.status === "string" ? order.status : "pending",
          createdAt: iso(order.createdAt),
          updatedAt: iso(order.updatedAt),
          timeline,
          liveLocationAvailable: false,
          liveLocationMessage: "Live courier location is available only when an integrated delivery provider supplies authorized location updates.",
        },
      });
    } catch (error) {
      console.error("UniquePlatform order tracking failed:", error);
      return res.status(503).json({ ok: false, code: "SERVICE_UNAVAILABLE", message: "Tracking is temporarily unavailable. Please try again." });
    }
  });

  // Retained as a provider utility for future map/directions workflows; Near Me does not use
  // this endpoint as its merchant source of truth.
  app.get("/api/places/search", publicLimiter, async (req, res) => {
    const query = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 160) : "";
    if (!query) return res.status(400).json({ ok: false, code: "INVALID_QUERY", message: "Enter a business or service to search for." });
    const apiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();
    if (!apiKey) return res.status(503).json({ ok: false, code: "MAPS_NOT_CONFIGURED", configured: false, message: "Google Places is not configured." });
    const latitude = coordinate(req.query.lat, -90, 90);
    const longitude = coordinate(req.query.lng, -180, 180);
    const location = latitude !== undefined && longitude !== undefined ? { latitude, longitude, radiusMeters: coordinate(req.query.radius, 100, 50_000) ?? 5_000 } : undefined;
    try {
      const places = await searchGooglePlaces(query, location);
      return res.json({ ok: true, source: "google_places", count: places.length, places });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      console.error("Google Places search failed:", message.slice(0, 240));
      return res.status(502).json({ ok: false, code: "PLACES_PROVIDER_ERROR", message: "The places provider could not complete the search. Check the Google Maps API key restrictions, Places API (New), and billing configuration." });
    }
  });
}
