import {
  Timestamp,
  getFirestore,
  type DocumentData,
  type DocumentReference,
  type Firestore,
} from 'firebase-admin/firestore';
import { webcrypto } from 'node:crypto';

import {
  evaluateLegacyConversationWithOverrides,
  type LegacyMessageEvaluation,
} from './legacyMessages';

export type LegacyMessageMigrationStatus =
  | 'pending'
  | 'eligible'
  | 'blocked'
  | 'migrated'
  | 'failed_retryable'
  | 'failed_permanent';

export type LegacyMessageMigrationSourceType =
  | 'order'
  | 'payment_request'
  | 'invoice';

export type LegacyMessageMigrationSourceCollection =
  | 'orders'
  | 'payment_requests'
  | 'invoices';

export interface LegacyMessageMigrationState {
  legacyConversationId: string;
  sourceType: LegacyMessageMigrationSourceType | null;
  sourceCollection: LegacyMessageMigrationSourceCollection | null;
  sourceDocumentId: string | null;
  derivedParticipantUids: string[];
  legacyParticipantSnapshot: unknown[];
  status: LegacyMessageMigrationStatus;
  reasonCodes: string[];
  sourceSnapshotHash: string | null;
  attemptCount: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  version: number;
}

interface LegacyConversationDiagnosticSnapshot {
  participants?: unknown;
  orderId?: unknown;
  paymentRequestId?: unknown;
  invoiceId?: unknown;
}

interface MigrationDependencies {
  db: Firestore;
}

interface StateTransaction {
  get(
    documentReference: unknown,
  ): Promise<{ exists: boolean; data(): DocumentData | undefined }>;
  set(documentReference: unknown, data: LegacyMessageMigrationState): void;
}

type TransactionDocumentSnapshot = Awaited<ReturnType<StateTransaction['get']>>;

const MIGRATION_STATE_COLLECTION = 'communicationCoreMigration';
const MIGRATION_STATE_VERSION = 1;
const IMMUTABLE_STATUSES = new Set<LegacyMessageMigrationStatus>([
  'migrated',
  'failed_permanent',
]);

function getDependencies(): MigrationDependencies {
  return {
    db: getFirestore(),
  };
}

function getLegacyParticipantSnapshot(
  conversation: LegacyConversationDiagnosticSnapshot | null,
): unknown[] {
  return Array.isArray(conversation?.participants)
    ? [...conversation.participants]
    : [];
}

function mapEvaluationStatus(
  status: LegacyMessageEvaluation['status'],
): LegacyMessageMigrationStatus {
  switch (status) {
    case 'eligible':
      return 'eligible';
    case 'retryable_error':
      return 'failed_retryable';
    case 'blocked':
    case 'out_of_scope':
      return 'blocked';
  }
}

function parseSourceMetadata(
  evaluation: LegacyMessageEvaluation,
): Pick<
  LegacyMessageMigrationState,
  'sourceType' | 'sourceCollection' | 'sourceDocumentId'
> {
  if (!evaluation.sourcePath) {
    return {
      sourceType: null,
      sourceCollection: null,
      sourceDocumentId: null,
    };
  }

  const pathSegments = evaluation.sourcePath.split('/');
  if (pathSegments.length !== 2) {
    return {
      sourceType: null,
      sourceCollection: null,
      sourceDocumentId: null,
    };
  }
  const [sourceCollection, sourceDocumentId] = pathSegments;

  if (sourceCollection === 'orders') {
    return {
      sourceType: 'order',
      sourceCollection,
      sourceDocumentId,
    };
  }

  if (sourceCollection === 'payment_requests') {
    return {
      sourceType: 'payment_request',
      sourceCollection,
      sourceDocumentId,
    };
  }

  if (sourceCollection === 'invoices') {
    return {
      sourceType: 'invoice',
      sourceCollection,
      sourceDocumentId,
    };
  }

  return {
    sourceType: null,
    sourceCollection: null,
    sourceDocumentId: null,
  };
}

function normalizeForHash(value: unknown): unknown {
  if (value instanceof Timestamp) {
    const timestampValue = value as {
      seconds: number;
      nanoseconds: number;
    };

    return {
      __type: 'timestamp',
      seconds: timestampValue.seconds,
      nanoseconds: timestampValue.nanoseconds,
    };
  }

  if (value instanceof Date) {
    return {
      __type: 'date',
      iso: value.toISOString(),
    };
  }

  if (
    typeof value === 'object' &&
    value !== null &&
    'path' in value &&
    typeof (value as { path?: unknown }).path === 'string' &&
    'firestore' in value
  ) {
    return {
      __type: 'document_reference',
      path: (value as DocumentReference).path,
    };
  }

  if (
    typeof value === 'object' &&
    value !== null &&
    'latitude' in value &&
    typeof (value as { latitude?: unknown }).latitude === 'number' &&
    'longitude' in value &&
    typeof (value as { longitude?: unknown }).longitude === 'number'
  ) {
    return {
      __type: 'geopoint',
      latitude: (value as { latitude: number }).latitude,
      longitude: (value as { longitude: number }).longitude,
    };
  }

  if (Array.isArray(value)) {
    return value.map(normalizeForHash);
  }

  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, nestedValue]) => nestedValue !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nestedValue]) => [key, normalizeForHash(nestedValue)]),
    );
  }

  return value;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function buildSourceSnapshotHash(
  sourceCollection: LegacyMessageMigrationSourceCollection,
  sourceDocumentId: string,
  sourceData: DocumentData,
): Promise<string> {
  const normalizedSourceData = normalizeForHash(sourceData);
  const payload = JSON.stringify({
    sourceCollection,
    sourceDocumentId,
    sourceData: normalizedSourceData,
  });
  const digest = await webcrypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(payload),
  );

  return bytesToHex(new Uint8Array(digest));
}

function toComparableState(state: LegacyMessageMigrationState): unknown {
  return normalizeForHash({
    legacyConversationId: state.legacyConversationId,
    sourceType: state.sourceType,
    sourceCollection: state.sourceCollection,
    sourceDocumentId: state.sourceDocumentId,
    derivedParticipantUids: state.derivedParticipantUids,
    legacyParticipantSnapshot: state.legacyParticipantSnapshot,
    status: state.status,
    reasonCodes: state.reasonCodes,
    sourceSnapshotHash: state.sourceSnapshotHash,
    attemptCount: state.attemptCount,
    createdAt: state.createdAt,
    version: state.version,
  });
}

function buildStateRecord(
  legacyConversationId: string,
  evaluation: LegacyMessageEvaluation,
  legacyParticipantSnapshot: unknown[],
  sourceSnapshotHash: string | null,
  createdAt: Timestamp,
  attemptCount: number,
  updatedAt: Timestamp,
): LegacyMessageMigrationState {
  const sourceMetadata = parseSourceMetadata(evaluation);

  return {
    legacyConversationId,
    ...sourceMetadata,
    derivedParticipantUids: evaluation.derivedParticipantUids ?? [],
    legacyParticipantSnapshot,
    status: mapEvaluationStatus(evaluation.status),
    reasonCodes: [...evaluation.reasonCodes],
    sourceSnapshotHash,
    attemptCount,
    createdAt,
    updatedAt,
    version: MIGRATION_STATE_VERSION,
  };
}

function createTransactionScopedEvaluationDb(
  db: Firestore,
  transaction: StateTransaction,
  legacyConversationId: string,
  conversationSnapshot: TransactionDocumentSnapshot,
  sourceSnapshotsByPath: Map<string, TransactionDocumentSnapshot>,
): Firestore {
  return {
    collection: (collectionName: string) => ({
      doc: (documentId: string) => ({
        get: async () => {
          const path = `${collectionName}/${documentId}`;
          if (path === `conversations/${legacyConversationId}`) {
            return conversationSnapshot;
          }

          const sourceSnapshot = sourceSnapshotsByPath.get(path);
          if (sourceSnapshot) {
            return sourceSnapshot;
          }

          const nextSourceSnapshot = await transaction.get(
            db.collection(collectionName).doc(documentId),
          );
          sourceSnapshotsByPath.set(path, nextSourceSnapshot);
          return nextSourceSnapshot;
        },
      }),
    }),
  } as Firestore;
}

/**
 * Creates or updates the isolated migration-state document for a single legacy
 * conversation without modifying any legacy or Communication Core records.
 */
export async function createOrUpdateLegacyMessageMigrationState(
  legacyConversationId: string,
): Promise<LegacyMessageMigrationState> {
  return createOrUpdateLegacyMessageMigrationStateWithDependencies(
    legacyConversationId,
    getDependencies(),
  );
}

async function createOrUpdateLegacyMessageMigrationStateWithDependencies(
  legacyConversationId: string,
  { db }: MigrationDependencies,
): Promise<LegacyMessageMigrationState> {
  const stateDocumentReference = db
    .collection(MIGRATION_STATE_COLLECTION)
    .doc(legacyConversationId);
  const conversationDocumentReference = db
    .collection('conversations')
    .doc(legacyConversationId);

  return db.runTransaction(async (transaction: StateTransaction) => {
    const existingStateSnapshot = await transaction.get(stateDocumentReference);
    if (existingStateSnapshot.exists) {
      const existingState =
        existingStateSnapshot.data() as LegacyMessageMigrationState;
      if (IMMUTABLE_STATUSES.has(existingState.status)) {
        return existingState;
      }
    }

    const conversationSnapshot = await transaction.get(conversationDocumentReference);
    const transactionConversation =
      conversationSnapshot.exists
        ? (conversationSnapshot.data() as LegacyConversationDiagnosticSnapshot)
        : null;
    const sourceSnapshotsByPath = new Map<string, TransactionDocumentSnapshot>();
    const evaluation = await evaluateLegacyConversationWithOverrides(
      legacyConversationId,
      {
        db: createTransactionScopedEvaluationDb(
          db,
          transaction,
          legacyConversationId,
          conversationSnapshot,
          sourceSnapshotsByPath,
        ),
      },
    );
    const sourceMetadata = parseSourceMetadata(evaluation);
    const legacyParticipantSnapshot = getLegacyParticipantSnapshot(
      transactionConversation,
    );
    const sourceSnapshotHash =
      sourceMetadata.sourceCollection && sourceMetadata.sourceDocumentId
        ? await (async () => {
            const sourcePath = `${sourceMetadata.sourceCollection}/${sourceMetadata.sourceDocumentId}`;
            let sourceSnapshot = sourceSnapshotsByPath.get(sourcePath);
            if (!sourceSnapshot) {
              sourceSnapshot = await transaction.get(
                db
                  .collection(sourceMetadata.sourceCollection)
                  .doc(sourceMetadata.sourceDocumentId),
              );
              sourceSnapshotsByPath.set(sourcePath, sourceSnapshot);
            }

            if (!sourceSnapshot.exists) {
              return null;
            }

            return buildSourceSnapshotHash(
              sourceMetadata.sourceCollection,
              sourceMetadata.sourceDocumentId,
              sourceSnapshot.data() as DocumentData,
            );
          })()
        : null;
    const now = Timestamp.now();
    const createdAt =
      existingStateSnapshot.exists &&
      existingStateSnapshot.data()?.createdAt instanceof Timestamp
        ? (existingStateSnapshot.data()?.createdAt as Timestamp)
        : now;
    const attemptCount =
      existingStateSnapshot.exists &&
      typeof existingStateSnapshot.data()?.attemptCount === 'number'
        ? existingStateSnapshot.data()?.attemptCount
        : 0;
    const nextState = buildStateRecord(
      legacyConversationId,
      evaluation,
      legacyParticipantSnapshot,
      sourceSnapshotHash,
      createdAt,
      attemptCount,
      now,
    );

    if (existingStateSnapshot.exists) {
      const existingState =
        existingStateSnapshot.data() as LegacyMessageMigrationState;
      const comparableExistingState = toComparableState(existingState);
      const comparableNextState = toComparableState(nextState);

      if (
        JSON.stringify(comparableExistingState) ===
        JSON.stringify(comparableNextState)
      ) {
        return existingState;
      }
    }

    transaction.set(stateDocumentReference, nextState);
    return nextState;
  });
}

export const __legacyMessageMigrationStateTestOnly = {
  buildSourceSnapshotHash,
  createOrUpdateLegacyMessageMigrationStateWithDependencies,
  mapEvaluationStatus,
  parseSourceMetadata,
};
