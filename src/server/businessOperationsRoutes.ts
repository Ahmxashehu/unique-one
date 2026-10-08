import type { Express, RequestHandler, Response } from 'express';
import { Timestamp, type Firestore } from 'firebase-admin/firestore';
import type { Permission } from '../lib/os/types';
import { hasRolePermission } from '../lib/auth/rbac';

function fail(res: Response, code: string, message: string, status = 400) {
  return res.status(status).json({ error: { code, message } });
}
function ctx(req: any) {
  const m = req.businessMembership || {}, s = req.businessSession || {};
  return { uid: String(s.uid || ''), businessId: String(s.businessId || ''), role: String(m.role || ''), permissions: Array.isArray(m.permissions) ? m.permissions : [] };
}
function can(req: any, permission: Permission) {
  const c = ctx(req);
  return hasRolePermission([c.role as any], c.permissions, permission);
}
function inTenant(data: any, businessId: string) { return String(data?.businessId || '') === businessId; }

export function registerBusinessOperationsRoutes(app: Express, _authenticate: RequestHandler, db: Firestore) {
  app.get('/api/business/staff', async (req, res) => {
    if (!can(req, 'manage:business_staff')) return fail(res, 'FORBIDDEN', 'You do not have permission to manage business staff.', 403);
    const { businessId } = ctx(req);
    try {
      const [i, b] = await Promise.all([
        db.collection('staffInvites').where('businessId', '==', businessId).limit(200).get(),
        db.collection('branches').where('businessId', '==', businessId).limit(200).get(),
      ]);
      return res.json({
        invites: i.docs.map(d => ({ id: d.id, ...d.data() })).filter((x: any) => inTenant(x, businessId)),
        branches: b.docs.map(d => ({ id: d.id, ...d.data() })).filter((x: any) => inTenant(x, businessId)),
      });
    } catch (e) { console.error('Business staff read failed:', e); return fail(res, 'SERVICE_UNAVAILABLE', 'Staff data is temporarily unavailable.', 503); }
  });

  app.post('/api/business/staff/invite', async (req, res) => {
    if (!can(req, 'manage:business_staff')) return fail(res, 'FORBIDDEN', 'You do not have permission to invite staff.', 403);
    const { uid, businessId } = ctx(req);
    const email = typeof req.body?.inviteeEmail === 'string' ? req.body.inviteeEmail.trim().toLowerCase() : '';
    const role = typeof req.body?.role === 'string' ? req.body.role.trim() : '';
    const branchId = typeof req.body?.branchId === 'string' ? req.body.branchId.trim() : '';
    const allowedRoles = new Set(['admin','manager','sales','cashier','accountant','inventory','support','delivery','branch_manager','viewer']);
    if (!uid || !businessId || !email || !allowedRoles.has(role)) return fail(res, 'INVALID_REQUEST', 'Valid invitation details are required.');
    try {
      const businessSnap = await db.collection('businesses').doc(businessId).get();
      const business = businessSnap.exists ? businessSnap.data() || {} : {};
      if (!businessSnap.exists || String(business.status || '') !== 'verified') {
        return fail(res, 'FORBIDDEN', 'Only a verified Business can issue staff invitations.', 403);
      }
      const businessOwnerUid = String(business.ownerUid || '');
      const privilegedInviteRoles = new Set(['admin', 'manager', 'branch_manager']);
      if (privilegedInviteRoles.has(role) && businessOwnerUid !== uid) {
        return fail(res, 'FORBIDDEN', 'Only the Business owner can invite privileged staff roles.', 403);
      }
      let branchName: string | null = null;
      if (branchId) {
        const snap = await db.collection('branches').doc(branchId).get(), branch = snap.exists ? snap.data() || {} : {};
        if (!snap.exists || !inTenant(branch, businessId) || String(branch.ownerUid || '') !== uid || String(branch.status || '') !== 'active') return fail(res, 'INVALID_BRANCH', 'The selected branch is invalid or inactive.', 403);
        branchName = String(branch.name || '').trim() || null;
      }
      const now = Timestamp.now(), ref = db.collection('staffInvites').doc();
      await ref.set({ businessOwnerUid: uid, businessId, inviteeEmail: email, role, branchName, branchId: branchId || null, status: 'pending', invitedAt: now, createdAt: now });
      await db.collection('audit_logs').add({ action: 'business_staff_invite_created', actorUid: uid, businessId, inviteId: ref.id, role, branchId: branchId || null, createdAt: now });
      return res.status(201).json({ ok: true, invite: { id: ref.id, businessId, inviteeEmail: email, role, branchName, branchId: branchId || null, status: 'pending' } });
    } catch (e) { console.error('Business staff invite failed:', e); return fail(res, 'SERVICE_UNAVAILABLE', 'Unable to create the staff invitation.', 503); }
  });

  app.post('/api/business/staff/:staffUid/deactivate', async (req, res) => {
    if (!can(req, 'manage:business_staff')) return fail(res, 'FORBIDDEN', 'You do not have permission to manage business staff.', 403);
    const { uid, businessId } = ctx(req);
    const targetUid = String(req.params.staffUid || '').trim();
    if (!uid || !businessId || !targetUid || targetUid === uid) return fail(res, 'INVALID_REQUEST', 'A valid staff account other than the Business owner is required.');
    try {
      const businessSnap = await db.collection('businesses').doc(businessId).get();
      const business = businessSnap.exists ? businessSnap.data() || {} : {};
      if (!businessSnap.exists || String(business.ownerUid || '') !== uid || String(business.status || '') !== 'verified') {
        return fail(res, 'FORBIDDEN', 'Only the verified Business owner can deactivate staff access.', 403);
      }
      const membershipRef = db.collection('businessMemberships').doc(`${targetUid}__${businessId}`);
      const now = Timestamp.now();
      let changed = false;
      await db.runTransaction(async (transaction) => {
        const membershipSnap = await transaction.get(membershipRef);
        if (!membershipSnap.exists || String(membershipSnap.data()?.status || '') !== 'active') return;
        const membership = membershipSnap.data() || {};
        if (String(membership.role || '') === 'business_owner') throw new Error('OWNER_MEMBERSHIP_PROTECTED');
        transaction.update(membershipRef, { status: 'inactive', inactiveReason: 'staff_deactivated', deactivatedBy: uid, updatedAt: now });
        const sessions = await transaction.get(
          db.collection('businessAccessSessions')
            .where('uid', '==', targetUid)
            .where('businessId', '==', businessId)
            .where('status', '==', 'active')
            .limit(50)
        );
        for (const session of sessions.docs) {
          transaction.update(session.ref, { status: 'revoked', revokedAt: now, revokedBy: uid });
        }
        changed = true;
      });
      await db.collection('audit_logs').add({
        action: 'business_staff_deactivated',
        actorUid: uid,
        targetUid,
        businessId,
        createdAt: now,
      });
      return res.json({ ok: true, changed });
    } catch (error: any) {
      if (String(error?.message || '') === 'OWNER_MEMBERSHIP_PROTECTED') return fail(res, 'FORBIDDEN', 'The Business owner membership cannot be deactivated.', 403);
      console.error('Business staff deactivation failed:', error);
      return fail(res, 'SERVICE_UNAVAILABLE', 'Unable to deactivate Business staff access.', 503);
    }
  });

  app.get('/api/business/branches', async (req, res) => {
    if (!can(req, 'manage:business_staff') && !can(req, 'create:products') && !can(req, 'edit:products') && !can(req, 'manage:inventory')) return fail(res, 'FORBIDDEN', 'You do not have permission to view branches.', 403);
    const { businessId } = ctx(req);
    const membership = req.businessMembership || {};
    const assignedBranchId = typeof membership.branchId === 'string' ? membership.branchId.trim() : '';
    try {
      const snap = await db.collection('branches').where('businessId', '==', businessId).limit(200).get();
      const branches = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter((x: any) => inTenant(x, businessId));
      return res.json({ branches: assignedBranchId ? branches.filter((x: any) => x.id === assignedBranchId) : branches });
    } catch (e) { console.error('Business branches read failed:', e); return fail(res, 'SERVICE_UNAVAILABLE', 'Branch data is temporarily unavailable.', 503); }
  });

  app.post('/api/business/branches', async (req, res) => {
    if (!can(req, 'manage:business_staff')) return fail(res, 'FORBIDDEN', 'You do not have permission to manage branches.', 403);
    const { uid, businessId } = ctx(req);
    const businessSnap = await db.collection('businesses').doc(businessId).get();
    const business = businessSnap.exists ? businessSnap.data() || {} : {};
    if (!businessSnap.exists || String(business.ownerUid || '') !== uid || String(business.status || '') !== 'verified') {
      return fail(res, 'FORBIDDEN', 'Only the verified Business owner can create branches.', 403);
    }
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const type = typeof req.body?.type === 'string' ? req.body.type.trim() : '';
    const address = typeof req.body?.address === 'string' ? req.body.address.trim() : '';
    const phone = typeof req.body?.phone === 'string' ? req.body.phone.trim() : '';
    if (!uid || !businessId || !name || !new Set(['headquarters','branch','warehouse','farm_site','storefront']).has(type)) return fail(res, 'INVALID_REQUEST', 'Valid branch details are required.');
    try {
      const now = Timestamp.now(), ref = db.collection('branches').doc();
      await ref.set({ ownerUid: uid, businessId, name, type, address: address || null, phone: phone || null, status: 'active', createdAt: now, updatedAt: now });
      await db.collection('audit_logs').add({ action: 'business_branch_created', actorUid: uid, businessId, branchId: ref.id, createdAt: now });
      return res.status(201).json({ ok: true, branch: { id: ref.id, ownerUid: uid, businessId, name, type, address: address || null, phone: phone || null, status: 'active' } });
    } catch (e) { console.error('Business branch create failed:', e); return fail(res, 'SERVICE_UNAVAILABLE', 'Unable to create the branch.', 503); }
  });

  for (const method of ['patch','delete'] as const) {
    app[method]('/api/business/branches/:branchId', async (req, res) => {
      if (!can(req, 'manage:business_staff')) return fail(res, 'FORBIDDEN', 'You do not have permission to manage branches.', 403);
      const { uid, businessId } = ctx(req), ref = db.collection('branches').doc(String(req.params.branchId || ''));
      try {
        const snap = await ref.get(), branch = snap.exists ? snap.data() || {} : {};
        if (!snap.exists || !inTenant(branch, businessId)) return fail(res, 'NOT_FOUND', 'Branch not found.', 404);
        const businessSnap = await db.collection('businesses').doc(businessId).get();
        const business = businessSnap.exists ? businessSnap.data() || {} : {};
        if (!businessSnap.exists || String(business.ownerUid || '') !== String(branch.ownerUid || '') || String(business.status || '') !== 'verified') {
          return fail(res, 'FORBIDDEN', 'This branch is not owned by the verified Business.', 403);
        }
        if (method === 'patch') {
          const updates: Record<string, unknown> = {};
          if (typeof req.body?.status === 'string' && ['active','inactive'].includes(req.body.status)) updates.status = req.body.status;
          if (typeof req.body?.name === 'string' && req.body.name.trim()) updates.name = req.body.name.trim();
          if (!Object.keys(updates).length) return fail(res, 'INVALID_REQUEST', 'No valid branch changes were supplied.');
          updates.updatedAt = Timestamp.now();
          if (updates.status === 'inactive' && String(branch.status || '') !== 'inactive') {
            await db.runTransaction(async (transaction) => {
              const membershipQuery = db.collection('businessMemberships')
                .where('businessId', '==', businessId)
                .where('branchId', '==', ref.id)
                .where('status', '==', 'active')
                .limit(200);
              const memberships = await transaction.get(membershipQuery);
              transaction.update(ref, updates);
              for (const membership of memberships.docs) {
                transaction.update(membership.ref, {
                  status: 'inactive',
                  inactiveReason: 'branch_deactivated',
                  updatedAt: updates.updatedAt,
                });
              }
            });
            await db.collection('audit_logs').add({
              action: 'business_branch_deactivated',
              actorUid: uid,
              businessId,
              branchId: ref.id,
              createdAt: Timestamp.now(),
            });
            return res.json({ ok: true, branchId: ref.id, status: 'inactive', suspendedMemberships: true });
          }
          await ref.update(updates);
          await db.collection('audit_logs').add({ action: 'business_branch_updated', actorUid: uid, businessId, branchId: ref.id, createdAt: Timestamp.now() });
          return res.json({ ok: true, branchId: ref.id, status: updates.status || branch.status });
        }
        // Branches are referenced by products, inventory and staff assignments.
        // Never hard-delete a branch and leave dangling references behind.
        const now = Timestamp.now();
        await db.runTransaction(async (transaction) => {
          const membershipQuery = db.collection('businessMemberships')
            .where('businessId', '==', businessId)
            .where('branchId', '==', ref.id)
            .where('status', '==', 'active')
            .limit(200);
          const memberships = await transaction.get(membershipQuery);
          transaction.update(ref, { status: 'inactive', updatedAt: now });
          for (const membership of memberships.docs) {
            transaction.update(membership.ref, {
              status: 'inactive',
              inactiveReason: 'branch_deactivated',
              updatedAt: now,
            });
          }
        });
        await db.collection('audit_logs').add({ action: 'business_branch_deactivated', actorUid: uid, businessId, branchId: ref.id, createdAt: now });
        return res.json({ ok: true, branchId: ref.id, status: 'inactive', suspendedMemberships: true });
      } catch (e) { console.error('Business branch mutation failed:', e); return fail(res, 'SERVICE_UNAVAILABLE', 'Unable to update the branch.', 503); }
    });
  }

  app.get('/api/business/suppliers', async (req, res) => {
    if (!can(req, 'manage:inventory')) return fail(res, 'FORBIDDEN', 'You do not have permission to manage suppliers.', 403);
    const { businessId } = ctx(req);
    try {
      const snap = await db.collection('suppliers').where('businessId', '==', businessId).limit(300).get();
      return res.json({ suppliers: snap.docs.map(d => ({ id: d.id, ...d.data() })).filter((x: any) => inTenant(x, businessId)) });
    } catch (e) { console.error('Business suppliers read failed:', e); return fail(res, 'SERVICE_UNAVAILABLE', 'Supplier data is temporarily unavailable.', 503); }
  });

  app.post('/api/business/suppliers', async (req, res) => {
    if (!can(req, 'manage:inventory')) return fail(res, 'FORBIDDEN', 'You do not have permission to manage suppliers.', 403);
    const { uid, businessId } = ctx(req);
    const f = {
      name: typeof req.body?.name === 'string' ? req.body.name.trim() : '',
      companyName: typeof req.body?.companyName === 'string' ? req.body.companyName.trim() : '',
      phone: typeof req.body?.phone === 'string' ? req.body.phone.trim() : '',
      email: typeof req.body?.email === 'string' ? req.body.email.trim() : '',
      address: typeof req.body?.address === 'string' ? req.body.address.trim() : '',
      category: typeof req.body?.category === 'string' ? req.body.category.trim() : '',
    };
    if (!uid || !businessId || !f.name || !f.companyName || !f.phone || !f.category) return fail(res, 'INVALID_REQUEST', 'Required supplier details are missing.');
    try {
      const now = Timestamp.now(), ref = db.collection('suppliers').doc();
      await ref.set({ businessOwnerUid: uid, businessId, ...f, email: f.email || null, address: f.address || null, outstandingAmount: 0, verificationStatus: 'unverified', createdAt: now, updatedAt: now });
      await db.collection('audit_logs').add({ action: 'business_supplier_created', actorUid: uid, businessId, supplierId: ref.id, createdAt: now });
      return res.status(201).json({ ok: true, supplier: { id: ref.id, businessId, ...f, outstandingAmount: 0, verificationStatus: 'unverified' } });
    } catch (e) { console.error('Business supplier create failed:', e); return fail(res, 'SERVICE_UNAVAILABLE', 'Unable to add the supplier.', 503); }
  });
}
