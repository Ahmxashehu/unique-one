import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

type SupportedSourceType = 'order' | 'payment' | 'invoice';
type EvaluationStatus = 'eligible' | 'blocked' | 'out_of_scope' | 'retryable_error';

export interface LegacyMessageEvaluation {
  conversationId: string;
  status: EvaluationStatus;
  sourceType?: SupportedSourceType;
  sourcePath?: string;
  derivedParticipantUids?: string[];
  reasonCodes: string[];
}

interface LegacyConversation {
  orderId?: unknown;
  paymentRequestId?: unknown;
  invoiceId?: unknown;
}

interface EvaluationDependencies {
  db: Firestore;
  auth: Auth;
}

const supportedReferences: Array<{
  field: keyof LegacyConversation;
  sourceType: SupportedSourceType;
  collection: string;
}> = [
  { field: 'orderId', sourceType: 'order', collection: 'orders' },
  { field: 'paymentRequestId', sourceType: 'payment', collection: 'payment_requests' },
  { field: 'invoiceId', sourceType: 'invoice', collection: 'invoices' },
];

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isForbiddenIdentity(value: string): boolean {
  return ['unknown', 'order_seller'].includes(value.trim());
}

function isNotFoundError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: unknown }).code === 5;
}

function isAuthUserNotFoundError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: unknown }).code === 'auth/user-not-found';
}

function getDependencies(): EvaluationDependencies {
  return { db: getFirestore(), auth: getAuth() };
}

async function evaluateWithDependencies(
  conversationId: string,
  { db, auth }: EvaluationDependencies,
): Promise<LegacyMessageEvaluation> {
  if (!isNonEmptyString(conversationId) || isForbiddenIdentity(conversationId)) {
    return {
      conversationId,
      status: 'blocked',
      reasonCodes: ['invalid_conversation_id'],
    };
  }

  const conversationPath = `conversations/${conversationId}`;
  let conversationSnapshot;
  try {
    conversationSnapshot = await db.collection('conversations').doc(conversationId).get();
  } catch {
    return {
      conversationId,
      status: 'retryable_error',
      reasonCodes: ['conversation_read_failed'],
    };
  }

  if (!conversationSnapshot.exists) {
    return {
      conversationId,
      status: 'blocked',
      reasonCodes: ['conversation_not_found'],
    };
  }

  const conversation = conversationSnapshot.data() as LegacyConversation;
  const presentReferences = supportedReferences.filter(({ field }) => {
    const value = conversation[field];
    return value !== undefined && value !== null && value !== '';
  });

  if (presentReferences.length === 0) {
    return {
      conversationId,
      status: 'out_of_scope',
      reasonCodes: ['missing_supported_source_reference'],
    };
  }

  if (presentReferences.length > 1) {
    return {
      conversationId,
      status: 'blocked',
      reasonCodes: ['multiple_source_references'],
    };
  }

  const reference = presentReferences[0];
  const sourceReference = conversation[reference.field];
  const sourcePath = `${reference.collection}/${String(sourceReference)}`;

  if (!isNonEmptyString(sourceReference) || isForbiddenIdentity(sourceReference)) {
    return {
      conversationId,
      status: 'blocked',
      sourceType: reference.sourceType,
      sourcePath,
      reasonCodes: ['invalid_source_reference'],
    };
  }

  let sourceSnapshot;
  try {
    sourceSnapshot = await db.collection(reference.collection).doc(sourceReference).get();
  } catch {
    return {
      conversationId,
      status: 'retryable_error',
      sourceType: reference.sourceType,
      sourcePath,
      reasonCodes: ['source_read_failed'],
    };
  }

  if (!sourceSnapshot.exists) {
    return {
      conversationId,
      status: 'blocked',
      sourceType: reference.sourceType,
      sourcePath,
      reasonCodes: ['source_not_found'],
    };
  }

  const source = sourceSnapshot.data() as Record<string, unknown>;
  const participantFields =
    reference.sourceType === 'order'
      ? ['customerId', 'sellerId']
      : reference.sourceType === 'payment'
        ? ['senderId', 'recipientId']
        : ['sellerId', 'customerId'];
  const participantUids = participantFields.map((field) => source[field]);

  if (participantUids.some((uid) => !isNonEmptyString(uid))) {
    return {
      conversationId,
      status: 'blocked',
      sourceType: reference.sourceType,
      sourcePath,
      reasonCodes: ['missing_or_invalid_participant_uid'],
    };
  }

  const normalizedParticipantUids = participantUids.map((uid) => uid.trim());
  if (normalizedParticipantUids.some(isForbiddenIdentity)) {
    return {
      conversationId,
      status: 'blocked',
      sourceType: reference.sourceType,
      sourcePath,
      derivedParticipantUids: normalizedParticipantUids,
      reasonCodes: ['forbidden_placeholder_identity'],
    };
  }

  if (new Set(normalizedParticipantUids).size !== normalizedParticipantUids.length) {
    return {
      conversationId,
      status: 'blocked',
      sourceType: reference.sourceType,
      sourcePath,
      derivedParticipantUids: normalizedParticipantUids,
      reasonCodes: ['duplicate_participant_uid'],
    };
  }

  for (const uid of normalizedParticipantUids) {
    try {
      await auth.getUser(uid);
    } catch (error) {
      if (isAuthUserNotFoundError(error)) {
        return {
          conversationId,
          status: 'blocked',
          sourceType: reference.sourceType,
          sourcePath,
          derivedParticipantUids: normalizedParticipantUids,
          reasonCodes: ['participant_user_not_found'],
        };
      }

      return {
        conversationId,
        status: 'retryable_error',
        sourceType: reference.sourceType,
        sourcePath,
        derivedParticipantUids: normalizedParticipantUids,
        reasonCodes: ['participant_auth_lookup_failed'],
      };
    }
  }

  return {
    conversationId,
    status: 'eligible',
    sourceType: reference.sourceType,
    sourcePath,
    derivedParticipantUids: normalizedParticipantUids,
    reasonCodes: [],
  };
}

/**
 * Evaluates exactly one legacy conversation without writing any Firestore data.
 */
export async function evaluateLegacyConversation(
  conversationId: string,
): Promise<LegacyMessageEvaluation> {
  return evaluateWithDependencies(conversationId, getDependencies());
}

export const __legacyMessageEvaluatorTestOnly = {
  evaluateWithDependencies,
  isNotFoundError,
};
