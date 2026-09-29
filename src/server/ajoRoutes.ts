import type { Express, Request, RequestHandler } from "express";
import { randomUUID } from "crypto";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

type Frequency = "weekly" | "monthly" | "custom";
const frequencies = new Set<Frequency>(["weekly", "monthly", "custom"]);

function uidFrom(req: Request) {
  const uid = (req as Request & { user?: { uid?: string } }).user?.uid;
  return typeof uid === "string" && uid.length > 0 ? uid : null;
}

function validAmount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function validMembers(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 2 && value <= 1000;
}

export function registerAjoRoutes(app: Express, authenticate: RequestHandler) {
  app.get("/api/ajo/cycles", authenticate, async (req, res) => {
    const uid = uidFrom(req);
    if (!uid) return res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Authentication is required." } });

    const snapshot = await getFirestore().collection("ajoCycles")
      .where("ownerUid", "==", uid)
      .orderBy("updatedAt", "desc")
      .limit(50)
      .get();

    return res.json({ cycles: snapshot.docs.map(doc => doc.data()) });
  });

  app.post("/api/ajo/cycles", authenticate, async (req, res) => {
    const uid = uidFrom(req);
    if (!uid) return res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Authentication is required." } });

    const body = req.body as Record<string, unknown>;
    const allowed = new Set(["name", "contributionAmountMinor", "memberCount", "frequency"]);
    if (!body || Object.keys(body).some(key => !allowed.has(key))) {
      return res.status(400).json({ error: { code: "INVALID_REQUEST", message: "Invalid Cycle Ajo fields." } });
    }

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const contributionAmountMinor = body.contributionAmountMinor;
    const memberCount = body.memberCount;
    const frequency = body.frequency;

    if (name.length < 1 || name.length > 100 || !validAmount(contributionAmountMinor) ||
        !validMembers(memberCount) || typeof frequency !== "string" || !frequencies.has(frequency as Frequency)) {
      return res.status(400).json({ error: { code: "INVALID_REQUEST", message: "Invalid Cycle Ajo cycle definition." } });
    }

    const db = getFirestore();
    const now = Timestamp.now();
    const id = randomUUID();

    const cycle = {
      id,
      ownerUid: uid,
      name,
      contributionAmountMinor,
      currency: "NGN",
      frequency,
      memberCount,
      payoutOrder: [uid],
      status: "draft",
      createdAt: now,
      updatedAt: now,
    };

    await db.collection("ajoCycles").doc(id).create(cycle);

    return res.status(201).json({
      cycle: { ...cycle, createdAt: now.toDate().toISOString(), updatedAt: now.toDate().toISOString() },
      moneyMoved: false,
      activated: false,
    });
  });
}
