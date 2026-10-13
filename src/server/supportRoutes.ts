import type { Express, RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import type { Permission, Role } from '../lib/os/types';
import { hasRolePermission } from '../lib/auth/rbac';

const CASE_CATEGORIES = new Set(['payment', 'store', 'booking', 'delivery', 'restaurant', 'account', 'other']);
const CASE_STATUSES = new Set(['open', 'in_progress', 'waiting_for_customer', 'resolved', 'closed']);
const CASE_PRIORITIES = new Set(['normal', 'high', 'urgent']);
const CASE_DEPARTMENTS: Record<string, string> = {
  payment: 'UniquePay',
  store: 'Marketplace',
  booking: 'Travel & Booking',
  delivery: 'Logistics',
  restaurant: 'Restaurant & Services',
  account: 'Account & Security',
  other: 'General Support',
};
const isRole = (value: unknown): value is Role => typeof value === 'string' && [
  'customer','buyer','seller','business_owner','staff_member','farmer','service_provider',
  'school_administrator','parent','healthcare_provider','property_owner','hotel_owner','driver',
  'logistics_provider','moderator','administrator','partner','developer','finance_officer',
  'risk_security_officer','platform_admin','super_admin',
].includes(value);
const isPermission = (value: unknown): value is Permission => typeof value === 'string' && [
  'view:profile','edit:profile','create:products','edit:products','manage:inventory','create:invoices',
  'send:payment_requests','view:customer_info','manage:orders','confirm:delivery','manage:bookings',
  'manage:business_staff','manage:restaurant','manage:restaurant_menu','manage:restaurant_orders',
  'manage:restaurant_verification','view:transactions','manage:verification','manage:disputes',
  'access:admin_tools','manage:roles','manage:permissions','view:audit_logs','view:customer_phone','manage:support',
].includes(value);

async function canManageSupport(db: FirebaseFirestore.Firestore, uid: string): Promise<boolean> {
  const snap = await db.collection('users').doc(uid).get();
  if (!snap.exists) return false;
  const data = snap.data() || {};
  const roles = Array.isArray(data.roles) ? data.roles.filter(isRole) : [];
  const permissions = Array.isArray(data.permissions) ? data.permissions.filter(isPermission) : [];
  return hasRolePermission(roles, permissions, 'manage:support');
}

export function registerSupportRoutes(
  app: Express,
  authenticate: RequestHandler,
  requirePermission: (permission: Permission) => RequestHandler,
) {
  const db = getFirestore();
  const createLimiter = rateLimit({ windowMs: 60_000, limit: 8, standardHeaders: true, legacyHeaders: false });
  const messageLimiter = rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: true, legacyHeaders: false });

  app.post('/api/support/cases', createLimiter, authenticate, async (req, res) => {
    const uid = String((req as any).user?.uid || '');
    if (!uid) return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Authentication is required.' } });
    const category = typeof req.body?.category === 'string' ? req.body.category : 'other';
    const subject = typeof req.body?.subject === 'string' ? req.body.subject.trim() : '';
    const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
    const orderReference = typeof req.body?.orderReference === 'string' ? req.body.orderReference.trim().slice(0, 128) : '';
    if (!CASE_CATEGORIES.has(category) || subject.length < 3 || subject.length > 160 || message.length < 5 || message.length > 4000) {
      return res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'Choose a valid category and provide a subject and message.' } });
    }
    try {
      const now = new Date().toISOString();
      const ref = db.collection('support_cases').doc();
      const firstMessage = ref.collection('messages').doc();
      const batch = db.batch();
      batch.set(ref, {
        userUid: uid,
        category,
        department: CASE_DEPARTMENTS[category],
        subject,
        orderReference: orderReference || null,
        status: 'open',
        priority: 'normal',
        assignedToUid: null,
        createdAt: now,
        updatedAt: now,
        lastMessageAt: now,
        messageCount: 1,
      });
      batch.set(firstMessage, {
        senderUid: uid,
        senderType: 'customer',
        senderLabel: 'Customer',
        body: message,
        createdAt: now,
      });
      await batch.commit();
      return res.status(201).json({ case: { id: ref.id, category, department: CASE_DEPARTMENTS[category], subject, orderReference: orderReference || null, status: 'open', priority: 'normal', createdAt: now, updatedAt: now, messageCount: 1 } });
    } catch (error) {
      console.error('Support case creation failed:', error);
      return res.status(503).json({ error: { code: 'SERVICE_UNAVAILABLE', message: 'Support is temporarily unavailable. Please try again.' } });
    }
  });

  app.get('/api/support/cases', authenticate, async (req, res) => {
    const uid = String((req as any).user?.uid || '');
    if (!uid) return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Authentication is required.' } });
    try {
      const snap = await db.collection('support_cases').where('userUid', '==', uid).limit(50).get();
      const cases = snap.docs.map((doc) => {
        const data = doc.data() || {};
        return {
          id: doc.id,
          category: data.category,
          department: data.department,
          subject: data.subject,
          orderReference: data.orderReference ?? null,
          status: data.status,
          priority: data.priority,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
          lastMessageAt: data.lastMessageAt,
          messageCount: data.messageCount,
        };
      });
      cases.sort((a: any, b: any) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
      return res.json({ cases });
    } catch (error) {
      console.error('Customer support case listing failed:', error);
      return res.status(503).json({ error: { code: 'SERVICE_UNAVAILABLE', message: 'Your support cases are temporarily unavailable.' } });
    }
  });

  app.get('/api/admin/support/staff', authenticate, requirePermission('manage:support'), async (_req, res) => {
    try {
      const snap = await db.collection('users').limit(200).get();
      const staff = snap.docs.flatMap((doc) => {
        const data = doc.data() || {};
        const roles: Role[] = Array.isArray(data.roles) ? data.roles.filter(isRole) : [];
        const permissions: Permission[] = Array.isArray(data.permissions) ? data.permissions.filter(isPermission) : [];
        if (!hasRolePermission(roles, permissions, 'manage:support')) return [];
        return [{
          uid: doc.id,
          displayName: typeof data.fullName === 'string' ? data.fullName : [data.firstName, data.lastName].filter(Boolean).join(' ') || 'Support Agent',
          roles,
        }];
      });
      return res.json({ staff });
    } catch (error) {
      console.error('Support staff directory failed:', error);
      return res.status(503).json({ error: { code: 'SERVICE_UNAVAILABLE', message: 'The support staff directory is temporarily unavailable.' } });
    }
  });

  app.get('/api/admin/support/cases', authenticate, requirePermission('manage:support'), async (req, res) => {
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
    try {
      const snap = await db.collection('support_cases').orderBy('updatedAt', 'desc').limit(limit).get();
      return res.json({ cases: snap.docs.map((doc) => {
        const data = doc.data() || {};
        return {
          id: doc.id,
          userUid: data.userUid,
          category: data.category,
          department: data.department,
          subject: data.subject,
          orderReference: data.orderReference ?? null,
          status: data.status,
          priority: data.priority,
          assignedToUid: data.assignedToUid ?? null,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
          lastMessageAt: data.lastMessageAt,
          messageCount: data.messageCount,
        };
      }) });
    } catch (error) {
      console.error('Admin support case listing failed:', error);
      return res.status(503).json({ error: { code: 'SERVICE_UNAVAILABLE', message: 'The support queue is temporarily unavailable.' } });
    }
  });

  app.patch('/api/admin/support/cases/:caseId', authenticate, requirePermission('manage:support'), async (req, res) => {
    const actorUid = String((req as any).user?.uid || '');
    const caseId = String(req.params.caseId || '');
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(caseId)) return res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'A valid support case is required.' } });
    const patch: Record<string, unknown> = {};
    if (req.body?.status !== undefined) {
      if (typeof req.body.status !== 'string' || !CASE_STATUSES.has(req.body.status)) return res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'Invalid support case status.' } });
      patch.status = req.body.status;
    }
    if (req.body?.priority !== undefined) {
      if (typeof req.body.priority !== 'string' || !CASE_PRIORITIES.has(req.body.priority)) return res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'Invalid support case priority.' } });
      patch.priority = req.body.priority;
    }
    if (req.body?.assignedToUid !== undefined) {
      const assignedToUid = req.body.assignedToUid === null ? null : String(req.body.assignedToUid || '').trim();
      if (assignedToUid && !/^[A-Za-z0-9_-]{1,128}$/.test(assignedToUid)) return res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'Invalid staff assignment.' } });
      if (assignedToUid && !(await canManageSupport(db, assignedToUid))) return res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'The selected staff member is not authorised for support.' } });
      patch.assignedToUid = assignedToUid;
    }
    if (req.body?.department !== undefined) {
      const department = typeof req.body.department === 'string' ? req.body.department.trim().slice(0, 80) : '';
      if (!department || !Object.values(CASE_DEPARTMENTS).includes(department)) return res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'Choose a supported department.' } });
      patch.department = department;
    }
    if (!Object.keys(patch).length) return res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'No supported changes were provided.' } });
    try {
      const ref = db.collection('support_cases').doc(caseId);
      const snap = await ref.get();
      if (!snap.exists) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Support case not found.' } });
      const now = new Date().toISOString();
      const auditRef = db.collection('audit_logs').doc();
      const batch = db.batch();
      batch.update(ref, { ...patch, updatedAt: now });
      batch.set(auditRef, {
        uid: actorUid,
        action: 'support.case_updated',
        resource: 'support_case',
        resourceId: caseId,
        details: JSON.stringify(patch),
        timestamp: Timestamp.now(),
      });
      await batch.commit();
      return res.json({ id: caseId, ...patch, updatedAt: now });
    } catch (error) {
      console.error('Support case update failed:', error);
      return res.status(503).json({ error: { code: 'SERVICE_UNAVAILABLE', message: 'The support case could not be updated.' } });
    }
  });

  app.get('/api/support/cases/:caseId/messages', authenticate, async (req, res) => {
    const uid = String((req as any).user?.uid || '');
    const caseId = String(req.params.caseId || '');
    if (!uid) return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Authentication is required.' } });
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(caseId)) return res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'A valid support case is required.' } });
    try {
      const ref = db.collection('support_cases').doc(caseId);
      const caseSnap = await ref.get();
      if (!caseSnap.exists) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Support case not found.' } });
      const isStaff = await canManageSupport(db, uid);
      if (caseSnap.data()?.userUid !== uid && !isStaff) return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You cannot access this support conversation.' } });
      const snap = await ref.collection('messages').orderBy('createdAt', 'asc').limit(100).get();
      return res.json({ messages: snap.docs.map((doc) => {
        const data = doc.data() || {};
        return {
          id: doc.id,
          senderType: data.senderType,
          senderLabel: data.senderLabel,
          body: data.body,
          createdAt: data.createdAt,
        };
      }) });
    } catch (error) {
      console.error('Support messages could not be loaded:', error);
      return res.status(503).json({ error: { code: 'SERVICE_UNAVAILABLE', message: 'Support messages are temporarily unavailable.' } });
    }
  });

  app.post('/api/support/cases/:caseId/messages', messageLimiter, authenticate, async (req, res) => {
    const uid = String((req as any).user?.uid || '');
    const caseId = String(req.params.caseId || '');
    const body = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
    if (!uid) return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Authentication is required.' } });
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(caseId) || body.length < 1 || body.length > 4000) return res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'Provide a valid case and message.' } });
    try {
      const ref = db.collection('support_cases').doc(caseId);
      const caseSnap = await ref.get();
      if (!caseSnap.exists) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Support case not found.' } });
      const data = caseSnap.data() || {};
      const isStaff = await canManageSupport(db, uid);
      if (data.userUid !== uid && !isStaff) return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You cannot reply to this support conversation.' } });
      if (['closed'].includes(String(data.status || ''))) return res.status(409).json({ error: { code: 'INVALID_STATE', message: 'This support case is closed. Please open a new case.' } });
      const now = new Date().toISOString();
      const msgRef = ref.collection('messages').doc();
      const batch = db.batch();
      batch.set(msgRef, {
        senderUid: uid,
        senderType: isStaff ? 'support' : 'customer',
        senderLabel: isStaff ? 'UniquePlatform Support' : 'Customer',
        body,
        createdAt: now,
      });
      batch.update(ref, {
        updatedAt: now,
        lastMessageAt: now,
        messageCount: (Number(data.messageCount) || 0) + 1,
        ...(!isStaff && ['resolved'].includes(String(data.status || '')) ? { status: 'open' } : {}),
      });
      await batch.commit();
      return res.status(201).json({ message: { id: msgRef.id, senderType: isStaff ? 'support' : 'customer', senderLabel: isStaff ? 'UniquePlatform Support' : 'Customer', body, createdAt: now } });
    } catch (error) {
      console.error('Support reply failed:', error);
      return res.status(503).json({ error: { code: 'SERVICE_UNAVAILABLE', message: 'Your message could not be sent. Please try again.' } });
    }
  });
}
