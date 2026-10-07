import { createHash } from 'node:crypto';
import { Firestore, Timestamp } from 'firebase-admin/firestore';

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
  sourceModule?: string;
  finalizeOrder?: 'full' | 'partial';
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
      input.reason,
      input.sourceModule ?? '',
      input.finalizeOrder ?? 'full',
      input.finalizeDispute?.decision ?? '',
      input.finalizeDispute?.reason ?? '',
      input.finalizeDispute?.actorUid ?? '',
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
    (input.finalizeOrder !== undefined && input.finalizeOrder !== 'full' && input.finalizeOrder !== 'partial') ||
    (input.finalizeDispute !== undefined && (input.finalizeDispute.decision !== 'approve_refund' || !input.finalizeDispute.reason.trim() || !isSafeId(input.finalizeDispute.actorUid) || input.finalizeDispute.actorUid !== input.actorUid))
  ) {
    return { error: { code: 'INVALID_REQUEST', message: 'Invalid refund request.' } };
  }

  const idempotencyRef = db.collection('financialRefundIdempotency')
    .doc(idempotencyDocumentId(input.actorUid, input.idempotencyKey));
  const originalRef = db.collection('transactions').doc(input.originalTransactionId);

  return db.runTransaction(async (transaction) => {
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
    const relatedOrderRef = input.relatedOrderId ? db.collection('orders').doc(input.relatedOrderId) : null;
    if (relatedOrderRef) {
      const relatedOrderSnap = await transaction.get(relatedOrderRef);
      if (!relatedOrderSnap.exists) {
        return { error: { code: 'ORIGINAL_NOT_REFUNDABLE', message: 'The related Store order was not found.' } };
      }
      const order = relatedOrderSnap.data() ?? {};
      if (
        order.customerId !== customerUid ||
        order.sellerId !== sellerUid ||
        order.currency !== 'NGN' ||
        !['paid', 'partially_refunded'].includes(String(order.paymentStatus)) ||
        !['confirmed', 'processing', 'ready_for_pickup', 'shipped', 'out_for_delivery', 'delivered', 'completed'].includes(String(order.status))
      ) {
        return { error: { code: 'ORIGINAL_NOT_REFUNDABLE', message: 'The related Store order is not eligible for refund.' } };
      }
      if (input.finalizeOrder === 'partial') {
        const rr = order.returnRequest && typeof order.returnRequest === 'object' ? order.returnRequest as Record<string, unknown> : null;
        if (!rr || rr.status !== 'received' || Number(rr.requestedRefundAmountMinor) !== input.amountMinor) {
          return { error: { code: 'ORIGINAL_NOT_REFUNDABLE', message: 'The partial Store return is not ready for this refund.' } };
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

    const now = Timestamp.now();
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

    if (relatedOrderRef) {
      if (input.finalizeOrder === 'partial') {
        const orderSnap = await transaction.get(relatedOrderRef);
        if (!orderSnap.exists) return { error: { code: 'ORIGINAL_NOT_REFUNDABLE', message: 'The related Store order was not found.' } };
        const order = orderSnap.data() ?? {};
        const rr = order.returnRequest && typeof order.returnRequest === 'object' ? order.returnRequest as Record<string, unknown> : null;
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
          const orderSnap = await transaction.get(relatedOrderRef);
          if (!orderSnap.exists) return { error: { code: 'ORIGINAL_NOT_REFUNDABLE', message: 'The related Store order was not found.' } };
          const current = orderSnap.data() ?? {};
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
        transaction.update(relatedOrderRef, orderUpdate);
      }
    }

    transaction.set(idempotencyRef, {
      actorUid: input.actorUid,
      originalTransactionId: input.originalTransactionId,
      amountMinor: input.amountMinor,
      currency: 'NGN',
      relatedOrderId: input.relatedOrderId ?? null,
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
      relatedOrderId: input.relatedOrderId ?? null,
      amountMinor: input.amountMinor,
      currency: 'NGN',
      reason: input.reason.trim(),
      idempotencyKey: input.idempotencyKey,
      timestamp: now,
    });

    return result;
  });
}
