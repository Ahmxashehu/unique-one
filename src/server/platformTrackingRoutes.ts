import type { Express, RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import type { Firestore } from 'firebase-admin/firestore';

function fail(res: any, code: string, message: string, status = 400) {
  return res.status(status).json({ ok: false, error: { code, message } });
}

function asIso(value: unknown): string | undefined {
  if (!value) return undefined;
  if (typeof value === 'string') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
  }
  if (typeof (value as any)?.toDate === 'function') {
    const date = (value as any).toDate();
    return date instanceof Date && !Number.isNaN(date.getTime()) ? date.toISOString() : undefined;
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  return undefined;
}

/**
 * Public discovery contains only active, verified UniquePlatform businesses.
 * Shipment status is private and available only to an authenticated order participant.
 */
export function registerPlatformTrackingRoutes(app: Express, authenticate: RequestHandler, db: Firestore) {
  const publicLimiter = rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: true, legacyHeaders: false });
  const privateLimiter = rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: true, legacyHeaders: false });

  app.get('/api/discovery/businesses', publicLimiter, async (req, res) => {
    const query = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 120).toLowerCase() : '';
    try {
      const snapshot = await db.collection('businesses').limit(300).get();
      const businesses = snapshot.docs.flatMap((doc) => {
        const data = doc.data() || {};
        if (String(data.status || '') !== 'active' || String(data.verificationStatus || '') !== 'verified') return [];
        const name = typeof data.name === 'string' ? data.name.trim() : typeof data.businessName === 'string' ? data.businessName.trim() : '';
        if (!name) return [];
        const categories = Array.isArray(data.categories) ? data.categories.filter((item: unknown): item is string => typeof item === 'string').slice(0, 20) : [];
        const description = typeof data.description === 'string' ? data.description.slice(0, 500) : '';
        const addressValue = data.address;
        const address = typeof addressValue === 'string'
          ? addressValue
          : addressValue && typeof addressValue === 'object'
            ? [addressValue.fullAddress, addressValue.address, addressValue.area, addressValue.town, addressValue.lga, addressValue.state].filter((v) => typeof v === 'string' && v.trim()).join(', ')
            : '';
        const searchable = [name, description, address, ...categories].join(' ').toLowerCase();
        if (query && !searchable.includes(query)) return [];
        return [{ id: doc.id, name, description, categories, address: address || undefined }];
      });
      return res.json({ ok: true, source: 'uniqueplatform_businesses', count: businesses.length, businesses: businesses.slice(0, 100) });
    } catch (error) {
      console.error('UniquePlatform business discovery failed:', error);
      return fail(res, 'SERVICE_UNAVAILABLE', 'Registered business discovery is temporarily unavailable.', 503);
    }
  });

  app.get('/api/logistics/track/:trackingId', privateLimiter, authenticate, async (req, res) => {
    const uid = String((req as any).user?.uid || '').trim();
    const trackingId = typeof req.params.trackingId === 'string' ? req.params.trackingId.trim() : '';
    if (!uid) return fail(res, 'UNAUTHENTICATED', 'Sign in to track your order.', 401);
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(trackingId)) return fail(res, 'INVALID_TRACKING_ID', 'Enter a valid UniquePlatform order or tracking number.');
    try {
      const snapshot = await db.collection('orders').doc(trackingId).get();
      if (!snapshot.exists) return fail(res, 'TRACKING_NOT_FOUND', 'No shipment or order was found for that tracking number.', 404);
      const order = snapshot.data() || {};
      const isParticipant = [order.customerId, order.sellerId, order.deliveryActorUid].some((value) => typeof value === 'string' && value === uid);
      if (!isParticipant) return fail(res, 'FORBIDDEN', 'This shipment is not linked to your account.', 403);
      const timeline = Array.isArray(order.orderTimeline) ? order.orderTimeline.slice(-50).map((entry: any) => ({
        status: typeof entry?.status === 'string' ? entry.status : 'updated',
        at: asIso(entry?.at),
      })) : [];
      return res.json({
        ok: true,
        tracking: {
          trackingId: snapshot.id,
          status: typeof order.status === 'string' ? order.status : 'pending',
          createdAt: asIso(order.createdAt),
          updatedAt: asIso(order.updatedAt),
          timeline,
          liveLocationAvailable: false,
          liveLocationMessage: 'Live courier location is shown only when an integrated delivery provider supplies authorized location updates.',
        },
      });
    } catch (error) {
      console.error('UniquePlatform order tracking failed:', error);
      return fail(res, 'SERVICE_UNAVAILABLE', 'Tracking is temporarily unavailable. Please try again.', 503);
    }
  });
}
