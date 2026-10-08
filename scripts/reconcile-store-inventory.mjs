import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
const credential = raw ? cert(JSON.parse(raw)) : applicationDefault();

if (getApps().length === 0) {
  initializeApp({
    credential,
    projectId: process.env.FIREBASE_PROJECT_ID || 'unique-one-9731b',
  });
}

const db = getFirestore();
const [productsSnap, movementsSnap] = await Promise.all([
  db.collection('products').get(),
  db.collection('inventory_movements').get(),
]);

const movementsByProduct = new Map();
const errors = [];
const productIds = new Set(productsSnap.docs.map((doc) => doc.id));

for (const movementDoc of movementsSnap.docs) {
  const movement = movementDoc.data() || {};
  const productId = typeof movement.productId === 'string' ? movement.productId : '';
  const previous = Number(movement.previousQuantity);
  const resulting = Number(movement.resultingQuantity);
  const quantity = Number(movement.quantity);
  const delta = Number(movement.quantityDelta);

  if (!/^[A-Za-z0-9_-]{1,128}$/.test(productId) ||
      !Number.isSafeInteger(quantity) || quantity <= 0 ||
      !Number.isSafeInteger(previous) || previous < 0 ||
      !Number.isSafeInteger(resulting) || resulting < 0 ||
      !Number.isSafeInteger(delta) ||
      previous + delta !== resulting) {
    errors.push({ type: 'invalid_movement', movementId: movementDoc.id, productId });
    continue;
  }

  const list = movementsByProduct.get(productId) || [];
  list.push({ id: movementDoc.id, ...movement });
  movementsByProduct.set(productId, list);
  if (!productIds.has(productId)) {
    orphanMovements += 1;
    errors.push({ type: 'orphan_inventory_movement', movementId: movementDoc.id, productId });
  }
}

let checkedProducts = 0;
let reconciledProducts = 0;
let legacyProducts = 0;
let orphanMovements = 0;

for (const productDoc of productsSnap.docs) {
  const productId = productDoc.id;
  const product = productDoc.data() || {};
  const currentQuantity = Number(product.quantity);
  const currentQuarantine = Number(product.quarantineQuantity ?? 0);
  const movements = movementsByProduct.get(productId) || [];

  if (!Number.isSafeInteger(currentQuantity) || currentQuantity < 0 ||
      !Number.isSafeInteger(currentQuarantine) || currentQuarantine < 0) {
    errors.push({ type: 'invalid_product_quantity', productId });
    continue;
  }

  checkedProducts += 1;

  // Every product must have canonical inventory history. We cannot invent an
  // opening balance for a legacy product, so ledgerless products are explicitly
  // reported for controlled migration instead of being silently accepted.
  if (movements.length === 0) {
    legacyProducts += 1;
    errors.push({
      type: 'legacy_product_without_ledger',
      productId,
      productQuantity: currentQuantity,
      productQuarantineQuantity: currentQuarantine,
    });
    continue;
  }

  movements.sort((a, b) => {
    const at = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
    const bt = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
    return at - bt || String(a.id).localeCompare(String(b.id));
  });

  let expectedQuantity = null;
  let expectedQuarantine = null;

  // A ledger chain can be internally consistent while still beginning from
  // pre-ledger stock. If the first canonical movement starts above zero without
  // an opening_balance, the product's historical stock is not independently
  // accounted for and must be surfaced as legacy/unreconciled.
  const firstMovement = movements[0];
  if (firstMovement.previousQuantity > 0 && firstMovement.movementType !== 'opening_balance') {
    legacyProducts += 1;
    errors.push({
      type: 'legacy_opening_balance_missing',
      productId,
      movementId: firstMovement.id,
      openingQuantity: firstMovement.previousQuantity,
      firstMovementType: firstMovement.movementType,
    });
  }

  for (const movement of movements) {
    if (expectedQuantity !== null && movement.previousQuantity !== expectedQuantity) {
      errors.push({
        type: 'quantity_chain_break',
        productId,
        movementId: movement.id,
        expectedPreviousQuantity: expectedQuantity,
        actualPreviousQuantity: movement.previousQuantity,
      });
    }

    if (expectedQuantity === null) expectedQuantity = movement.previousQuantity;
    expectedQuantity = movement.resultingQuantity;

    if (movement.previousQuarantineQuantity !== undefined ||
        movement.resultingQuarantineQuantity !== undefined) {
      const previousQ = Number(movement.previousQuarantineQuantity);
      const resultingQ = Number(movement.resultingQuarantineQuantity);
      if (!Number.isSafeInteger(previousQ) || previousQ < 0 ||
          !Number.isSafeInteger(resultingQ) || resultingQ < 0) {
        errors.push({ type: 'invalid_quarantine_movement', productId, movementId: movement.id });
      } else {
        if (expectedQuarantine !== null && previousQ !== expectedQuarantine) {
          errors.push({
            type: 'quarantine_chain_break',
            productId,
            movementId: movement.id,
            expectedPreviousQuarantine: expectedQuarantine,
            actualPreviousQuarantine: previousQ,
          });
        }
        if (expectedQuarantine === null) expectedQuarantine = previousQ;
        expectedQuarantine = resultingQ;
      }
    }
  }

  if (expectedQuantity !== null && expectedQuantity !== currentQuantity) {
    errors.push({
      type: 'quantity_reconciliation_mismatch',
      productId,
      ledgerQuantity: expectedQuantity,
      productQuantity: currentQuantity,
    });
  }

  if (expectedQuarantine !== null && expectedQuarantine !== currentQuarantine) {
    errors.push({
      type: 'quarantine_reconciliation_mismatch',
      productId,
      ledgerQuarantineQuantity: expectedQuarantine,
      productQuarantineQuantity: currentQuarantine,
    });
  }

  if (movements.length > 0 &&
      expectedQuantity === currentQuantity &&
      (expectedQuarantine === null || expectedQuarantine === currentQuarantine)) {
    reconciledProducts += 1;
  }
}

console.log(JSON.stringify({
  ok: errors.length === 0,
  scannedProducts: productsSnap.size,
  checkedProducts,
  productsWithLedger: movementsByProduct.size,
  reconciledProducts,
  legacyProducts,
  orphanMovements,
  errors,
}, null, 2));

if (errors.length > 0) process.exitCode = 1;
