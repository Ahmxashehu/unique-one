import type { Express, RequestHandler, Response } from 'express';
import { Timestamp, type Firestore } from 'firebase-admin/firestore';
import type { ProductCategory, ProductCondition, ProductStatus, Permission, Role } from '../lib/os/types';
import { hasRolePermission } from '../lib/auth/rbac';
import { recordStoreInventoryMovement } from './storeInventoryLedger';
import rateLimit from 'express-rate-limit';

const PRODUCT_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const CATEGORY_SET = new Set<ProductCategory>([
  'electronics', 'electricity_power', 'phones_accessories', 'fashion', 'shoes', 'beauty',
  'home_furniture', 'building_materials', 'cement', 'agriculture', 'fertilizer', 'seeds',
  'farm_equipment', 'food_groceries', 'machinery', 'vehicles', 'property', 'services',
  'digital_products', 'other',
]);
const CURRENCY_SET = new Set(['NGN']);
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
    const membershipBusinessId = cleanString(membership.businessId, 128);
    const membershipRole = cleanString(membership.role, 64) as Role;
    const customPermissions = Array.isArray(membership.permissions)
      ? membership.permissions.filter((value): value is Permission => typeof value === 'string') as Permission[]
      : [];

    if (!uid || !businessId || membershipBusinessId !== businessId) {
      return fail(res, 'BUSINESS_AUTH_REQUIRED', 'An active Business Platform session is required.', 401);
    }
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
    if (!CATEGORY_SET.has(category) || !CONDITION_SET.has(condition) || !STATUS_SET.has(status) || !CURRENCY_SET.has(currency)) {
      return fail(res, 'INVALID_REQUEST', 'Product category, condition, status and currency are invalid.');
    }
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
        const business = businessSnap.data() ?? {};
        if (
          !businessSnap.exists ||
          String(business.ownerUid || '') === '' ||
          !['verified'].includes(String(business.status || ''))
        ) {
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
      if (String(error?.code || '') === 'INVALID_BUSINESS') return fail(res, 'INVALID_BUSINESS', 'The selected Business account is invalid or not verified.', 403);
      console.error('Business product creation failed:', error);
      return fail(res, 'SERVICE_UNAVAILABLE', 'Unable to create the product right now.', 503);
    }
  app.patch('/api/business/products/:productId', authenticate, limiter, async (req, res) => {
    const uid = String((req as any).user?.uid || '');
    const membership = ((req as any).businessMembership || {}) as Record<string, unknown>;
    const session = ((req as any).businessSession || {}) as Record<string, unknown>;
    const businessId = cleanString(session.businessId, 128);
    const membershipBusinessId = cleanString(membership.businessId, 128);
    const role = cleanString(membership.role, 64) as Role;
    const permissions = Array.isArray(membership.permissions)
      ? membership.permissions.filter((v): v is Permission => typeof v === 'string')
      : [];
    const productId = cleanString(req.params.productId, 128);
    if (!uid || !businessId || membershipBusinessId !== businessId) return fail(res, 'BUSINESS_AUTH_REQUIRED', 'An active Business Platform session is required.', 401);
    if (!hasRolePermission([role], permissions, 'edit:products')) return fail(res, 'FORBIDDEN', 'Your Business role does not allow product editing.', 403);
    if (!PRODUCT_ID_PATTERN.test(productId)) return fail(res, 'INVALID_REQUEST', 'Product ID is invalid.');

    const allowed = ['name','description','category','images','hasVideo','price','discount','condition','minOrderQuantity','wholesalePrice','bulkPrice','locationAddress','deliveryOptions','pickupOptions','status'];
    const supplied = Object.keys(req.body || {});
    if (supplied.some((key) => !allowed.includes(key))) return fail(res, 'INVALID_REQUEST', 'Unsupported product fields were supplied.');
    const name = req.body?.name === undefined ? undefined : cleanString(req.body.name, 200);
    const description = req.body?.description === undefined ? undefined : cleanString(req.body.description, 5000);
    const category = req.body?.category === undefined ? undefined : cleanString(req.body.category, 64) as ProductCategory;
    const condition = req.body?.condition === undefined ? undefined : cleanString(req.body.condition, 32) as ProductCondition;
    const status = req.body?.status === undefined ? undefined : cleanString(req.body.status, 32) as ProductStatus;
    const price = req.body?.price === undefined ? undefined : finiteNumber(req.body.price);
    const discount = req.body?.discount === undefined ? undefined : finiteNumber(req.body.discount);
    const wholesalePrice = req.body?.wholesalePrice === undefined ? undefined : finiteNumber(req.body.wholesalePrice);
    const bulkPrice = req.body?.bulkPrice === undefined ? undefined : finiteNumber(req.body.bulkPrice);
    const minOrderQuantity = req.body?.minOrderQuantity === undefined ? undefined : safeInteger(req.body.minOrderQuantity);
    const images = req.body?.images === undefined ? undefined : (Array.isArray(req.body.images) ? req.body.images.filter((v: unknown) => typeof v === 'string').slice(0, 5) : null);
    const hasVideo = req.body?.hasVideo === undefined ? undefined : req.body.hasVideo === true;
    const locationAddress = req.body?.locationAddress === undefined ? undefined : cleanString(req.body.locationAddress, 500);
    const deliveryOptions = req.body?.deliveryOptions === undefined ? undefined : (Array.isArray(req.body.deliveryOptions) ? req.body.deliveryOptions.filter((v: unknown) => typeof v === 'string').slice(0, 10) : null);
    const pickupOptions = req.body?.pickupOptions === undefined ? undefined : (Array.isArray(req.body.pickupOptions) ? req.body.pickupOptions.filter((v: unknown) => typeof v === 'string').slice(0, 10) : null);

    if (name !== undefined && !name || description !== undefined && !description) return fail(res, 'INVALID_REQUEST', 'Product name and description cannot be empty.');
    if (category !== undefined && !CATEGORY_SET.has(category)) return fail(res, 'INVALID_REQUEST', 'Product category is invalid.');
    if (condition !== undefined && !CONDITION_SET.has(condition)) return fail(res, 'INVALID_REQUEST', 'Product condition is invalid.');
    if (status !== undefined && !STATUS_SET.has(status)) return fail(res, 'INVALID_REQUEST', 'Product status is invalid.');
    for (const value of [price, discount, wholesalePrice, bulkPrice]) if (value !== undefined && (value === null || value < 0 || value > Number.MAX_SAFE_INTEGER)) return fail(res, 'INVALID_REQUEST', 'Product pricing is invalid.');
    if (minOrderQuantity !== undefined && (minOrderQuantity === null || minOrderQuantity < 1)) return fail(res, 'INVALID_REQUEST', 'Minimum order quantity is invalid.');
    if (images === null || (images && images.some((v: string) => v.length > 2048))) return fail(res, 'INVALID_REQUEST', 'Product image references are invalid.');
    if (deliveryOptions === null || pickupOptions === null) return fail(res, 'INVALID_REQUEST', 'Product fulfilment options are invalid.');

    const productRef = db.collection('products').doc(productId);
    try {
      const result = await db.runTransaction(async (transaction) => {
        const snap = await transaction.get(productRef);
        if (!snap.exists) throw Object.assign(new Error('NOT_FOUND'), { code: 'NOT_FOUND' });
        const product = snap.data() || {};
        if (String(product.sellerId || '') !== uid || String(product.businessId || '') !== businessId) {
          throw Object.assign(new Error('FORBIDDEN'), { code: 'FORBIDDEN' });
        }
        const businessSnap = await transaction.get(db.collection('businesses').doc(businessId));
        if (!businessSnap.exists || String(businessSnap.data()?.status || '') !== 'verified') {
          throw Object.assign(new Error('INVALID_BUSINESS'), { code: 'INVALID_BUSINESS' });
        }
        const quantity = safeInteger(product.quantity);
        if (quantity === null || quantity < 0) throw Object.assign(new Error('INVALID_STOCK'), { code: 'INVALID_STOCK' });
        const nextMin = minOrderQuantity ?? safeInteger(product.minOrderQuantity);
        if (nextMin === null || nextMin < 1 || (quantity > 0 && nextMin > quantity)) throw Object.assign(new Error('INVALID_MIN_ORDER'), { code: 'INVALID_MIN_ORDER' });
        if (status === 'out_of_stock' && quantity > 0) throw Object.assign(new Error('INVALID_STATUS'), { code: 'INVALID_STATUS' });
        if (status === 'published' && quantity === 0) throw Object.assign(new Error('INVALID_STATUS'), { code: 'INVALID_STATUS' });

        const update: Record<string, unknown> = { updatedAt: Timestamp.now().toDate().toISOString() };
        if (name !== undefined) update.name = name;
        if (description !== undefined) update.description = description;
        if (category !== undefined) update.category = category;
        if (images !== undefined) update.images = images;
        if (hasVideo !== undefined) update.hasVideo = hasVideo;
        if (price !== undefined) update.price = price;
        if (discount !== undefined) update.discount = discount;
        if (condition !== undefined) update.condition = condition;
        if (minOrderQuantity !== undefined) update.minOrderQuantity = minOrderQuantity;
        if (wholesalePrice !== undefined) update.wholesalePrice = wholesalePrice;
        if (bulkPrice !== undefined) update.bulkPrice = bulkPrice;
        if (locationAddress !== undefined) update.location = { ...(product.location && typeof product.location === 'object' ? product.location : {}), address: locationAddress };
        if (deliveryOptions !== undefined) update.deliveryOptions = deliveryOptions;
        if (pickupOptions !== undefined) update.pickupOptions = pickupOptions;
        if (status !== undefined) update.status = status;
        transaction.update(productRef, update);
        return { productId, quantity };
      });
      await db.collection('audit_logs').add({ action: 'business_product_updated', actorUid: uid, businessId, productId, updatedFields: supplied, createdAt: Timestamp.now() });
      return res.json({ ok: true, ...result });
    } catch (error: any) {
      const code = String(error?.code || '');
      if (code === 'NOT_FOUND') return fail(res, 'NOT_FOUND', 'Product was not found.', 404);
      if (code === 'FORBIDDEN') return fail(res, 'FORBIDDEN', 'You do not control this product.', 403);
      if (code === 'INVALID_BUSINESS') return fail(res, 'INVALID_BUSINESS', 'The Business account is not verified.', 403);
      if (code === 'INVALID_STOCK' || code === 'INVALID_MIN_ORDER' || code === 'INVALID_STATUS') return fail(res, 'INVALID_REQUEST', 'The requested product update conflicts with current inventory.', 409);
      console.error('Business product update failed:', error);
      return fail(res, 'SERVICE_UNAVAILABLE', 'Unable to update the product right now.', 503);
    }
  });

  });
}
