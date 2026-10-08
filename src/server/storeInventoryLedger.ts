import { createHash } from 'crypto';
import { Timestamp } from 'firebase-admin/firestore';
import type { Firestore, Transaction } from 'firebase-admin/firestore';

export type StoreInventoryMovementType =
  | 'checkout_reservation'
  | 'order_cancellation_release'
  | 'reservation_expiry_release'
  | 'return_received_quarantine'
  | 'return_inspection_resalable'
  | 'return_inspection_damaged'
  | 'refund_release'
  | 'manual_adjustment';

export interface StoreInventoryMovementInput {
  productId: string;
  movementType: StoreInventoryMovementType;
  quantity: number;
  previousQuantity: number;
  resultingQuantity: number;
  previousQuarantineQuantity?: number;
  resultingQuarantineQuantity?: number;
  direction: 'in' | 'out' | 'quarantine_in' | 'quarantine_out';
  quantityDelta?: number;
  sourceId: string;
  sourceModule: string;
  actorUid: string;
  orderId?: string;
  returnId?: string;
  transactionId?: string;
  businessId?: string | null;
  branchId?: string | null;
  createdAt?: Timestamp;
}

function safePart(value: string) {
  return value.trim().slice(0, 200);
}

function movementDocId(input: StoreInventoryMovementInput) {
  return createHash('sha256')
    .update([
      safePart(input.movementType),
      safePart(input.sourceId),
      safePart(input.productId),
    ].join('\0'))
    .digest('hex');
}

export function recordStoreInventoryMovement(
  transaction: Transaction,
  db: Firestore,
  input: StoreInventoryMovementInput,
) {
  if (
    !/^[A-Za-z0-9_-]{1,128}$/.test(input.productId) ||
    !Number.isSafeInteger(input.quantity) || input.quantity <= 0 ||
    !Number.isSafeInteger(input.previousQuantity) || input.previousQuantity < 0 ||
    !Number.isSafeInteger(input.resultingQuantity) || input.resultingQuantity < 0 ||
    !Number.isSafeInteger(input.previousQuantity + (input.direction === 'in' ? input.quantity : -input.quantity)) ||
    (input.quantityDelta ?? (input.direction === 'in' ? input.quantity : input.direction === 'out' ? -input.quantity : 0)) + input.previousQuantity !== input.resultingQuantity ||
    !safePart(input.sourceId) || !safePart(input.sourceModule) || !safePart(input.actorUid)
  ) {
    throw new Error('INVALID_INVENTORY_MOVEMENT');
  }

  const movementRef = db.collection('inventory_movements').doc(movementDocId(input));
  const now = input.createdAt ?? Timestamp.now();

  transaction.create(movementRef, {
    schemaVersion: 1,
    id: movementRef.id,
    productId: input.productId,
    movementType: input.movementType,
    direction: input.direction,
    quantity: input.quantity,
    quantityDelta: input.quantityDelta ?? (input.direction === 'in' ? input.quantity : input.direction === 'out' ? -input.quantity : 0),
    previousQuantity: input.previousQuantity,
    resultingQuantity: input.resultingQuantity,
    ...(input.previousQuarantineQuantity !== undefined ? { previousQuarantineQuantity: input.previousQuarantineQuantity } : {}),
    ...(input.resultingQuarantineQuantity !== undefined ? { resultingQuarantineQuantity: input.resultingQuarantineQuantity } : {}),
    sourceId: safePart(input.sourceId),
    sourceModule: safePart(input.sourceModule),
    actorUid: safePart(input.actorUid),
    ...(input.orderId ? { orderId: safePart(input.orderId) } : {}),
    ...(input.returnId ? { returnId: safePart(input.returnId) } : {}),
    ...(input.transactionId ? { transactionId: safePart(input.transactionId) } : {}),
    ...(input.businessId ? { businessId: safePart(input.businessId) } : {}),
    ...(input.branchId ? { branchId: safePart(input.branchId) } : {}),
    createdAt: now,
  });
}
