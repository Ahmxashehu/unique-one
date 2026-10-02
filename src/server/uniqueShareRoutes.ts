import { createHash, randomBytes } from "crypto";
import type { Express, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

type AuthenticatedRequest = Request & { user?: { uid?: string } };

function safeUid(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);
}
function safeId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,160}$/.test(value);
}
function hashSecret(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
function error(res: Response, status: number, code: string, message: string) {
  return res.status(status).json({ error: { code, message } });
}
function uidOf(req: AuthenticatedRequest): string | null {
  return safeUid(req.user?.uid) ? req.user!.uid! : null;
}
function normalizeFileName(value: unknown): string {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw || raw.length > 255) throw new Error("INVALID_FILE_NAME");
  const cleaned = raw.replace(/[\\/\0]/g, "_").replace(/[\u0000-\u001f\u007f]/g, "_");
  if (!cleaned || cleaned === "." || cleaned === "..") throw new Error("INVALID_FILE_NAME");
  return cleaned;
}
function normalizeContentType(value: unknown): string {
  if (typeof value !== "string" || value.length > 255) throw new Error("INVALID_CONTENT_TYPE");
  return value.trim() || "application/octet-stream";
}

export function registerUniqueShareRoutes(app: Express, authenticate: any) {
  const db = getFirestore();
  const sessionLimiter = rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: true, legacyHeaders: false });
  const actionLimiter = rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: true, legacyHeaders: false });

  app.post("/api/unique-share/sessions", authenticate, sessionLimiter, async (req: AuthenticatedRequest, res) => {
    const senderUid = uidOf(req);
    if (!senderUid) return error(res, 401, "UNAUTHENTICATED", "Sign in is required.");
    const sessionId = randomBytes(18).toString("base64url");
    const connectionSecret = randomBytes(24).toString("base64url");
    const expiresAt = Timestamp.fromMillis(Date.now() + 5 * 60_000);
    await db.collection("uniqueShareSessions").doc(sessionId).set({
      sessionId,
      senderUid,
      receiverUid: null,
      secretHash: hashSecret(connectionSecret),
      status: "waiting",
      createdAt: Timestamp.now(),
      expiresAt,
      acceptedAt: null,
      completedAt: null,
      revokedAt: null,
    });
    return res.status(201).json({
      sessionId,
      connectionToken: "U1SHARE1." + sessionId + "." + connectionSecret,
      expiresAt: expiresAt.toDate().toISOString(),
      protocol: "uniqueShare.v1",
    });
  });

  app.post("/api/unique-share/sessions/:sessionId/connect", authenticate, actionLimiter, async (req: AuthenticatedRequest, res) => {
    const receiverUid = uidOf(req);
    const sessionId = req.params.sessionId;
    const token = typeof req.body?.connectionToken === "string" ? req.body.connectionToken : "";
    if (!receiverUid) return error(res, 401, "UNAUTHENTICATED", "Sign in is required.");
    if (!safeId(sessionId) || !token.startsWith("U1SHARE1.")) return error(res, 400, "INVALID_CONNECTION", "This UniqueShare connection code is invalid.");
    const parts = token.split(".");
    if (parts.length !== 3 || parts[1] !== sessionId || !parts[2]) return error(res, 400, "INVALID_CONNECTION", "This UniqueShare connection code is invalid.");
    const ref = db.collection("uniqueShareSessions").doc(sessionId);
    const snap = await ref.get();
    if (!snap.exists) return error(res, 404, "SESSION_NOT_FOUND", "The UniqueShare connection has expired or does not exist.");
    const session = snap.data() as Record<string, any>;
    if (session.senderUid === receiverUid) return error(res, 400, "SELF_CONNECTION", "A UniqueShare connection must connect two different authenticated users.");
    if (session.status !== "waiting") return error(res, 409, "SESSION_UNAVAILABLE", "This UniqueShare connection is no longer waiting.");
    if (!(session.expiresAt instanceof Timestamp) || session.expiresAt.toMillis() < Date.now()) {
      await ref.update({ status: "expired", revokedAt: Timestamp.now() });
      return error(res, 410, "SESSION_EXPIRED", "This UniqueShare connection has expired.");
    }
    if (session.secretHash !== hashSecret(parts[2])) return error(res, 403, "INVALID_CONNECTION", "The UniqueShare security challenge could not be verified.");
    await ref.update({ receiverUid, status: "connected", connectedAt: Timestamp.now() });
    return res.status(200).json({ sessionId, status: "connected", senderUid: session.senderUid, receiverUid });
  });

  app.get("/api/unique-share/sessions/:sessionId", authenticate, actionLimiter, async (req: AuthenticatedRequest, res) => {
    const uid = uidOf(req);
    const sessionId = req.params.sessionId;
    if (!uid) return error(res, 401, "UNAUTHENTICATED", "Sign in is required.");
    if (!safeId(sessionId)) return error(res, 400, "INVALID_SESSION", "The UniqueShare session ID is invalid.");
    const snap = await db.collection("uniqueShareSessions").doc(sessionId).get();
    if (!snap.exists) return error(res, 404, "SESSION_NOT_FOUND", "The UniqueShare connection was not found.");
    const session = snap.data() as Record<string, any>;
    if (session.senderUid !== uid && session.receiverUid !== uid) return error(res, 403, "FORBIDDEN", "You are not a member of this UniqueShare connection.");
    if (session.expiresAt instanceof Timestamp && session.expiresAt.toMillis() < Date.now() && session.status !== "completed") {
      await snap.ref.update({ status: "expired", revokedAt: Timestamp.now() });
      session.status = "expired";
    }
    return res.json({
      sessionId,
      status: session.status,
      senderUid: session.senderUid,
      receiverUid: session.receiverUid,
      expiresAt: session.expiresAt instanceof Timestamp ? session.expiresAt.toDate().toISOString() : null,
    });
  });

  app.post("/api/unique-share/sessions/:sessionId/accept", authenticate, actionLimiter, async (req: AuthenticatedRequest, res) => {
    const uid = uidOf(req);
    const sessionId = req.params.sessionId;
    if (!uid) return error(res, 401, "UNAUTHENTICATED", "Sign in is required.");
    const ref = db.collection("uniqueShareSessions").doc(sessionId);
    const snap = await ref.get();
    if (!snap.exists) return error(res, 404, "SESSION_NOT_FOUND", "The UniqueShare connection was not found.");
    const session = snap.data() as Record<string, any>;
    if (session.receiverUid !== uid) return error(res, 403, "FORBIDDEN", "Only the receiving authenticated user can accept this connection.");
    if (session.status !== "connected") return error(res, 409, "SESSION_UNAVAILABLE", "This connection is not waiting for receiver approval.");
    if (session.expiresAt instanceof Timestamp && session.expiresAt.toMillis() < Date.now()) {
      await ref.update({ status: "expired", revokedAt: Timestamp.now() });
      return error(res, 410, "SESSION_EXPIRED", "This UniqueShare connection has expired.");
    }
    await ref.update({ status: "accepted", acceptedAt: Timestamp.now() });
    return res.json({ sessionId, status: "accepted" });
  });

  app.post("/api/unique-share/sessions/:sessionId/revoke", authenticate, actionLimiter, async (req: AuthenticatedRequest, res) => {
    const uid = uidOf(req);
    const sessionId = req.params.sessionId;
    if (!uid) return error(res, 401, "UNAUTHENTICATED", "Sign in is required.");
    const ref = db.collection("uniqueShareSessions").doc(sessionId);
    const snap = await ref.get();
    if (!snap.exists) return error(res, 404, "SESSION_NOT_FOUND", "The UniqueShare connection was not found.");
    const session = snap.data() as Record<string, any>;
    if (session.senderUid !== uid && session.receiverUid !== uid) return error(res, 403, "FORBIDDEN", "You are not a member of this UniqueShare connection.");
    await ref.update({ status: "revoked", revokedAt: Timestamp.now() });
    return res.json({ sessionId, status: "revoked" });
  });

  app.post("/api/unique-share/sessions/:sessionId/files", authenticate, actionLimiter, async (req: AuthenticatedRequest, res) => {
    const uid = uidOf(req);
    const sessionId = req.params.sessionId;
    if (!uid) return error(res, 401, "UNAUTHENTICATED", "Sign in is required.");
    const ref = db.collection("uniqueShareSessions").doc(sessionId);
    const snap = await ref.get();
    if (!snap.exists) return error(res, 404, "SESSION_NOT_FOUND", "The UniqueShare connection was not found.");
    const session = snap.data() as Record<string, any>;
    if (session.senderUid !== uid) return error(res, 403, "FORBIDDEN", "Only the authenticated sender can add files.");
    if (session.status !== "accepted") return error(res, 409, "SESSION_NOT_ACCEPTED", "The receiver must accept the UniqueShare connection first.");
    const name = normalizeFileName(req.body?.name);
    const contentType = normalizeContentType(req.body?.contentType);
    const sizeBytes = Number(req.body?.sizeBytes);
    if (!Number.isSafeInteger(sizeBytes) || sizeBytes < 0 || sizeBytes > 2 * 1024 * 1024 * 1024) {
      return error(res, 400, "INVALID_FILE_SIZE", "Each UniqueShare file must be 2 GB or smaller in this web build.");
    }
    const fileId = randomBytes(16).toString("hex");
    const storagePath = "uniqueShare/" + sessionId + "/" + session.receiverUid + "/" + fileId + "/" + name;
    await db.collection("uniqueShareFiles").doc(sessionId + "_" + fileId).set({
      fileId, sessionId, senderUid: session.senderUid, receiverUid: session.receiverUid,
      name, contentType, sizeBytes, storagePath, status: "pending",
      createdAt: Timestamp.now(), uploadedAt: null,
    });
    return res.status(201).json({ fileId, storagePath, name, contentType, sizeBytes, status: "pending" });
  });

  app.post("/api/unique-share/sessions/:sessionId/files/:fileId/complete", authenticate, actionLimiter, async (req: AuthenticatedRequest, res) => {
    const uid = uidOf(req);
    const { sessionId, fileId } = req.params;
    if (!uid) return error(res, 401, "UNAUTHENTICATED", "Sign in is required.");
    const fileRef = db.collection("uniqueShareFiles").doc(sessionId + "_" + fileId);
    const snap = await fileRef.get();
    if (!snap.exists) return error(res, 404, "FILE_NOT_FOUND", "The UniqueShare file was not found.");
    const file = snap.data() as Record<string, any>;
    if (file.senderUid !== uid) return error(res, 403, "FORBIDDEN", "Only the authenticated sender can complete this transfer.");
    if (file.status !== "pending") return error(res, 409, "FILE_UNAVAILABLE", "This UniqueShare file is no longer pending.");
    await fileRef.update({ status: "available", uploadedAt: Timestamp.now() });
    return res.json({ fileId, status: "available" });
  });

  app.get("/api/unique-share/sessions/:sessionId/files", authenticate, actionLimiter, async (req: AuthenticatedRequest, res) => {
    const uid = uidOf(req);
    const sessionId = req.params.sessionId;
    if (!uid) return error(res, 401, "UNAUTHENTICATED", "Sign in is required.");
    const sessionSnap = await db.collection("uniqueShareSessions").doc(sessionId).get();
    if (!sessionSnap.exists) return error(res, 404, "SESSION_NOT_FOUND", "The UniqueShare connection was not found.");
    const session = sessionSnap.data() as Record<string, any>;
    if (session.senderUid !== uid && session.receiverUid !== uid) return error(res, 403, "FORBIDDEN", "You are not a member of this UniqueShare connection.");
    const files = await db.collection("uniqueShareFiles").where("sessionId", "==", sessionId).limit(100).get();
    return res.json({
      files: files.docs.map(doc => {
        const data = doc.data() as Record<string, any>;
        return { fileId: data.fileId, name: data.name, contentType: data.contentType, sizeBytes: data.sizeBytes, storagePath: data.storagePath, status: data.status };
      }),
    });
  });
}
