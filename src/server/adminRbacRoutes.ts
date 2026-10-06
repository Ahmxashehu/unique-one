import type { Express, RequestHandler } from 'express';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import type { Permission, Role } from '../lib/os/types';
import { ROLE_PERMISSIONS, hasRolePermission } from '../lib/auth/rbac';
import { registerBusinessAccessRoutes } from './businessAccessRoutes';

const ALL_ROLES: Role[] = [
  'customer','buyer','seller','business_owner','staff_member','farmer','service_provider',
  'school_administrator','parent','healthcare_provider','property_owner','hotel_owner','driver',
  'logistics_provider','moderator','administrator','partner','developer',
  'finance_officer','risk_security_officer','platform_admin','super_admin',
];
const ALL_PERMISSIONS: Permission[] = [
  'view:profile','edit:profile','create:products','edit:products','manage:inventory',
  'create:invoices','send:payment_requests','view:customer_info','manage:orders','manage:bookings',
  'manage:business_staff','view:transactions','manage:verification','manage:disputes',
  'access:admin_tools','manage:roles','manage:permissions','view:audit_logs',
];
const RESTRICTED_ROLES = new Set<Role>(['risk_security_officer','platform_admin','super_admin']);
const isRole = (value: unknown): value is Role => typeof value === 'string' && ALL_ROLES.includes(value as Role);
const isPermission = (value: unknown): value is Permission => typeof value === 'string' && ALL_PERMISSIONS.includes(value as Permission);

export function registerAdminRbacRoutes(
  app: Express,
  authenticate: RequestHandler,
  requirePermission: (permission: Permission) => RequestHandler,
) {
  const db = getFirestore();
  app.get('/api/admin/rbac/catalog', authenticate, requirePermission('manage:roles'), async (_req, res) => {
    return res.json({
      roles: ALL_ROLES.map((role) => ({ role, permissions: ROLE_PERMISSIONS[role] || [] })),
      permissions: ALL_PERMISSIONS,
      restrictedRoles: Array.from(RESTRICTED_ROLES),
    });
  });

  app.get('/api/admin/rbac/users', authenticate, requirePermission('manage:roles'), async (req, res) => {
    try {
      const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
      const snap = await db.collection('users').limit(limit).get();
      const users = snap.docs.map((doc) => {
        const data = doc.data() || {};
        return {
          uid: doc.id,
          displayName: typeof data.fullName === 'string' ? data.fullName : [data.firstName, data.lastName].filter(Boolean).join(' '),
          email: typeof data.email === 'string' ? data.email : '',
          phone: typeof data.phone === 'string' ? data.phone : '',
          roles: Array.isArray(data.roles) ? data.roles.filter(isRole) : [],
          permissions: Array.isArray(data.permissions) ? data.permissions.filter(isPermission) : [],
          status: data.status || 'active',
        };
      });
      return res.json({ users });
    } catch (error) {
      console.error('RBAC user listing failed:', error);
      return res.status(503).json({ error: { code: 'SERVICE_UNAVAILABLE', message: 'Role and permission data is temporarily unavailable.' } });
    }
  });

  app.patch('/api/admin/rbac/users/:uid', authenticate, requirePermission('manage:roles'), async (req, res) => {
    const actorUid = String((req as any).user?.uid || '');
    const targetUid = String(req.params.uid || '').trim();
    const roles = Array.isArray(req.body?.roles) ? Array.from(new Set(req.body.roles.filter((value: unknown): value is Role => isRole(value)))) : [];
    const permissions = Array.isArray(req.body?.permissions) ? Array.from(new Set(req.body.permissions.filter((value: unknown): value is Permission => isPermission(value)))) : [];
    if (!targetUid || roles.length !== (Array.isArray(req.body?.roles) ? new Set(req.body.roles).size : 0) || permissions.length !== (Array.isArray(req.body?.permissions) ? new Set(req.body.permissions).size : 0)) {
      return res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'Invalid role or permission values.' } });
    }
    if (targetUid === actorUid && !roles.includes('super_admin')) {
      const current = await db.collection('users').doc(actorUid).get();
      const currentRoles = Array.isArray(current.data()?.roles) ? current.data()?.roles.filter(isRole) : [];
      if (currentRoles.includes('super_admin')) return res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'A Super Admin cannot remove their own Super Admin role.' } });
    }
    const actor = await db.collection('users').doc(actorUid).get();
    const actorRoles = Array.isArray(actor.data()?.roles) ? actor.data()?.roles.filter(isRole) : [];
    const actorIsSuperAdmin = actorRoles.includes('super_admin');
    if (!actorIsSuperAdmin && roles.some((role) => RESTRICTED_ROLES.has(role))) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Only a Super Admin can assign restricted platform roles.' } });
    }
    if (!actorIsSuperAdmin && permissions.some((permission) => ['manage:roles','manage:permissions'].includes(permission))) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Only a Super Admin can grant RBAC-management permissions.' } });
    }
    const ref = db.collection('users').doc(targetUid);
    const target = await ref.get();
    if (!target.exists) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User was not found.' } });
    try {
      const now = Timestamp.now();
      await ref.update({ roles, permissions, rbacUpdatedAt: now, rbacUpdatedBy: actorUid });
      await db.collection('audit_logs').add({
        uid: actorUid,
        action: 'rbac.update',
        resource: 'user',
        resourceId: targetUid,
        details: JSON.stringify({ roles, permissions }),
        timestamp: now,
      });
      return res.json({ uid: targetUid, roles, permissions });
    } catch (error) {
      console.error('RBAC update failed:', error);
      return res.status(503).json({ error: { code: 'SERVICE_UNAVAILABLE', message: 'The role update could not be saved.' } });
    }
  });

  // Business Platform access/security is registered alongside the central RBAC routes.
  registerBusinessAccessRoutes(app, authenticate, db, requirePermission);
}
