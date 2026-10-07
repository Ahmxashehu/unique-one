import type { Express, RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import { Timestamp, type Firestore } from 'firebase-admin/firestore';

function fail(res: any, code: string, message: string, status = 400) {
  return res.status(status).json({ error: { code, message } });
}

const PLAN_ID = /^[A-Za-z0-9_-]{1,128}$/;
const IDEMPOTENCY = /^[A-Za-z0-9._:-]{1,128}$/;

export function registerPaySmallSmallRoutes(app: Express, authenticate: RequestHandler, db: Firestore) {
  const limiter = rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: true, legacyHeaders: false });

  app.post('/api/pay-small-small/plans', limiter, authenticate, async (req, res) => {
    const uid = String((req as any).user?.uid || '');
    const orderId = typeof req.body?.orderId === 'string' ? req.body.orderId.trim() : '';
    const totalAmountMinor = Number(req.body?.totalAmountMinor);
    const depositAmountMinor = Number(req.body?.depositAmountMinor);
    const installmentCount = Number(req.body?.installmentCount);
    const frequency = req.body?.frequency;
    const idempotencyKey = typeof req.body?.idempotencyKey === 'string' ? req.body.idempotencyKey.trim() : '';
    if (!uid || !PLAN_ID.test(orderId) || !Number.isSafeInteger(totalAmountMinor) || totalAmountMinor <= 0 ||
        !Number.isSafeInteger(depositAmountMinor) || depositAmountMinor <= 0 || depositAmountMinor >= totalAmountMinor ||
        !Number.isInteger(installmentCount) || installmentCount < 2 || installmentCount > 24 ||
        !['weekly', 'monthly'].includes(frequency) || !IDEMPOTENCY.test(idempotencyKey)) {
      return fail(res, 'INVALID_REQUEST', 'Valid Pay Small Small plan details are required.');
    }
    try {
      const result = await db.runTransaction(async (transaction) => {
        const orderRef = db.collection('orders').doc(orderId);
        const idemRef = db.collection('paySmallSmallIdempotency').doc(uid + '_' + idempotencyKey);
        const [orderSnap, idemSnap] = await Promise.all([transaction.get(orderRef), transaction.get(idemRef)]);
        if (idemSnap.exists) return { ...(idemSnap.data() || {}), replayed: true };
        if (!orderSnap.exists) throw new Error('ORDER_NOT_FOUND');
        const order = orderSnap.data() || {};
        if (String(order.customerId || '') !== uid) throw new Error('FORBIDDEN');
        if (String(order.currency || '') !== 'NGN') throw new Error('INVALID_CURRENCY');
        if (Number(order.totalAmountMinor) !== totalAmountMinor) throw new Error('AMOUNT_MISMATCH');
        if (String(order.paymentStatus || '') !== 'pending_payment') throw new Error('ORDER_NOT_ELIGIBLE');
        if (order.paySmallSmallPlanId) throw new Error('PLAN_EXISTS');
        const now = Timestamp.now();
        const intervalDays = frequency === 'weekly' ? 7 : 30;
        const firstDueAt = Timestamp.fromMillis(Date.now() + intervalDays * 24 * 60 * 60 * 1000);
        const remainingMinor = totalAmountMinor - depositAmountMinor;
        const baseInstallmentMinor = Math.floor(remainingMinor / installmentCount);
        const remainderMinor = remainingMinor - baseInstallmentMinor * installmentCount;
        const installments = Array.from({ length: installmentCount }, (_, index) => ({
          installmentNumber: index + 1,
          amountMinor: baseInstallmentMinor + (index === installmentCount - 1 ? remainderMinor : 0),
          status: 'pending',
          dueAt: Timestamp.fromMillis(firstDueAt.toMillis() + index * intervalDays * 24 * 60 * 60 * 1000),
        }));
        const planRef = db.collection('paySmallSmallPlans').doc();
        const plan = { planId: planRef.id, orderId, customerId: uid, currency: 'NGN', totalAmountMinor, depositAmountMinor, installmentCount, frequency, installments, status: 'draft', createdAt: now, updatedAt: now };
        transaction.create(planRef, plan);
        transaction.update(orderRef, { paySmallSmallPlanId: planRef.id, paySmallSmallStatus: 'draft', updatedAt: now });
        transaction.create(idemRef, { uid, planId: planRef.id, orderId, createdAt: now });
        transaction.create(db.collection('audit_logs').doc(), { action: 'pay_small_small.plan_created', actorUid: uid, targetUid: uid, resource: 'pay_small_small_plan', resourceId: planRef.id, orderId, timestamp: now, createdAt: now });
        return { ...plan, replayed: false };
      });
      return res.status(201).json(result);
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      if (code === 'ORDER_NOT_FOUND') return fail(res, 'NOT_FOUND', 'The Store order was not found.', 404);
      if (code === 'FORBIDDEN') return fail(res, 'FORBIDDEN', 'You are not permitted to use this order.', 403);
      if (code === 'INVALID_CURRENCY' || code === 'AMOUNT_MISMATCH' || code === 'ORDER_NOT_ELIGIBLE') return fail(res, 'INVALID_REQUEST', 'This order is not eligible for Pay Small Small.');
      if (code === 'PLAN_EXISTS') return fail(res, 'CONFLICT', 'This order already has a Pay Small Small plan.', 409);
      console.error('Pay Small Small plan creation failed:', error);
      return fail(res, 'SERVICE_UNAVAILABLE', 'The Pay Small Small plan could not be created safely.', 503);
    }
  });

  app.get('/api/pay-small-small/plans/:planId', limiter, authenticate, async (req, res) => {
    const uid = String((req as any).user?.uid || '');
    const planId = typeof req.params.planId === 'string' ? req.params.planId.trim() : '';
    if (!uid || !PLAN_ID.test(planId)) return fail(res, 'INVALID_REQUEST', 'A valid plan ID is required.');
    try {
      const snap = await db.collection('paySmallSmallPlans').doc(planId).get();
      if (!snap.exists) return fail(res, 'NOT_FOUND', 'The Pay Small Small plan was not found.', 404);
      const plan = snap.data() || {};
      if (String(plan.customerId || '') !== uid) return fail(res, 'FORBIDDEN', 'You are not permitted to view this plan.', 403);
      return res.json(plan);
    } catch (error) {
      console.error('Pay Small Small plan lookup failed:', error);
      return fail(res, 'SERVICE_UNAVAILABLE', 'The Pay Small Small plan could not be loaded.', 503);
    }
  });
}
