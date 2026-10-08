import type { Express, RequestHandler, Response } from 'express';
import { Timestamp, type Firestore } from 'firebase-admin/firestore';
import type { ProductCategory, ProductCondition, ProductStatus, Permission, Role } from '../lib/os/types';
import { hasRolePermission } from '../lib/auth/rbac';
import { recordStoreInventoryMovement } from './storeInventoryLedger';
import rateLimit from 'express-rate-limit';

const PRODUCT_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const CURRENCY_SET = new Set(['NGN', 'USD']);
const STATUS_SET = new Set<ProductStatus>(['draft', 'published', 'out_of_stock']);
const CONDITION_SET = new Set<ProductCondition>(['new', 'used', 'refurbished']);

function fail(res: Response, code: string, message: string, status = 400) {
  return res.status(status).json({ error: { code, message } });
}

function cleanString(value: unknown, max: number) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function finiteNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function safeInteger(value: unknown) {
  return typeof value === 'number' && Number.isSafeInteger(value) ? value : null;
}

export function registerBusinessProductRoutes(app: Express, authenticate: RequestHandler, db: Firestore) {
  const limiter = rateLimit({ windowMs: 15 * 60_000, limit: 30, standardHeaders: true, legacyHeaders: false });

  app.post('/api/business/products/create', authenticate, limiter, async (req, res) => {
    const uid = String((req as any).user?.uid || '');
    const membership = ((req as any).businessMembership || {}) as Record<string, unknown>;
    const businessSession = ((req as any).businessSession || {}) as Record<string, unknown>;
    const businessId = cleanString(businessSession.businessId, 128);
    const membershipRole = cleanString(membership.role, 64) as Role;
    const customPermissions = Array.isArray(membership.permissions)
      ? membership.permissions.filter((value): value is Permission => typeof value === 'string') as Permission[]
      : [];

    if (!uid || !businessId) return fail(res, 'BUSINESS_AUTH_REQUIRED', 'An active Business Platform session is required.', 401);
    if (!hasRolePermission([membershipRole], customPermissions, 'create:products')) {
      return fail(res, 'FORBIDDEN', 'Your Business role does not allow product creation.', 403);
    }

    const productId = cleanString(req.body?.id, 128);
    const name = cleanString(req.body?.name, 200);
    const description = cleanString(req.body?.description, 5000);
    const category = cleanString(req.body?.category, 64) as ProductCategory;
    const condition = cleanString(req.body?.condition, 32) as ProductCondition;
    const status = cleanString(req.body?.status, 32) as ProductStatus;
    const currency = cleanString(req.body?.currency, 8);
    const price = finiteNumber(req.body?.price);
    const quantity = safeInteger(req.body?.quantity);
    const minOrderQuantity = safeInteger(req.body?.minOrderQuantity);
    const discount = req.body?.discount === undefined ? undefined : finiteNumber(req.body?.discount);
    const wholesalePrice = req.body?.wholesalePrice === undefined ? undefined : finiteNumber(req.body?.wholesalePrice);
    const bulkPrice = req.body?.bulkPrice === undefined ? undefined : finiteNumber(req.body?.bulkPrice);
    const images = Array.isArray(req.body?.images) ? req.body.images.filter((value: unknown) => typeof value === 'string').slice(0, 5) : [];
    const hasVideo = req.body?.hasVideo === true;
    const locationAddress = cleanString(req.body?.locationAddress, 500);
    const deliveryOptions = Array.isArray(req.body?.deliveryOptions) ? req.body.deliveryOptions.filter((value: unknown) => typeof value === 'string').slice(0, 10) : [];
    const pickupOptions = Array.isArray(req.body?.pickupOptions) ? req.body.pickupOptions.filter((value: unknown) => typeof value === 'string').slice(0, 10) : [];

    if (!PRODUCT_ID_PATTERN.test(productId) || !name || !description) return fail(res, 'INVALID_REQUEST', 'A valid product ID, name and description are required.');
    if (!category || !condition || !status || !CURRENCY_SET.has(currency)) return fail(res, 'INVALID_REQUEST', 'Product category, condition, status and currency are invalid.');
    if (!CONDITION_SET.has(condition) || !STATUS_SET.has(status)) return fail(res, 'INVALID_REQUEST', 'Product condition or status is invalid.');
    if (price === null || price < 0 || price > Number.MAX_SAFE_INTEGER) return fail(res, 'INVALID_REQUEST', 'Product price is invalid.');
    if (quantity === null || quantity < 0) return fail(res, 'INVALID_REQUEST', 'Product quantity is invalid.');
    if (minOrderQuantity === null || minOrderQuantity < 1) return fail(res, 'INVALID_REQUEST', 'Minimum order quantity must be at least 1.');
    if (quantity > 0 && minOrderQuantity > quantity) return fail(res, 'INVALID_REQUEST', 'Minimum order quantity cannot exceed available quantity.');
    for (const value of [discount, wholesalePrice, bulkPrice]) {
      if (value !== undefined && (value === null || value < 0 || value > Number.MAX_SAFE_INTEGER)) return fail(res, 'INVALID_REQUEST', 'Optional product pricing is invalid.');
    }
    if (images.some((value: string) => value.length > 2048)) return fail(res, 'INVALID_REQUEST', 'Product image references are invalid.');

    const productRef = db.collection('products').doc(productId);
    try {
      const result = await db.runTransaction(async (transaction) => {
        const existing = await transaction.get(productRef);
        if (existing.exists) throw Object.assign(new Error('PRODUCT_EXISTS'), { code: 'PRODUCT_EXISTS' });

        const businessRef = db.collection('businesses').doc(businessId);
        const businessSnap = await transaction.get(businessRef);
        if (!businessSnap.exists || String(businessSnap.data()?.ownerUid || '') === '') {
          throw Object.assign(new Error('INVALID_BUSINESS'), { code: 'INVALID_BUSINESS' });
        }

        const now = Timestamp.now();
        transaction.create(productRef, {
          id: productId,
          sellerId: uid,
          businessId,
          name,
          description,
          category,
          images,
          hasVideo,
          price,
          currency,
          ...(discount !== undefined ? { discount } : {}),
          condition,
          quantity,
          minOrderQuantity,
          ...(wholesalePrice !== undefined ? { wholesalePrice } : {}),
          ...(bulkPrice !== undefined ? { bulkPrice } : {}),
          location: { address: locationAddress, lat: 0, lng: 0 },
          deliveryOptions,
          pickupOptions,
          status: quantity === 0 && status === 'published' ? 'out_of_stock' : status,
          createdAt: now.toDate().toISOString(),
          updatedAt: now.toDate().toISOString(),
        });

        if (quantity > 0) {
          recordStoreInventoryMovement(transaction, db, {
            productId,
            movementType: 'opening_balance',
            quantity,
            previousQuantity: 0,
            resultingQuantity: quantity,
            direction: 'in',
            sourceId: productId,
            sourceModule: 'unique_business.product_creation',
            actorUid: uid,
            businessId,
          });
        }
        return { productId, quantity };
      });
      await db.collection('audit_logs').add({
        action: 'business_product_created',
        actorUid: uid,
        businessId,
        productId: result.productId,
        openingQuantity: result.quantity,
        createdAt: Timestamp.now(),
      });
      return res.status(201).json({ ok: true, productId: result.productId, quantity: result.quantity });
    } catch (error: any) {
      if (String(error?.code || '') === 'PRODUCT_EXISTS') return fail(res, 'PRODUCT_EXISTS', 'A product with this ID already exists.', 409);
      if (String(error?.code || '') === 'INVALID_BUSINESS') return fail(res, 'INVALID_BUSINESS', 'The selected Business account is invalid.', 403);
      console.error('Business product creation failed:', error);
      return fail(res, 'SERVICE_UNAVAILABLE', 'Unable to create the product right now.', 503);
    }
  });
}
