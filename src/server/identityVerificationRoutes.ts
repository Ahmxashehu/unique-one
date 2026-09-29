import type { Express, RequestHandler } from "express";
import { createHash } from "crypto";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

type VerificationType = "nin" | "vNIN" | "bvn" | "bank_account" | "phone";
type MatchInput = { firstName?: string; lastName?: string; dateOfBirth?: string; phone?: string };

const db = getFirestore();
const allowedTypes = new Set<VerificationType>(["nin", "vNIN", "bvn", "bank_account", "phone"]);

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function safeIdentifier(type: VerificationType, value: unknown): value is string {
  if (typeof value !== "string") return false;
  const v = value.trim();
  if (!v || v.length > 128) return false;
  if (type === "nin" || type === "bvn") return /^\d{11}$/.test(v);
  if (type === "vNIN") return /^[A-Za-z0-9]{10,32}$/.test(v);
  if (type === "phone") return /^\+?[0-9]{10,15}$/.test(v);
  return /^\d{10}$/.test(v);
}

function providerConfigured() {
  return Boolean(process.env.DOJAH_APP_ID && process.env.DOJAH_API_KEY);
}

function providerBaseUrl() {
  return (process.env.DOJAH_BASE_URL || "https://sandbox.dojah.io").replace(/\/$/, "");
}

function providerPath(type: VerificationType) {
  switch (type) {
    case "bvn": return "/api/v1/kyc/bvn";
    case "nin": return "/api/v1/kyc/nin";
    case "vNIN": return "/api/v1/kyc/vnin";
    case "bank_account": return "/api/v1/kyc/nuban";
    case "phone": return "/api/v1/kyc/phone_number";
  }
}

function identifierParameter(type: VerificationType) {
  switch (type) {
    case "bvn": return "bvn";
    case "nin": return "nin";
    case "vNIN": return "vnin";
    case "bank_account": return "nuban";
    case "phone": return "phone_number";
  }
}

function pickEntity(payload: unknown): Record<string, unknown> | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const entity = (payload as Record<string, unknown>).entity;
  return entity && typeof entity === "object" && !Array.isArray(entity)
    ? entity as Record<string, unknown>
    : null;
}

function readString(entity: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = entity[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function evaluateMatch(entity: Record<string, unknown>, match: MatchInput) {
  const checks: boolean[] = [];
  if (match.firstName) {
    const actual = readString(entity, ["first_name", "firstname", "firstName"]);
    if (actual) checks.push(normalize(actual) === normalize(match.firstName));
  }
  if (match.lastName) {
    const actual = readString(entity, ["last_name", "surname", "lastName"]);
    if (actual) checks.push(normalize(actual) === normalize(match.lastName));
  }
  if (match.dateOfBirth) {
    const actual = readString(entity, ["dob", "date_of_birth", "birthdate", "dateOfBirth"]);
    if (actual) checks.push(actual === match.dateOfBirth);
  }
  if (match.phone) {
    const actual = readString(entity, ["phone", "phone_number", "phone_number1", "mobile"]);
    if (actual) checks.push(actual.replace(/\D/g, "").slice(-10) === match.phone.replace(/\D/g, "").slice(-10));
  }
  return checks.length === 0 ? "not_requested" : checks.every(Boolean) ? "matched" : "not_matched";
}

export function registerIdentityVerificationRoutes(app: Express, authenticate: RequestHandler) {
  app.get("/api/verification/status", authenticate, async (req, res) => {
    const uid = (req as Request & { user?: { uid?: string } }).user?.uid;
    if (!uid) return res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Authentication is required." } });

    const snapshot = await db.collection("identityVerifications")
      .where("uid", "==", uid)
      .orderBy("updatedAt", "desc")
      .limit(20)
      .get();

    return res.json({
      provider: process.env.IDENTITY_PROVIDER || "dojah",
      configured: providerConfigured(),
      verifications: snapshot.docs.map((doc) => doc.data()),
    });
  });

  app.post("/api/verification/validate", authenticate, async (req, res) => {
    const uid = (req as Request & { user?: { uid?: string } }).user?.uid;
    if (!uid) return res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Authentication is required." } });

    const body = req.body as Record<string, unknown>;
    const type = body.type as VerificationType;
    const identifier = typeof body.identifier === "string" ? body.identifier.trim() : "";
    const match = (body.match && typeof body.match === "object" && !Array.isArray(body.match) ? body.match : {}) as MatchInput;

    if (!allowedTypes.has(type) || !safeIdentifier(type, identifier)) {
      return res.status(400).json({ error: { code: "INVALID_REQUEST", message: "Invalid verification type or identifier." } });
    }

    for (const key of Object.keys(match)) {
      if (!["firstName", "lastName", "dateOfBirth", "phone"].includes(key)) {
        return res.status(400).json({ error: { code: "INVALID_REQUEST", message: "Unsupported match field." } });
      }
    }

    if (!providerConfigured()) {
      return res.status(503).json({
        error: { code: "PROVIDER_NOT_CONFIGURED", message: "Identity provider credentials are not configured on the server." },
        provider: process.env.IDENTITY_PROVIDER || "dojah",
      });
    }

    const url = new URL(providerBaseUrl() + providerPath(type));
    url.searchParams.set(identifierParameter(type), identifier);

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        AppId: process.env.DOJAH_APP_ID as string,
        Authorization: process.env.DOJAH_API_KEY as string,
      },
    });

    const payload = await response.json().catch(() => null);
    const entity = pickEntity(payload);
    const providerValidated = response.ok && Boolean(entity);
    const matchStatus = entity ? evaluateMatch(entity, match) : "not_requested";

    const verificationId = createHash("sha256")
      .update(uid + ":" + type + ":" + Date.now() + ":" + Math.random())
      .digest("hex");

    await db.collection("identityVerifications").doc(verificationId).set({
      id: verificationId,
      uid,
      type,
      provider: process.env.IDENTITY_PROVIDER || "dojah",
      status: providerValidated ? (matchStatus === "not_matched" ? "needs_review" : "verified") : "failed",
      providerValidated,
      matchStatus,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      // Deliberately never persist the submitted NIN/BVN/vNIN/phone/NUBAN.
    });

    return res.status(providerValidated ? 200 : 422).json({
      id: verificationId,
      type,
      provider: process.env.IDENTITY_PROVIDER || "dojah",
      providerValidated,
      matchStatus,
      status: providerValidated ? (matchStatus === "not_matched" ? "needs_review" : "verified") : "failed",
    });
  });
}
