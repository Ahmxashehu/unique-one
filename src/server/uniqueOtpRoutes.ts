import type { Express, RequestHandler } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { createHash, randomUUID, scryptSync } from 'crypto';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getUniqueOtpService, isWhatsAppOtpConfigured } from './uniqueOtpRuntime';

type RecoveryChannel = 'sms' | 'whatsapp' | 'email';

function normalizePhone(value: unknown): string {
  if (typeof value !== 'string') throw new Error('INVALID_PHONE');
  const trimmed = value.trim().replace(/[\s()-]/g, '');
  const normalized = trimmed.startsWith('+') ? trimmed : /^0\d{10}$/.test(trimmed) ? `+234${trimmed.slice(1)}` : trimmed;
  if (!/^\+\d{8,15}$/.test(normalized)) throw new Error('INVALID_PHONE');
  return normalized;
}

function validatePassword(value: unknown): string {
  const weak = new Set(['000000','111111','222222','333333','444444','555555','666666','777777','888888','999999','123456','654321','121212','212121','112233','123123']);
  if (typeof value !== 'string' || !/^\d{6}$/.test(value) || weak.has(value)) throw new Error('INVALID_PASSWORD');
  const digits = value.split('').map(Number);
  const ascending = digits.every((digit,index)=>index===0||digit===digits[index-1]+1);
  const descending = digits.every((digit,index)=>index===0||digit===digits[index-1]-1);
  if (ascending || descending) throw new Error('INVALID_PASSWORD');
  return value;
}

function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function registerUniqueOtpRoutes(app: Express, authenticate?: RequestHandler) {
  if (authenticate) {
    app.post('/api/auth/unique-otp/email/request', authenticate, rateLimit({ windowMs: 10 * 60_000, limit: 5, standardHeaders: true, legacyHeaders: true, keyGenerator: (req) => ipKeyGenerator(req.ip) }), async (req, res) => {
      try {
        const uid = typeof (req as any).user?.uid === 'string' ? (req as any).user.uid : '';
        if (!uid) return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Authentication is required.' } });
        const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'Enter a valid email address.' } });
        const existing = await getFirestore().collection('users').where('email', '==', email).limit(1).get();
        if (!existing.empty && existing.docs[0].id !== uid) return res.status(409).json({ error: { code: 'EMAIL_ALREADY_REGISTERED', message: 'That email address is already linked to another Unique One account.' } });
        await getUniqueOtpService('email').issue({ destination: email, purpose: 'email_verification', channel: 'email' });
        return res.json({ ok: true, email, expiresInSeconds: 300, resendAfterSeconds: 30 });
      } catch (error: any) {
        console.error('UniqueOTP email verification request failed:', error);
        return res.status(503).json({ error: { code: 'SERVICE_UNAVAILABLE', message: 'We could not send the email verification code right now.' } });
      }
    });

    app.post('/api/auth/unique-otp/email/verify', authenticate, rateLimit({ windowMs: 10 * 10_000, limit: 8, standardHeaders: true, legacyHeaders: true, keyGenerator: (req) => ipKeyGenerator(req.ip) }), async (req, res) => {
      try {
        const uid = typeof (req as any).user?.uid === 'string' ? (req as any).user.uid : '';
        if (!uid) return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Authentication is required.' } });
        const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
        const code = typeof req.body?.code === 'string' ? req.body.code : '';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^\d{6}$/.test(code)) return res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'Enter a valid email address and 6-digit UniqueOTP.' } });
        const verified = await getUniqueOtpService('email').verify({ destination: email, purpose: 'email_verification', channel: 'email', code });
        if (!verified) return res.status(403).json({ error: { code: 'OTP_INVALID', message: 'The email UniqueOTP is invalid, expired, or already used.' } });
        const existing = await getFirestore().collection('users').where('email', '==', email).limit(1).get();
        if (!existing.empty && existing.docs[0].id !== uid) return res.status(409).json({ error: { code: 'EMAIL_ALREADY_REGISTERED', message: 'That email address is already linked to another Unique One account.' } });
        await getFirestore().collection('users').doc(uid).set({ email, emailVerified: true }, { merge: true });
        return res.json({ ok: true, email, emailVerified: true });
      } catch (error: any) {
        console.error('UniqueOTP email verification failed:', error);
        return res.status(503).json({ error: { code: 'SERVICE_UNAVAILABLE', message: 'Email verification could not be completed.' } });
      }
    });
  }
  app.post('/api/auth/unique-otp/recovery/options', rateLimit({
    windowMs: 10 * 60_000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: true,
    keyGenerator: (req) => ipKeyGenerator(req.ip),
  }), async (req, res) => {
    try {
      normalizePhone(req.body?.phone);
      return res.json({
        ok: true,
        channels: isWhatsAppOtpConfigured() ? ['sms', 'whatsapp'] : ['sms'],
        whatsappBeta: isWhatsAppOtpConfigured(),
      });
    } catch (error: any) {
      if (error?.message === 'INVALID_PHONE') return res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'Enter a valid registered phone number.' } });
      console.error('UniqueOTP recovery options failed:', error);
      return res.status(503).json({ error: { code: 'SERVICE_UNAVAILABLE', message: 'Recovery options are temporarily unavailable.' } });
    }
  });

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
      const requestedChannel = req.body?.channel;
      const channel: RecoveryChannel = requestedChannel === 'whatsapp' ? 'whatsapp' : 'sms';
      if (channel === 'whatsapp' && !isWhatsAppOtpConfigured()) {
        return res.status(400).json({ error: { code: 'WHATSAPP_BETA_UNAVAILABLE', message: 'WhatsApp OTP (Beta) is not available yet.' } });
      }
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

  app.post('/api/auth/firebase-phone/recovery/verify', rateLimit({
    windowMs: 10 * 10_000,
    limit: 8,
    standardHeaders: true,
    legacyHeaders: true,
    keyGenerator: (req) => ipKeyGenerator(req.ip),
  }), async (req, res) => {
    try {
      const idToken = typeof req.body?.idToken === 'string' ? req.body.idToken.trim() : '';
      const phone = normalizePhone(req.body?.phone);
      if (!idToken) return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Firebase phone verification is required.' } });
      const decoded = await getAuth().verifyIdToken(idToken);
      if (decoded.phone_number !== phone) return res.status(403).json({ error: { code: 'PHONE_VERIFICATION_MISMATCH', message: 'The verified phone does not match this account.' } });
      const userDoc = await getFirestore().collection('users').doc(decoded.uid).get();
      if (!userDoc.exists || userDoc.data()?.phone !== phone) return res.status(403).json({ error: { code: 'ACCOUNT_NOT_FOUND', message: 'No matching Unique One account was found.' } });
      const recoveryToken = randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '');
      const now = Timestamp.now();
      await getFirestore().collection('uniqueOtpRecoverySessions').doc(tokenHash(recoveryToken)).set({
        uid: decoded.uid, phone, purpose: 'password_reset', provider: 'firebase_phone_auth',
        createdAt: now, expiresAt: Timestamp.fromMillis(Date.now() + 10 * 60_000), consumedAt: null,
      });
      return res.json({ ok: true, verified: true, recoveryToken, expiresInSeconds: 600 });
    } catch (error: any) {
      if (error?.message === 'INVALID_PHONE') return res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'Enter a valid registered phone number.' } });
      if (error?.code === 'auth/invalid-id-token' || error?.code === 'auth/id-token-expired' || error?.code === 'auth/id-token-revoked') return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Firebase phone verification is invalid or expired.' } });
      console.error('Firebase phone recovery verification failed:', error);
      return res.status(503).json({ error: { code: 'SERVICE_UNAVAILABLE', message: 'Phone verification could not be completed.' } });
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
      const requestedChannel = req.body?.channel;
      const channel: RecoveryChannel = requestedChannel === 'whatsapp' ? 'whatsapp' : 'sms';
      const verified = await getUniqueOtpService(channel).verify({ destination: phone, purpose: 'password_reset', channel, code });
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


  app.post('/api/auth/unique-otp/recovery/request-pin', rateLimit({
    windowMs: 10 * 60_000,
    limit: 5,
    standardHeaders: true,
    legacyHeaders: true,
    keyGenerator: (req) => ipKeyGenerator(req.ip),
    handler: (_req, res) => res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Too many PIN recovery requests. Please try again later.' } }),
  }), async (req, res) => {
    try {
      const phone = normalizePhone(req.body?.phone);
      const requestedChannel = req.body?.channel;
      const channel: RecoveryChannel = requestedChannel === 'whatsapp' ? 'whatsapp' : 'sms';
      if (channel === 'whatsapp' && !isWhatsAppOtpConfigured()) {
        return res.status(400).json({ error: { code: 'WHATSAPP_BETA_UNAVAILABLE', message: 'WhatsApp OTP (Beta) is not available yet.' } });
      }
      await getAuth().getUserByPhoneNumber(phone);
      await getUniqueOtpService(channel).issue({ destination: phone, purpose: 'transaction_pin_reset', channel });
      return res.json({ ok: true, channel, expiresInSeconds: 300, resendAfterSeconds: 30, recoveryStarted: true });
    } catch (error: any) {
      if (error?.message === 'INVALID_PHONE') return res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'Enter a valid registered phone number.' } });
      if (error?.code === 'auth/user-not-found') return res.status(200).json({ ok: true, channel: 'sms', expiresInSeconds: 300, resendAfterSeconds: 30, recoveryStarted: true });
      console.error('UniqueOTP transaction PIN recovery request failed:', error);
      return res.status(503).json({ error: { code: 'SERVICE_UNAVAILABLE', message: 'We could not send a PIN recovery code right now.' } });
    }
  });

  app.post('/api/auth/unique-otp/recovery/verify-pin', rateLimit({
    windowMs: 10 * 10_000,
    limit: 8,
    standardHeaders: true,
    legacyHeaders: true,
    keyGenerator: (req) => ipKeyGenerator(req.ip),
    handler: (_req, res) => res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Too many PIN verification attempts. Please wait before trying again.' } }),
  }), async (req, res) => {
    try {
      const phone = normalizePhone(req.body?.phone);
      const code = typeof req.body?.code === 'string' ? req.body.code : '';
      if (!/^\d{6}$/.test(code)) return res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'Enter the 6-digit verification code.' } });
      const requestedChannel = req.body?.channel;
      const channel: RecoveryChannel = requestedChannel === 'whatsapp' ? 'whatsapp' : 'sms';
      const verified = await getUniqueOtpService(channel).verify({ destination: phone, purpose: 'transaction_pin_reset', channel, code });
      if (!verified) return res.status(403).json({ error: { code: 'OTP_INVALID', message: 'The verification code is invalid, expired, or already used.' } });
      const user = await getAuth().getUserByPhoneNumber(phone);
      const recoveryToken = randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '');
      const now = Timestamp.now();
      await getFirestore().collection('uniqueOtpRecoverySessions').doc(tokenHash(recoveryToken)).set({
        uid: user.uid, phone, purpose: 'transaction_pin_reset', createdAt: now,
        expiresAt: Timestamp.fromMillis(Date.now() + 10 * 60_000), consumedAt: null,
      });
      return res.json({ ok: true, verified: true, recoveryToken, expiresInSeconds: 600 });
    } catch (error: any) {
      if (error?.message === 'INVALID_PHONE') return res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'Enter a valid registered phone number.' } });
      if (error?.code === 'auth/user-not-found') return res.status(403).json({ error: { code: 'OTP_INVALID', message: 'The verification code is invalid or expired.' } });
      console.error('UniqueOTP transaction PIN recovery verification failed:', error);
      return res.status(503).json({ error: { code: 'SERVICE_UNAVAILABLE', message: 'PIN recovery verification could not be completed.' } });
    }
  });

  app.post('/api/auth/unique-otp/recovery/reset-pin', rateLimit({
    windowMs: 10 * 60_000,
    limit: 5,
    standardHeaders: true,
    legacyHeaders: true,
    keyGenerator: (req) => ipKeyGenerator(req.ip),
    handler: (_req, res) => res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Too many PIN reset attempts. Please try again later.' } }),
  }), async (req, res) => {
    try {
      const recoveryToken = typeof req.body?.recoveryToken === 'string' ? req.body.recoveryToken.trim() : '';
      if (!/^\[a-f0-9]{64}$/.test(recoveryToken)) return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'A verified PIN recovery session is required.' } });
      const pin = typeof req.body?.pin === 'string' ? req.body.pin : '';
      const confirmPin = typeof req.body?.confirmPin === 'string' ? req.body.confirmPin : '';
      if (!/^\d{4}$/.test(pin) || !/^\d{4}$/.test(confirmPin)) return res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'Choose a valid 4-digit transaction PIN.' } });
      if (pin !== confirmPin) return res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'The 4-digit transaction PINs do not match.' } });
      if (/^(\d)\1{3}$/.test(pin) || /^0123$|^1234$|^4321$/.test(pin)) return res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'Choose a stronger 4-digit transaction PIN.' } });

      const db = getFirestore();
      const sessionRef = db.collection('uniqueOtpRecoverySessions').doc(tokenHash(recoveryToken));
      let uid = '';
      await db.runTransaction(async transaction => {
        const session = await transaction.get(sessionRef);
        if (!session.exists) throw new Error('PIN_RECOVERY_SESSION_INVALID');
        const data = session.data() as Record<string, unknown>;
        if (data.purpose !== 'transaction_pin_reset' || data.consumedAt || !(data.expiresAt instanceof Timestamp) || data.expiresAt.toMillis() <= Date.now() || typeof data.uid !== 'string') throw new Error('PIN_RECOVERY_SESSION_INVALID');
        uid = data.uid;
        const credentialRef = db.collection('authCredentials').doc(uid);
        const credential = await transaction.get(credentialRef);
        if (!credential.exists) throw new Error('CREDENTIAL_NOT_FOUND');
        const pinSalt = randomUUID().replace(/-/g, '');
        transaction.update(credentialRef, {
          transactionPinSalt: pinSalt,
          transactionPinHash: scryptSync(pin, pinSalt, 64).toString('hex'),
          updatedAt: Timestamp.now(),
        });
        transaction.update(sessionRef, { consumedAt: Timestamp.now() });
      });
      try {
        await getAuth().revokeRefreshTokens(uid);
      } catch (revokeError) {
        console.error('UniqueOTP transaction PIN reset session revocation failed:', revokeError);
        return res.status(503).json({ error: { code: 'SERVICE_UNAVAILABLE', message: 'PIN was changed, but active sessions could not be safely revoked. Please sign in again later.' } });
      }
      return res.json({ ok: true, transactionPinReset: true });
    } catch (error: any) {
      if (error?.message === 'PIN_RECOVERY_SESSION_INVALID') return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'The PIN recovery session is invalid, expired, or already used.' } });
      if (error?.message === 'CREDENTIAL_NOT_FOUND') return res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'This account does not have a recoverable transaction PIN yet.' } });
      console.error('UniqueOTP transaction PIN reset failed:', error);
      return res.status(503).json({ error: { code: 'SERVICE_UNAVAILABLE', message: 'Transaction PIN reset could not be completed.' } });
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
      // Password recovery changes the credential first; then revoke refresh tokens so
      // previously issued Firebase sessions cannot silently remain authorized.
      try {
        await getAuth().revokeRefreshTokens(uid);
      } catch (revokeError) {
        console.error('UniqueOTP password reset session revocation failed:', revokeError);
        return res.status(503).json({ error: { code: 'SERVICE_UNAVAILABLE', message: 'Password was changed, but active sessions could not be safely revoked. Please sign in again later.' } });
      }
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
