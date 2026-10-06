import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import type { Express, RequestHandler, Response } from 'express';
import { Timestamp, type Firestore } from 'firebase-admin/firestore';
import rateLimit from 'express-rate-limit';

const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const PASSWORD_MIN_LENGTH = 8;

function fail(res: Response, code: string, message: string, status = 400) {
  return res.status(status).json({ error: { code, message } });
}

function credentialId(uid: string, businessId: string) {
  return `${uid}__${businessId}`;
}

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function validateBusinessPassword(value: unknown): string | null {
  if (typeof value !== 'string' || value.length < PASSWORD_MIN_LENGTH || value.length > 128) return 'Business password must be 8–128 characters.';
  if (!/[A-Z]/.test(value) || !/[a-z]/.test(value) || !/\d/.test(value) || !/[^A-Za-z0-9]/.test(value)) {
    return 'Business password must contain uppercase, lowercase, number and special character.';
  }
  return null;
}

async function getMemberships(db: Firestore, uid: string) {
  const snapshot = await db.collection('businessMemberships')
    .where('uid', '==', uid)
    .where('status', '==', 'active')
    .limit(20)
    .get();

  return Promise.all(snapshot.docs.map(async (doc) => {
    const data = doc.data();
    const businessId = String(data.businessId || '');
    const businessSnap = businessId ? await db.collection('businesses').doc(businessId).get() : null;
    const business = businessSnap?.exists ? businessSnap.data() || {} : {};
    return {
      businessId,
      role: String(data.role || 'staff_member'),
      businessName: String(business.name || data.businessName || 'Unique Business'),
      status: String(data.status || 'active'),
    };
  }));
}

async function sessionValid(db: Firestore, uid: string, businessId: string, token: string) {
  if (!token || token.length < 32) return false;
  const snapshot = await db.collection('businessAccessSessions').doc(hashToken(token)).get();
  if (!snapshot.exists) return false;
  const data = snapshot.data() || {};
  return data.uid === uid && data.businessId === businessId && data.status === 'active' &&
    typeof data.expiresAt?.toMillis === 'function' && data.expiresAt.toMillis() > Date.now();
}

export function registerBusinessAccessRoutes(app: Express, authenticate: RequestHandler, db: Firestore) {
  const setupLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 8, standardHeaders: true, legacyHeaders: false });
  const loginLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 12, standardHeaders: true, legacyHeaders: false });

  app.get('/api/business/access/status', authenticate, async (req, res) => {
    const uid = String((req as any).user?.uid || '');
    if (!uid) return fail(res, 'UNAUTHENTICATED', 'Authentication is required.', 401);
    try {
      const memberships = await getMemberships(db, uid);
      const requestedBusinessId = typeof req.query.businessId === 'string' ? req.query.businessId : '';
      const selected = memberships.find((item) => item.businessId === requestedBusinessId) || memberships[0];
      if (!selected) return res.json({ approved: false, memberships: [] });

      const credentialSnap = await db.collection('businessAccessCredentials').doc(credentialId(uid, selected.businessId)).get();
      const token = typeof req.headers['x-business-session'] === 'string' ? req.headers['x-business-session'] : '';
      const activeSession = await sessionValid(db, uid, selected.businessId, token);

      return res.json({
        approved: true,
        memberships,
        selectedBusiness: selected,
        hasCredential: credentialSnap.exists && credentialSnap.data()?.status !== 'revoked',
        credentialStatus: credentialSnap.exists ? String(credentialSnap.data()?.status || 'active') : 'not_set',
        sessionValid: activeSession,
      });
    } catch (error) {
      console.error('Business access status failed:', error);
      return fail(res, 'SERVICE_UNAVAILABLE', 'Unable to check Business Platform access.', 503);
    }
  });

  app.post('/api/business/access/setup', setupLimiter, authenticate, async (req, res) => {
    const uid = String((req as any).user?.uid || '');
    const businessId = typeof req.body?.businessId === 'string' ? req.body.businessId.trim() : '';
    const password = req.body?.password;
    const passwordError = validateBusinessPassword(password);
    if (!uid || !businessId) return fail(res, 'INVALID_REQUEST', 'A business must be selected.');
    if (passwordError) return fail(res, 'INVALID_REQUEST', passwordError);

    try {
      const membershipSnap = await db.collection('businessMemberships').doc(`${uid}__${businessId}`).get();
      if (!membershipSnap.exists || membershipSnap.data()?.status !== 'active') return fail(res, 'FORBIDDEN', 'You do not have approved access to this business.', 403);

      const salt = randomBytes(16).toString('hex');
      const hash = scryptSync(password, salt, 64).toString('hex');
      const now = Timestamp.now();
      await db.collection('businessAccessCredentials').doc(credentialId(uid, businessId)).set({
        uid, businessId, salt, hash, status: 'active', createdAt: now, updatedAt: now, passwordSetAt: now,
      }, { merge: true });

      await db.collection('audit_logs').add({ action: 'business_password_created', actorUid: uid, targetUid: uid, businessId, createdAt: now });
      return res.json({ ok: true, status: 'active' });
    } catch (error) {
      console.error('Business access setup failed:', error);
      return fail(res, 'SERVICE_UNAVAILABLE', 'Unable to set up Business Platform security.', 503);
    }
  });

  app.post('/api/business/access/login', loginLimiter, authenticate, async (req, res) => {
    const uid = String((req as any).user?.uid || '');
    const businessId = typeof req.body?.businessId === 'string' ? req.body.businessId.trim() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!uid || !businessId || !password) return fail(res, 'INVALID_REQUEST', 'Business ID and password are required.');

    try {
      const membershipSnap = await db.collection('businessMemberships').doc(`${uid}__${businessId}`).get();
      if (!membershipSnap.exists || membershipSnap.data()?.status !== 'active') return fail(res, 'FORBIDDEN', 'You do not have approved access to this business.', 403);

      const credentialSnap = await db.collection('businessAccessCredentials').doc(credentialId(uid, businessId)).get();
      if (!credentialSnap.exists) return fail(res, 'SETUP_REQUIRED', 'Set your Business Platform password before signing in.', 409);
      const credential = credentialSnap.data() || {};
      if (credential.status !== 'active') return fail(res, 'SETUP_REQUIRED', 'Your Business Platform password must be reset before access is restored.', 409);

      const salt = String(credential.salt || '');
      const expected = Buffer.from(String(credential.hash || ''), 'hex');
      const actual = scryptSync(password, salt, 64);
      if (!salt || expected.length !== actual.length || !timingSafeEqual(expected, actual)) return fail(res, 'FORBIDDEN', 'Incorrect Business Platform password.', 403);

      const token = randomBytes(32).toString('base64url');
      const now = Timestamp.now();
      const expiresAt = Timestamp.fromMillis(Date.now() + SESSION_TTL_MS);
      await db.collection('businessAccessSessions').doc(hashToken(token)).set({
        uid, businessId, status: 'active', createdAt: now, expiresAt, lastUsedAt: now,
      });
      await db.collection('audit_logs').add({ action: 'business_login', actorUid: uid, businessId, createdAt: now });
      return res.json({ ok: true, token, expiresAt: expiresAt.toDate().toISOString() });
    } catch (error) {
      console.error('Business access login failed:', error);
      return fail(res, 'SERVICE_UNAVAILABLE', 'Unable to sign in to the Business Platform.', 503);
    }
  });

  app.post('/api/business/access/logout', authenticate, async (req, res) => {
    const uid = String((req as any).user?.uid || '');
    const token = typeof req.headers['x-business-session'] === 'string' ? req.headers['x-business-session'] : '';
    if (token) {
      const ref = db.collection('businessAccessSessions').doc(hashToken(token));
      const snap = await ref.get();
      if (snap.exists && snap.data()?.uid === uid) await ref.update({ status: 'revoked', revokedAt: Timestamp.now() });
    }
    return res.json({ ok: true });
  });

  app.post('/api/business/access/change-password', setupLimiter, authenticate, async (req, res) => {
    const uid = String((req as any).user?.uid || '');
    const businessId = typeof req.body?.businessId === 'string' ? req.body.businessId.trim() : '';
    const currentPassword = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
    const newPassword = req.body?.newPassword;
    const passwordError = validateBusinessPassword(newPassword);
    if (!uid || !businessId || !currentPassword) return fail(res, 'INVALID_REQUEST', 'Current password and business are required.');
    if (passwordError) return fail(res, 'INVALID_REQUEST', passwordError);

    try {
      const ref = db.collection('businessAccessCredentials').doc(credentialId(uid, businessId));
      const snap = await ref.get();
      if (!snap.exists || snap.data()?.status !== 'active') return fail(res, 'SETUP_REQUIRED', 'Business password setup is required.', 409);
      const data = snap.data() || {};
      const expected = Buffer.from(String(data.hash || ''), 'hex');
      const actual = scryptSync(currentPassword, String(data.salt || ''), 64);
      if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return fail(res, 'FORBIDDEN', 'Current Business Platform password is incorrect.', 403);

      const salt = randomBytes(16).toString('hex');
      const now = Timestamp.now();
      await ref.update({ salt, hash: scryptSync(newPassword, salt, 64).toString('hex'), updatedAt: now, passwordChangedAt: now, status: 'active' });
      const sessions = await db.collection('businessAccessSessions').where('uid', '==', uid).where('businessId', '==', businessId).where('status', '==', 'active').get();
      await Promise.all(sessions.docs.map((doc) => doc.ref.update({ status: 'revoked', revokedAt: now })));
      await db.collection('audit_logs').add({ action: 'business_password_changed', actorUid: uid, businessId, createdAt: now });
      return res.json({ ok: true });
    } catch (error) {
      console.error('Business password change failed:', error);
      return fail(res, 'SERVICE_UNAVAILABLE', 'Unable to change Business Platform password.', 503);
    }
  });

  app.post('/api/admin/business-access/reset', authenticate, async (req, res) => {
    const adminUid = String((req as any).user?.uid || '');
    const targetUid = typeof req.body?.uid === 'string' ? req.body.uid.trim() : '';
    const businessId = typeof req.body?.businessId === 'string' ? req.body.businessId.trim() : '';
    if (!adminUid || !targetUid || !businessId) return fail(res, 'INVALID_REQUEST', 'User and business are required.');
    try {
      const adminSnap = await db.collection('users').doc(adminUid).get();
      const roles = Array.isArray(adminSnap.data()?.roles) ? adminSnap.data()?.roles : [];
      if (!roles.some((role: unknown) => ['super_admin', 'platform_admin', 'administrator'].includes(String(role)))) return fail(res, 'FORBIDDEN', 'Platform administration access is required.', 403);

      const now = Timestamp.now();
      const credentialRef = db.collection('businessAccessCredentials').doc(credentialId(targetUid, businessId));
      const credentialSnap = await credentialRef.get();
      if (credentialSnap.exists) await credentialRef.update({ status: 'reset_required', resetBy: adminUid, resetAt: now, updatedAt: now });

      const sessions = await db.collection('businessAccessSessions').where('uid', '==', targetUid).where('businessId', '==', businessId).where('status', '==', 'active').get();
      await Promise.all(sessions.docs.map((doc) => doc.ref.update({ status: 'revoked', revokedAt: now, revokedBy: adminUid })));
      await db.collection('audit_logs').add({ action: 'business_password_reset_required', actorUid: adminUid, targetUid, businessId, createdAt: now });
      return res.json({ ok: true, status: 'reset_required' });
    } catch (error) {
      console.error('Admin business password reset failed:', error);
      return fail(res, 'SERVICE_UNAVAILABLE', 'Unable to reset Business Platform access.', 503);
    }
  });
}
