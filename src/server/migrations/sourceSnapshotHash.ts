import { Timestamp, type DocumentData, type DocumentReference } from 'firebase-admin/firestore';
import { webcrypto } from 'node:crypto';

/**
 * Normalizes arbitrary Firestore field values into plain, deterministically
 * ordered structures so that two logically-equal documents always produce the
 * same JSON payload (and therefore the same hash), regardless of Firestore
 * SDK internal representation differences.
 */
export function normalizeForHash(value: unknown): unknown {
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

/**
 * Builds a deterministic hash of a single source document's data, keyed by
 * its collection and id. Used both at evaluation time and at persistence
 * time so the two hashes can be compared to detect a stale source snapshot.
 */
export async function buildSourceSnapshotHash(
  sourceCollection: string,
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
