import type { Express, RequestHandler } from 'express';
import type { Firestore, QueryDocumentSnapshot } from 'firebase-admin/firestore';
import type { Permission } from '../lib/os/types';
import { hasRolePermission } from '../lib/auth/rbac';

type BusinessMembership = {
  uid?: string;
  businessId?: string;
  role?: string;
  status?: string;
  branchId?: string;
};

function fail(res: any, code: string, message: string, status = 400) {
  return res.status(status).json({ error: { code, message } });
}

function can(membership: BusinessMembership, permission: Permission) {
  const role = typeof membership.role === 'string' ? membership.role : '';
  return hasRolePermission([role as any], [], permission);
}

function serializeTimestamp(value: unknown) {
  return value && typeof (value as any).toDate === 'function'
    ? (value as any).toDate().toISOString()
    : typeof value === 'string' ? value : null;
}

function minimalOrder(doc: QueryDocumentSnapshot) {
  const data = doc.data() || {};
  return {
    id: doc.id,
    customerId: String(data.customerId || ''),
    sellerId: String(data.sellerId || ''),
    businessId: typeof data.businessId === 'string' ? data.businessId : null,
    status: typeof data.status === 'string' ? data.status : 'pending',
    totalAmount: typeof data.totalAmount === 'number' ? data.totalAmount : null,
    currency: typeof data.currency === 'string' ? data.currency : 'NGN',
    items: Array.isArray(data.items) ? data.items.map((item: any) => ({
      productId: typeof item?.productId === 'string' ? item.productId : '',
      name: typeof item?.name === 'string' ? item.name : '',
      quantity: typeof item?.quantity === 'number' ? item.quantity : 0,
      price: typeof item?.price === 'number' ? item.price : 0,
    })) : [],
    createdAt: serializeTimestamp(data.createdAt),
    updatedAt: serializeTimestamp(data.updatedAt),
  };
}

export function registerBusinessDataRoutes(
  app: Express,
  authenticate: RequestHandler,
  db: Firestore,
) {
  const protectedBusiness = ['/api/business/orders', '/api/business/customers', '/api/business/catalog'];

  app.use(protectedBusiness, authenticate, async (req, res, next) => {
    const membership = (req as any).businessMembership as BusinessMembership | undefined;
    const session = (req as any).businessSession as Record<string, unknown> | undefined;
    const businessId = typeof membership?.businessId === 'string' ? membership.businessId : '';
    if (!membership || membership.status !== 'active' || !session || session.businessId !== businessId) {
      return fail(res, 'BUSINESS_AUTH_REQUIRED', 'An active Business Platform session is required.', 401);
    }
    (req as any).businessDataMembership = membership;
    return next();
  });

  app.get('/api/business/orders', async (req, res) => {
    const membership = (req as any).businessDataMembership as BusinessMembership;
    if (!can(membership, 'manage:orders')) return fail(res, 'FORBIDDEN', 'You do not have permission to view business orders.', 403);
    const businessId = String(membership.businessId || '');
    const uid = String(membership.uid || '');
    try {
      const [tenantSnap, legacySnap] = await Promise.all([
        db.collection('orders').where('businessId', '==', businessId).limit(200).get(),
        db.collection('orders').where('sellerId', '==', uid).limit(200).get(),
      ]);
      const seen = new Set<string>();
      const orders = [...tenantSnap.docs, ...legacySnap.docs]
        .filter((doc) => {
          if (seen.has(doc.id)) return false;
          seen.add(doc.id);
          const data = doc.data() || {};
          return data.businessId === businessId || (!data.businessId && data.sellerId === uid);
        })
        .map(minimalOrder)
        .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
      return res.json({ orders });
    } catch (error) {
      console.error('Business orders read failed:', error);
      return fail(res, 'SERVICE_UNAVAILABLE', 'Business orders are temporarily unavailable.', 503);
    }
  });

  app.get('/api/business/customers', async (req, res) => {
    const membership = (req as any).businessDataMembership as BusinessMembership;
    if (!can(membership, 'view:customer_info')) return fail(res, 'FORBIDDEN', 'You do not have permission to view customer information.', 403);
    const businessId = String(membership.businessId || '');
    const uid = String(membership.uid || '');
    try {
      const [tenantSnap, legacySnap] = await Promise.all([
        db.collection('orders').where('businessId', '==', businessId).limit(500).get(),
        db.collection('orders').where('sellerId', '==', uid).limit(500).get(),
      ]);
      const customers = new Map<string, { customerId: string; orderCount: number; totalSpent: number; lastOrderAt: string | null; lastStatus: string }>();
      for (const doc of [...tenantSnap.docs, ...legacySnap.docs]) {
        const data = doc.data() || {};
        if (!(data.businessId === businessId || (!data.businessId && data.sellerId === uid))) continue;
        const customerId = typeof data.customerId === 'string' ? data.customerId : '';
        if (!customerId) continue;
        const current = customers.get(customerId) || { customerId, orderCount: 0, totalSpent: 0, lastOrderAt: null, lastStatus: '' };
        current.orderCount += 1;
        current.totalSpent += typeof data.totalAmount === 'number' && Number.isSafeInteger(data.totalAmount) ? data.totalAmount : 0;
        const createdAt = serializeTimestamp(data.createdAt);
        if (!current.lastOrderAt || String(createdAt || '') > current.lastOrderAt) {
          current.lastOrderAt = createdAt;
          current.lastStatus = typeof data.status === 'string' ? data.status : '';
        }
        customers.set(customerId, current);
      }
      return res.json({ customers: Array.from(customers.values()).sort((a, b) => b.orderCount - a.orderCount) });
    } catch (error) {
      console.error('Business customers read failed:', error);
      return fail(res, 'SERVICE_UNAVAILABLE', 'Business customer data is temporarily unavailable.', 503);
    }
  });

  app.get('/api/business/catalog', async (req, res) => {
    const membership = (req as any).businessDataMembership as BusinessMembership;
    if (!can(membership, 'create:products') && !can(membership, 'edit:products') && !can(membership, 'manage:inventory')) {
      return fail(res, 'FORBIDDEN', 'You do not have permission to view the business catalog.', 403);
    }
    const businessId = String(membership.businessId || '');
    const uid = String(membership.uid || '');
    try {
      const [tenantSnap, legacySnap] = await Promise.all([
        db.collection('products').where('businessId', '==', businessId).limit(500).get(),
        db.collection('products').where('sellerId', '==', uid).limit(500).get(),
      ]);
      const seen = new Set<string>();
      const products = [...tenantSnap.docs, ...legacySnap.docs]
        .filter((doc) => {
          if (seen.has(doc.id)) return false;
          seen.add(doc.id);
          const data = doc.data() || {};
          return data.businessId === businessId || (!data.businessId && data.sellerId === uid);
        })
        .map((doc) => {
          const data = doc.data() || {};
          return {
            id: doc.id,
            sellerId: String(data.sellerId || ''),
            businessId: typeof data.businessId === 'string' ? data.businessId : null,
            name: typeof data.name === 'string' ? data.name : '',
            quantity: typeof data.quantity === 'number' ? data.quantity : 0,
            status: typeof data.status === 'string' ? data.status : 'draft',
            category: typeof data.category === 'string' ? data.category : '',
            currency: typeof data.currency === 'string' ? data.currency : 'NGN',
            price: typeof data.price === 'number' ? data.price : 0,
            images: Array.isArray(data.images) ? data.images.slice(0, 3) : [],
          };
        });
      return res.json({ products });
    } catch (error) {
      console.error('Business catalog read failed:', error);
      return fail(res, 'SERVICE_UNAVAILABLE', 'Business catalog is temporarily unavailable.', 503);
    }
  });
}
