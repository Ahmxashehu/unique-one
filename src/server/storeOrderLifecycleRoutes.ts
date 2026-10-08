import type { Express, RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import { Timestamp, type Firestore } from 'firebase-admin/firestore';
import type { Permission, Role } from '../lib/os/types';
import { hasRolePermission } from '../lib/auth/rbac';

function fail(res: any, code: string, message: string, status = 400) {
  return res.status(status).json({ error: { code, message } });
}

const TRANSITIONS: Record<string, string> = {
  paid: 'confirmed',
  confirmed: 'processing',
  processing: 'ready_for_pickup',
  ready_for_pickup: 'shipped',
  shipped: 'out_for_delivery',
  out_for_delivery: 'delivered',
  delivered: 'completed',
};

const VALID_TARGETS = new Set(Object.values(TRANSITIONS));

export function registerStoreOrderLifecycleRoutes(
  app: Express,
  authenticate: RequestHandler,
  db: Firestore,
) {
  const limiter = rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: true, legacyHeaders: false });

  app.post('/api/business/orders/:orderId/status', limiter, authenticate, async (req, res) => {
    const uid = String((req as any).user?.uid || '');
    const orderId = typeof req.params.orderId === 'string' ? req.params.orderId.trim() : '';
    const targetStatus = typeof req.body?.status === 'string' ? req.body.status.trim() : '';

    if (!uid || !/^[A-Za-z0-9_-]{1,128}$/.test(orderId) || !VALID_TARGETS.has(targetStatus)) {
      return fail(res, 'INVALID_REQUEST', 'A valid order ID and lifecycle status are required.');
    }

    try {
      const result = await db.runTransaction(async (transaction) => {
        const orderRef = db.collection('orders').doc(orderId);
        const actorRef = db.collection('users').doc(uid);
        const [orderSnap, actorSnap] = await Promise.all([
          transaction.get(orderRef),
          transaction.get(actorRef),
        ]);
        if (!orderSnap.exists) throw new Error('ORDER_NOT_FOUND');
        if (!actorSnap.exists) throw new Error('ACTOR_NOT_FOUND');

        const order = orderSnap.data() || {};
        const actor = actorSnap.data() || {};
        const roles: Role[] = Array.isArray(actor.roles) ? actor.roles.filter((r: unknown): r is Role => typeof r === 'string') : [];
        const permissions: Permission[] = Array.isArray(actor.permissions)
          ? actor.permissions.filter((p: unknown): p is Permission => typeof p === 'string')
          : [];

        const isSeller = String(order.sellerId || '') === uid;
        const businessMembership = (req as any).businessMembership as Record<string, unknown> | undefined;
        const activeBusinessId = typeof businessMembership?.businessId === 'string' ? businessMembership.businessId : '';
        const orderBusinessId = typeof order.businessId === 'string' ? order.businessId : '';
        const orderBranchId = typeof order.branchId === 'string' ? order.branchId : '';
        const memberBranchId = typeof businessMembership?.branchId === 'string' ? businessMembership.branchId : '';
        const ownerRole = String(businessMembership?.role || '') === 'business_owner';
        const branchScopedAccess = ownerRole || (!memberBranchId ? false : memberBranchId === orderBranchId);
        const hasBusinessContext = Boolean(activeBusinessId);
        const privilegedBusinessAccess = hasBusinessContext && orderBusinessId === activeBusinessId && branchScopedAccess;
        if (!isSeller && (!hasRolePermission(roles, permissions, 'manage:orders') || !privilegedBusinessAccess)) {
          throw new Error('FORBIDDEN');
        }

        if (String(order.currency || '') !== 'NGN' || String(order.paymentStatus || '') !== 'paid') {
          throw new Error('ORDER_NOT_PAID');
        }

        const currentStatus = String(order.status || '');
        if (currentStatus === targetStatus) {
          return { orderId, status: currentStatus, replayed: true };
        }

        if (TRANSITIONS[currentStatus] !== targetStatus) {
          throw new Error('INVALID_TRANSITION');
        }

        const now = Timestamp.now();
        const timeline = Array.isArray(order.orderTimeline) ? order.orderTimeline.slice(-49) : [];
        timeline.push({ status: targetStatus, at: now, actorUid: uid });

        transaction.update(orderRef, {
          status: targetStatus,
          updatedAt: now,
          orderTimeline: timeline,
          statusChangedAt: now,
          statusChangedBy: uid,
        });
        transaction.create(db.collection('audit_logs').doc(), {
          action: 'store.order.status_changed',
          actorUid: uid,
          targetUid: String(order.customerId || ''),
          resource: 'store_order',
          resourceId: orderId,
          orderId,
          fromStatus: currentStatus,
          toStatus: targetStatus,
          timestamp: now,
          createdAt: now,
        });

        return { orderId, status: targetStatus, previousStatus: currentStatus, replayed: false };
      });

      return res.status(200).json(result);
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      if (code === 'ORDER_NOT_FOUND') return fail(res, 'NOT_FOUND', 'The Store order was not found.', 404);
      if (code === 'ACTOR_NOT_FOUND') return fail(res, 'UNAUTHENTICATED', 'Your account profile could not be found.', 401);
      if (code === 'FORBIDDEN') return fail(res, 'FORBIDDEN', 'You are not permitted to update this Store order.', 403);
      if (code === 'ORDER_NOT_PAID') return fail(res, 'INVALID_REQUEST', 'Only paid NGN Store orders can enter the fulfilment lifecycle.');
      if (code === 'INVALID_TRANSITION') return fail(res, 'INVALID_REQUEST', 'That Store order status transition is not allowed.');
      console.error('Store order lifecycle update failed:', error);
      return fail(res, 'SERVICE_UNAVAILABLE', 'The Store order status could not be updated safely.', 503);
    }
  });
}
