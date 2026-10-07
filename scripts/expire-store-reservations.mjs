import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
const credential = raw
  ? cert(JSON.parse(raw))
  : applicationDefault();

if (getApps().length === 0) initializeApp({
  credential,
  projectId: process.env.FIREBASE_PROJECT_ID || 'unique-one-9731b',
});

const db = getFirestore();
const now = new Date();
const nowIso = now.toISOString();

const snap = await db.collection('orders').where('status', '==', 'pending').limit(100).get();
let expired = 0;

for (const doc of snap.docs) {
  const result = await db.runTransaction(async (transaction) => {
    const orderSnap = await transaction.get(doc.ref);
    if (!orderSnap.exists) return false;
    const order = orderSnap.data() || {};
    if (order.status !== 'pending') return false;

    const explicitExpiry = typeof order.expiresAt === 'string' ? Date.parse(order.expiresAt) : NaN;
    const createdAt = typeof order.createdAt === 'string' ? Date.parse(order.createdAt) : NaN;
    const expiresAt = Number.isFinite(explicitExpiry) ? explicitExpiry : Number.isFinite(createdAt) ? createdAt + 1800000 : NaN;
    if (!Number.isFinite(expiresAt) || expiresAt > now.getTime()) return false;

    const items = Array.isArray(order.items) ? order.items : [];
    const quantities = new Map();
    for (const item of items) {
      const productId = typeof item?.productId === 'string' ? item.productId : '';
      const quantity = Number(item?.quantity);
      if (!/^[A-Za-z0-9_-]{1,128}$/.test(productId) || !Number.isSafeInteger(quantity) || quantity <= 0) {
        throw new Error('INVALID_ORDER_INVENTORY');
      }
      quantities.set(productId, (quantities.get(productId) || 0) + quantity);
    }

    const entries = Array.from(quantities.entries());
    const productSnaps = await Promise.all(entries.map(([id]) =>
      transaction.get(db.collection('products').doc(id))
    ));

    for (let i = 0; i < productSnaps.length; i += 1) {
      const productSnap = productSnaps[i];
      if (!productSnap.exists) throw new Error('MISSING_PRODUCT');
      const product = productSnap.data() || {};
      const quantity = Number(product.quantity);
      const restore = entries[i][1];
      if (!Number.isSafeInteger(quantity) || quantity < 0 ||
          !Number.isSafeInteger(restore) || restore <= 0 ||
          quantity + restore > Number.MAX_SAFE_INTEGER) {
        throw new Error('INVALID_STOCK');
      }
      const currentStatus = typeof product.status === 'string' ? product.status : 'published';
      const restoredStatus = currentStatus === 'out_of_stock' && quantity + restore > 0 ? 'published' : currentStatus;
      transaction.update(productSnap.ref, {
        quantity: quantity + restore,
        status: restoredStatus,
        updatedAt: nowIso,
      });
    }

    transaction.update(doc.ref, {
      status: 'expired',
      paymentStatus: 'unpaid',
      expiredAt: nowIso,
      updatedAt: nowIso,
    });
    transaction.create(db.collection('audit_logs').doc(), {
      action: 'store.order.expired',
      actorUid: 'system',
      targetUid: order.customerId,
      resource: 'store_order',
      resourceId: doc.id,
      timestamp: Timestamp.now(),
      createdAt: nowIso,
    });
    return true;
  });

  if (result) expired += 1;
}

console.log(JSON.stringify({ ok: true, scanned: snap.size, expired }));
