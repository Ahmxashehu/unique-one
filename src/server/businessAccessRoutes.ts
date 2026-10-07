import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import type { Express, RequestHandler, Response } from 'express';
import { getAuth } from 'firebase-admin/auth';
import { Timestamp, type Firestore } from 'firebase-admin/firestore';
import rateLimit from 'express-rate-limit';
import type { Permission } from '../lib/os/types';

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
  const membershipSnapshot = await db.collection('businessMemberships')
    .where('uid', '==', uid)
    .where('status', '==', 'active')
    .limit(20)
    .get();

  const existing = new Map<string, { businessId: string; role: string; businessName: string; status: string }>();
  for (const doc of membershipSnapshot.docs) {
    const data = doc.data();
    const businessId = String(data.businessId || '');
    if (!businessId) continue;
    const businessSnap = await db.collection('businesses').doc(businessId).get();
    const business = businessSnap.exists ? businessSnap.data() || {} : {};
    existing.set(businessId, {
      businessId,
      role: String(data.role || 'staff_member'),
      businessName: String(business.name || data.businessName || 'Unique Business'),
      status: String(data.status || 'active'),
    });
  }

  // Repair/complete memberships for approvals created before the membership record existed.
  const approvals = await db.collection('businessApplications')
    .where('applicantUid', '==', uid)
    .where('status', '==', 'approved')
    .limit(20)
    .get();

  for (const approvalDoc of approvals.docs) {
    const application = approvalDoc.data();
    let businessId = typeof application.businessId === 'string' ? application.businessId : '';
    if (!businessId && application.applicationType === 'join_business' && typeof application.organizationName === 'string') {
      const businessQuery = await db.collection('businesses').where('name', '==', application.organizationName.trim()).limit(1).get();
      businessId = businessQuery.empty ? '' : businessQuery.docs[0].id;
    }
    if (!businessId || existing.has(businessId)) continue;

    const businessSnap = await db.collection('businesses').doc(businessId).get();
    if (!businessSnap.exists) continue;
    const business = businessSnap.data() || {};
    const role = String(application.requestedRole || 'staff_member');
    const membershipRef = db.collection('businessMemberships').doc(`${uid}__${businessId}`);
    await membershipRef.set({
      uid,
      businessId,
      role,
      businessName: String(business.name || application.organizationName || application.name || 'Unique Business'),
      status: 'active',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      sourceApplicationId: approvalDoc.id,
    }, { merge: true });

    existing.set(businessId, {
      businessId,
      role,
      businessName: String(business.name || application.organizationName || application.name || 'Unique Business'),
      status: 'active',
    });
  }

  return Array.from(existing.values());
}

async function getActiveSession(db: Firestore, uid: string, token: string) {
  if (!token || token.length < 32) return null;
  const snapshot = await db.collection('businessAccessSessions').doc(hashToken(token)).get();
  if (!snapshot.exists) return null;
  const data = snapshot.data() || {};
  if (data.uid !== uid || data.status !== 'active' || typeof data.expiresAt?.toMillis !== 'function' || data.expiresAt.toMillis() <= Date.now()) return null;
  return data;
}

async function sessionValid(db: Firestore, uid: string, businessId: string, token: string) {
  const session = await getActiveSession(db, uid, token);
  return Boolean(session && session.businessId === businessId);
}

export function registerBusinessAccessRoutes(app: Express, authenticate: RequestHandler, db: Firestore, requirePermission?: (permission: Permission) => RequestHandler) {
  const setupLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 8, standardHeaders: true, legacyHeaders: false });
  const loginLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 12, standardHeaders: true, legacyHeaders: false });

  // Server-side enforcement: the separate Business credential is required for protected
  // Business APIs, not merely for displaying the dashboard UI.
  app.use('/api/business', async (req, res, next) => {
    const exempt = new Set([
      '/register',
      '/applications',
      '/access/status',
      '/access/setup',
      '/access/login',
      '/access/logout',
      '/access/step-up',
      '/staff/accept-invite',
    ]);
    if (exempt.has(req.path)) return next();

    const authHeader = typeof req.headers.authorization === 'string' ? req.headers.authorization : '';
    const businessToken = typeof req.headers['x-business-session'] === 'string' ? req.headers['x-business-session'] : '';
    if (!authHeader.startsWith('Bearer ') || !businessToken) return fail(res, 'BUSINESS_AUTH_REQUIRED', 'Business Platform authentication is required.', 401);

    try {
      const idToken = authHeader.slice(7).trim();
      const decoded = await getAuth().verifyIdToken(idToken);
      const session = await getActiveSession(db, decoded.uid, businessToken);
      if (!session) return fail(res, 'BUSINESS_AUTH_REQUIRED', 'Your Business Platform session has expired or was revoked. Please sign in again.', 401);

      // Re-check active membership on every protected request so revoked access cannot
      // continue through an already-issued Business session.
      const membershipSnap = await db.collection('businessMemberships').doc(`${decoded.uid}__${session.businessId}`).get();
      if (!membershipSnap.exists || membershipSnap.data()?.status !== 'active') {
        return fail(res, 'BUSINESS_AUTH_REQUIRED', 'Your approved Business Platform access is no longer active.', 403);
      }
      const membership = membershipSnap.data() || {};
      (req as any).businessMembership = membership;

      // Sensitive Business actions require a recent password step-up.
      const stepUpRequired = new Set(['/inventory/adjust', '/access/change-password']);
      if (stepUpRequired.has(req.path)) {
        const expiresAt = session.stepUpExpiresAt;
        if (typeof expiresAt?.toMillis !== 'function' || expiresAt.toMillis() <= Date.now()) {
          return fail(res, 'STEP_UP_REQUIRED', 'Additional Business verification is required before this sensitive action.', 403);
        }
      }

      (req as any).businessSession = session;
      return next();
    } catch {
      return fail(res, 'BUSINESS_AUTH_REQUIRED', 'Business Platform authentication could not be verified.', 401);
    }
  });

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

  app.post('/api/business/access/step-up', loginLimiter, authenticate, async (req, res) => {
    const uid = String((req as any).user?.uid || '');
    const businessId = typeof req.body?.businessId === 'string' ? req.body.businessId.trim() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const token = typeof req.headers['x-business-session'] === 'string' ? req.headers['x-business-session'] : '';
    if (!uid || !businessId || !password || !token) return fail(res, 'INVALID_REQUEST', 'Business session, business and password are required.');
    try {
      const session = await getActiveSession(db, uid, token);
      if (!session || session.businessId !== businessId) return fail(res, 'BUSINESS_AUTH_REQUIRED', 'Business Platform authentication is required.', 401);
      const credentialSnap = await db.collection('businessAccessCredentials').doc(credentialId(uid, businessId)).get();
      if (!credentialSnap.exists || credentialSnap.data()?.status !== 'active') return fail(res, 'SETUP_REQUIRED', 'Business password setup is required.', 409);
      const credential = credentialSnap.data() || {};
      const expected = Buffer.from(String(credential.hash || ''), 'hex');
      const actual = scryptSync(password, String(credential.salt || ''), 64);
      if (!expected.length || expected.length !== actual.length || !timingSafeEqual(expected, actual)) return fail(res, 'FORBIDDEN', 'Incorrect Business Platform password.', 403);
      const now = Timestamp.now();
      await db.collection('businessAccessSessions').doc(hashToken(token)).update({ stepUpVerifiedAt: now, stepUpExpiresAt: Timestamp.fromMillis(Date.now() + 10 * 60 * 1000), lastUsedAt: now });
      await db.collection('audit_logs').add({ action: 'business_step_up_verified', actorUid: uid, businessId, createdAt: now });
      return res.json({ ok: true, expiresInSeconds: 600 });
    } catch (error) {
      console.error('Business step-up failed:', error);
      return fail(res, 'SERVICE_UNAVAILABLE', 'Unable to verify Business Platform step-up access.', 503);
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

  const adminResetMiddleware = requirePermission ? requirePermission('access:admin_tools') : authenticate;
  app.post('/api/admin/business-access/reset', authenticate, adminResetMiddleware, async (req, res) => {
    const adminUid = String((req as any).user?.uid || '');
    const targetUid = typeof req.body?.uid === 'string' ? req.body.uid.trim() : '';
    const businessId = typeof req.body?.businessId === 'string' ? req.body.businessId.trim() : '';
    if (!adminUid || !targetUid || !businessId) return fail(res, 'INVALID_REQUEST', 'User and business are required.');
    try {
      const adminSnap = await db.collection('users').doc(adminUid).get();
      const roles = Array.isArray(adminSnap.data()?.roles) ? adminSnap.data()?.roles : [];
      if (!roles.some((role: unknown) => ['super_admin', 'platform_admin'].includes(String(role)))) return fail(res, 'FORBIDDEN', 'Platform or Super Admin access is required.', 403);

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
