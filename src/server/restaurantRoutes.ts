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
  app.post('/api/business/restaurants/:restaurantId/submit', authenticate, limiter, async (req, res) => {
    const uid = clean((req as any).user?.uid, 128);
    const membership = ((req as any).businessMembership || {}) as Record<string, unknown>;
    const session = ((req as any).businessSession || {}) as Record<string, unknown>;
    const businessId = clean(session.businessId, 128);
    const restaurantId = clean(req.params.restaurantId, 128);
    const role = clean(membership.role, 64) as Role;
    const customPermissions = Array.isArray(membership.permissions)
      ? membership.permissions.filter((v): v is Permission => typeof v === 'string') as Permission[] : [];
    if (!uid || !businessId || clean(membership.businessId, 128) !== businessId) return fail(res, 'BUSINESS_AUTH_REQUIRED', 'An active Business Platform session is required.', 401);
    if (!hasRolePermission([role], customPermissions, 'manage:restaurant')) return fail(res, 'FORBIDDEN', 'Your Business role does not allow Restaurant submission.', 403);
    const restaurantRef = db.collection('restaurants').doc(restaurantId);
    const businessRef = db.collection('businesses').doc(businessId);
    const now = Timestamp.now();
    try {
      await db.runTransaction(async (transaction) => {
        const [restaurantSnap, businessSnap] = await Promise.all([transaction.get(restaurantRef), transaction.get(businessRef)]);
        if (!restaurantSnap.exists || !businessSnap.exists) throw Object.assign(new Error('NOT_FOUND'), { code: 'NOT_FOUND' });
        const restaurant = restaurantSnap.data() || {};
        const business = businessSnap.data() || {};
        if (String(restaurant.businessId || '') !== businessId || String(restaurant.ownerUid || '') !== uid ||
            String(business.ownerUid || '') !== uid || String(business.status || '') !== 'active' ||
            String(business.verificationStatus || '') !== 'verified') throw Object.assign(new Error('FORBIDDEN'), { code: 'FORBIDDEN' });
        if (String(restaurant.status || '') !== 'draft' || String(restaurant.verificationStatus || '') !== 'pending') throw Object.assign(new Error('INVALID_STATE'), { code: 'INVALID_STATE' });
        transaction.update(restaurantRef, { status: 'submitted', updatedAt: now, submittedAt: now, submittedBy: uid });
        transaction.create(db.collection('audit_logs').doc(), {
          action: 'restaurant_submitted', actorUid: uid, resource: 'restaurant', resourceId: restaurantId, businessId,
          branchId: String(restaurant.branchId || ''), details: { previousStatus: 'draft', newStatus: 'submitted', verificationStatus: 'pending' }, timestamp: now,
        });
      });
      return res.json({ ok: true, restaurantId, status: 'submitted', verificationStatus: 'pending' });
    } catch (error: any) {
      if (error?.code === 'NOT_FOUND') return fail(res, 'NOT_FOUND', 'Restaurant not found.', 404);
      if (error?.code === 'FORBIDDEN') return fail(res, 'FORBIDDEN', 'You are not authorized to submit this Restaurant.', 403);
      if (error?.code === 'INVALID_STATE') return fail(res, 'CONFLICT', 'Only a draft Restaurant can be submitted.', 409);
      console.error('Restaurant submission failed:', error);
      return fail(res, 'SERVICE_UNAVAILABLE', 'Restaurant submission is temporarily unavailable.', 503);
    }
  });

  app.patch('/api/business/restaurants/:restaurantId', authenticate, limiter, async (req, res) => {
    const uid = clean((req as any).user?.uid, 128);
    const membership = ((req as any).businessMembership || {}) as Record<string, unknown>;
    const session = ((req as any).businessSession || {}) as Record<string, unknown>;
    const businessId = clean(session.businessId, 128);
    const restaurantId = clean(req.params.restaurantId, 128);
    const role = clean(membership.role, 64) as Role;
    const customPermissions = Array.isArray(membership.permissions)
      ? membership.permissions.filter((v): v is Permission => typeof v === 'string') as Permission[] : [];
    if (!uid || !businessId || clean(membership.businessId, 128) !== businessId) {
      return fail(res, 'BUSINESS_AUTH_REQUIRED', 'An active Business Platform session is required.', 401);
    }
    if (!hasRolePermission([role], customPermissions, 'manage:restaurant')) {
      return fail(res, 'FORBIDDEN', 'Your Business role does not allow Restaurant management.', 403);
    }
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const allowed = ['name', 'description'];
    for (const key of Object.keys(body)) {
      if (!allowed.includes(key)) return fail(res, 'INVALID_REQUEST', 'Only draft Restaurant profile fields can be changed.');
    }
    const updates: Record<string, string> = {};
    if ('name' in body) updates.name = clean(body.name, 200);
    if ('description' in body) updates.description = clean(body.description, 2000);
    if (!updates.name && !updates.description) return fail(res, 'INVALID_REQUEST', 'No valid Restaurant changes were supplied.');

    const restaurantRef = db.collection('restaurants').doc(restaurantId);
    const businessRef = db.collection('businesses').doc(businessId);
    const now = Timestamp.now();
    try {
      await db.runTransaction(async (transaction) => {
        const [restaurantSnap, businessSnap] = await Promise.all([
          transaction.get(restaurantRef), transaction.get(businessRef),
        ]);
        if (!restaurantSnap.exists || !businessSnap.exists) throw Object.assign(new Error('NOT_FOUND'), { code: 'NOT_FOUND' });
        const restaurant = restaurantSnap.data() || {};
        const business = businessSnap.data() || {};
        if (
          String(restaurant.businessId || '') !== businessId ||
          String(restaurant.ownerUid || '') !== uid ||
          String(business.ownerUid || '') !== uid ||
          String(business.status || '') !== 'active' ||
          String(business.verificationStatus || '') !== 'verified'
        ) throw Object.assign(new Error('FORBIDDEN'), { code: 'FORBIDDEN' });
        const assignedBranchId = clean(membership.branchId, 128);
        if (assignedBranchId && String(restaurant.branchId || '') !== assignedBranchId) {
          throw Object.assign(new Error('BRANCH_FORBIDDEN'), { code: 'BRANCH_FORBIDDEN' });
        }
        if (String(restaurant.status || '') !== 'draft' || String(restaurant.verificationStatus || '') !== 'pending') {
          throw Object.assign(new Error('LOCKED'), { code: 'LOCKED' });
        }
        transaction.update(restaurantRef, { ...updates, updatedAt: now });
        transaction.create(db.collection('audit_logs').doc(), {
          action: 'restaurant_updated',
          actorUid: uid,
          resource: 'restaurant',
          resourceId: restaurantId,
          businessId,
          branchId: String(restaurant.branchId || ''),
          details: { changedFields: Object.keys(updates) },
          timestamp: now,
        });
      });
      return res.json({ ok: true, restaurantId, updatedFields: Object.keys(updates) });
    } catch (error: any) {
      if (error?.code === 'NOT_FOUND') return fail(res, 'NOT_FOUND', 'Restaurant not found.', 404);
      if (error?.code === 'FORBIDDEN') return fail(res, 'FORBIDDEN', 'You are not authorized to modify this Restaurant.', 403);
      if (error?.code === 'BRANCH_FORBIDDEN') return fail(res, 'FORBIDDEN', 'You cannot modify a Restaurant assigned to another branch.', 403);
      if (error?.code === 'LOCKED') return fail(res, 'CONFLICT', 'This Restaurant profile is locked after submission.', 409);
      console.error('Restaurant update failed:', error);
      return fail(res, 'SERVICE_UNAVAILABLE', 'Restaurant profile update is temporarily unavailable.', 503);
    }
  });

  if (requirePermission) {
    app.patch('/api/admin/restaurants/:restaurantId/verification', authenticate, requirePermission('manage:restaurant_verification'), async (req, res) => {
      const actorUid = clean((req as any).user?.uid, 128);
      const restaurantId = clean(req.params.restaurantId, 128);
      const decision = clean(req.body?.decision, 32);
      const reason = clean(req.body?.reason, 1000);
      if (!actorUid || !restaurantId || !['approve', 'reject'].includes(decision)) return fail(res, 'INVALID_REQUEST', 'A valid approval decision is required.');
      if (decision === 'reject' && !reason) return fail(res, 'INVALID_REQUEST', 'A rejection reason is required.');
      const restaurantRef = db.collection('restaurants').doc(restaurantId);
      const actorRef = db.collection('users').doc(actorUid);
      const now = Timestamp.now();
      try {
        await db.runTransaction(async (transaction) => {
          const [actorSnap, restaurantSnap] = await Promise.all([transaction.get(actorRef), transaction.get(restaurantRef)]);
          if (!actorSnap.exists) throw Object.assign(new Error('ACTOR_FORBIDDEN'), { code: 'ACTOR_FORBIDDEN' });
          const actorData = actorSnap.data() || {};
          const roles = Array.isArray(actorData.roles) ? actorData.roles.filter((v): v is Role => typeof v === 'string') : [];
          const permissions = Array.isArray(actorData.permissions) ? actorData.permissions.filter((v): v is Permission => typeof v === 'string') : [];
          if (!hasRolePermission(roles, permissions, 'manage:restaurant_verification')) throw Object.assign(new Error('ACTOR_FORBIDDEN'), { code: 'ACTOR_FORBIDDEN' });
          if (!restaurantSnap.exists) throw Object.assign(new Error('NOT_FOUND'), { code: 'NOT_FOUND' });
          const restaurant = restaurantSnap.data() || {};
          if (String(restaurant.status || '') !== 'submitted' || String(restaurant.verificationStatus || '') !== 'pending') throw Object.assign(new Error('INVALID_STATE'), { code: 'INVALID_STATE' });
          const approved = decision === 'approve';
          const nextStatus = approved ? 'active' : 'draft';
          const nextVerification = approved ? 'verified' : 'rejected';
          transaction.update(restaurantRef, {
            status: nextStatus, verificationStatus: nextVerification, verificationReviewedAt: now, verificationReviewedBy: actorUid,
            ...(approved ? { rejectionReason: null } : { rejectionReason: reason }), updatedAt: now,
          });
          transaction.create(db.collection('audit_logs').doc(), {
            action: approved ? 'restaurant_verified' : 'restaurant_rejected', actorUid, resource: 'restaurant', resourceId: restaurantId,
            businessId: String(restaurant.businessId || ''), branchId: String(restaurant.branchId || ''),
            details: { previousStatus: 'submitted', newStatus: nextStatus, previousVerificationStatus: 'pending', newVerificationStatus: nextVerification, reason: reason || null },
            timestamp: now,
          });
        });
        return res.json({ ok: true, restaurantId, decision, status: decision === 'approve' ? 'active' : 'draft', verificationStatus: decision === 'approve' ? 'verified' : 'rejected' });
      } catch (error: any) {
        if (error?.code === 'ACTOR_FORBIDDEN') return fail(res, 'FORBIDDEN', 'You are no longer authorized to verify Restaurants.', 403);
        if (error?.code === 'NOT_FOUND') return fail(res, 'NOT_FOUND', 'Restaurant not found.', 404);
        if (error?.code === 'INVALID_STATE') return fail(res, 'CONFLICT', 'Only a submitted Restaurant awaiting verification can be reviewed.', 409);
        console.error('Restaurant verification failed:', error);
        return fail(res, 'SERVICE_UNAVAILABLE', 'Restaurant verification is temporarily unavailable.', 503);
      }
    });
  }
  app.post('/api/business/restaurants/:restaurantId/uniquepay/connect', authenticate, limiter, async (req, res) => {
    const uid = clean((req as any).user?.uid, 128);
    const membership = ((req as any).businessMembership || {}) as Record<string, unknown>;
    const session = ((req as any).businessSession || {}) as Record<string, unknown>;
    const businessId = clean(session.businessId, 128);
    const restaurantId = clean(req.params.restaurantId, 128);
    const role = clean(membership.role, 64) as Role;
    const customPermissions = Array.isArray(membership.permissions)
      ? membership.permissions.filter((v): v is Permission => typeof v === 'string') as Permission[] : [];
    if (!uid || !businessId || clean(membership.businessId, 128) !== businessId) {
      return fail(res, 'BUSINESS_AUTH_REQUIRED', 'An active Business Platform session is required.', 401);
    }
    if (!hasRolePermission([role], customPermissions, 'manage:restaurant')) {
      return fail(res, 'FORBIDDEN', 'Your Business role does not allow Restaurant payment setup.', 403);
    }
    const restaurantRef = db.collection('restaurants').doc(restaurantId);
    const businessRef = db.collection('businesses').doc(businessId);
    const walletRef = db.collection('wallets').doc(uid);
    const now = Timestamp.now();
    try {
      await db.runTransaction(async (transaction) => {
        const [restaurantSnap, businessSnap, walletSnap] = await Promise.all([
          transaction.get(restaurantRef), transaction.get(businessRef), transaction.get(walletRef),
        ]);
        if (!restaurantSnap.exists || !businessSnap.exists) throw Object.assign(new Error('NOT_FOUND'), { code: 'NOT_FOUND' });
        const restaurant = restaurantSnap.data() || {};
        const business = businessSnap.data() || {};
        if (
          String(restaurant.businessId || '') !== businessId ||
          String(restaurant.ownerUid || '') !== uid ||
          String(business.ownerUid || '') !== uid ||
          String(business.status || '') !== 'active' ||
          String(business.verificationStatus || '') !== 'verified'
        ) throw Object.assign(new Error('FORBIDDEN'), { code: 'FORBIDDEN' });
        if (String(restaurant.status || '') !== 'active' || String(restaurant.verificationStatus || '') !== 'verified') {
          throw Object.assign(new Error('RESTAURANT_NOT_VERIFIED'), { code: 'RESTAURANT_NOT_VERIFIED' });
        }
        if (!walletSnap.exists) throw Object.assign(new Error('WALLET_UNAVAILABLE'), { code: 'WALLET_UNAVAILABLE' });
        const wallet = walletSnap.data() || {};
        if (String(wallet.currency || '') !== 'NGN' || String(wallet.status || '') !== 'active' ||
            !Number.isSafeInteger(Number(wallet.availableBalanceMinor)) || Number(wallet.availableBalanceMinor) < 0) {
          throw Object.assign(new Error('WALLET_UNAVAILABLE'), { code: 'WALLET_UNAVAILABLE' });
        }
        const existingWalletId = clean(restaurant.merchantWalletId, 128);
        if (existingWalletId && existingWalletId !== uid) {
          throw Object.assign(new Error('WALLET_LOCKED'), { code: 'WALLET_LOCKED' });
        }
        if (restaurant.uniquePayStatus === 'verified' && existingWalletId === uid) {
          throw Object.assign(new Error('ALREADY_CONNECTED'), { code: 'ALREADY_CONNECTED' });
        }
        transaction.update(restaurantRef, {
          merchantWalletId: uid,
          uniquePayStatus: 'verified',
          uniquePayConnectedAt: now,
          uniquePayConnectedBy: uid,
          updatedAt: now,
        });
        transaction.create(db.collection('audit_logs').doc(), {
          action: 'restaurant.uniquepay.connected',
          actorUid: uid,
          targetUid: uid,
          resource: 'restaurant',
          resourceId: restaurantId,
          businessId,
          branchId: String(restaurant.branchId || ''),
          details: { merchantWalletId: uid, uniquePayStatus: 'verified' },
          timestamp: now,
        });
      });
      return res.json({ ok: true, restaurantId, uniquePayStatus: 'verified' });
    } catch (error: any) {
      if (error?.code === 'NOT_FOUND') return fail(res, 'NOT_FOUND', 'Restaurant not found.', 404);
      if (error?.code === 'FORBIDDEN') return fail(res, 'FORBIDDEN', 'Only the verified Business owner can connect this Restaurant wallet.', 403);
      if (error?.code === 'RESTAURANT_NOT_VERIFIED') return fail(res, 'CONFLICT', 'The Restaurant must be approved before UniquePay can be connected.', 409);
      if (error?.code === 'WALLET_UNAVAILABLE') return fail(res, 'UNAVAILABLE', 'The Business owner UniquePay wallet is not available.', 503);
      if (error?.code === 'WALLET_LOCKED') return fail(res, 'CONFLICT', 'The Restaurant UniquePay wallet binding is already locked.', 409);
      if (error?.code === 'ALREADY_CONNECTED') return fail(res, 'CONFLICT', 'UniquePay is already connected to this Restaurant.', 409);
      console.error('Restaurant UniquePay connection failed:', error);
      return fail(res, 'SERVICE_UNAVAILABLE', 'Restaurant UniquePay connection is temporarily unavailable.', 503);
    }
  });
}