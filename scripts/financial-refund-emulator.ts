import assert from 'node:assert/strict';
import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { executeFinancialRefund } from '../src/server/financialRefundService';

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error('Refusing to run refund integration tests without FIRESTORE_EMULATOR_HOST.');
}

const app = initializeApp({ projectId: 'demo-uniqueplatform-refunds' }, 'financial-refund-emulator-test');
const db = getFirestore(app);
const prefix = 'refund-emulator-' + process.pid;
const touched: Array<{ collection: string; id: string }> = [];
const track = (collection: string, id: string) => { touched.push({ collection, id }); return db.collection(collection).doc(id); };

async function seedScenario(label: string, sellerBalance: number, amountMinor = 1000) {
  const customerUid = prefix + '-customer-' + label;
  const sellerUid = prefix + '-seller-' + label;
  const originalId = prefix + '-original-' + label;
  const orderId = prefix + '-order-' + label;
  const productId = prefix + '-product-' + label;
  const customerWallet = track('wallets', customerUid);
  const sellerWallet = track('wallets', sellerUid);
  const original = track('transactions', originalId);
  const order = track('orders', orderId);
  const product = track('products', productId);
  await Promise.all([
    customerWallet.set({ uid: customerUid, currency: 'NGN', status: 'active', availableBalanceMinor: 200 }),
    sellerWallet.set({ uid: sellerUid, currency: 'NGN', status: 'active', availableBalanceMinor: sellerBalance }),
    original.set({
      id: originalId, senderId: customerUid, recipientId: sellerUid, amount: amountMinor,
      currency: 'NGN', type: 'payment', status: 'completed', recordKind: 'financial',
      schemaVersion: 2, amountUnit: 'minor', sourceModule: 'unique_store.checkout',
      relatedOrderIds: [orderId],
    }),
    order.set({
      customerId: customerUid, sellerId: sellerUid, currency: 'NGN',
      paymentStatus: 'paid', status: 'confirmed', amountMinor,
      items: [{ productId, quantity: 3 }],
    }),
    product.set({ sellerId: sellerUid, quantity: 0, status: 'out_of_stock' }),
  ]);
  return { customerUid, sellerUid, originalId, orderId, productId, customerWallet, sellerWallet, original, order, product };
}

function refundInput(s: Awaited<ReturnType<typeof seedScenario>>, key: string, amountMinor = 1000) {
  return {
    originalTransactionId: s.originalId,
    amountMinor,
    currency: 'NGN' as const,
    idempotencyKey: key,
    actorUid: s.customerUid,
    reason: 'Emulator integration test',
    relatedOrderId: s.orderId,
    sourceModule: 'unique_store.refund',
    finalizeOrder: 'full' as const,
    releaseInventory: true,
  };
}

try {
  // Failed refund must not commit queued stock changes or any financial writes.
  const failed = await seedScenario('insufficient', 0);
  const failedResult = await executeFinancialRefund(db, refundInput(failed, prefix + '-failed-key'));
  assert.ok('error' in failedResult, 'refund without seller funds must fail');
  if ('error' in failedResult) assert.equal(failedResult.error.code, 'INSUFFICIENT_FUNDS');
  assert.equal((await failed.product.get()).data()?.quantity, 0, 'failed refund must not restore stock');
  assert.equal((await failed.order.get()).data()?.status, 'confirmed', 'failed refund must not change order status');
  assert.equal((await failed.sellerWallet.get()).data()?.availableBalanceMinor, 0, 'failed refund must not debit seller wallet');
  assert.equal((await failed.customerWallet.get()).data()?.availableBalanceMinor, 200, 'failed refund must not credit customer wallet');
  assert.equal((await db.collection('transactions').where('reversalOfTransactionId', '==', failed.originalId).get()).size, 0,
    'failed refund must not create a refund transaction');
  assert.equal((await db.collection('inventory_movements').where('sourceId', '==', failed.originalId + ':early-refund').get()).size, 0,
    'failed refund must not create an inventory movement');

  // A successful replay returns the original result and applies stock/money exactly once.
  const successful = await seedScenario('success', 5000);
  const input = refundInput(successful, prefix + '-success-key');
  const first = await executeFinancialRefund(db, input);
  assert.ok(!('error' in first), 'funded refund should succeed');
  const second = await executeFinancialRefund(db, input);
  assert.ok(!('error' in second), 'same-key retry should return the successful result');
  if (!('error' in first) && !('error' in second)) assert.equal(second.transactionId, first.transactionId, 'replay must return same refund transaction');
  assert.equal((await successful.product.get()).data()?.quantity, 3, 'successful early refund restores stock once');
  assert.equal((await successful.order.get()).data()?.status, 'refunded', 'successful refund finalizes order');
  assert.equal((await successful.sellerWallet.get()).data()?.availableBalanceMinor, 4000, 'seller is debited once');
  assert.equal((await successful.customerWallet.get()).data()?.availableBalanceMinor, 1200, 'customer is credited once');
  assert.equal((await db.collection('transactions').where('reversalOfTransactionId', '==', successful.originalId).get()).size, 1,
    'successful replay must not create a second refund');
  assert.equal((await db.collection('inventory_movements').where('sourceId', '==', successful.originalId + ':early-refund').get()).size, 1,
    'successful replay must not duplicate inventory movement');

  // Concurrent different keys cannot collectively refund more than the original payment.
  const concurrent = await seedScenario('concurrent', 5000, 1000);
  const concurrentBase = {
    originalTransactionId: concurrent.originalId,
    amountMinor: 700,
    currency: 'NGN' as const,
    actorUid: concurrent.customerUid,
    reason: 'Concurrent emulator refund test',
    sourceModule: 'unique_pay.financial_refund',
  };
  const outcomes = await Promise.all([
    executeFinancialRefund(db, { ...concurrentBase, idempotencyKey: prefix + '-concurrent-a' }),
    executeFinancialRefund(db, { ...concurrentBase, idempotencyKey: prefix + '-concurrent-b' }),
  ]);
  assert.equal(outcomes.filter(result => !('error' in result)).length, 1, 'only one concurrent over-refund attempt may succeed');
  assert.equal(outcomes.filter(result => 'error' in result && result.error.code === 'REFUND_EXCEEDS_REMAINING').length, 1,
    'losing concurrent refund must see the reduced refundable balance');
  assert.equal((await db.collection('transactions').where('reversalOfTransactionId', '==', concurrent.originalId).get()).size, 1,
    'concurrent refund attempts create at most one refund transaction');
  assert.equal((await concurrent.sellerWallet.get()).data()?.availableBalanceMinor, 4300, 'seller debit occurs once for accepted concurrent refund');
  assert.equal((await concurrent.customerWallet.get()).data()?.availableBalanceMinor, 900, 'customer credit occurs once for accepted concurrent refund');

  console.log('Firestore Emulator financial refund atomicity, replay, and concurrency tests passed.');
} finally {
  for (const item of touched) {
    try { await db.collection(item.collection).doc(item.id).delete(); } catch { /* best-effort cleanup */ }
  }
  const prefixCollections = ['transactions', 'ledgerEntries', 'inventory_movements', 'financialRefundIdempotency', 'audit_logs'];
  for (const collection of prefixCollections) {
    const field = collection === 'transactions' ? 'initiatedByUid' : collection === 'ledgerEntries' ? 'uid' : collection === 'inventory_movements' ? 'actorUid' : collection === 'audit_logs' ? 'actorUid' : 'actorUid';
    try {
      const snap = await db.collection(collection).where(field, '==', prefix + '-customer-success').get();
      await Promise.all(snap.docs.map(doc => doc.ref.delete()));
    } catch { /* cleanup only; primary assertions determine test result */ }
  }
  await deleteApp(app);
}
