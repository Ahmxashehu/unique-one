import type { Express } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { createHash, randomUUID, scryptSync } from 'crypto';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getUniqueOtpService } from './uniqueOtpRuntime';

type RecoveryChannel = 'sms' | 'email';

function normalizePhone(value: unknown): string {
  if (typeof value !== 'string') throw new Error('INVALID_PHONE');
  const trimmed = value.trim().replace(/[\s()-]/g, '');
  const normalized = trimmed.startsWith('+') ? trimmed : /^0\d{10}$/.test(trimmed) ? `+234${trimmed.slice(1)}` : trimmed;
  if (!/^\+\d{8,15}$/.test(normalized)) throw new Error('INVALID_PHONE');
  return normalized;
}

function validatePassword(value: unknown): string {
  const weak = new Set(['000000','111111','123456','654321','121212','112233','123123']);
  if (typeof value !== 'string' || !/^\d{6}$/.test(value) || weak.has(value)) throw new Error('INVALID_PASSWORD');
  return value;
}

function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function registerUniqueOtpRoutes(app: Express) {
  app.post('/api/auth/unique-otp/recovery/request', rateLimit({
    windowMs: 10 * 60_000,
    limit: 5,
    standardHeaders: true,
    legacyHeaders: true,
    keyGenerator: (req) => ipKeyGenerator(req.ip),
    handler: (_req, res) => res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Too many recovery requests. Please try again later.' } }),
  }), async (req, res) => {
    try {
      const phone = normalizePhone(req.body?.phone);
      const channel: RecoveryChannel = req.body?.channel === 'email' ? 'email' : 'sms';
      if (channel !== 'sms') return res.status(400).json({ error: { code: 'UNSUPPORTED_CHANNEL', message: 'Phone recovery currently uses SMS.' } });
      const user = await getAuth().getUserByPhoneNumber(phone);
      await getUniqueOtpService(channel).issue({ destination: phone, purpose: 'password_reset', channel });
      return res.json({ ok: true, channel, expiresInSeconds: 300, resendAfterSeconds: 30, recoveryStarted: true });
    } catch (error: any) {
      if (error?.message === 'INVALID_PHONE') return res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'Enter a valid registered phone number.' } });
      if (error?.code === 'auth/user-not-found') return res.status(200).json({ ok: true, channel: 'sms', expiresInSeconds: 300, resendAfterSeconds: 30, recoveryStarted: true });
      console.error('UniqueOTP recovery request failed:', error);
      return res.status(503).json({ error: { code: 'SERVICE_UNAVAILABLE', message: 'We could not send a recovery code right now.' } });
    }
  });

  app.post('/api/auth/unique-otp/recovery/verify', rateLimit({
    windowMs: 10 * 10_000,
    limit: 8,
    standardHeaders: true,
    legacyHeaders: true,
    keyGenerator: (req) => ipKeyGenerator(req.ip),
    handler: (_req, res) => res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Too many verification attempts. Please wait before trying again.' } }),
  }), async (req, res) => {
    try {
      const phone = normalizePhone(req.body?.phone);
      const code = typeof req.body?.code === 'string' ? req.body.code : '';
      if (!/^\d{6}$/.test(code)) return res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'Enter the 6-digit verification code.' } });
      const verified = await getUniqueOtpService('sms').verify({ destination: phone, purpose: 'password_reset', code });
      if (!verified) return res.status(403).json({ error: { code: 'OTP_INVALID', message: 'The verification code is invalid, expired, or already used.' } });

      const user = await getAuth().getUserByPhoneNumber(phone);
      const recoveryToken = randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '');
      const now = Timestamp.now();
      await getFirestore().collection('uniqueOtpRecoverySessions').doc(tokenHash(recoveryToken)).set({
        uid: user.uid,
        phone,
        purpose: 'password_reset',
        createdAt: now,
        expiresAt: Timestamp.fromMillis(Date.now() + 10 * 60_000),
        consumedAt: null,
      });
      return res.json({ ok: true, verified: true, recoveryToken, expiresInSeconds: 600 });
    } catch (error: any) {
      if (error?.message === 'INVALID_PHONE') return res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'Enter a valid registered phone number.' } });
      if (error?.code === 'auth/user-not-found') return res.status(403).json({ error: { code: 'OTP_INVALID', message: 'The verification code is invalid or expired.' } });
      console.error('UniqueOTP recovery verification failed:', error);
      return res.status(503).json({ error: { code: 'SERVICE_UNAVAILABLE', message: 'Recovery verification could not be completed.' } });
    }
  });

  app.post('/api/auth/unique-otp/recovery/reset-password', rateLimit({
    windowMs: 10 * 60_000,
    limit: 5,
    standardHeaders: true,
    legacyHeaders: true,
    keyGenerator: (req) => ipKeyGenerator(req.ip),
    handler: (_req, res) => res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Too many password reset attempts. Please try again later.' } }),
  }), async (req, res) => {
    try {
      const recoveryToken = typeof req.body?.recoveryToken === 'string' ? req.body.recoveryToken.trim() : '';
      if (!/^[a-f0-9]{64}$/.test(recoveryToken)) return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'A verified recovery session is required.' } });
      const password = validatePassword(req.body?.password);
      const confirmPassword = validatePassword(req.body?.confirmPassword);
      if (password !== confirmPassword) return res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'The 6-digit login passwords do not match.' } });

      const db = getFirestore();
      const sessionRef = db.collection('uniqueOtpRecoverySessions').doc(tokenHash(recoveryToken));
      const credentialRef = db.collection('authCredentials');
      let uid = '';
      await db.runTransaction(async transaction => {
        const session = await transaction.get(sessionRef);
        if (!session.exists) throw new Error('RECOVERY_SESSION_INVALID');
        const data = session.data() as Record<string, unknown>;
        if (data.purpose !== 'password_reset' || data.consumedAt || !(data.expiresAt instanceof Timestamp) || data.expiresAt.toMillis() <= Date.now() || typeof data.uid !== 'string') throw new Error('RECOVERY_SESSION_INVALID');
        uid = data.uid;
        const credentialSnapshot = await transaction.get(credentialRef.doc(uid));
        if (!credentialSnapshot.exists) throw new Error('CREDENTIAL_NOT_FOUND');
        const loginSalt = randomUUID().replace(/-/g, '');
        transaction.update(credentialRef.doc(uid), {
          loginPasswordSalt: loginSalt,
          loginPasswordHash: scryptSync(password, loginSalt, 64).toString('hex'),
          updatedAt: Timestamp.now(),
        });
        transaction.update(sessionRef, { consumedAt: Timestamp.now() });
      });
      await db.collection('users').doc(uid).set({ lastLogin: new Date().toISOString(), verificationStatus: 'phone_verified' }, { merge: true });
      return res.json({ ok: true, passwordReset: true });
    } catch (error: any) {
      if (error?.message === 'INVALID_PASSWORD') return res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'Choose a valid 6-digit login password.' } });
      if (error?.message === 'RECOVERY_SESSION_INVALID') return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'The recovery session is invalid, expired, or already used.' } });
      if (error?.message === 'CREDENTIAL_NOT_FOUND') return res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'This account does not have a recoverable login credential yet.' } });
      console.error('UniqueOTP password reset failed:', error);
      return res.status(503).json({ error: { code: 'SERVICE_UNAVAILABLE', message: 'Password reset could not be completed.' } });
    }
  });
}
