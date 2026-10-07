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
        if (Number(order.totalMinor) !== totalAmountMinor) throw new Error('AMOUNT_MISMATCH');
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
        transaction.create(db.collection('audit_logs').doc(), { action: 'pay_small_small.plan_created', actorUid: uid, targetUid: uid, resource: 'pay_small_pay_small_plan', resourceId: planRef.id, orderId, timestamp: now, createdAt: now });
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
        if (idemSnap.exists) {
          const existing = idemSnap.data() || {};
          const expectedFingerprint = planId + '|deposit';
          if (String(existing.requestFingerprint || '') !== expectedFingerprint) throw new Error('IDEMPOTENCY_CONFLICT');
          return { ...(existing.result || {}), replayed: true };
        }
        if (!planSnap.exists) throw new Error('PLAN_NOT_FOUND');
        if (!credentialSnap.exists) throw new Error('USER_NOT_FOUND');
        if (!walletSnap.exists) throw new Error('WALLET_NOT_FOUND');
        const plan = planSnap.data() || {};
        if (String(plan.customerId || '') !== uid) throw new Error('FORBIDDEN');
        if (String(plan.currency || '') !== 'NGN' || String(plan.status || '') !== 'draft') throw new Error('PLAN_NOT_ELIGIBLE');
        const orderRef = db.collection('orders').doc(String(plan.orderId || ''));
        const orderSnap = await transaction.get(orderRef);
        if (!orderSnap.exists) throw new Error('ORDER_NOT_FOUND');
        const order = orderSnap.data() || {};
        if (String(order.customerId || '') !== uid ||
            String(order.paySmallSmallPlanId || '') !== planId ||
            String(order.currency || '') !== 'NGN' ||
            String(order.paymentStatus || '') !== 'pending' ||
            String(order.status || '') !== 'pending_payment' ||
            Number(order.totalMinor) !== Number(plan.totalAmountMinor)) {
          throw new Error('ORDER_STATE_MISMATCH');
        }
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
        const holdRef = db.collection('ledgerEntries').doc();
        transaction.create(txRef, {
          id: txRef.id, reference, senderId: uid, recipientId: String(plan.planId), amount: deposit,
          currency: 'NGN', type: 'merchant_payment', sourceModule: 'unique_pay_small_small.deposit',
          provider: 'unique_pay_internal_wallet', status: 'completed', relatedOrderIds: [String(plan.orderId)],
          createdAt: now, updatedAt: now, recordKind: 'financial', schemaVersion: 2, amountUnit: 'minor'
        });
        transaction.create(debitRef, {
          id: debitRef.id, transactionId: txRef.id, reference, uid, direction: 'debit',
          amountMinor: deposit, currency: 'NGN', status: 'completed', idempotencyKey, createdAt: now
        });
        transaction.create(holdRef, { id: holdRef.id, transactionId: txRef.id, reference, uid: String(plan.planId), direction: 'credit', amountMinor: deposit, currency: 'NGN', status: 'completed', idempotencyKey, createdAt: now, accountType: 'pay_small_small_hold' });
        transaction.update(walletRef, { availableBalanceMinor: balance - deposit, updatedAt: now });
        transaction.update(planRef, {
          status: 'active', paidAmountMinor: deposit, remainingAmountMinor: Number(plan.totalAmountMinor) - deposit,
          depositTransactionId: txRef.id, activatedAt: now, updatedAt: now
        });
        transaction.update(orderRef, {
          paySmallSmallStatus: 'active', paySmallSmallPlanId: planId, paymentStatus: 'partial', status: 'reserved',
          updatedAt: now
        });
        const result = { status: 'active', planId, transactionId: txRef.id, amountMinor: deposit, idempotencyKey };
        transaction.create(idemRef, { uid, planId, transactionId: txRef.id, requestFingerprint: planId + '|deposit', result, createdAt: now });
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
      if (code === 'ORDER_NOT_FOUND' || code === 'ORDER_STATE_MISMATCH') return fail(res, 'CONFLICT', 'The Store order is no longer eligible for Pay Small Small activation.', 409);
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
        let sellerSettlement: any = null;
        if (completed) {
          const orderRef = db.collection('orders').doc(String(plan.orderId));
          const orderSnap = await transaction.get(orderRef);
          if (!orderSnap.exists) throw new Error('ORDER_NOT_FOUND');
          const order = orderSnap.data() || {};
          if (String(order.paySmallSmallPlanId || '') !== planId ||
              String(order.paySmallSmallStatus || '') !== 'active' ||
              String(order.paymentStatus || '') !== 'partial' ||
              String(order.status || '') !== 'reserved') {
            throw new Error('ORDER_STATE_MISMATCH');
          }
          const sellerId = typeof order.sellerId === 'string' ? order.sellerId : '';
          if (!sellerId || sellerId === uid) throw new Error('INVALID_SELLER');
          if (Number(order.totalMinor) !== total) throw new Error('SETTLEMENT_AMOUNT_MISMATCH');
          const sellerWalletRef = db.collection('wallets').doc(sellerId);
          const sellerWalletSnap = await transaction.get(sellerWalletRef);
          if (!sellerWalletSnap.exists) throw new Error('SELLER_WALLET_NOT_FOUND');
          const sellerWallet = sellerWalletSnap.data() || {};
          const sellerBalance = Number(sellerWallet.availableBalanceMinor);
          if (String(sellerWallet.status || '') !== 'active' || !Number.isSafeInteger(sellerBalance)) throw new Error('SELLER_WALLET_UNAVAILABLE');
          const settlementTxRef = db.collection('transactions').doc();
          const settlementReference = 'UP-PSS-SET-' + settlementTxRef.id;
          const holdDebitRef = db.collection('ledgerEntries').doc();
          const sellerCreditRef = db.collection('ledgerEntries').doc();
          transaction.create(settlementTxRef, { id: settlementTxRef.id, reference: settlementReference, senderId: String(plan.planId), recipientId: sellerId, amount: total, currency: 'NGN', type: 'settlement', sourceModule: 'unique_pay_small_small.settlement', provider: 'unique_pay_internal_wallet', status: 'completed', relatedOrderIds: [String(plan.orderId)], createdAt: now, updatedAt: now, recordKind: 'financial', schemaVersion: 2, amountUnit: 'minor' });
          transaction.create(holdDebitRef, { id: holdDebitRef.id, transactionId: settlementTxRef.id, reference: settlementReference, uid: String(plan.planId), direction: 'debit', amountMinor: total, currency: 'NGN', status: 'completed', createdAt: now, accountType: 'pay_small_small_hold' });
          transaction.create(sellerCreditRef, { id: sellerCreditRef.id, transactionId: settlementTxRef.id, reference: settlementReference, uid: sellerId, direction: 'credit', amountMinor: total, currency: 'NGN', status: 'completed', createdAt: now, accountType: 'seller_settlement' });
          transaction.update(sellerWalletRef, { availableBalanceMinor: sellerBalance + total, updatedAt: now });
          sellerSettlement = { transactionId: settlementTxRef.id, sellerId, amountMinor: total };
        }
        transaction.update(walletRef, { availableBalanceMinor: balance - amount, updatedAt: now });
        transaction.update(planRef, { installments: nextInstallments, paidAmountMinor: paidAmount, remainingAmountMinor: remaining, status: completed ? 'completed' : 'active', ...(completed ? { completedAt: now } : {}), updatedAt: now });
        transaction.update(db.collection('orders').doc(String(plan.orderId)), { paySmallSmallStatus: completed ? 'completed' : 'active', paymentStatus: completed ? 'paid' : 'partial', status: completed ? 'confirmed' : 'reserved', updatedAt: now, ...(completed ? { paidAt: now } : {}) });
        const paymentResult = { status: completed ? 'completed' : 'active', planId, installmentNumber, transactionId: txRef.id, amountMinor: amount, paidAmountMinor: paidAmount, remainingAmountMinor: remaining, ...(sellerSettlement ? { sellerSettlement } : {}), idempotencyKey };
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
      if (code === 'ORDER_NOT_FOUND' || code === 'ORDER_STATE_MISMATCH' || code === 'INVALID_SELLER' || code === 'SETTLEMENT_AMOUNT_MISMATCH' || code === 'SELLER_WALLET_NOT_FOUND' || code === 'SELLER_WALLET_UNAVAILABLE') return fail(res, 'SERVICE_UNAVAILABLE', 'Seller settlement could not be completed safely. Your installment was not charged.', 503);
      if (code === 'INSUFFICIENT_FUNDS') return fail(res, 'INSUFFICIENT_FUNDS', 'Insufficient UniquePay wallet balance.');
      if (code === 'INVALID_AMOUNT') return fail(res, 'INVALID_AMOUNT', 'The installment amount is invalid.');
      if (code === 'IDEMPOTENCY_CONFLICT') return fail(res, 'INVALID_REQUEST', 'This payment idempotency key was already used for a different installment.');
      console.error('Pay Small Small installment failed:', error);
      return fail(res, 'SERVICE_UNAVAILABLE', 'The installment could not be completed safely.', 503);
    }
  });

  app.post('/api/pay-small-small/system/sync', async (req, res) => {
    const token = typeof req.header('x-pay-small-small-cron-token') === 'string' ? req.header('x-pay-small-small-cron-token') : '';
    if (!process.env.PAY_SMALL_SMALL_CRON_TOKEN || token !== process.env.PAY_SMALL_SMALL_CRON_TOKEN) return fail(res, 'FORBIDDEN', 'Forbidden.', 403);
    try {
      const now = Timestamp.now();
      const graceMs = 3 * 24 * 60 * 60 * 1000;
      const cancelMs = 7 * 24 * 60 * 60 * 1000;
      const pageSize = 100;
      let lastDoc: any = null;
      let scanned = 0, overdue = 0, grace = 0, cancelled = 0, reminded = 0;
      while (true) {
        let query = db.collection('paySmallSmallPlans').where('status', '==', 'active').orderBy('__name__').limit(pageSize);
        if (lastDoc) query = query.startAfter(lastDoc);
        const snap = await query.get();
        if (snap.empty) break;
        lastDoc = snap.docs[snap.docs.length - 1];
        for (const doc of snap.docs) {
          scanned++;
          await db.runTransaction(async (transaction) => {
            const ref = doc.ref;
            const current = await transaction.get(ref);
            if (!current.exists) return;
            const plan = current.data() || {};
            if (String(plan.status || '') !== 'active') return;
            const installments = Array.isArray(plan.installments) ? plan.installments : [];
            let changed = false;
            const next = installments.map((item: any) => {
              if (String(item.status || '') === 'pending' && item.dueAt && typeof item.dueAt.toMillis === 'function' && item.dueAt.toMillis() <= now.toMillis()) {
                overdue++;
                changed = true;
                return { ...item, status: 'overdue', overdueAt: now };
              }
              return item;
            });
            const oldestOverdue = next.filter((x: any) => String(x.status || '') === 'overdue' && x.overdueAt && typeof x.overdueAt.toMillis === 'function').sort((a: any, b: any) => a.overdueAt.toMillis() - b.overdueAt.toMillis())[0];
            const oldestMs = oldestOverdue?.overdueAt?.toMillis?.() || 0;
            const age = oldestMs ? now.toMillis() - oldestMs : 0;
            const update: any = { updatedAt: now };
            if (changed) update.installments = next;
            if (oldestMs && age >= graceMs && age < cancelMs && String(plan.missedPaymentState || '') !== 'grace') {
              update.missedPaymentState = 'grace';
              update.graceStartedAt = now;
              grace++;
            }
            if (oldestMs && age >= cancelMs) {
              const customerId = String(plan.customerId || '');
              const walletRef = db.collection('wallets').doc(customerId);
              const walletSnap = await transaction.get(walletRef);
              if (!walletSnap.exists) throw new Error('WALLET_NOT_FOUND');
              const wallet = walletSnap.data() || {};
              const balance = Number(wallet.availableBalanceMinor);
              if (!Number.isSafeInteger(balance) || String(wallet.status || '') !== 'active') throw new Error('WALLET_UNAVAILABLE');
              const orderRef = db.collection('orders').doc(String(plan.orderId));
              const orderSnap = await transaction.get(orderRef);
              if (!orderSnap.exists) throw new Error('ORDER_NOT_FOUND');
              const order = orderSnap.data() || {};
              if (String(order.paySmallSmallPlanId || '') !== String(plan.planId) ||
                  String(order.paySmallSmallStatus || '') !== 'active' ||
                  String(order.paymentStatus || '') !== 'partial' ||
                  String(order.status || '') !== 'reserved') {
                throw new Error('ORDER_STATE_MISMATCH');
              }
              const refundAmount = Number(plan.paidAmountMinor || 0);
              if (!Number.isSafeInteger(refundAmount) || refundAmount < 0) throw new Error('INVALID_REFUND');
              const holdLedgerSnap = await transaction.get(db.collection('ledgerEntries')
                .where('uid', '==', String(plan.planId))
                .where('accountType', '==', 'pay_small_small_hold'));
              let holdBalance = 0;
              for (const holdDoc of holdLedgerSnap.docs) {
                const holdEntry = holdDoc.data() || {};
                const holdAmount = Number(holdEntry.amountMinor);
                if (!Number.isSafeInteger(holdAmount) || holdAmount < 0) throw new Error('HOLD_LEDGER_INVALID');
                if (String(holdEntry.status || '') !== 'completed') continue;
                if (String(holdEntry.direction || '') === 'credit') holdBalance += holdAmount;
                else if (String(holdEntry.direction || '') === 'debit') holdBalance -= holdAmount;
              }
              if (!Number.isSafeInteger(holdBalance) || holdBalance < refundAmount) throw new Error('HOLD_BALANCE_MISMATCH');
              if (refundAmount > 0) {
                const refundTx = db.collection('transactions').doc();
                const refundRef = 'UP-PSS-REF-' + refundTx.id;
                const holdDebit = db.collection('ledgerEntries').doc();
                const customerCredit = db.collection('ledgerEntries').doc();
                transaction.create(refundTx, { id: refundTx.id, reference: refundRef, senderId: String(plan.planId), recipientId: customerId, amount: refundAmount, currency: 'NGN', type: 'refund', sourceModule: 'unique_pay_small_small.cancellation_refund', provider: 'unique_pay_internal_wallet', status: 'completed', relatedOrderIds: [String(plan.orderId)], createdAt: now, updatedAt: now, recordKind: 'financial', schemaVersion: 2, amountUnit: 'minor' });
                transaction.create(holdDebit, { id: holdDebit.id, transactionId: refundTx.id, reference: refundRef, uid: String(plan.planId), direction: 'debit', amountMinor: refundAmount, currency: 'NGN', status: 'completed', createdAt: now, accountType: 'pay_small_small_hold' });
                transaction.create(customerCredit, { id: customerCredit.id, transactionId: refundTx.id, reference: refundRef, uid: customerId, direction: 'credit', amountMinor: refundAmount, currency: 'NGN', status: 'completed', createdAt: now, accountType: 'wallet_refund' });
                transaction.update(walletRef, { availableBalanceMinor: balance + refundAmount, updatedAt: now });
                update.cancellationRefundTransactionId = refundTx.id;
              }
              update.status = 'cancelled';
              update.missedPaymentState = 'cancelled';
              update.cancelledAt = now;
              update.cancelReason = 'missed_payment';
              update.paidAmountMinor = 0;
              update.remainingAmountMinor = Number(plan.totalAmountMinor || 0);
              transaction.update(orderRef, { paySmallSmallStatus: 'cancelled', paymentStatus: 'refunded', status: 'cancelled', updatedAt: now });
              transaction.create(db.collection('audit_logs').doc(), { action: 'pay_small_small.cancelled_for_missed_payment', actorUid: 'system', targetUid: customerId, resource: 'pay_small_pay_small_plan', resourceId: String(plan.planId), orderId: String(plan.orderId), refundAmountMinor: refundAmount, createdAt: now, timestamp: now });
              cancelled++;
            } else if (oldestMs && age >= graceMs) {
              const notificationRef = db.collection('notifications').doc('pss_overdue_' + String(plan.planId) + '_' + String(oldestMs));
              const notificationSnap = await transaction.get(notificationRef);
              if (!notificationSnap.exists) {
                transaction.create(notificationRef, { uid: String(plan.customerId), type: 'pay_small_small.payment_overdue', title: 'Pay Small Small payment overdue', message: 'Your installment is overdue. Please make the payment during the grace period to keep your plan active.', planId: String(plan.planId), createdAt: now, read: false });
                reminded++;
              }
            } else if (changed) {
              const notificationRef = db.collection('notifications').doc('pss_due_' + String(plan.planId) + '_' + String(now.toMillis()));
              const notificationSnap = await transaction.get(notificationRef);
              if (!notificationSnap.exists) {
                transaction.create(notificationRef, { uid: String(plan.customerId), type: 'pay_small_small.payment_due', title: 'Pay Small Small payment due', message: 'An installment on your Pay Small Small plan is now due.', planId: String(plan.planId), createdAt: now, read: false });
                reminded++;
              }
            }
            if (Object.keys(update).length > 1) transaction.update(ref, update);
          });
        }
        if (snap.size < pageSize) break;
      }
      return res.json({ ok: true, scanned, overdue, grace, cancelled, reminded });
    } catch (error) {
      console.error('Pay Small Small system sync failed:', error);
      return fail(res, 'SERVICE_UNAVAILABLE', 'Pay Small Small scheduled processing failed safely.', 503);
    }
  });

  app.get('/api/pay-small-small/system/reconcile', async (req, res) => {
    const token = typeof req.header('x-pay-small-small-cron-token') === 'string' ? req.header('x-pay-small-small-cron-token') : '';
    if (!process.env.PAY_SMALL_SMALL_CRON_TOKEN || token !== process.env.PAY_SMALL_SMALL_CRON_TOKEN) return fail(res, 'FORBIDDEN', 'Forbidden.', 403);
    try {
      const [plansSnap, ordersSnap, depositTxSnap, installmentTxSnap, settlementTxSnap, refundTxSnap, holdSnap, sellerCreditSnap, customerRefundSnap, walletsSnap, allLedgerSnap] = await Promise.all([
        db.collection('paySmallSmallPlans').get(),
        db.collection('orders').get(),
        db.collection('transactions').where('sourceModule', '==', 'unique_pay_small_small.deposit').get(),
        db.collection('transactions').where('sourceModule', '==', 'unique_pay_small_small.installment').get(),
        db.collection('transactions').where('sourceModule', '==', 'unique_pay_small_small.settlement').get(),
        db.collection('transactions').where('sourceModule', '==', 'unique_pay_small_small.cancellation_refund').get(),
        db.collection('ledgerEntries').where('accountType', '==', 'pay_small_small_hold').get(),
        db.collection('ledgerEntries').where('accountType', '==', 'seller_settlement').get(),
        db.collection('ledgerEntries').where('accountType', '==', 'wallet_refund').get(),
        db.collection('wallets').get(),
        db.collection('ledgerEntries').get()
      ]);

      type Finding = { code: string; severity: 'critical' | 'high' | 'medium'; planId?: string; transactionId?: string; amountMinor?: number; detail: string };
      const findings: Finding[] = [];
      const addFinding = (finding: Finding) => findings.push(finding);

      const walletLedgerNet = new Map<string, number>();
      for (const doc of allLedgerSnap.docs) {
        const entry = doc.data() || {};
        const accountType = String(entry.accountType || '');
        const uid = String(entry.uid || '');
        if (!uid || accountType === 'pay_small_small_hold') continue;
        const amount = Number(entry.amountMinor);
        if (!Number.isSafeInteger(amount) || amount <= 0) {
          addFinding({ code: 'INVALID_WALLET_LEDGER_AMOUNT', severity: 'critical', detail: 'A wallet ledger entry has an invalid positive integer amount.' });
          continue;
        }
        const direction = String(entry.direction || '');
        const delta = direction === 'credit' ? amount : direction === 'debit' ? -amount : 0;
        if (delta === 0) {
          addFinding({ code: 'INVALID_WALLET_LEDGER_DIRECTION', severity: 'critical', transactionId: String(entry.transactionId || ''), amountMinor: amount, detail: 'A wallet ledger entry has an invalid direction.' });
          continue;
        }
        walletLedgerNet.set(uid, (walletLedgerNet.get(uid) || 0) + delta);
      }
      for (const doc of walletsSnap.docs) {
        const wallet = doc.data() || {};
        const uid = String(wallet.uid || doc.id);
        const balance = Number(wallet.availableBalanceMinor);
        const ledgerNet = walletLedgerNet.get(uid) || 0;
        if (!Number.isSafeInteger(balance) || balance < 0 || !Number.isSafeInteger(ledgerNet)) {
          addFinding({ code: 'WALLET_BALANCE_INVALID', severity: 'critical', detail: 'A wallet contains an invalid balance or its ledger net is outside the safe integer range.' });
          continue;
        }
        if (balance !== ledgerNet) {
          addFinding({ code: 'WALLET_LEDGER_BALANCE_MISMATCH', severity: 'critical', amountMinor: balance - ledgerNet, detail: 'Wallet availableBalanceMinor does not equal the net of its wallet ledger credits and debits.' });
        }
      }
      const planMap = new Map<string, any>();
      const orderMap = new Map<string, string>();
      const orderDocs = new Map<string, any>();
      for (const doc of ordersSnap.docs) orderDocs.set(doc.id, doc.data() || {});
      for (const doc of plansSnap.docs) {
        const plan = doc.data() || {};
        const planId = String(plan.planId || doc.id);
        planMap.set(planId, plan);
        orderMap.set(String(plan.orderId || ''), planId);
      }

      const txDocs = [...depositTxSnap.docs, ...installmentTxSnap.docs, ...settlementTxSnap.docs, ...refundTxSnap.docs];
      const txMap = new Map<string, any>();
      for (const doc of txDocs) {
        const tx = doc.data() || {};
        const txId = String(tx.id || doc.id);
        if (txMap.has(txId)) {
          addFinding({ code: 'DUPLICATE_TRANSACTION_ID', severity: 'critical', transactionId: txId, detail: 'The same transaction ID appears in multiple Pay Small Small transaction streams.' });
        }
        txMap.set(txId, tx);
      }

      const ledgerByTx = new Map<string, any[]>();
      const allLedgerDocs = [...holdSnap.docs, ...sellerCreditSnap.docs, ...customerRefundSnap.docs];
      for (const doc of allLedgerDocs) {
        const entry = doc.data() || {};
        const txId = String(entry.transactionId || '');
        if (!txId) {
          addFinding({ code: 'ORPHAN_LEDGER_ENTRY', severity: 'high', detail: 'Pay Small Small ledger entry has no transactionId.' });
          continue;
        }
        const list = ledgerByTx.get(txId) || [];
        list.push(entry);
        ledgerByTx.set(txId, list);
      }

      const fundingByPlan = new Map<string, number>();
      const settlementByPlan = new Map<string, number>();
      const refundByPlan = new Map<string, number>();
      const installmentTxByPlan = new Map<string, Set<string>>();
      const settlementTxByPlan = new Map<string, Set<string>>();
      const refundTxByPlan = new Map<string, Set<string>>();

      const expectedLedgerCount = new Map<string, number>();
      for (const [txId, tx] of txMap) {
        const module = String(tx.sourceModule || '');
        const planId = String(tx.recipientId || tx.senderId || '');
        const amount = Number(tx.amount);
        if (!PLAN_ID.test(planId) || !planMap.has(planId)) {
          addFinding({ code: 'ORPHAN_TRANSACTION', severity: 'critical', transactionId: txId, amountMinor: Number.isSafeInteger(amount) ? amount : undefined, detail: 'Pay Small Small transaction references a plan that does not exist.' });
          continue;
        }
        if (!Number.isSafeInteger(amount) || amount <= 0) {
          addFinding({ code: 'INVALID_TRANSACTION_AMOUNT', severity: 'critical', planId, transactionId: txId, detail: 'Pay Small Small transaction has an invalid amount.' });
          continue;
        }
        const ledgers = ledgerByTx.get(txId) || [];
        const plan = planMap.get(planId) || {};
        const customerId = String(plan.customerId || '');
        const orderId = String(plan.orderId || '');
        const order = orderDocs.get(orderId);
        if (!order) {
          addFinding({ code: 'PLAN_ORDER_NOT_FOUND', severity: 'critical', planId, transactionId: txId, detail: 'Pay Small Small plan references a Store order that does not exist.' });
        } else {
          if (String(order.customerId || '') !== customerId) {
            addFinding({ code: 'PLAN_ORDER_CUSTOMER_MISMATCH', severity: 'critical', planId, transactionId: txId, detail: 'Plan customer does not match the Store order customer.' });
          }
          if (String(order.paySmallSmallPlanId || '') !== planId) {
            addFinding({ code: 'PLAN_ORDER_LINK_MISMATCH', severity: 'critical', planId, transactionId: txId, detail: 'Store order does not point back to the Pay Small Small plan.' });
          }
          if (String(order.currency || '') !== 'NGN' || Number(order.totalMinor) !== Number(plan.totalAmountMinor)) {
            addFinding({ code: 'PLAN_ORDER_AMOUNT_CURRENCY_MISMATCH', severity: 'critical', planId, transactionId: txId, detail: 'Plan and Store order currency/total do not match.' });
          }
        }
        if (String(tx.currency || '') !== 'NGN' || String(tx.status || '') !== 'completed' ||
            String(tx.recordKind || '') !== 'financial' || Number(tx.schemaVersion) !== 2 ||
            String(tx.amountUnit || '') !== 'minor' || String(tx.provider || '') !== 'unique_pay_internal_wallet') {
          addFinding({ code: 'NON_CANONICAL_PSS_TRANSACTION', severity: 'critical', planId, transactionId: txId, amountMinor: amount, detail: 'Pay Small Small transaction is missing required canonical financial metadata.' });
        }
        const expectedFlow = module === 'unique_pay_small_small.deposit' || module === 'unique_pay_small_small.installment'
          ? { senderId: customerId, recipientId: planId, debitUid: customerId, debitAccountType: '', creditUid: planId, creditAccountType: 'pay_small_small_hold' }
          : module === 'unique_pay_small_small.settlement'
            ? { senderId: planId, recipientId: String(tx.recipientId || ''), debitUid: planId, debitAccountType: 'pay_small_small_hold', creditUid: String(tx.recipientId || ''), creditAccountType: 'seller_settlement' }
            : module === 'unique_pay_small_small.cancellation_refund'
              ? { senderId: planId, recipientId: customerId, debitUid: planId, debitAccountType: 'pay_small_small_hold', creditUid: customerId, creditAccountType: 'wallet_refund' }
              : null;
        if (expectedFlow) {
          if (String(tx.senderId || '') !== expectedFlow.senderId || String(tx.recipientId || '') !== expectedFlow.recipientId) {
            addFinding({ code: 'TRANSACTION_PARTY_SEMANTICS_MISMATCH', severity: 'critical', planId, transactionId: txId, amountMinor: amount, detail: 'Pay Small Small transaction sender/recipient does not match the required flow for its module.' });
          }
          const debitEntry = ledgers.find(x => String(x.direction || '') === 'debit');
          const creditEntry = ledgers.find(x => String(x.direction || '') === 'credit');
          if (debitEntry && (String(debitEntry.uid || '') !== expectedFlow.debitUid || String(debitEntry.accountType || '') !== expectedFlow.debitAccountType)) {
            addFinding({ code: 'DEBIT_LEDGER_SEMANTICS_MISMATCH', severity: 'critical', planId, transactionId: txId, amountMinor: amount, detail: 'Pay Small Small debit ledger points to the wrong account or account type.' });
          }
          if (creditEntry && (String(creditEntry.uid || '') !== expectedFlow.creditUid || String(creditEntry.accountType || '') !== expectedFlow.creditAccountType)) {
            addFinding({ code: 'CREDIT_LEDGER_SEMANTICS_MISMATCH', severity: 'critical', planId, transactionId: txId, amountMinor: amount, detail: 'Pay Small Small credit ledger points to the wrong account or account type.' });
          }
        }
        const required = module === 'unique_pay_small_small.deposit' || module === 'unique_pay_small_small.installment' || module === 'unique_pay_small_small.settlement' || module === 'unique_pay_small_small.cancellation_refund' ? 2 : 0;
        expectedLedgerCount.set(txId, required);
        if (ledgers.length !== required) {
          addFinding({ code: 'LEDGER_TRANSACTION_MISMATCH', severity: 'critical', planId, transactionId: txId, amountMinor: amount, detail: 'Expected exactly two balanced ledger entries for this Pay Small Small transaction.' });
        }
        const debitEntries = ledgers.filter(x => String(x.direction || '') === 'debit');
        const creditEntries = ledgers.filter(x => String(x.direction || '') === 'credit');
        const debit = debitEntries.reduce((s, x) => s + Number(x.amountMinor || 0), 0);
        const credit = creditEntries.reduce((s, x) => s + Number(x.amountMinor || 0), 0);
        if (debit !== amount || credit !== amount) {
          addFinding({ code: 'LEDGER_AMOUNT_IMBALANCE', severity: 'critical', planId, transactionId: txId, amountMinor: amount, detail: 'Ledger debit/credit does not balance to the transaction amount.' });
        }
        if (debitEntries.length !== 1 || creditEntries.length !== 1) {
          addFinding({ code: 'LEDGER_DIRECTION_STRUCTURE_MISMATCH', severity: 'critical', planId, transactionId: txId, amountMinor: amount, detail: 'Pay Small Small transaction must have exactly one debit and one credit ledger entry.' });
        }
        for (const entry of ledgers) {
          const entryAmount = Number(entry.amountMinor);
          if (!Number.isSafeInteger(entryAmount) || entryAmount !== amount) {
            addFinding({ code: 'LEDGER_ENTRY_AMOUNT_MISMATCH', severity: 'critical', planId, transactionId: txId, amountMinor: amount, detail: 'A ledger entry amount does not exactly match its financial transaction.' });
          }
          if (String(entry.transactionId || '') !== txId || String(entry.reference || '') !== String(tx.reference || '') || String(entry.currency || '') !== String(tx.currency || 'NGN') || String(entry.status || '') !== 'completed') {
            addFinding({ code: 'LEDGER_TRANSACTION_IDENTITY_MISMATCH', severity: 'critical', planId, transactionId: txId, amountMinor: amount, detail: 'A ledger entry identity does not match its financial transaction.' });
          }
        }
        if (module === 'unique_pay_small_small.deposit' || module === 'unique_pay_small_small.installment') {
          const fundingPlanId = String(tx.recipientId || '');
          fundingByPlan.set(fundingPlanId, (fundingByPlan.get(fundingPlanId) || 0) + amount);
          if (module === 'unique_pay_small_small.installment') {
            const set = installmentTxByPlan.get(fundingPlanId) || new Set<string>();
            set.add(txId);
            installmentTxByPlan.set(fundingPlanId, set);
          }
        } else if (module === 'unique_pay_small_small.settlement') {
          const settlementPlanId = String(tx.senderId || '');
          settlementByPlan.set(settlementPlanId, (settlementByPlan.get(settlementPlanId) || 0) + amount);
          const set = settlementTxByPlan.get(settlementPlanId) || new Set<string>();
          set.add(txId);
          settlementTxByPlan.set(settlementPlanId, set);
        } else if (module === 'unique_pay_small_small.cancellation_refund') {
          const refundPlanId = String(tx.senderId || '');
          refundByPlan.set(refundPlanId, (refundByPlan.get(refundPlanId) || 0) + amount);
          const set = refundTxByPlan.get(refundPlanId) || new Set<string>();
          set.add(txId);
          refundTxByPlan.set(refundPlanId, set);
        }
      }

      for (const [txId] of ledgerByTx) {
        if (!txMap.has(txId)) addFinding({ code: 'ORPHAN_LEDGER_TRANSACTION', severity: 'critical', transactionId: txId, detail: 'Pay Small Small ledger entry references a transaction that is not a Pay Small Small transaction.' });
      }

      for (const [planId, plan] of planMap) {
        const total = Number(plan.totalAmountMinor);
        const paid = Number(plan.paidAmountMinor || 0);
        const remaining = Number(plan.remainingAmountMinor);
        const funding = fundingByPlan.get(planId) || 0;
        const settlement = settlementByPlan.get(planId) || 0;
        const refund = refundByPlan.get(planId) || 0;
        const installmentPaid = Array.isArray(plan.installments) ? plan.installments.filter((x: any) => String(x.status || '') === 'paid').reduce((s: number, x: any) => s + Number(x.amountMinor || 0), 0) : 0;
        const installments = Array.isArray(plan.installments) ? plan.installments : [];
        const installmentNumbers = new Set<number>();
        let scheduleTotal = 0;
        let paidInstallmentCount = 0;
        for (const installment of installments) {
          const numberValue = Number(installment?.installmentNumber);
          const amountValue = Number(installment?.amountMinor);
          const installmentStatus = String(installment?.status || '');
          const dueAtMs = typeof installment?.dueAt?.toMillis === 'function' ? installment.dueAt.toMillis() : NaN;
          if (!Number.isInteger(numberValue) || numberValue < 1 || installmentNumbers.has(numberValue)) {
            addFinding({ code: 'INVALID_INSTALLMENT_NUMBER', severity: 'critical', planId, detail: 'Installment schedule contains a missing, invalid, or duplicate installment number.' });
          } else {
            installmentNumbers.add(numberValue);
          }
          if (!Number.isSafeInteger(amountValue) || amountValue <= 0 || !['pending', 'paid'].includes(installmentStatus)) {
            addFinding({ code: 'INVALID_INSTALLMENT_RECORD', severity: 'critical', planId, detail: 'Installment schedule contains an invalid amount or status.' });
          } else {
            scheduleTotal += amountValue;
            if (installmentStatus === 'paid') paidInstallmentCount++;
          }
          if (!Number.isFinite(dueAtMs)) {
            addFinding({ code: 'INVALID_INSTALLMENT_DUE_DATE', severity: 'critical', planId, detail: 'Installment schedule contains an invalid due date.' });
          }
        }
        if (installments.length !== Number(plan.installmentCount)) {
          addFinding({ code: 'INSTALLMENT_COUNT_MISMATCH', severity: 'critical', planId, detail: 'Stored installment schedule length does not equal installmentCount.' });
        }
        if (scheduleTotal !== Math.max(total - Number(plan.depositAmountMinor || 0), 0)) {
          addFinding({ code: 'INSTALLMENT_SCHEDULE_TOTAL_MISMATCH', severity: 'critical', planId, amountMinor: scheduleTotal, detail: 'Installment schedule total does not equal the amount remaining after the deposit.' });
        }
        if (installments.some((x: any) => String(x.status || '') === 'paid') && paidInstallmentCount !== installmentTxByPlan.get(planId)?.size) {
          addFinding({ code: 'INSTALLMENT_PAYMENT_COUNT_MISMATCH', severity: 'critical', planId, detail: 'Paid installment records do not match the number of installment financial transactions.' });
        }
        const expectedPaid = funding;
        const status = String(plan.status || '');
        const order = orderDocs.get(String(plan.orderId || ''));
        const orderPaymentStatus = String(order?.paymentStatus || '');
        const orderStatus = String(order?.status || '');
        const orderPssStatus = String(order?.paySmallSmallStatus || '');
        const validStatuses = new Set(['draft', 'active', 'completed', 'cancelled']);
        if (!validStatuses.has(status)) {
          addFinding({ code: 'INVALID_PLAN_STATUS', severity: 'critical', planId, detail: 'Pay Small Small plan has an unsupported lifecycle status.' });
        }
        if (status === 'draft' && (paid !== 0 || remaining !== total || settlement !== 0 || refund !== 0 || orderPssStatus !== 'draft')) {
          addFinding({ code: 'DRAFT_STATE_MISMATCH', severity: 'critical', planId, detail: 'Draft plan/order state is inconsistent with an unfunded plan.' });
        }
        if (status === 'active' && (paid <= 0 || paid >= total || remaining <= 0 || orderPssStatus !== 'active' || orderPaymentStatus !== 'partial' || orderStatus !== 'reserved')) {
          addFinding({ code: 'ACTIVE_STATE_MISMATCH', severity: 'critical', planId, detail: 'Active Pay Small Small plan is not synchronized with its required partially-paid reserved Store order state.' });
        }
        if (status === 'completed' && (paid !== total || remaining !== 0 || orderPssStatus !== 'completed' || orderPaymentStatus !== 'paid' || orderStatus !== 'confirmed')) {
          addFinding({ code: 'COMPLETED_STATE_MISMATCH', severity: 'critical', planId, detail: 'Completed Pay Small Small plan is not synchronized with a fully paid confirmed Store order.' });
        }
        if (status === 'cancelled' && (paid !== 0 || remaining !== total || orderPssStatus !== 'cancelled' || orderPaymentStatus !== 'refunded' || orderStatus !== 'cancelled')) {
          addFinding({ code: 'CANCELLED_STATE_MISMATCH', severity: 'critical', planId, detail: 'Cancelled Pay Small Small plan is not synchronized with a refunded cancelled Store order.' });
        }
        if (status === 'completed' && order) {
          const sellerId = String(order.sellerId || '');
          const settlementTxIds = settlementTxByPlan.get(planId) || new Set<string>();
          for (const settlementTxId of settlementTxIds) {
            const settlementTx = txMap.get(settlementTxId) || {};
            if (String(settlementTx.recipientId || '') !== sellerId) {
              addFinding({ code: 'SETTLEMENT_SELLER_MISMATCH', severity: 'critical', planId, transactionId: settlementTxId, detail: 'Final settlement recipient does not match the Store order seller.' });
            }
          }
        }
        if (!Number.isSafeInteger(total) || total <= 0 || !Number.isSafeInteger(paid) || !Number.isSafeInteger(remaining)) {
          addFinding({ code: 'PLAN_AMOUNT_INVALID', severity: 'critical', planId, detail: 'Plan contains invalid monetary totals.' });
          continue;
        }
        if (plan.status === 'draft' && funding !== 0) addFinding({ code: 'DRAFT_FUNDED', severity: 'high', planId, amountMinor: funding, detail: 'Draft plan has Pay Small Small funding transactions.' });
        if (plan.status === 'active' && paid !== expectedPaid) addFinding({ code: 'PLAN_PAID_AMOUNT_MISMATCH', severity: 'critical', planId, amountMinor: paid, detail: 'Plan paidAmountMinor does not equal the sum of deposit and installment funding.' });
        if (plan.status === 'completed' && (paid !== total || settlement !== total)) addFinding({ code: 'COMPLETED_PLAN_SETTLEMENT_MISMATCH', severity: 'critical', planId, amountMinor: settlement, detail: 'Completed plan does not have exactly one full settlement equal to the plan total.' });
        if (plan.status === 'cancelled' && refund > funding) addFinding({ code: 'OVER_REFUND', severity: 'critical', planId, amountMinor: refund, detail: 'Cancellation refunds exceed total customer funding.' });
        if (plan.status === 'cancelled' && paid !== 0) addFinding({ code: 'CANCELLED_PAID_BALANCE', severity: 'high', planId, amountMinor: paid, detail: 'Cancelled plan still reports a non-zero paidAmountMinor after refund processing.' });
        if (remaining !== Math.max(total - paid, 0)) addFinding({ code: 'PLAN_REMAINING_MISMATCH', severity: 'critical', planId, amountMinor: remaining, detail: 'Plan remainingAmountMinor does not equal totalAmountMinor minus paidAmountMinor.' });
        if (installmentPaid !== Math.max(paid - Number(plan.depositAmountMinor || 0), 0) && ['active', 'completed'].includes(String(plan.status || ''))) {
          addFinding({ code: 'INSTALLMENT_TOTAL_MISMATCH', severity: 'high', planId, amountMinor: installmentPaid, detail: 'Paid installment amounts do not reconcile to plan paid amount after deposit.' });
        }
        if (settlement > 0 && settlementTxByPlan.get(planId)?.size !== 1) addFinding({ code: 'DUPLICATE_SETTLEMENT', severity: 'critical', planId, amountMinor: settlement, detail: 'More than one settlement transaction exists for this plan.' });
        if (refund > 0 && refundTxByPlan.get(planId)?.size !== 1) addFinding({ code: 'DUPLICATE_REFUND', severity: 'critical', planId, amountMinor: refund, detail: 'More than one cancellation refund transaction exists for this plan.' });
        if (settlement > funding) addFinding({ code: 'SETTLEMENT_EXCEEDS_FUNDING', severity: 'critical', planId, amountMinor: settlement, detail: 'Seller settlement exceeds customer funding.' });
        if (refund > funding) addFinding({ code: 'REFUND_EXCEEDS_FUNDING', severity: 'critical', planId, amountMinor: refund, detail: 'Customer refunds exceed customer funding.' });
        const expectedHold = funding - settlement - refund;
        const actualHold = allLedgerDocs
          .filter(x => {
            const data = x.data();
            return String(data.uid || '') === planId && String(data.accountType || '') === 'pay_small_small_hold';
          })
          .reduce((s, x) => {
            const data = x.data();
            return s + (String(data.direction || '') === 'credit' ? Number(data.amountMinor || 0) : -Number(data.amountMinor || 0));
          }, 0);
        if (actualHold !== expectedHold) addFinding({ code: 'HOLD_BALANCE_MISMATCH', severity: 'critical', planId, amountMinor: actualHold, detail: 'Pay Small Small hold ledger balance does not reconcile to funding minus settlements and refunds.' });
      }

      return res.json({
        ok: findings.length === 0,
        readOnly: true,
        checkedAt: Timestamp.now(),
        counts: {
          plans: plansSnap.size,
          transactions: txDocs.length,
          ledgerEntries: allLedgerDocs.length,
          findings: findings.length,
          critical: findings.filter(x => x.severity === 'critical').length,
          high: findings.filter(x => x.severity === 'high').length,
          medium: findings.filter(x => x.severity === 'medium').length
        },
        findings: findings.slice(0, 500),
        truncatedFindings: findings.length > 500
      });
    } catch (error) {
      console.error('Pay Small Small reconciliation failed:', error);
      return fail(res, 'SERVICE_UNAVAILABLE', 'Pay Small Small reconciliation could not be completed safely.', 503);
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
