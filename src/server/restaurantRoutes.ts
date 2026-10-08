import type { Express, RequestHandler, Response } from 'express';
import { randomUUID } from 'crypto';
import { Timestamp, type Firestore } from 'firebase-admin/firestore';
import rateLimit from 'express-rate-limit';
import type { Permission, Role } from '../lib/os/types';
import { hasRolePermission } from '../lib/auth/rbac';

function fail(res: Response, code: string, message: string, status = 400) { return res.status(status).json({ error: { code, message } }); }
function clean(value: unknown, max: number) { return typeof value === 'string' ? value.trim().slice(0, max) : ''; }

export function registerRestaurantRoutes(app: Express, authenticate: RequestHandler, db: Firestore) {
  const limiter = rateLimit({ windowMs: 15 * 60_000, limit: 10, standardHeaders: true, legacyHeaders: true });
  app.post('/api/business/restaurants', authenticate, limiter, async (req, res) => {
    const uid = clean((req as any).user?.uid, 128);
    const membership = ((req as any).businessMembership || {}) as Record<string, unknown>;
    const session = ((req as any).businessSession || {}) as Record<string, unknown>;
    const businessId = clean(session.businessId, 128);
    const membershipBusinessId = clean(membership.businessId, 128);
    const role = clean(membership.role, 64) as Role;
    const customPermissions = Array.isArray(membership.permissions) ? membership.permissions.filter((value): value is Permission => typeof value === 'string') as Permission[] : [];
    if (!uid || !businessId || membershipBusinessId !== businessId) return fail(res, 'BUSINESS_AUTH_REQUIRED', 'An active Business Platform session is required.', 401);
    if (!hasRolePermission([role], customPermissions, 'manage:restaurant')) return fail(res, 'FORBIDDEN', 'Your Business role does not allow Restaurant onboarding.', 403);
    const name = clean(req.body?.name, 200);
    const description = clean(req.body?.description, 2000);
    const branchId = clean(req.body?.branchId, 128);
    if (!name || !description || !branchId) return fail(res, 'INVALID_REQUEST', 'Restaurant name, description and branch are required.');
    const restaurantId = 'rest_' + randomUUID().replace(/-/g, '');
    const restaurantRef = db.collection('restaurants').doc(restaurantId);
    const businessRef = db.collection('businesses').doc(businessId);
    const branchRef = db.collection('branches').doc(branchId);
    const now = Timestamp.now();
    try {
      await db.runTransaction(async (transaction) => {
        const [businessSnap, branchSnap] = await Promise.all([transaction.get(businessRef), transaction.get(branchRef)]);
        const business = businessSnap.data() || {};
        if (!businessSnap.exists || String(business.status || '') !== 'active' || String(business.verificationStatus || '') !== 'verified' || String(business.ownerUid || '') !== uid) throw Object.assign(new Error('BUSINESS_NOT_ELIGIBLE'), { code: 'BUSINESS_NOT_ELIGIBLE' });
        const branch = branchSnap.data() || {};
        if (!branchSnap.exists || String(branch.businessId || '') !== businessId || String(branch.ownerUid || '') !== String(business.ownerUid || '') || String(branch.status || '') !== 'active') throw Object.assign(new Error('INVALID_BRANCH'), { code: 'INVALID_BRANCH' });
        const assignedBranchId = clean(membership.branchId, 128);
        if (assignedBranchId && assignedBranchId !== branchId) throw Object.assign(new Error('BRANCH_FORBIDDEN'), { code: 'BRANCH_FORBIDDEN' });
        transaction.create(restaurantRef, { id: restaurantId, businessId, branchId, ownerUid: uid, name, description, status: 'draft', verificationStatus: 'pending', merchantWalletId: null, uniquePayStatus: 'unverified', createdAt: now, updatedAt: now });
        transaction.create(db.collection('audit_logs').doc(), { action: 'restaurant_created', actorUid: uid, resource: 'restaurant', resourceId: restaurantId, businessId, branchId, details: { status: 'draft', verificationStatus: 'pending' }, timestamp: now });
      });
      return res.status(201).json({ ok: true, restaurantId, status: 'draft', verificationStatus: 'pending', uniquePayStatus: 'unverified' });
    } catch (error: any) {
      if (error?.code === 'BUSINESS_NOT_ELIGIBLE') return fail(res, 'FORBIDDEN', 'Only the verified Business owner can create a Restaurant.', 403);
      if (error?.code === 'INVALID_BRANCH') return fail(res, 'INVALID_REQUEST', 'The selected branch is not an active branch of this Business.');
      if (error?.code === 'BRANCH_FORBIDDEN') return fail(res, 'FORBIDDEN', 'You cannot create a Restaurant for another assigned branch.', 403);
      console.error('Restaurant creation failed:', error);
      return fail(res, 'SERVICE_UNAVAILABLE', 'Restaurant onboarding is temporarily unavailable.', 503);
    }
  });
}