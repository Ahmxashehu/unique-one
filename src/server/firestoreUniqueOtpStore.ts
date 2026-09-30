import { Timestamp, type CollectionReference } from 'firebase-admin/firestore';
import type { UniqueOtpRecord, UniqueOtpPurpose, UniqueOtpStore, UniqueOtpChannel } from './uniqueOtp';

type StoredOtp = {
  id: string;
  destination: string;
  purpose: UniqueOtpPurpose;
  channel: UniqueOtpChannel;
  codeHash: string;
  expiresAt: Timestamp;
  attempts: number;
  maxAttempts: number;
  consumedAt?: Timestamp;
  createdAt: Timestamp;
};

function toRecord(data: StoredOtp): UniqueOtpRecord {
  return {
    id: data.id,
    destination: data.destination,
    purpose: data.purpose,
    channel: data.channel,
    codeHash: data.codeHash,
    expiresAt: data.expiresAt.toDate(),
    attempts: data.attempts,
    maxAttempts: data.maxAttempts,
    consumedAt: data.consumedAt?.toDate(),
    createdAt: data.createdAt.toDate(),
  };
}

export class FirestoreUniqueOtpStore implements UniqueOtpStore {
  constructor(private readonly collection: CollectionReference) {}

  async invalidateActive(input: { destination: string; purpose: UniqueOtpPurpose }): Promise<void> {
    const snapshot = await this.collection.where('destination', '==', input.destination).where('purpose', '==', input.purpose).where('consumedAt', '==', null).get();
    if (snapshot.empty) return;
    const batch = this.collection.firestore.batch();
    const now = Timestamp.now();
    snapshot.docs.forEach((doc) => batch.update(doc.ref, { consumedAt: now, invalidatedAt: now }));
    await batch.commit();
  }

  async create(record: UniqueOtpRecord): Promise<void> {
    await this.collection.doc(record.id).create({
      id: record.id,
      destination: record.destination,
      purpose: record.purpose,
      channel: record.channel,
      codeHash: record.codeHash,
      expiresAt: Timestamp.fromDate(record.expiresAt),
      attempts: record.attempts,
      maxAttempts: record.maxAttempts,
      consumedAt: null,
      createdAt: Timestamp.fromDate(record.createdAt),
    } satisfies StoredOtp);
  }

  async findActive(input: { destination: string; purpose: UniqueOtpPurpose; channel: UniqueOtpChannel; now: Date }): Promise<UniqueOtpRecord | null> {
    const snapshot = await this.collection.where('destination', '==', input.destination).where('purpose', '==', input.purpose).where('consumedAt', '==', null).limit(10).get();
    const active = snapshot.docs
      .map((doc) => doc.data() as StoredOtp)
      .filter((data) => data.channel === input.channel && data.expiresAt.toMillis() > input.now.getTime())
      .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis())[0];
    return active ? toRecord(active) : null;
  }

  async consume(id: string, consumedAt: Date): Promise<boolean> {
    const ref = this.collection.doc(id);
    return this.collection.firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists) return false;
      const data = snapshot.data() as StoredOtp;
      if (data.consumedAt || data.expiresAt.toMillis() <= consumedAt.getTime()) return false;
      transaction.update(ref, { consumedAt: Timestamp.fromDate(consumedAt) });
      return true;
    });
  }

  async incrementAttempts(id: string, attempts: number): Promise<void> {
    const ref = this.collection.doc(id);
    await this.collection.firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists) return;
      const data = snapshot.data() as StoredOtp;
      if (data.consumedAt || data.expiresAt.toMillis() <= Date.now()) return;
      const nextAttempts = Math.min(Math.max(data.attempts + 1, attempts), data.maxAttempts);
      if (nextAttempts <= data.attempts) return;
      transaction.update(ref, { attempts: nextAttempts });
    });
  }
}
