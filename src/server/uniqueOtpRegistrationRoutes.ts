import type { Express } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { createHash, randomUUID } from 'crypto';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getUniqueOtpService } from './uniqueOtpRuntime';

function normalizePhone(value: unknown): string {
  if (typeof value !== 'string') throw new Error('INVALID_PHONE');
  const trimmed = value.trim().replace(/[\s()-]/g, '');
  const normalized = trimmed.startsWith('+') ? trimmed : /^0\d{10}$/.test(trimmed) ? `+234${trimmed.slice(1)}` : trimmed;
  if (!/^\+\d{8,15}$/.test(normalized)) throw new Error('INVALID_PHONE');
  return normalized;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function validatePassword(value: unknown): string {
  const weak = new Set(['000000','111111','123456','654321','121212','112233','123123']);
  if (typeof value !== 'string' || !/^\d{6}$/.test(value) || weak.has(value)) throw new Error('INVALID_PASSWORD');
  return value;
}

function validatePin(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}$/.test(value)) throw new Error('INVALID_PIN');
  return value;
}

export function registerUniqueOtpRegistrationRoutes(app: Express) {
  app.post('/api/auth/unique-otp/registration/request', rateLimit({
    windowMs: 10 * 60_000, limit: 5, standardHeaders: true, legacyHeaders: true,
    keyGenerator: (req) => ipKeyGenerator(req.ip),
    handler: (_req, res) => res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Too many registration requests. Please try again later.' } }),
  }), async (req, res) => {
    try {
      const phone = normalizePhone(req.body?.phone);
      try {
        await getAuth().getUserByPhoneNumber(phone);
        return res.status(409).json({ error: { code: 'PHONE_ALREADY_REGISTERED', message: 'This phone number is already registered. Please log in.' } });
      } catch (error: any) {
        if (error?.code !== 'auth/user-not-found') throw error;
      }
      await getUniqueOtpService('sms').issue({ destination: phone, purpose: 'registration', channel: 'sms' });
      return res.json({ ok: true, channel: 'sms', expiresInSeconds: 300, resendAfterSeconds: 30 });
    } catch (error: any) {
      if (error?.message === 'INVALID_PHONE') return res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'Enter a valid phone number.' } });
      if (error?.code === 'auth/phone-number-already-exists') return res.status(409).json({ error: { code: 'PHONE_ALREADY_REGISTERED', message: 'This phone number is already registered. Please log in.' } });
      console.error('UniqueOTP registration request failed:', error);
      return res.status(503).json({ error: { code: 'SERVICE_UNAVAILABLE', message: 'We could not send a registration code right now.' } });
    }
  });

  app.post('/api/auth/unique-otp/registration/verify', rateLimit({
    windowMs: 10 * 10_000, limit: 8, standardHeaders: true, legacyHeaders: true,
    keyGenerator: (req) => ipKeyGenerator(req.ip),
    handler: (_req, res) => res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Too many verification attempts. Please wait before trying again.' } }),
  }), async (req, res) => {
    try {
      const phone = normalizePhone(req.body?.phone);
      const code = typeof req.body?.code === 'string' ? req.body.code : '';
      if (!/^\d{6}$/.test(code)) return res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'Enter the 6-digit UniqueOTP.' } });
      const verified = await getUniqueOtpService('sms').verify({ destination: phone, purpose: 'registration', code });
      if (!verified) return res.status(403).json({ error: { code: 'OTP_INVALID', message: 'The UniqueOTP is invalid, expired, or already used.' } });

      const auth = getAuth();
      let user;
      try {
        user = await auth.getUserByPhoneNumber(phone);
        return res.status(409).json({ error: { code: 'PHONE_ALREADY_REGISTERED', message: 'This phone number is already registered. Please log in.' } });
      } catch (error: any) {
        if (error?.code !== 'auth/user-not-found') throw error;
      }
      user = await auth.createUser({ phoneNumber: phone, disabled: false });
      const registrationToken = randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '');
      const now = Timestamp.now();
      await getFirestore().collection('uniqueOtpRegistrationSessions').doc(hashToken(registrationToken)).set({
        uid: user.uid, phone, purpose: 'registration', createdAt: now,
        expiresAt: Timestamp.fromMillis(Date.now() + 10 * 60_000), consumedAt: null,
      });
      return res.json({ ok: true, verified: true, registrationToken, expiresInSeconds: 600 });
    } catch (error: any) {
      if (error?.message === 'INVALID_PHONE') return res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'Enter a valid phone number.' } });
      console.error('UniqueOTP registration verification failed:', error);
      return res.status(503).json({ error: { code: 'SERVICE_UNAVAILABLE', message: 'Registration verification could not be completed.' } });
    }
  });

  app.post('/api/auth/unique-otp/registration/complete', rateLimit({
    windowMs: 10 * 10_000, limit: 5, standardHeaders: true, legacyHeaders: true,
    keyGenerator: (req) => ipKeyGenerator(req.ip),
    handler: (_req, res) => res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Too many registration attempts. Please try again later.' } }),
  }), async (req, res) => {
    try {
      const token = typeof req.body?.registrationToken === 'string' ? req.body.registrationToken.trim() : '';
      if (!/^[a-f0-9]{64}$/.test(token)) return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Verified phone registration is required.' } });
      const password = validatePassword(req.body?.password);
      const confirmPassword = validatePassword(req.body?.confirmPassword);
      if (password !== confirmPassword) return res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'The 6-digit login passwords do not match.' } });
      const transactionPin = validatePin(req.body?.transactionPin);
      const confirmTransactionPin = validatePin(req.body?.confirmTransactionPin);
      if (transactionPin !== confirmTransactionPin) return res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'The Transaction PINs do not match.' } });
      const fullName = typeof req.body?.fullName === 'string' ? req.body.fullName.trim().slice(0, 120) : '';
      if (!fullName) return res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'Enter your full name.' } });

      const db = getFirestore();
      const sessionRef = db.collection('uniqueOtpRegistrationSessions').doc(hashToken(token));
      let uid = '';
      let phone = '';
      const now = Timestamp.now();
      await db.runTransaction(async transaction => {
        const session = await transaction.get(sessionRef);
        if (!session.exists) throw new Error('REGISTRATION_SESSION_INVALID');
        const data = session.data() as Record<string, unknown>;
        if (data.purpose !== 'registration' || data.consumedAt || !(data.expiresAt instanceof Timestamp) || data.expiresAt.toMillis() <= Date.now() || typeof data.uid !== 'string' || typeof data.phone !== 'string') throw new Error('REGISTRATION_SESSION_INVALID');
        uid = data.uid;
        phone = data.phone;
        const credentialRef = db.collection('authCredentials').doc(uid);
        const existing = await transaction.get(credentialRef);
        if (existing.exists) throw new Error('ALREADY_PROVISIONED');
        const loginSalt = randomUUID().replace(/-/g, '');
        const pinSalt = randomUUID().replace(/-/g, '');
        const crypto = require('crypto');
        transaction.create(credentialRef, {
          uid, phone, loginPasswordSalt: loginSalt, loginPasswordHash: crypto.scryptSync(password, loginSalt, 64).toString('hex'),
          transactionPinSalt: pinSalt, transactionPinHash: crypto.scryptSync(transactionPin, pinSalt, 64).toString('hex'),
          createdAt: now, updatedAt: now,
        });
        const uniqueOneId = `U1-${uid.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10).toUpperCase() || 'ACCOUNT'}`;
        transaction.set(db.collection('users').doc(uid), {
          uid, email: '', phone, fullName, uniqueOneId, roles: ['customer'], permissions: [], status: 'active',
          preferredLanguage: 'en', createdAt: now.toDate().toISOString(), lastLogin: now.toDate().toISOString(),
          verificationStatus: 'phone_verified', hasSecurePin: true, twoFactorEnabled: false,
        }, { merge: true });
        transaction.update(sessionRef, { consumedAt: now });
      });
      return res.json({ ok: true, uid, uniqueOneId: `U1-${uid.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10).toUpperCase() || 'ACCOUNT'}`, hasSecurePin: true });
    } catch (error: any) {
      if (error?.message === 'INVALID_PASSWORD' || error?.message === 'INVALID_PIN') return res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'Enter valid registration credentials.' } });
      if (error?.message === 'REGISTRATION_SESSION_INVALID') return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'The registration verification session is invalid, expired, or already used.' } });
      if (error?.message === 'ALREADY_PROVISIONED') return res.status(409).json({ error: { code: 'ALREADY_REGISTERED', message: 'This registration has already been completed.' } });
      console.error('UniqueOTP registration completion failed:', error);
      return res.status(503).json({ error: { code: 'SERVICE_UNAVAILABLE', message: 'Registration could not be completed.' } });
    }
  });
}
