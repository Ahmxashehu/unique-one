import type { Express, RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import { Timestamp, type Firestore } from 'firebase-admin/firestore';
import { recordStoreInventoryMovement } from './storeInventoryLedger';

type ReturnDisposition = 'resalable' | 'damaged' | 'non_resalable';

const isSafeId = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);

export function registerStoreReturnInspectionRoutes(
  app: Express,
  authenticate: RequestHandler,
  db: Firestore,
) {
  app.post('/api/business/orders/:orderId/return-inspect', authenticate, rateLimit({
    windowMs: 60_000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
  }), async (req, res) => {
    try {
      const uid = String((req as any).user?.uid || '');
      const orderId = String(req.params.orderId || '');
      const disposition = req.body?.disposition as ReturnDisposition;
      if (!isSafeId(orderId) || !['resalable', 'damaged', 'non_resalable'].includes(disposition)) {
        return res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'A valid return disposition is required.' } });
      }

      const result = await db.runTransaction(async (transaction) => {
        const orderRef = db.collection('orders').doc(orderId);
        const orderSnap = await transaction.get(orderRef);
        if (!orderSnap.exists) throw new Error('NOT_FOUND');
        const order = orderSnap.data() || {};

        const actorSnap = await transaction.get(db.collection('users').doc(uid));
        const actor = actorSnap.data() || {};
        const roles = Array.isArray(actor.roles) ? actor.roles.filter((r: unknown) => typeof r === 'string') : [];
        const permissions = Array.isArray(actor.permissions) ? actor.permissions.filter((p: unknown) => typeof p === 'string') : [];
        const canManage = roles.includes('super_admin') || roles.includes('platform_admin') ||
          roles.includes('administrator') || permissions.includes('manage:disputes');

        const businessMembership = (req as any).businessMembership as Record<string, unknown> | undefined;
        const activeBusinessId = typeof businessMembership?.businessId === 'string' ? businessMembership.businessId : '';
        const orderBusinessId = typeof order.businessId === 'string' ? order.businessId : '';
        const globalAdmin = roles.includes('super_admin') || roles.includes('platform_admin');
        const assignedBranchId = typeof businessMembership?.branchId === 'string' ? businessMembership.branchId.trim() : '';
        const orderBranchId = typeof order.branchId === 'string' ? order.branchId.trim() : '';
        const branchAccess = !assignedBranchId || orderBranchId === assignedBranchId;
        const tenantAccess = Boolean(activeBusinessId && orderBusinessId && orderBusinessId === activeBusinessId && branchAccess);
        const privilegedBusinessAccess = canManage && (orderBusinessId ? (globalAdmin || tenantAccess) : globalAdmin);
        // Inventory inspection determines whether returned goods become resalable and
        // therefore can unlock a refund. Keep this decision separate from the seller.
        if (!privilegedBusinessAccess) throw new Error('FORBIDDEN');

        const rr = order.returnRequest && typeof order.returnRequest === 'object'
          ? order.returnRequest as Record<string, unknown>
          : null;
        if (!rr || rr.status !== 'received' || rr.restocked !== false || rr.quarantined !== true) throw new Error('INVALID_STATE');
        const expiresAt = typeof rr.expiresAt === 'string' ? Date.parse(rr.expiresAt) : NaN;
        if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) throw new Error('RETURN_EXPIRED');
        if (rr.inventoryDisposition && rr.inventoryDisposition !== 'quarantined') {
          if (rr.inventoryDisposition === disposition) {
            return { orderId, disposition, replayed: true };
          }
          throw new Error('ALREADY_INSPECTED');
        }

        const items = Array.isArray(rr.items) ? rr.items : [];
        const quantities = new Map<string, number>();
        for (const item of items) {
          const productId = (item as any)?.productId;
          const quantity = Number((item as any)?.quantity);
          if (!isSafeId(productId) || !Number.isSafeInteger(quantity) || quantity <= 0) throw new Error('INVALID_ITEMS');
          quantities.set(productId, (quantities.get(productId) || 0) + quantity);
        }

        const productEntries = Array.from(quantities.entries());
        const productSnaps = await Promise.all(productEntries.map(([productId]) =>
          transaction.get(db.collection('products').doc(productId))
        ));
        const now = Timestamp.now();

        productSnaps.forEach((productSnap, index) => {
          if (!productSnap.exists) throw new Error('PRODUCT_NOT_FOUND');
          const product = productSnap.data() || {};
          const productSellerId = typeof product.sellerId === 'string' ? product.sellerId.trim() : '';
          const productBusinessId = typeof product.businessId === 'string' ? product.businessId.trim() : '';
          const productBranchId = typeof product.branchId === 'string' ? product.branchId.trim() : '';
          if (productSellerId !== String(order.sellerId || '').trim()) throw new Error('PRODUCT_SELLER_MISMATCH');
          if (orderBusinessId && productBusinessId !== orderBusinessId) throw new Error('PRODUCT_TENANT_MISMATCH');
          if (orderBranchId && productBranchId !== orderBranchId) throw new Error('PRODUCT_BRANCH_MISMATCH');
          const currentQuantity = Number(product.quantity);
          const quarantineQuantity = Number(product.quarantineQuantity || 0);
          const returnedQuantity = productEntries[index][1];
          if (!Number.isSafeInteger(currentQuantity) || currentQuantity < 0 ||
              !Number.isSafeInteger(quarantineQuantity) || quarantineQuantity < returnedQuantity) {
            throw new Error('INVALID_STOCK');
          }

          if (disposition === 'resalable') {
            const newQuantity = currentQuantity + returnedQuantity;
            if (!Number.isSafeInteger(newQuantity)) throw new Error('INVALID_STOCK');
            transaction.update(productSnap.ref, {
              quantity: newQuantity,
              quarantineQuantity: quarantineQuantity - returnedQuantity,
              // Returned stock can restore sellability from out_of_stock, but must
              // never silently reactivate an intentionally archived/suspended product.
              status: product.status === 'out_of_stock' ? 'published' : product.status,
              updatedAt: now,
            });
            recordStoreInventoryMovement(transaction, db, {
              productId: productEntries[index][0],
              movementType: 'return_inspection_resalable',
              quantity: returnedQuantity,
              previousQuantity: currentQuantity,
              resultingQuantity: newQuantity,
              previousQuarantineQuantity: quarantineQuantity,
              resultingQuarantineQuantity: quarantineQuantity - returnedQuantity,
              direction: 'in',
              sourceId: orderId + ':inspection:resalable',
              sourceModule: 'unique_store.return_inspection',
              actorUid: uid,
              orderId,
              returnId: orderId,
              businessId: orderBusinessId || null,
            });
          } else {
            transaction.update(productSnap.ref, {
              quarantineQuantity: quarantineQuantity - returnedQuantity,
              updatedAt: now,
            });
            recordStoreInventoryMovement(transaction, db, {
              productId: productEntries[index][0],
              movementType: 'return_inspection_damaged',
              quantity: returnedQuantity,
              previousQuantity: currentQuantity,
              resultingQuantity: currentQuantity,
              previousQuarantineQuantity: quarantineQuantity,
              resultingQuarantineQuantity: quarantineQuantity - returnedQuantity,
              direction: 'quarantine_out',
              quantityDelta: 0,
              sourceId: orderId + ':inspection:' + disposition,
              sourceModule: 'unique_store.return_inspection',
              actorUid: uid,
              orderId,
              returnId: orderId,
              businessId: orderBusinessId || null,
            });
          }
        });

        transaction.update(orderRef, {
          returnRequest: {
            ...rr,
            inventoryDisposition: disposition,
            quarantined: false,
            restocked: disposition === 'resalable',
            inspectedBy: uid,
            inspectedAt: now.toDate().toISOString(),
          },
          updatedAt: now.toDate().toISOString(),
        });
        transaction.create(db.collection('audit_logs').doc(), {
          action: 'store.return.inspected',
          actorUid: uid,
          targetUid: order.customerId,
          resource: 'store_order',
          resourceId: orderId,
          disposition,
          quantities: Object.fromEntries(quantities),
          timestamp: now,
          createdAt: now.toDate().toISOString(),
        });

        return { orderId, disposition, replayed: false };
      });

      return res.json(result);
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      const status = code === 'FORBIDDEN' ? 403 : code === 'NOT_FOUND' || code === 'PRODUCT_NOT_FOUND' ? 404 : 400;
      const messages: Record<string, string> = {
        FORBIDDEN: 'You are not permitted to inspect this return.',
        NOT_FOUND: 'The Store order was not found.',
        INVALID_STATE: 'This return is not ready for inventory inspection.',
        RETURN_EXPIRED: 'This Store return request has expired and can no longer be inspected.',
        ALREADY_INSPECTED: 'This return has already been inspected.',
        INVALID_ITEMS: 'The return contains invalid inventory data.',
        PRODUCT_NOT_FOUND: 'A returned product no longer exists.',
        INVALID_STOCK: 'The returned inventory quantity is inconsistent.',
        PRODUCT_SELLER_MISMATCH: 'A returned product does not belong to the Store seller.',
        PRODUCT_TENANT_MISMATCH: 'A returned product does not belong to this Store business.',
        PRODUCT_BRANCH_MISMATCH: 'A returned product does not belong to this Store branch.',
      };
      return res.status(status).json({ error: { code: code || 'INVALID_REQUEST', message: messages[code] || 'The return inspection could not be completed safely.' } });
    }
  });
}
