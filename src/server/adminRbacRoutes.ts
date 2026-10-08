import type { Express, RequestHandler } from 'express';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import type { Permission, Role } from '../lib/os/types';
import { ROLE_PERMISSIONS, hasRolePermission } from '../lib/auth/rbac';
import { registerBusinessAccessRoutes } from './businessAccessRoutes';
import { registerBusinessDataRoutes } from './businessDataRoutes';
import { registerBusinessInventoryRoutes } from './businessInventoryRoutes';
import { registerBusinessProductRoutes } from './businessProductRoutes';
import { registerBusinessOperationsRoutes } from './businessOperationsRoutes';
import { registerStoreOrderLifecycleRoutes } from './storeOrderLifecycleRoutes';
import { registerStoreReturnInspectionRoutes } from './storeReturnInspectionRoutes';
import { registerPaySmallSmallRoutes } from './paySmallSmallRoutes';

const ALL_ROLES: Role[] = [
  'customer','buyer','seller','business_owner','staff_member','farmer','service_provider',
  'school_administrator','parent','healthcare_provider','property_owner','hotel_owner','driver',
  'logistics_provider','moderator','administrator','partner','developer',
  'finance_officer','risk_security_officer','platform_admin','super_admin',
];
const ALL_PERMISSIONS: Permission[] = [
  'view:profile','edit:profile','create:products','edit:products','manage:inventory',
  'create:invoices','send:payment_requests','view:customer_info','manage:orders','manage:bookings',
  'manage:business_staff','view:transactions','manage:verification','manage:restaurant','manage:restaurant_menu','manage:restaurant_orders','manage:restaurant_verification','manage:disputes',
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
    const rawRoles: unknown[] = Array.isArray(req.body?.roles) ? req.body.roles : [];
    const rawPermissions: unknown[] = Array.isArray(req.body?.permissions) ? req.body.permissions : [];
    const roles: Role[] = Array.from(new Set(rawRoles.filter(isRole)));
    const permissions: Permission[] = Array.from(new Set(rawPermissions.filter(isPermission)));
    if (!targetUid || roles.length !== (rawRoles.length ? new Set(rawRoles).size : 0) || permissions.length !== (rawPermissions.length ? new Set(rawPermissions).size : 0)) {
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
      const auditRef = db.collection('audit_logs').doc();
      await db.runTransaction(async (transaction) => {
        const actorSnapshot = await transaction.get(db.collection('users').doc(actorUid));
        const targetSnapshot = await transaction.get(ref);
        if (!actorSnapshot.exists) throw new Error('ACTOR_NOT_FOUND');
        if (!targetSnapshot.exists) throw new Error('TARGET_NOT_FOUND');

        // Re-evaluate the actor's authority inside the same transaction that writes RBAC,
        // preventing a concurrent role downgrade from leaving a stale authorization decision.
        const liveActorRoles = Array.isArray(actorSnapshot.data()?.roles)
          ? actorSnapshot.data()?.roles.filter(isRole)
          : [];
        const liveActorIsSuperAdmin = liveActorRoles.includes('super_admin');
        if (!liveActorIsSuperAdmin && roles.some((role) => RESTRICTED_ROLES.has(role))) {
          throw new Error('RESTRICTED_ROLE_FORBIDDEN');
        }
        if (!liveActorIsSuperAdmin && permissions.some((permission) => ['manage:roles','manage:permissions'].includes(permission))) {
          throw new Error('RBAC_PERMISSION_FORBIDDEN');
        }
        if (targetUid === actorUid && liveActorIsSuperAdmin && !roles.includes('super_admin')) {
          throw new Error('SELF_SUPER_ADMIN_REMOVAL');
        }

        transaction.update(ref, { roles, permissions, rbacUpdatedAt: now, rbacUpdatedBy: actorUid });
        transaction.set(auditRef, {
          uid: actorUid,
          action: 'rbac.update',
          resource: 'user',
          resourceId: targetUid,
          details: JSON.stringify({ roles, permissions }),
          timestamp: now,
        });
      });
      return res.json({ uid: targetUid, roles, permissions });
    } catch (error) {
      if (error instanceof Error && error.message === 'TARGET_NOT_FOUND') {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User was not found.' } });
      }
      if (error instanceof Error && error.message === 'ACTOR_NOT_FOUND') {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'The acting administrator is no longer authorized.' } });
      }
      if (error instanceof Error && error.message === 'RESTRICTED_ROLE_FORBIDDEN') {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Only a Super Admin can assign restricted platform roles.' } });
      }
      if (error instanceof Error && error.message === 'RBAC_PERMISSION_FORBIDDEN') {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Only a Super Admin can grant RBAC-management permissions.' } });
      }
      if (error instanceof Error && error.message === 'SELF_SUPER_ADMIN_REMOVAL') {
        return res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'A Super Admin cannot remove their own Super Admin role.' } });
      }
      console.error('RBAC update failed:', error);
      return res.status(503).json({ error: { code: 'SERVICE_UNAVAILABLE', message: 'The role update could not be saved.' } });
    }
  });

  registerBusinessAccessRoutes(app, authenticate, db, requirePermission);
  registerBusinessDataRoutes(app, authenticate, db);
  registerBusinessInventoryRoutes(app, authenticate, db);
  registerBusinessProductRoutes(app, authenticate, db);
  registerBusinessOperationsRoutes(app, authenticate, db);
  registerStoreOrderLifecycleRoutes(app, authenticate, db);
  registerStoreReturnInspectionRoutes(app, authenticate, db);
  registerPaySmallSmallRoutes(app, authenticate, db);
}
