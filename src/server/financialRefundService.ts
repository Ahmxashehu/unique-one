import { createHash } from 'node:crypto';
import { Firestore, Timestamp } from 'firebase-admin/firestore';
import { recordStoreInventoryMovement } from './storeInventoryLedger';

export type FinancialRefundErrorCode =
  | 'INVALID_REQUEST'
  | 'ORIGINAL_NOT_FOUND'
  | 'ORIGINAL_NOT_REFUNDABLE'
  | 'REFUND_EXCEEDS_REMAINING'
  | 'IDEMPOTENCY_CONFLICT'
  | 'REFUND_IN_PROGRESS'
  | 'WALLET_NOT_FOUND'
  | 'WALLET_UNAVAILABLE'
  | 'INSUFFICIENT_FUNDS'
  | 'TRANSACTION_FAILED';

export interface FinancialRefundInput {
  originalTransactionId: string;
  amountMinor: number;
  currency: 'NGN';
  idempotencyKey: string;
  actorUid: string;
  reason: string;
  relatedOrderId?: string;
  relatedRestaurantOrderId?: string;
  sourceModule?: string;
  finalizeOrder?: 'full' | 'partial';
  /** Restore Store inventory for an early full refund before fulfillment. */
  releaseInventory?: boolean;
  finalizeDispute?: { decision: 'approve_refund'; reason: string; actorUid: string };
}

export interface FinancialRefundResult {
  transactionId: string;
  reference: string;
  originalTransactionId: string;
  amountMinor: number;
  currency: 'NGN';
  status: 'completed';
  idempotencyKey: string;
}

type Failure = { error: { code: FinancialRefundErrorCode; message: string } };

function isSafeId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
}

function fingerprint(input: FinancialRefundInput): string {
  return createHash('sha256')
    .update([
      input.originalTransactionId,
      input.amountMinor,
      input.currency,
      input.relatedOrderId ?? '',
      input.relatedRestaurantOrderId ?? '',
      input.reason,
      input.sourceModule ?? '',
      input.finalizeOrder ?? 'full',
      input.finalizeDispute?.decision ?? '',
      input.finalizeDispute?.reason ?? '',
      input.finalizeDispute?.actorUid ?? '',
      input.releaseInventory ? 'release_inventory' : 'no_inventory_release',
    ].join('\0'))
    .digest('hex');
}

function idempotencyDocumentId(actorUid: string, key: string): string {
  return createHash('sha256').update(actorUid + '\0' + key).digest('hex');
}

function validateWallet(data: FirebaseFirestore.DocumentData | undefined, uid: string) {
  if (!data || data.uid !== uid || data.currency !== 'NGN' || data.status !== 'active') {
    throw new Error('WALLET_UNAVAILABLE');
  }
  const balance = data.availableBalanceMinor;
  if (!Number.isSafeInteger(balance) || balance < 0) throw new Error('WALLET_UNAVAILABLE');
  return balance as number;
}

/**
 * Executes a wallet-funded refund against an existing completed financial
 * transaction. Authorization of the actor belongs to the calling domain
 * (Store, Restaurant, admin, etc.); this function is the atomic money primitive.
 *
 * Remaining refundable value is calculated inside the Firestore transaction,
 * preventing concurrent over-refunds.
 */
export async function executeFinancialRefund(
  db: Firestore,
  input: FinancialRefundInput,
): Promise<FinancialRefundResult | Failure> {
  if (
    !isSafeId(input.originalTransactionId) ||
    !isSafeId(input.actorUid) ||
    !Number.isSafeInteger(input.amountMinor) ||
    input.amountMinor <= 0 ||
    !isSafeId(input.idempotencyKey) ||
    input.idempotencyKey.length > 200 ||
    input.currency !== 'NGN' ||
    !input.reason.trim() ||
    (input.relatedOrderId !== undefined && !isSafeId(input.relatedOrderId)) ||
    (input.relatedRestaurantOrderId !== undefined && !isSafeId(input.relatedRestaurantOrderId)) ||
    (input.relatedOrderId !== undefined && input.relatedRestaurantOrderId !== undefined) ||
    (input.finalizeOrder !== undefined && input.finalizeOrder !== 'full' && input.finalizeOrder !== 'partial') ||
    (input.releaseInventory === true && (input.sourceModule !== 'unique_store.refund' || input.finalizeOrder !== 'full')) ||
    (input.finalizeDispute !== undefined && (input.finalizeDispute.decision !== 'approve_refund' || !input.finalizeDispute.reason.trim() || !isSafeId(input.finalizeDispute.actorUid) || input.finalizeDispute.actorUid !== input.actorUid))
  ) {
    return { error: { code: 'INVALID_REQUEST', message: 'Invalid refund request.' } };
  }

  const idempotencyRef = db.collection('financialRefundIdempotency')
    .doc(idempotencyDocumentId(input.actorUid, input.idempotencyKey));
  const originalRef = db.collection('transactions').doc(input.originalTransactionId);

  return db.runTransaction(async (transaction) => {
    const now = Timestamp.now();
    const idemSnap = await transaction.get(idempotencyRef);
    const requestFingerprint = fingerprint(input);

    if (idemSnap.exists) {
      const existing = idemSnap.data() ?? {};
      if (existing.requestFingerprint !== requestFingerprint) {
        return { error: { code: 'IDEMPOTENCY_CONFLICT', message: 'This idempotency key was already used for different refund parameters.' } };
      }
      if (existing.status === 'completed' && existing.result) return existing.result as FinancialRefundResult;
      if (existing.status === 'in_progress') {
        return { error: { code: 'REFUND_IN_PROGRESS', message: 'This refund is already being processed.' } };
      }
    }

    const originalSnap = await transaction.get(originalRef);
    if (!originalSnap.exists) {
      return { error: { code: 'ORIGINAL_NOT_FOUND', message: 'The original financial transaction was not found.' } };
    }

    const original = originalSnap.data() ?? {};
    const originalAmount = original.amount;
    if (
      original.recordKind !== 'financial' ||
      original.schemaVersion !== 2 ||
      original.amountUnit !== 'minor' ||
      original.currency !== 'NGN' ||
      original.status !== 'completed' ||
      !Number.isSafeInteger(originalAmount) ||
      originalAmount <= 0 ||
      !isSafeId(String(original.senderId ?? '')) ||
      !isSafeId(String(original.recipientId ?? ''))
    ) {
      return { error: { code: 'ORIGINAL_NOT_REFUNDABLE', message: 'The original transaction is not eligible for refund.' } };
    }

    const refundQuery = db.collection('transactions')
      .where('reversalOfTransactionId', '==', input.originalTransactionId)
      .where('type', '==', 'refund')
      .where('status', '==', 'completed');
    const refundSnapshots = await transaction.get(refundQuery);
    const refundedMinor = refundSnapshots.docs.reduce((sum, doc) => {
      const amount = doc.data().amount;
      return Number.isSafeInteger(amount) && amount > 0 && Number.isSafeInteger(sum + amount) ? sum + amount : sum;
    }, 0);

    if (!Number.isSafeInteger(refundedMinor) || refundedMinor >= originalAmount || input.amountMinor > originalAmount - refundedMinor) {
      return { error: { code: 'REFUND_EXCEEDS_REMAINING', message: 'The requested refund exceeds the remaining refundable amount.' } };
    }

    const customerUid = String(original.senderId);
    const sellerUid = String(original.recipientId);
    if (customerUid === sellerUid) {
      return { error: { code: 'ORIGINAL_NOT_REFUNDABLE', message: 'A refund requires distinct customer and seller accounts.' } };
    }
    const relatedRestaurantOrderRef = input.relatedRestaurantOrderId ? db.collection('restaurantOrders').doc(input.relatedRestaurantOrderId) : null;
    let relatedRestaurantOrderData: Record<string, unknown> | null = null;
    if (relatedRestaurantOrderRef) {
      if (input.sourceModule !== 'unique_restaurant.refund') {
        return { error: { code: 'INVALID_REQUEST', message: 'Restaurant refunds must use the Restaurant refund source module.' } };
      }
      const restaurantOrderSnap = await transaction.get(relatedRestaurantOrderRef);
      if (!restaurantOrderSnap.exists) return { error: { code: 'ORIGINAL_NOT_REFUNDABLE', message: 'The related Restaurant order was not found.' } };
      const restaurantOrder = restaurantOrderSnap.data() ?? {};
      relatedRestaurantOrderData = restaurantOrder as Record<string, unknown>;
      if (
        String(restaurantOrder.customerId || '') !== customerUid ||
        String(restaurantOrder.currency || '') !== 'NGN' ||
        !['paid', 'cancelled'].includes(String(restaurantOrder.status || '')) ||
        String(restaurantOrder.paymentStatus || '') !== 'paid'
      ) {
        return { error: { code: 'ORIGINAL_NOT_REFUNDABLE', message: 'The Restaurant order is not eligible for refund.' } };
      }
      const orderAmount = Number(restaurantOrder.totalMinor);
      if (!Number.isSafeInteger(orderAmount) || orderAmount <= 0 || orderAmount !== originalAmount || input.amountMinor !== orderAmount) {
        return { error: { code: 'ORIGINAL_NOT_REFUNDABLE', message: 'The Restaurant payment amount must exactly match the cancelled order amount.' } };
      }
      if (String(original.sourceModule || '') !== 'unique_restaurant.checkout' || String(original.relatedOrderIds?.[0] || '') !== input.relatedRestaurantOrderId) {
        return { error: { code: 'ORIGINAL_NOT_REFUNDABLE', message: 'The original transaction is not the payment for this Restaurant order.' } };
      }
    }
    const relatedOrderRef = input.relatedOrderId ? db.collection('orders').doc(input.relatedOrderId) : null;
    let relatedOrderData: Record<string, unknown> | null = null;
    if (relatedOrderRef) {
      const relatedOrderSnap = await transaction.get(relatedOrderRef);
      if (!relatedOrderSnap.exists) {
        return { error: { code: 'ORIGINAL_NOT_REFUNDABLE', message: 'The related Store order was not found.' } };
      }
      const order = relatedOrderSnap.data() ?? {};
      relatedOrderData = order as Record<string, unknown>;
      if (
        order.customerId !== customerUid ||
        order.sellerId !== sellerUid ||
        order.currency !== 'NGN' ||
        !['paid', 'partially_refunded'].includes(String(order.paymentStatus)) ||
        !['confirmed', 'processing', 'ready_for_pickup', 'shipped', 'out_for_delivery', 'delivered', 'completed'].includes(String(order.status))
      ) {
        return { error: { code: 'ORIGINAL_NOT_REFUNDABLE', message: 'The related Store order is not eligible for refund.' } };
      }
      const relatedOrderAmount = Number(order.amountMinor);
      if (!Number.isSafeInteger(relatedOrderAmount) || relatedOrderAmount <= 0 || originalAmount !== relatedOrderAmount) {
        return { error: { code: 'ORIGINAL_NOT_REFUNDABLE', message: 'The Store payment amount must exactly match the related order amount.' } };
      }
      if (input.finalizeOrder === 'full' && order.paymentStatus !== 'paid') {
        return { error: { code: 'ORIGINAL_NOT_REFUNDABLE', message: 'A full Store refund requires an order that has not already been partially refunded.' } };
      }
      const rr = order.returnRequest && typeof order.returnRequest === 'object'
        ? order.returnRequest as Record<string, unknown>
        : null;
      if (rr) {
        const expiresAtMs = typeof rr.expiresAt === 'string' ? Date.parse(rr.expiresAt) : NaN;
        if (!Number.isFinite(expiresAtMs) || Date.now() > expiresAtMs) {
          return { error: { code: 'ORIGINAL_NOT_REFUNDABLE', message: 'The Store return request has expired and cannot be refunded.' } };
        }
        const disposition = rr.inventoryDisposition;
        if (
          rr.status !== 'received' ||
          Number(rr.requestedRefundAmountMinor) !== input.amountMinor ||
          !['resalable', 'damaged', 'non_resalable'].includes(String(disposition)) ||
          rr.quarantined !== false
        ) {
          return { error: { code: 'ORIGINAL_NOT_REFUNDABLE', message: 'A Store return must complete inventory inspection before any return-linked refund.' } };
        }
      }
      if (input.finalizeOrder === 'full' && originalAmount !== Number(order.amountMinor)) {
        return { error: { code: 'ORIGINAL_NOT_REFUNDABLE', message: 'The Store payment amount must exactly match the order amount for a full refund.' } };
      }
      if (input.releaseInventory) {
        if (input.finalizeDispute || input.sourceModule !== 'unique_store.refund' || input.finalizeOrder !== 'full' || !['confirmed', 'processing'].includes(String(order.status)) || order.returnRequest !== undefined) {
          return { error: { code: 'ORIGINAL_NOT_REFUNDABLE', message: 'Inventory can only be released for an early full Store refund before a return or dispute workflow.' } };
        }
        const sourceItems = Array.isArray(order.items) ? order.items : [];
        const quantities = new Map<string, number>();
        for (const item of sourceItems) {
          const productId = typeof item?.productId === 'string' ? item.productId : '';
          const quantity = Number(item?.quantity);
          if (!isSafeId(productId) || !Number.isSafeInteger(quantity) || quantity <= 0) {
            return { error: { code: 'ORIGINAL_NOT_REFUNDABLE', message: 'The Store order contains invalid inventory data; the refund was not applied.' } };
          }
          quantities.set(productId, (quantities.get(productId) || 0) + quantity);
        }
        if (quantities.size === 0) return { error: { code: 'ORIGINAL_NOT_REFUNDABLE', message: 'The Store order has no refundable inventory lines.' } };
        for (const [productId, quantity] of quantities) {
          const productRef = db.collection('products').doc(productId);
          const productSnap = await transaction.get(productRef);
          if (!productSnap.exists) return { error: { code: 'ORIGINAL_NOT_REFUNDABLE', message: 'A Store product no longer exists; inventory reconciliation is required before refund.' } };
          const product = productSnap.data() ?? {};
          const productBusinessId = typeof product.businessId === 'string' ? product.businessId.trim() : '';
          const productBranchId = typeof product.branchId === 'string' ? product.branchId.trim() : '';
          const orderBusinessId = typeof order.businessId === 'string' ? order.businessId.trim() : '';
          const orderBranchId = typeof order.branchId === 'string' ? order.branchId.trim() : '';
          if (orderBusinessId && productBusinessId !== orderBusinessId) {
            return { error: { code: 'ORIGINAL_NOT_REFUNDABLE', message: 'A Store product does not belong to the related order business.' } };
          }
          if (orderBranchId && productBranchId !== orderBranchId) {
            return { error: { code: 'ORIGINAL_NOT_REFUNDABLE', message: 'A Store product does not belong to the related order branch.' } };
          }
          if (product.sellerId !== sellerUid) {
            return { error: { code: 'ORIGINAL_NOT_REFUNDABLE', message: 'A Store product does not belong to the order seller.' } };
          }
          const currentQuantity = Number(product.quantity);
          if (!Number.isSafeInteger(currentQuantity) || currentQuantity < 0 || !Number.isSafeInteger(currentQuantity + quantity)) {
            return { error: { code: 'ORIGINAL_NOT_REFUNDABLE', message: 'Store inventory data is invalid; the refund was not applied.' } };
          }
          transaction.update(productRef, {
            quantity: currentQuantity + quantity,
            status: product.status === 'out_of_stock' ? 'published' : product.status,
            updatedAt: now,
          });
          recordStoreInventoryMovement(transaction, db, {
            productId,
            movementType: 'refund_release',
            quantity,
            previousQuantity: currentQuantity,
            resultingQuantity: currentQuantity + quantity,
            direction: 'in',
            sourceId: input.originalTransactionId + ':early-refund',
            sourceModule: 'unique_store.refund',
            actorUid: input.actorUid,
            orderId: input.relatedOrderId,
            transactionId: input.originalTransactionId,
            businessId: typeof product.businessId === 'string' ? product.businessId : null,
          });
        }
      }
      if (input.finalizeDispute) {
        const dispute = order.dispute && typeof order.dispute === 'object' ? order.dispute as Record<string, unknown> : null;
        if (!dispute || !['opened', 'seller_responded', 'under_review'].includes(String(dispute.status))) {
          return { error: { code: 'ORIGINAL_NOT_REFUNDABLE', message: 'The Store dispute is no longer awaiting resolution.' } };
        }
        if (String(order.paymentStatus) !== 'paid' || order.returnRequest !== undefined) {
          return { error: { code: 'ORIGINAL_NOT_REFUNDABLE', message: 'A dispute refund requires an otherwise fully paid Store order with no active return workflow.' } };
        }
      }
    }
    const customerWalletRef = db.collection('wallets').doc(customerUid);
    const sellerWalletRef = db.collection('wallets').doc(sellerUid);
    const [customerWalletSnap, sellerWalletSnap] = await Promise.all([
      transaction.get(customerWalletRef),
      transaction.get(sellerWalletRef),
    ]);

    if (!customerWalletSnap.exists || !sellerWalletSnap.exists) {
      return { error: { code: 'WALLET_NOT_FOUND', message: 'Both wallets must exist before a refund can be processed.' } };
    }

    let customerBalance: number;
    let sellerBalance: number;
    try {
      customerBalance = validateWallet(customerWalletSnap.data(), customerUid);
      sellerBalance = validateWallet(sellerWalletSnap.data(), sellerUid);
    } catch {
      return { error: { code: 'WALLET_UNAVAILABLE', message: 'One or both wallets are unavailable for refund.' } };
    }

    if (sellerBalance < input.amountMinor) {
      return { error: { code: 'INSUFFICIENT_FUNDS', message: 'The seller wallet does not have enough funds to cover this refund.' } };
    }

    const newSellerBalance = sellerBalance - input.amountMinor;
    const newCustomerBalance = customerBalance + input.amountMinor;
    if (!Number.isSafeInteger(newSellerBalance) || !Number.isSafeInteger(newCustomerBalance)) {
      return { error: { code: 'TRANSACTION_FAILED', message: 'The refund would exceed the safe wallet accounting range.' } };
    }

    const refundRef = db.collection('transactions').doc();
    const reference = `UP-REF-${refundRef.id}`;
    const result: FinancialRefundResult = {
      transactionId: refundRef.id,
      reference,
      originalTransactionId: input.originalTransactionId,
      amountMinor: input.amountMinor,
      currency: 'NGN',
      status: 'completed',
      idempotencyKey: input.idempotencyKey,
    };

    transaction.set(refundRef, {
      id: refundRef.id,
      reference,
      senderId: sellerUid,
      recipientId: customerUid,
      amount: input.amountMinor,
      currency: 'NGN',
      type: 'refund',
      sourceModule: input.sourceModule ?? 'unique_pay.financial_refund',
      provider: 'unique_pay_internal_wallet',
      status: 'completed',
      recordKind: 'financial',
      schemaVersion: 2,
      amountUnit: 'minor',
      reversalOfTransactionId: input.originalTransactionId,
      ...(input.relatedOrderId ? { relatedOrderId: input.relatedOrderId, relatedOrderIds: [input.relatedOrderId] } : {}),
      refundReason: input.reason.trim(),
      initiatedByUid: input.actorUid,
      createdAt: now,
      updatedAt: now,
      completedAt: now,
    });

    transaction.update(sellerWalletRef, { availableBalanceMinor: newSellerBalance, updatedAt: now });
    transaction.update(customerWalletRef, { availableBalanceMinor: newCustomerBalance, updatedAt: now });

    const debitRef = db.collection('ledgerEntries').doc();
    const creditRef = db.collection('ledgerEntries').doc();
    transaction.set(debitRef, {
      id: debitRef.id,
      transactionId: refundRef.id,
      reference,
      uid: sellerUid,
      direction: 'debit',
      amountMinor: input.amountMinor,
      currency: 'NGN',
      status: 'completed',
      idempotencyKey: input.idempotencyKey,
      createdAt: now,
    });
    transaction.set(creditRef, {
      id: creditRef.id,
      transactionId: refundRef.id,
      reference,
      uid: customerUid,
      direction: 'credit',
      amountMinor: input.amountMinor,
      currency: 'NGN',
      status: 'completed',
      idempotencyKey: input.idempotencyKey,
      createdAt: now,
    });

    if (relatedRestaurantOrderRef) {
      transaction.update(relatedRestaurantOrderRef, {
        status: 'refunded',
        paymentStatus: 'refunded',
        refundedAt: now,
        refundTransactionId: refundRef.id,
        cancellationReason: (relatedRestaurantOrderData?.cancellationReason as string) || 'customer_requested',
        updatedAt: now,
      });
    }

    if (relatedOrderRef) {
      const order = relatedOrderData;
      const rr = order && order.returnRequest && typeof order.returnRequest === 'object'
        ? order.returnRequest as Record<string, unknown>
        : null;
      if (input.finalizeOrder === 'partial') {
        if (!order) return { error: { code: 'ORIGINAL_NOT_REFUNDABLE', message: 'The related Store order was not found.' } };
        if (!rr || rr.status !== 'received' || Number(rr.requestedRefundAmountMinor) !== input.amountMinor) {
          return { error: { code: 'ORIGINAL_NOT_REFUNDABLE', message: 'The partial Store return is no longer eligible for this refund.' } };
        }
        transaction.update(relatedOrderRef, {
          paymentStatus: 'partially_refunded',
          returnRequest: { ...rr, status: 'refunded', refundedAt: now, refundTransactionId: refundRef.id },
          updatedAt: now,
        });
      } else {
        const orderUpdate: Record<string, unknown> = {
          status: 'refunded',
          paymentStatus: 'refunded',
          refundedAt: now,
          updatedAt: now,
          refundTransactionId: refundRef.id,
        };
        if (input.finalizeDispute) {
          const current = relatedOrderData;
          if (!current) return { error: { code: 'ORIGINAL_NOT_REFUNDABLE', message: 'The related Store order was not found.' } };
          const dispute = current.dispute && typeof current.dispute === 'object' ? current.dispute as Record<string, unknown> : null;
          if (!dispute || !['opened', 'seller_responded', 'under_review'].includes(String(dispute.status))) {
            return { error: { code: 'ORIGINAL_NOT_REFUNDABLE', message: 'The Store dispute has already been resolved.' } };
          }
          orderUpdate.dispute = {
            ...dispute,
            status: 'resolved',
            decision: 'approve_refund',
            resolutionReason: input.finalizeDispute.reason.trim(),
            resolvedBy: input.finalizeDispute.actorUid,
            resolvedAt: now,
            refundTransactionId: refundRef.id,
          };
        }
        if (rr) {
          orderUpdate.returnRequest = {
            ...rr,
            status: 'refunded',
            refundedAt: now,
            refundTransactionId: refundRef.id,
          };
        }
        transaction.update(relatedOrderRef, orderUpdate);
      }
    }

    transaction.set(idempotencyRef, {
      actorUid: input.actorUid,
      originalTransactionId: input.originalTransactionId,
      amountMinor: input.amountMinor,
      currency: 'NGN',
      relatedOrderId: input.relatedOrderId ?? input.relatedRestaurantOrderId ?? null,
      requestFingerprint,
      status: 'completed',
      result,
      createdAt: now,
      updatedAt: now,
    });

    const auditRef = db.collection('audit_logs').doc();
    transaction.create(auditRef, {
      action: 'financial.refund.completed',
      actorUid: input.actorUid,
      resource: 'financial_refund',
      resourceId: refundRef.id,
      transactionId: refundRef.id,
      originalTransactionId: input.originalTransactionId,
      relatedOrderId: input.relatedOrderId ?? input.relatedRestaurantOrderId ?? null,
      amountMinor: input.amountMinor,
      currency: 'NGN',
      reason: input.reason.trim(),
      idempotencyKey: input.idempotencyKey,
      timestamp: now,
    });

    return result;
  });
}
