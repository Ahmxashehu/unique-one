import type { Express, RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import { Timestamp, type Firestore } from 'firebase-admin/firestore';
import crypto from 'node:crypto';
import { scryptSync, timingSafeEqual } from 'node:crypto';

function fail(res: any, code: string, message: string, status = 400) {
  return res.status(status).json({ error: { code, message } });
}

const PLAN_ID = /^[A-Za-z0-9_-]{1,128}$/;
function verifyPinCredential(data: any, pin: string): boolean {
  if (!/^\d{4}$/.test(pin)) return false;
  const salt = typeof data?.transactionPinSalt === 'string' ? Buffer.from(data.transactionPinSalt, 'utf8') : null;
  const digest = typeof data?.transactionPinHash === 'string' ? Buffer.from(data.transactionPinHash, 'hex') : null;
  if (!salt || !digest || salt.length < 16 || digest.length !== 64) return false;
  const candidate = scryptSync(pin, salt, 64);
  return timingSafeEqual(candidate, digest);
}

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


  app.post('/api/pay-small-small/plans/:planId/deposit', limiter, authenticate, async (req, res) => {
    const uid = String((req as any).user?.uid || '');
    const planId = typeof req.params.planId === 'string' ? req.params.planId.trim() : '';
    const transactionPin = typeof req.body?.transactionPin === 'string' ? req.body.transactionPin : '';
    const idempotencyKey = typeof req.body?.idempotencyKey === 'string' ? req.body.idempotencyKey.trim() : '';
    if (!uid || !PLAN_ID.test(planId) || !/^\d{4}$/.test(transactionPin) || !IDEMPOTENCY.test(idempotencyKey)) {
      return fail(res, 'INVALID_REQUEST', 'A valid plan, Transaction PIN and idempotency key are required.');
    }
    try {
      const result = await db.runTransaction(async (transaction) => {
        const planRef = db.collection('paySmallSmallPlans').doc(planId);
        const walletRef = db.collection('wallets').doc(uid);
        const idemRef = db.collection('paySmallSmallPaymentIdempotency').doc(crypto.createHash('sha256').update(uid + '\0' + idempotencyKey).digest('hex'));
        const credentialRef = db.collection('authCredentials').doc(uid);
        const [planSnap, credentialSnap, walletSnap, idemSnap] = await Promise.all([
          transaction.get(planRef), transaction.get(credentialRef), transaction.get(walletRef), transaction.get(idemRef)
        ]);
        if (idemSnap.exists) return { ...(idemSnap.data()?.result || {}), replayed: true };
        if (!planSnap.exists) throw new Error('PLAN_NOT_FOUND');
        if (!credentialSnap.exists) throw new Error('USER_NOT_FOUND');
        if (!walletSnap.exists) throw new Error('WALLET_NOT_FOUND');
        const plan = planSnap.data() || {};
        if (String(plan.customerId || '') !== uid) throw new Error('FORBIDDEN');
        if (String(plan.currency || '') !== 'NGN' || String(plan.status || '') !== 'draft') throw new Error('PLAN_NOT_ELIGIBLE');
        const credential = credentialSnap.data() || {};
        if (!verifyPinCredential(credential, transactionPin)) throw new Error('BAD_PIN');
        const deposit = Number(plan.depositAmountMinor);
        if (!Number.isSafeInteger(deposit) || deposit <= 0) throw new Error('INVALID_AMOUNT');
        const wallet = walletSnap.data() || {};
        const balance = Number(wallet.availableBalanceMinor);
        if (!Number.isSafeInteger(balance) || balance < deposit || String(wallet.status || '') !== 'active') throw new Error('INSUFFICIENT_FUNDS');
        const now = Timestamp.now();
        const txRef = db.collection('transactions').doc();
        const reference = 'UP-PSS-' + txRef.id;
        const debitRef = db.collection('ledgerEntries').doc();
        transaction.create(txRef, {
          id: txRef.id, reference, senderId: uid, recipientId: String(plan.planId), amount: deposit,
          currency: 'NGN', type: 'merchant_payment', sourceModule: 'unique_pay_small_small.deposit',
          provider: 'unique_pay_internal_wallet', status: 'completed', relatedOrderIds: [String(plan.orderId)],
          createdAt: now, updatedAt: now, recordKind: 'financial', schemaVersion: 2, amountUnit: 'minor'
        });
        transaction.create(debitRef, {
          id: debitRef.id, transactionId: txRef.id, reference, uid, direction: 'debit',
          amountMinor: deposit, currency: 'NGN', status: 'completed', idempotencyKey,
          createdAt: now
        });
        transaction.create(holdRef, { id: holdRef.id, transactionId: txRef.id, reference, uid: String(plan.planId), direction: 'credit', amountMinor: deposit, currency: 'NGN', status: 'completed', idempotencyKey, createdAt: now, accountType: 'pay_small_small_hold' });
        transaction.update(walletRef, { availableBalanceMinor: balance - deposit, updatedAt: now });
        transaction.update(planRef, {
          status: 'active', paidAmountMinor: deposit, remainingAmountMinor: Number(plan.totalAmountMinor) - deposit,
          depositTransactionId: txRef.id, activatedAt: now, updatedAt: now
        });
        const orderRef = db.collection('orders').doc(String(plan.orderId));
        transaction.update(orderRef, {
          paySmallSmallStatus: 'active', paySmallSmallPlanId: planId, paymentStatus: 'partial', status: 'reserved',
          updatedAt: now
        });
        const result = { status: 'active', planId, transactionId: txRef.id, amountMinor: deposit, idempotencyKey };
        transaction.create(idemRef, { uid, planId, transactionId: txRef.id, requestFingerprint: planId + '|' + deposit, result, createdAt: now });
        transaction.create(db.collection('audit_logs').doc(), {
          action: 'pay_small_small.deposit_completed', actorUid: uid, targetUid: uid,
          resource: 'pay_small_small_plan', resourceId: planId, orderId: String(plan.orderId),
          transactionId: txRef.id, amountMinor: deposit, currency: 'NGN', idempotencyKey, createdAt: now, timestamp: now
        });
        return result;
      });
      return res.status(200).json(result);
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      if (code === 'PLAN_NOT_FOUND') return fail(res, 'NOT_FOUND', 'The Pay Small Small plan was not found.', 404);
      if (code === 'USER_NOT_FOUND') return fail(res, 'UNAUTHENTICATED', 'Your account profile could not be found.', 401);
      if (code === 'FORBIDDEN') return fail(res, 'FORBIDDEN', 'You are not permitted to fund this plan.', 403);
      if (code === 'BAD_PIN') return fail(res, 'FORBIDDEN', 'Incorrect Transaction PIN.', 403);
      if (code === 'WALLET_NOT_FOUND') return fail(res, 'WALLET_NOT_FOUND', 'Your UniquePay wallet is not available.');
      if (code === 'INSUFFICIENT_FUNDS') return fail(res, 'INSUFFICIENT_FUNDS', 'Insufficient UniquePay wallet balance.');
      if (code === 'PLAN_NOT_ELIGIBLE') return fail(res, 'INVALID_REQUEST', 'This Pay Small Small plan is not ready for activation.');
      if (code === 'INVALID_AMOUNT') return fail(res, 'INVALID_AMOUNT', 'The deposit amount is invalid.');
      console.error('Pay Small Small deposit failed:', error);
      return fail(res, 'SERVICE_UNAVAILABLE', 'The Pay Small Small deposit could not be completed safely.', 503);
    }
  });

  app.post('/api/pay-small-small/plans/:planId/sync-due-status', limiter, authenticate, async (req, res) => {
    const uid = String((req as any).user?.uid || '');
    const planId = typeof req.params.planId === 'string' ? req.params.planId.trim() : '';
    if (!uid || !PLAN_ID.test(planId)) return fail(res, 'INVALID_REQUEST', 'A valid plan ID is required.');
    try {
      const result = await db.runTransaction(async (transaction) => {
        const planRef = db.collection('paySmallSmallPlans').doc(planId);
        const snap = await transaction.get(planRef);
        if (!snap.exists) throw new Error('PLAN_NOT_FOUND');
        const plan = snap.data() || {};
        if (String(plan.customerId || '') !== uid) throw new Error('FORBIDDEN');
        if (String(plan.status || '') !== 'active') return { planId, status: String(plan.status || ''), updatedInstallments: 0 };
        const now = Timestamp.now();
        let changed = 0;
        const installments = Array.isArray(plan.installments) ? plan.installments : [];
        const next = installments.map((item: any) => {
          if (String(item.status || '') === 'pending' && item.dueAt && typeof item.dueAt.toMillis === 'function' && item.dueAt.toMillis() <= now.toMillis()) {
            changed++;
            return { ...item, status: 'overdue', overdueAt: now };
          }
          return item;
        });
        if (changed > 0) {
          transaction.update(planRef, { installments: next, updatedAt: now });
          transaction.create(db.collection('audit_logs').doc(), {
            action: 'pay_small_small.installments_marked_overdue', actorUid: uid, targetUid: uid,
            resource: 'pay_small_small_plan', resourceId: planId, changedInstallments: changed,
            createdAt: now, timestamp: now
          });
        }
        return { planId, status: 'active', updatedInstallments: changed, installments: next };
      });
      return res.json(result);
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      if (code === 'PLAN_NOT_FOUND') return fail(res, 'NOT_FOUND', 'The Pay Small Small plan was not found.', 404);
      if (code === 'FORBIDDEN') return fail(res, 'FORBIDDEN', 'You are not permitted to update this plan.', 403);
      console.error('Pay Small Small due-status sync failed:', error);
      return fail(res, 'SERVICE_UNAVAILABLE', 'The Pay Small Small due status could not be synchronized safely.', 503);
    }
  });

  app.post('/api/pay-small-small/plans/:planId/installments/:installmentNumber/pay', limiter, authenticate, async (req, res) => {
    const uid = String((req as any).user?.uid || '');
    const planId = typeof req.params.planId === 'string' ? req.params.planId.trim() : '';
    const installmentNumber = Number(req.params.installmentNumber);
    const transactionPin = typeof req.body?.transactionPin === 'string' ? req.body.transactionPin : '';
    const idempotencyKey = typeof req.body?.idempotencyKey === 'string' ? req.body.idempotencyKey.trim() : '';
    if (!uid || !PLAN_ID.test(planId) || !Number.isInteger(installmentNumber) || installmentNumber < 1 || installmentNumber > 24 || !/^\d{4}$/.test(transactionPin) || !IDEMPOTENCY.test(idempotencyKey)) return fail(res, 'INVALID_REQUEST', 'A valid plan, installment number, Transaction PIN and idempotency key are required.');
    try {
      const result = await db.runTransaction(async (transaction) => {
        const planRef = db.collection('paySmallSmallPlans').doc(planId);
        const walletRef = db.collection('wallets').doc(uid);
        const credentialRef = db.collection('authCredentials').doc(uid);
        const idemRef = db.collection('paySmallSmallPaymentIdempotency').doc(crypto.createHash('sha256').update(uid + '\0' + idempotencyKey).digest('hex'));
        const [planSnap, walletSnap, credentialSnap, idemSnap] = await Promise.all([transaction.get(planRef), transaction.get(walletRef), transaction.get(credentialRef), transaction.get(idemRef)]);
        const fingerprint = planId + '|' + installmentNumber;
        if (idemSnap.exists) {
          const existing = idemSnap.data() || {};
          if (String(existing.requestFingerprint || '') !== fingerprint) throw new Error('IDEMPOTENCY_CONFLICT');
          return { ...(existing.result || {}), replayed: true };
        }
        if (!planSnap.exists) throw new Error('PLAN_NOT_FOUND');
        if (!walletSnap.exists) throw new Error('WALLET_NOT_FOUND');
        if (!credentialSnap.exists) throw new Error('USER_NOT_FOUND');
        const plan = planSnap.data() || {};
        if (String(plan.customerId || '') !== uid) throw new Error('FORBIDDEN');
        if (String(plan.currency || '') !== 'NGN' || String(plan.status || '') !== 'active') throw new Error('PLAN_NOT_ELIGIBLE');
        if (!verifyPinCredential(credentialSnap.data() || {}, transactionPin)) throw new Error('BAD_PIN');
        const installments = Array.isArray(plan.installments) ? plan.installments : [];
        const index = installmentNumber - 1;
        if (index < 0 || index >= installments.length) throw new Error('INSTALLMENT_NOT_FOUND');
        const installment = installments[index] || {};
        if (Number(installment.installmentNumber) !== installmentNumber) throw new Error('INSTALLMENT_NOT_FOUND');
        if (String(installment.status || '') === 'paid') throw new Error('INSTALLMENT_PAID');
        if (!['pending', 'overdue'].includes(String(installment.status || ''))) throw new Error('INSTALLMENT_NOT_PAYABLE');
        const amount = Number(installment.amountMinor);
        if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error('INVALID_AMOUNT');
        const wallet = walletSnap.data() || {};
        const balance = Number(wallet.availableBalanceMinor);
        if (String(wallet.status || '') !== 'active' || !Number.isSafeInteger(balance) || balance < amount) throw new Error('INSUFFICIENT_FUNDS');
        const now = Timestamp.now();
        const txRef = db.collection('transactions').doc();
        const reference = 'UP-PSS-' + txRef.id;
        const debitRef = db.collection('ledgerEntries').doc();
        const holdRef = db.collection('ledgerEntries').doc();
        transaction.create(txRef, { id: txRef.id, reference, senderId: uid, recipientId: String(plan.planId), amount, currency: 'NGN', type: 'merchant_payment', sourceModule: 'unique_pay_small_small.installment', provider: 'unique_pay_internal_wallet', status: 'completed', relatedOrderIds: [String(plan.orderId)], createdAt: now, updatedAt: now, recordKind: 'financial', schemaVersion: 2, amountUnit: 'minor', installmentNumber });
        transaction.create(debitRef, { id: debitRef.id, transactionId: txRef.id, reference, uid, direction: 'debit', amountMinor: amount, currency: 'NGN', status: 'completed', idempotencyKey, createdAt: now });
        transaction.create(holdRef, { id: holdRef.id, transactionId: txRef.id, reference, uid: String(plan.planId), direction: 'credit', amountMinor: amount, currency: 'NGN', status: 'completed', idempotencyKey, createdAt: now, accountType: 'pay_small_small_hold' });
        const nextInstallments = installments.map((item: any, i: number) => i === index ? { ...item, status: 'paid', paidAt: now, paymentTransactionId: txRef.id } : item);
        const paidAmount = Number(plan.paidAmountMinor || 0) + amount;
        const total = Number(plan.totalAmountMinor);
        const remaining = total - paidAmount;
        if (!Number.isSafeInteger(paidAmount) || paidAmount > total || remaining < 0) throw new Error('INVALID_AMOUNT');
        const completed = remaining === 0 && nextInstallments.every((item: any) => String(item.status || '') === 'paid');
        transaction.update(walletRef, { availableBalanceMinor: balance - amount, updatedAt: now });
        transaction.update(planRef, { installments: nextInstallments, paidAmountMinor: paidAmount, remainingAmountMinor: remaining, status: completed ? 'completed' : 'active', ...(completed ? { completedAt: now } : {}), updatedAt: now });
        transaction.update(db.collection('orders').doc(String(plan.orderId)), { paySmallSmallStatus: completed ? 'completed' : 'active', paymentStatus: completed ? 'paid' : 'partial', status: completed ? 'confirmed' : 'reserved', updatedAt: now, ...(completed ? { paidAt: now } : {}) });
        const paymentResult = { status: completed ? 'completed' : 'active', planId, installmentNumber, transactionId: txRef.id, amountMinor: amount, paidAmountMinor: paidAmount, remainingAmountMinor: remaining, idempotencyKey };
        transaction.create(idemRef, { uid, planId, installmentNumber, transactionId: txRef.id, requestFingerprint: fingerprint, result: paymentResult, createdAt: now });
        transaction.create(db.collection('audit_logs').doc(), { action: completed ? 'pay_small_small.plan_completed' : 'pay_small_small.installment_completed', actorUid: uid, targetUid: uid, resource: 'pay_small_small_plan', resourceId: planId, orderId: String(plan.orderId), transactionId: txRef.id, installmentNumber, amountMinor: amount, currency: 'NGN', idempotencyKey, createdAt: now, timestamp: now });
        return paymentResult;
      });
      return res.status(200).json(result);
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      if (code === 'PLAN_NOT_FOUND') return fail(res, 'NOT_FOUND', 'The Pay Small Small plan was not found.', 404);
      if (code === 'USER_NOT_FOUND') return fail(res, 'UNAUTHENTICATED', 'Your account profile could not be found.', 401);
      if (code === 'WALLET_NOT_FOUND') return fail(res, 'WALLET_NOT_FOUND', 'Your UniquePay wallet is not available.');
      if (code === 'FORBIDDEN') return fail(res, 'FORBIDDEN', 'You are not permitted to fund this plan.', 403);
      if (code === 'BAD_PIN') return fail(res, 'FORBIDDEN', 'Incorrect Transaction PIN.', 403);
      if (code === 'PLAN_NOT_ELIGIBLE' || code === 'INSTALLMENT_NOT_PAYABLE' || code === 'INSTALLMENT_PAID') return fail(res, 'INVALID_REQUEST', 'This installment is not payable.');
      if (code === 'INSTALLMENT_NOT_FOUND') return fail(res, 'NOT_FOUND', 'The requested installment was not found.', 404);
      if (code === 'INSUFFICIENT_FUNDS') return fail(res, 'INSUFFICIENT_FUNDS', 'Insufficient UniquePay wallet balance.');
      if (code === 'INVALID_AMOUNT') return fail(res, 'INVALID_AMOUNT', 'The installment amount is invalid.');
      if (code === 'IDEMPOTENCY_CONFLICT') return fail(res, 'INVALID_REQUEST', 'This payment idempotency key was already used for a different installment.');
      console.error('Pay Small Small installment failed:', error);
      return fail(res, 'SERVICE_UNAVAILABLE', 'The installment could not be completed safely.', 503);
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
