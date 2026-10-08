import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { createHash } from 'crypto';

const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
const credential = raw ? cert(JSON.parse(raw)) : applicationDefault();
if (getApps().length === 0) initializeApp({ credential, projectId: process.env.FIREBASE_PROJECT_ID || 'unique-one-9731b' });

const db = getFirestore();
const args = process.argv.slice(2);
const apply = args.includes('--apply');
const approvals = args.filter((arg) => arg.startsWith('--approve=')).map((arg) => arg.slice(10));

if (apply && approvals.length === 0) {
  console.error('Refusing --apply without explicit --approve=productId:quantity:quarantineQuantity entries.');
  process.exit(2);
}

const approved = new Map();
for (const entry of approvals) {
  const [productId, quantityRaw, quarantineRaw = '0'] = entry.split(':');
  const quantity = Number(quantityRaw);
  const quarantineQuantity = Number(quarantineRaw);
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(productId) ||
      !Number.isSafeInteger(quantity) || quantity < 0 ||
      !Number.isSafeInteger(quarantineQuantity) || quarantineQuantity < 0) {
    console.error('Invalid approval:', entry);
    process.exit(2);
  }
  approved.set(productId, { quantity, quarantineQuantity });
}

const [productsSnap, movementsSnap] = await Promise.all([
  db.collection('products').get(),
  db.collection('inventory_movements').get(),
]);

const movementByProduct = new Map();
for (const doc of movementsSnap.docs) {
  const movement = doc.data() || {};
  const productId = typeof movement.productId === 'string' ? movement.productId : '';
  if (!productId) continue;
  const list = movementByProduct.get(productId) || [];
  list.push(movement);
  movementByProduct.set(productId, list);
}

if (!apply) {
  const candidates = [];
  for (const doc of productsSnap.docs) {
    const product = doc.data() || {};
    if ((movementByProduct.get(doc.id) || []).length === 0) {
      candidates.push({
        productId: doc.id,
        quantity: Number(product.quantity ?? 0),
        quarantineQuantity: Number(product.quarantineQuantity ?? 0),
        businessId: product.businessId || null,
        branchId: product.branchId || null,
      });
    }
  }
  console.log(JSON.stringify({ mode: 'dry-run', candidateCount: candidates.length, candidates }, null, 2));
  process.exit(candidates.length ? 1 : 0);
}

let migrated = 0;
for (const [productId, approval] of approved) {
  const ref = db.collection('products').doc(productId);
  await db.runTransaction(async (transaction) => {
    const productSnap = await transaction.get(ref);
    if (!productSnap.exists) throw new Error('PRODUCT_NOT_FOUND');
    const product = productSnap.data() || {};
    if ((movementByProduct.get(productId) || []).length > 0) throw new Error('PRODUCT_ALREADY_HAS_LEDGER');

    const currentQuantity = Number(product.quantity ?? 0);
    const currentQuarantine = Number(product.quarantineQuantity ?? 0);
    if (currentQuantity !== approval.quantity || currentQuarantine !== approval.quarantineQuantity) {
      throw new Error('CURRENT_STOCK_CHANGED_SINCE_APPROVAL');
    }

    if (approval.quantity <= 0) throw new Error('ZERO_SELLABLE_OPENING_BALANCE_NOT_SUPPORTED');
    if (approval.quarantineQuantity !== 0) throw new Error('QUARANTINE_OPENING_BALANCE_REQUIRES_SEPARATE_APPROVAL');

    const now = Timestamp.now();
    const sourceId = `legacy-migration:${productId}`;
    const movementId = createHash('sha256').update(['opening_balance', sourceId, productId].join('\\0')).digest('hex');

    transaction.create(db.collection('inventory_movements').doc(movementId), {
      schemaVersion: 1,
      id: movementId,
      productId,
      movementType: 'opening_balance',
      direction: 'in',
      quantity: approval.quantity,
      quantityDelta: approval.quantity,
      previousQuantity: 0,
      resultingQuantity: approval.quantity,
      sourceId,
      sourceModule: 'store.inventory.legacy_migration',
      actorUid: 'system:legacy-migration',
      businessId: product.businessId || null,
      branchId: product.branchId || null,
      createdAt: now,
    });
  });
  migrated += 1;
}

console.log(JSON.stringify({ mode: 'apply', migrated, approved: approved.size }, null, 2));