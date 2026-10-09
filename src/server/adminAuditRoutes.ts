import type { Express, RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import type { Permission } from '../lib/os/types';

export function registerAdminAuditRoutes(app: Express, authenticate: RequestHandler, requirePermission: (permission: Permission) => RequestHandler) {
  const db = getFirestore();

  app.get('/api/payment-requests', rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: true, legacyHeaders: false }), authenticate, async (req, res) => {
    const uid = (req as any).user?.uid as string | undefined;
    if (!uid) return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Authentication is required.' } });
    try {
      const [sent, received] = await Promise.all([
        db.collection('payment_requests').where('senderId', '==', uid).limit(100).get(),
        db.collection('payment_requests').where('recipientId', '==', uid).limit(100).get(),
      ]);
      const requests = new Map<string, Record<string, unknown>>();
      for (const doc of [...sent.docs, ...received.docs]) {
        const d = doc.data();
        requests.set(doc.id, {
          id: doc.id, senderId: d.senderId, recipientId: d.recipientId,
          recipientIdentifier: d.recipientIdentifier ?? null, recipientName: d.recipientName ?? null,
          amount: d.amount, currency: d.currency, description: d.description,
          status: d.status, dueDate: d.dueDate ?? null,
          createdAt: d.createdAt ?? null, updatedAt: d.updatedAt ?? null,
        });
      }
      return res.json({ requests: [...requests.values()].sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? ''))) });
    } catch (error) {
      console.error('Payment request list failed:', error);
      return res.status(503).json({ error: { code: 'SERVICE_UNAVAILABLE', message: 'Payment requests are temporarily unavailable.' } });
    }
  });

  app.patch('/api/payment-requests/:requestId/status', rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: true, legacyHeaders: false }), authenticate, async (req, res) => {
    const uid = (req as any).user?.uid as string | undefined;
    if (!uid) return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Authentication is required.' } });
    const requestId = typeof req.params.requestId === 'string' ? req.params.requestId : '';
    const nextStatus = typeof req.body?.status === 'string' ? req.body.status : '';
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(requestId) || !['sent', 'viewed', 'rejected', 'cancelled'].includes(nextStatus)) {
      return res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'A valid request ID and supported status are required.' } });
    }
    const ref = db.collection('payment_requests').doc(requestId);
    try {
      const result = await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists) return { status: 404, body: { error: { code: 'NOT_FOUND', message: 'Payment request was not found.' } } };
        const d = snap.data()!;
        const sender = d.senderId === uid;
        const recipient = d.recipientId === uid;
        if (!sender && !recipient) return { status: 403, body: { error: { code: 'FORBIDDEN', message: 'You are not a participant in this payment request.' } } };
        const current = String(d.status ?? '');
        const allowed = (nextStatus === 'sent' && sender && current === 'draft')
          || (nextStatus === 'viewed' && recipient && current === 'sent')
          || (nextStatus === 'rejected' && recipient && ['sent', 'viewed'].includes(current))
          || (nextStatus === 'cancelled' && sender && ['draft', 'sent'].includes(current));
        if (!allowed) return { status: 409, body: { error: { code: 'INVALID_STATE', message: 'This payment request cannot make that status transition.' } } };
        const now = Timestamp.now();
        tx.update(ref, { status: nextStatus, updatedAt: now.toDate().toISOString() });
        const auditRef = db.collection('audit_logs').doc();
        tx.set(auditRef, { action: 'payment_request.status_changed', actorUid: uid, resource: 'payment_request', resourceId: requestId, previousStatus: current, status: nextStatus, timestamp: now });
        return { status: 200, body: { id: requestId, status: nextStatus } };
      });
      return res.status(result.status).json(result.body);
    } catch (error) {
      console.error('Payment request status update failed:', error);
      return res.status(503).json({ error: { code: 'SERVICE_UNAVAILABLE', message: 'The payment request could not be updated.' } });
    }
  });

  app.get('/api/admin/audit-logs', authenticate, requirePermission('view:audit_logs'), async (req, res) => {
    const raw = Number(req.query.limit);
    const limit = Number.isInteger(raw) && raw > 0 ? Math.min(raw, 100) : 50;
    try {
      const snapshot = await db.collection('audit_logs').orderBy('timestamp', 'desc').limit(limit).get();
      const logs = snapshot.docs.map((doc) => {
        const data = doc.data();
        const timestamp = typeof data.timestamp?.toDate === 'function' ? data.timestamp.toDate().toISOString() : null;
        return { id: doc.id, action: data.action ?? 'unknown', resource: data.resource ?? null, resourceId: data.resourceId ?? null, actorUid: data.actorUid ?? data.uid ?? null, details: data.details ?? null, timestamp };
      });
      return res.json({ logs });
    } catch (error) {
      console.error('Admin audit log read failed:', error);
      return res.status(503).json({ error: { code: 'SERVICE_UNAVAILABLE', message: 'Audit logs are temporarily unavailable.' } });
    }
  });
}
