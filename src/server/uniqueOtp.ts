import { createHash, randomInt, timingSafeEqual } from 'crypto';

export type UniqueOtpPurpose =
  | 'registration'
  | 'password_reset'
  | 'phone_change'
  | 'transaction_step_up';

export type UniqueOtpChannel = 'sms' | 'email';

export interface UniqueOtpRecord {
  id: string;
  destination: string;
  purpose: UniqueOtpPurpose;
  channel: UniqueOtpChannel;
  codeHash: string;
  expiresAt: Date;
  attempts: number;
  maxAttempts: number;
  consumedAt?: Date;
  createdAt: Date;
}

export interface UniqueOtpStore {
  invalidateActive(input: { destination: string; purpose: UniqueOtpPurpose }): Promise<void>;
  create(record: UniqueOtpRecord): Promise<void>;
  findActive(input: { destination: string; purpose: UniqueOtpPurpose; now: Date }): Promise<UniqueOtpRecord | null>;
  consume(id: string, consumedAt: Date): Promise<boolean>;
  incrementAttempts(id: string, attempts: number): Promise<void>;
}

export interface UniqueOtpProvider {
  send(input: {
    destination: string;
    code: string;
    purpose: UniqueOtpPurpose;
    channel: UniqueOtpChannel;
    expiresInSeconds: number;
  }): Promise<void>;
}

export interface UniqueOtpServiceOptions {
  store: UniqueOtpStore;
  provider: UniqueOtpProvider;
  ttlSeconds?: number;
  maxAttempts?: number;
  pepper?: string;
}

export interface IssueOtpInput {
  destination: string;
  purpose: UniqueOtpPurpose;
  channel: UniqueOtpChannel;
}

export interface VerifyOtpInput {
  destination: string;
  purpose: UniqueOtpPurpose;
  code: string;
}

const DEFAULT_TTL_SECONDS = 5 * 60;
const DEFAULT_MAX_ATTEMPTS = 5;

function assertDestination(value: string): string {
  const destination = value.trim();
  if (!destination || destination.length > 320) throw new Error('INVALID_OTP_DESTINATION');
  return destination;
}

function assertOtpCode(value: string): string {
  if (!/^\d{6}$/.test(value)) throw new Error('INVALID_OTP_CODE');
  return value;
}

function hashOtp(code: string, recordId: string, pepper: string): string {
  return createHash('sha256').update(recordId).update(':').update(code).update(':').update(pepper).digest('hex');
}

function hashesMatch(actualHex: string, expectedHex: string): boolean {
  const actual = Buffer.from(actualHex, 'hex');
  const expected = Buffer.from(expectedHex, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function generateOtpCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

function generateOtpId(): string {
  return randomInt(0, 1_000_000_000).toString(36) + Date.now().toString(36);
}

export class UniqueOtpService {
  private readonly ttlSeconds: number;
  private readonly maxAttempts: number;
  private readonly pepper: string;

  constructor(private readonly options: UniqueOtpServiceOptions) {
    this.ttlSeconds = options.ttlSeconds ?? DEFAULT_TTL_SECONDS;
    this.maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
    this.pepper = options.pepper ?? process.env.UNIQUE_OTP_PEPPER ?? '';
    if (!Number.isInteger(this.ttlSeconds) || this.ttlSeconds < 60 || this.ttlSeconds > 15 * 60) throw new Error('INVALID_OTP_TTL');
    if (!Number.isInteger(this.maxAttempts) || this.maxAttempts < 1 || this.maxAttempts > 10) throw new Error('INVALID_OTP_ATTEMPTS');
    if (this.pepper.length < 16) throw new Error('UNIQUE_OTP_PEPPER_REQUIRED');
  }

  async issue(input: IssueOtpInput): Promise<{ expiresAt: Date; resendAfterSeconds: number }> {
    const destination = assertDestination(input.destination);
    await this.options.store.invalidateActive({ destination, purpose: input.purpose });
    const id = generateOtpId();
    const code = generateOtpCode();
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + this.ttlSeconds * 1000);
    const record: UniqueOtpRecord = {
      id, destination, purpose: input.purpose, channel: input.channel,
      codeHash: hashOtp(code, id, this.pepper), expiresAt, attempts: 0,
      maxAttempts: this.maxAttempts, createdAt,
    };
    await this.options.store.create(record);
    await this.options.provider.send({
      destination, code, purpose: input.purpose, channel: input.channel,
      expiresInSeconds: this.ttlSeconds,
    });
    return { expiresAt, resendAfterSeconds: 30 };
  }

  async verify(input: VerifyOtpInput): Promise<boolean> {
    const destination = assertDestination(input.destination);
    const code = assertOtpCode(input.code);
    const now = new Date();
    const record = await this.options.store.findActive({ destination, purpose: input.purpose, now });
    if (!record || record.consumedAt || record.expiresAt.getTime() <= now.getTime()) return false;
    if (record.attempts >= record.maxAttempts) return false;

    const matches = hashesMatch(hashOtp(code, record.id, this.pepper), record.codeHash);
    if (!matches) {
      await this.options.store.incrementAttempts(record.id, record.attempts + 1);
      return false;
    }

    return this.options.store.consume(record.id, now);
  }
}
