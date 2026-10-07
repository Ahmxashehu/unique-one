import type { Express, RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import { Timestamp, type Firestore } from 'firebase-admin/firestore';

function fail(res: any, code: string, message: string, status = 400) {
  return res.status(status).json({ error: { code, message } });
}

export function registerBusinessInventoryRoutes(
  app: Express,
  authenticate: RequestHandler,
  db: Firestore,
) {
  const inventoryLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 60, standardHeaders: true, legacyHeaders: false });

  app.post('/api/business/inventory/adjust', inventoryLimiter, authenticate, async (req, res) => {
    const uid = String((req as any).user?.uid || '');
    const session = (req as any).businessSession || {};
    const membership = (req as any).businessMembership || {};
    const businessId = String(session.businessId || '');
    const productId = typeof req.body?.productId === 'string' ? req.body.productId.trim() : '';
    const direction = req.body?.direction;
    const quantity = req.body?.quantity;
    const requestedBranchId = typeof req.body?.branchId === 'string' ? req.body.branchId.trim() : '';
    const membershipBranchId = typeof membership.branchId === 'string' ? membership.branchId.trim() : '';

    if (!uid || !businessId || !productId) return fail(res, 'INVALID_REQUEST', 'Business, user and product are required.');
    if (!['in', 'out'].includes(direction)) return fail(res, 'INVALID_REQUEST', 'Inventory direction must be in or out.');
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 1000000) return fail(res, 'INVALID_REQUEST', 'Inventory quantity must be a positive whole number.');
    if (!['business_owner', 'seller', 'admin', 'manager', 'inventory'].includes(String(membership.role || ''))) {
      return fail(res, 'FORBIDDEN', 'You do not have permission to adjust inventory.', 403);
    }

    try {
      const productRef = db.collection('products').doc(productId);
      const now = Timestamp.now();
      let newQuantity = 0;
      let productName = '';

      await db.runTransaction(async (transaction) => {
        const productSnap = await transaction.get(productRef);
        if (!productSnap.exists) throw new Error('PRODUCT_NOT_FOUND');
        const product = productSnap.data() || {};

        // The active Business session is the tenant boundary. Never trust a client-supplied businessId.
        if (String(product.businessId || '') !== businessId) throw new Error('PRODUCT_BUSINESS_MISMATCH');

        // Branch-scoped members may only operate within their assigned branch.
        if (membershipBranchId && requestedBranchId !== membershipBranchId) throw new Error('BRANCH_FORBIDDEN');
        if (requestedBranchId) {
          const branchRef = db.collection('branches').doc(requestedBranchId);
          const branchSnap = await transaction.get(branchRef);
          if (!branchSnap.exists) throw new Error('BRANCH_NOT_FOUND');
          const branch = branchSnap.data() || {};
          if (String(branch.businessId || '') !== businessId || String(branch.status || '') !== 'active') {
            throw new Error('BRANCH_FORBIDDEN');
          }
        }
        if (String(product.status || '') !== 'published') throw new Error('PRODUCT_NOT_PUBLISHED');

        const currentQuantity = Number(product.quantity);
        if (!Number.isSafeInteger(currentQuantity) || currentQuantity < 0) throw new Error('INVALID_STOCK');
        newQuantity = direction === 'in' ? currentQuantity + quantity : currentQuantity - quantity;
        if (!Number.isSafeInteger(newQuantity) || newQuantity < 0) throw new Error('INSUFFICIENT_STOCK');
        productName = String(product.name || 'Product');

        transaction.update(productRef, { quantity: newQuantity, updatedAt: now });
        const logRef = db.collection('inventoryLogs').doc();
        transaction.set(logRef, {
          productId,
          businessId,
          branchId: requestedBranchId,
          quantity,
          action: direction === 'in' ? 'stock_in' : 'stock_out',
          reason: typeof req.body?.reason === 'string' ? req.body.reason.trim().slice(0, 240) : '',
          staffId: uid,
          createdAt: now,
        });
      });

      await db.collection('audit_logs').add({
        action: 'business_inventory_adjusted',
        actorUid: uid,
        businessId,
        resource: 'product',
        resourceId: productId,
        details: JSON.stringify({ productName, direction, quantity, resultingQuantity: newQuantity }),
        createdAt: now,
      });
      return res.json({ ok: true, productId, quantity: newQuantity });
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      if (code === 'PRODUCT_NOT_FOUND') return fail(res, 'NOT_FOUND', 'The product was not found.', 404);
      if (code === 'PRODUCT_BUSINESS_MISMATCH') return fail(res, 'FORBIDDEN', 'This product does not belong to the active business.', 403);
      if (code === 'BRANCH_FORBIDDEN') return fail(res, 'FORBIDDEN', 'You are not authorized to operate in this branch.', 403);
      if (code === 'BRANCH_NOT_FOUND') return fail(res, 'NOT_FOUND', 'The selected branch was not found.', 404);
      if (code === 'PRODUCT_NOT_PUBLISHED') return fail(res, 'INVALID_REQUEST', 'Only published products can be adjusted.');
      if (code === 'INVALID_STOCK') return fail(res, 'INVALID_REQUEST', 'The product has an invalid inventory quantity.');
      if (code === 'INSUFFICIENT_STOCK') return fail(res, 'INVALID_REQUEST', 'There is not enough stock for this adjustment.');
      console.error('Business inventory adjustment failed:', error);
      return fail(res, 'SERVICE_UNAVAILABLE', 'Unable to adjust business inventory.', 503);
    }
  });
}
