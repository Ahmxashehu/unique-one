import type { Express, RequestHandler } from 'express';
import { getFirestore } from 'firebase-admin/firestore';
import type { Permission } from '../lib/os/types';

export function registerAdminAuditRoutes(app: Express, authenticate: RequestHandler, requirePermission: (permission: Permission) => RequestHandler) {
  const db = getFirestore();
  app.get('/api/admin/audit-logs', authenticate, requirePermission('view:audit_logs'), async (req, res) => {
    const raw = Number(req.query.limit);
    const limit = Number.isInteger(raw) && raw > 0 ? Math.min(raw, 100) : 50;
    try {
      const snapshot = await db.collection('auditLogs').orderBy('timestamp', 'desc').limit(limit).get();
      const logs = snapshot.docs.map((doc) => {
        const data = doc.data();
        const timestamp = typeof data.timestamp?.toDate === 'function' ? data.timestamp.toDate().toISOString() : null;
        return { id: doc.id, action: data.action ?? 'unknown', resource: data.resource ?? null, resourceId: data.resourceId ?? null, actorUid: data.uid ?? null, details: data.details ?? null, timestamp };
      });
      return res.json({ logs });
    } catch (error) {
      console.error('Admin audit log read failed:', error);
      return res.status(503).json({ error: { code: 'SERVICE_UNAVAILABLE', message: 'Audit logs are temporarily unavailable.' } });
    }
  });
}
