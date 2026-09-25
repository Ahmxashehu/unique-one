import { Timestamp } from 'firebase/firestore';
import { TransactionModel, TransactionStatus, TransactionType } from '../types';

export interface FinancialTransactionViewModel {
  id: string;
  reference: string;
  senderId: string;
  recipientId: string;

  amountMinor: number;
  currency: string;

  type: TransactionType;
  sourceModule: string;
  provider: string;
  status: TransactionStatus;

  createdAt: string;
  updatedAt: string;
  completedAt?: string;

  relatedOrderId?: string;
  relatedInvoiceId?: string;
  relatedRequestId?: string;

  failureReason?: string;
  reversalReason?: string;

  direction: 'incoming' | 'outgoing';
}

type FirestoreTimestampValue = Timestamp | { toDate: () => Date } | string;
type FinancialTransactionDocument = Partial<TransactionModel> & {
  recordKind?: unknown;
  schemaVersion?: unknown;
  amountUnit?: unknown;
  completedAt?: unknown;
};

const transactionTypes: readonly TransactionType[] = [
  'payment',
  'transfer',
  'refund',
  'fee',
  'invoice_payment',
  'school_payment',
  'merchant_payment',
  'bulk_payment',
  'reversal',
];

const transactionStatuses: readonly TransactionStatus[] = ['pending', 'completed', 'failed', 'reversed', 'disputed'];

function isTransactionType(value: unknown): value is TransactionType {
  return typeof value === 'string' && transactionTypes.includes(value as TransactionType);
}

function isTransactionStatus(value: unknown): value is TransactionStatus {
  return typeof value === 'string' && transactionStatuses.includes(value as TransactionStatus);
}

function normalizeTimestamp(value: unknown): string | null {
  if (typeof value === 'string') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  if (value instanceof Timestamp || (typeof value === 'object' && value !== null && 'toDate' in value)) {
    const date = (value as FirestoreTimestampValue & { toDate: () => Date }).toDate();
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  return null;
}

function isSafeMinorAmount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

/**
 * Maps only explicitly versioned financial records. Returning null for anything
 * else prevents legacy/demo amounts from being silently reinterpreted as minor units.
 */
export function mapFinancialTransaction(
  documentId: string,
  data: unknown,
  currentUserId: string,
): FinancialTransactionViewModel | null {
  if (typeof data !== 'object' || data === null) return null;

  const record = data as FinancialTransactionDocument;
  const normalizedSchemaVersion = typeof record.schemaVersion === 'string' ? Number(record.schemaVersion) : record.schemaVersion;
  if (record.recordKind !== 'financial' || normalizedSchemaVersion !== 2 || record.amountUnit !== 'minor') return null;
  if (!isSafeMinorAmount(record.amount)) return null;
  if (typeof record.reference !== 'string' || typeof record.senderId !== 'string' || typeof record.recipientId !== 'string') return null;
  if (typeof record.currency !== 'string' || !isTransactionType(record.type) || !isTransactionStatus(record.status)) return null;
  if (typeof record.sourceModule !== 'string' || typeof record.provider !== 'string') return null;

  const createdAt = normalizeTimestamp(record.createdAt);
  const updatedAt = normalizeTimestamp(record.updatedAt);
  if (!createdAt || !updatedAt) return null;

  const completedAt = record.completedAt === undefined ? undefined : normalizeTimestamp(record.completedAt);
  if (record.completedAt !== undefined && !completedAt) return null;

  return {
    id: documentId,
    reference: record.reference,
    senderId: record.senderId,
    recipientId: record.recipientId,
    amountMinor: record.amount,
    currency: record.currency,
    type: record.type,
    sourceModule: record.sourceModule,
    provider: record.provider,
    status: record.status,
    createdAt,
    updatedAt,
    ...(completedAt ? { completedAt } : {}),
    ...(optionalString(record.relatedOrderId) ? { relatedOrderId: record.relatedOrderId } : {}),
    ...(optionalString(record.relatedInvoiceId) ? { relatedInvoiceId: record.relatedInvoiceId } : {}),
    ...(optionalString(record.relatedRequestId) ? { relatedRequestId: record.relatedRequestId } : {}),
    ...(optionalString(record.failureReason) ? { failureReason: record.failureReason } : {}),
    ...(optionalString(record.reversalReason) ? { reversalReason: record.reversalReason } : {}),
    direction: record.senderId === currentUserId ? 'outgoing' : 'incoming',
  };
}

/** Formats minor units for display only; it must not be used for accounting. */
export function formatFinancialTransactionAmount(transaction: Pick<FinancialTransactionViewModel, 'amountMinor' | 'currency'>): string {
  const majorAmount = transaction.currency === 'NGN' ? transaction.amountMinor / 100 : transaction.amountMinor;
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: transaction.currency,
    maximumFractionDigits: 2,
  }).format(majorAmount);
}
