import type { Express } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { createHash, randomUUID } from 'crypto';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getUniqueOtpService } from './uniqueOtpRuntime';

function normalizePhone(value: unknown): string {
  if (typeof value !== 'string' || !/^0\d{10}$/.test(value.trim())) throw new Error('INVALID_PHONE');
  return `+234${value.trim().slice(1)}`;
}

function validateName(value: unknown, required: boolean): string {
  const name = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, 80) : '';
  if (required && !name) throw new Error('INVALID_NAME');
  return name;
}

function validateOptionalEmail(value: unknown): string {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value !== 'string') throw new Error('INVALID_EMAIL');
  const email = value.trim().toLowerCase();
  if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email) || email.length > 254) throw new Error('INVALID_EMAIL');
  return email;
}

function validateText(value: unknown, required: boolean, max = 120): string {
  const text = typeof value === 'string' ? value.trim().replace(/\\s+/g, ' ').slice(0, max) : '';
  if (required && !text) throw new Error('INVALID_REQUEST');
  return text;
}

function uniqueIdFromPhone(phone: string): string {
  return phone.slice(4);
}

function fullNameFromParts(firstName: string, otherName: string, lastName: string): string {
  return [firstName, otherName, lastName].filter(Boolean).join(' ');
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
      const firstName = validateName(req.body?.firstName, true);
      const otherName = validateName(req.body?.otherName, false);
      const lastName = validateName(req.body?.lastName, true);
      const email = validateOptionalEmail(req.body?.email);
      const country = validateText(req.body?.country, true, 80);
      const state = validateText(req.body?.state, true, 80);
      const lga = validateText(req.body?.lga, true, 100);
      const town = validateText(req.body?.town, true, 100);
      const area = validateText(req.body?.area, true, 120);
      const fullAddress = validateText(req.body?.fullAddress, true, 300);
      const landmark = validateText(req.body?.landmark, false, 160);
      const fullName = fullNameFromParts(firstName, otherName, lastName);

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
        transaction.create(credentialRef, {
          uid, phone, loginPasswordSalt: loginSalt, loginPasswordHash: require('crypto').scryptSync(password, loginSalt, 64).toString('hex'),
          transactionPinSalt: pinSalt, transactionPinHash: require('crypto').scryptSync(transactionPin, pinSalt, 64).toString('hex'),
          createdAt: now, updatedAt: now,
        });
        const uniqueOneId = uniqueIdFromPhone(phone);
        transaction.set(db.collection('users').doc(uid), {
          uid, email, emailVerified: false, phone, phoneVerified: true, uniqueOneId,
          firstName, otherName, lastName, fullName, roles: ['customer'], permissions: [], status: 'active',
          preferredLanguage: 'en', createdAt: now.toDate().toISOString(), lastLogin: now.toDate().toISOString(),
          verificationStatus: 'phone_verified', hasSecurePin: true, twoFactorEnabled: false,
          address: { country, state, lga, town, area, fullAddress, landmark },
          shippingAddresses: [{ id: 'default', label: 'Home', recipientName: fullName, phone, country, state, lga, town, area, fullAddress, landmark, isDefault: true }],
          communicationProfile: { firstName, otherName, lastName, profilePhotoUrl: '', locationVisibility: 'city_only' },
        }, { merge: true });
        transaction.update(sessionRef, { consumedAt: now });
      });
      return res.json({ ok: true, uid, uniqueOneId: uniqueIdFromPhone(phone), hasSecurePin: true, emailVerified: false });
    } catch (error: any) {
      if (['INVALID_PASSWORD','INVALID_PIN','INVALID_NAME','INVALID_EMAIL','INVALID_REQUEST'].includes(error?.message)) return res.status(400).json({ error: { code: 'INVALID_REQUEST', message: error?.message === 'INVALID_EMAIL' ? 'Enter a valid email address or leave it blank.' : 'Check your registration details and try again.' } });
      if (error?.message === 'REGISTRATION_SESSION_INVALID') return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'The registration verification session is invalid, expired, or already used.' } });
      if (error?.message === 'ALREADY_PROVISIONED') return res.status(409).json({ error: { code: 'ALREADY_REGISTERED', message: 'This registration has already been completed.' } });
      console.error('UniqueOTP registration completion failed:', error);
      return res.status(503).json({ error: { code: 'SERVICE_UNAVAILABLE', message: 'Registration could not be completed.' } });
    }
  });
}
