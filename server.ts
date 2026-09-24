import express, { Request, Response, NextFunction } from "express";
import http from "http";
import path from "path";
import { createServer as createViteServer } from "vite";
import { initializeApp, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import type { DecodedIdToken } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

// Initialize Firebase Admin (Uses Application Default Credentials if available, otherwise just relies on the project configuration)
if (getApps().length === 0) {
  initializeApp({
    projectId: "gen-lang-client-0680695304",
  });
}

const db = getFirestore();

export interface AuthenticatedRequest extends Request {
  user?: DecodedIdToken;
}

interface WalletTransferRequestBody {
  recipientId?: unknown;
  amountMinor?: unknown;
  currency?: unknown;
  idempotencyKey?: unknown;
  description?: unknown;
}

async function startServer() {
  const app = express();
  const PORT = 3000;
  const httpServer = http.createServer(app);

  app.use(express.json());

  // Firebase Authentication Middleware
  const authenticate = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }

    const token = authHeader.split('Bearer ')[1];
    
    // We skip verification of the Google Workspace token used for Calendar, because that's an OAuth token, not a Firebase ID Token.
    // If the token is meant for our own Firebase backend, we verify it:
    try {
      const decodedToken = await getAuth().verifyIdToken(token);
      req.user = decodedToken;
      next();
    } catch (error) {
      console.error('Error verifying Firebase auth token:', error);
      res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }
  };

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", ecosystem: "Unique One", version: "1.0.0" });
  });

  // UniquePay wallet transfer endpoint — Step 4A: validation skeleton only.
  // NOTE: This endpoint does NOT move money. It only validates the request shape
  // and authenticated sender identity. Wallet reads/writes, ledger entries,
  // transaction records, and idempotency records are implemented in later steps.
  app.post("/api/wallet/transfer", authenticate, (req: AuthenticatedRequest, res: Response) => {
    const senderUid = req.user?.uid;
    if (!senderUid) {
      return res.status(401).json({ error: "Unauthorized: No authenticated user" });
    }

    const body = (req.body ?? {}) as WalletTransferRequestBody;
    const { recipientId, amountMinor, currency, idempotencyKey, description } = body;

    if (typeof recipientId !== "string" || recipientId.trim().length === 0) {
      return res.status(400).json({ error: "INVALID_RECIPIENT", message: "recipientId must be a non-empty string" });
    }

    if (recipientId === senderUid) {
      return res.status(400).json({ error: "SELF_TRANSFER_NOT_ALLOWED", message: "recipientId must not equal the authenticated sender" });
    }

    if (typeof amountMinor !== "number" || !Number.isInteger(amountMinor)) {
      return res.status(400).json({ error: "INVALID_AMOUNT", message: "amountMinor must be an integer" });
    }

    if (amountMinor <= 0) {
      return res.status(400).json({ error: "INVALID_AMOUNT", message: "amountMinor must be greater than 0" });
    }

    if (!Number.isSafeInteger(amountMinor)) {
      return res.status(400).json({ error: "INVALID_AMOUNT", message: "amountMinor must be a safe integer" });
    }

    if (currency !== "NGN") {
      return res.status(400).json({ error: "UNSUPPORTED_CURRENCY", message: "currency must equal \"NGN\"" });
    }

    if (typeof idempotencyKey !== "string" || idempotencyKey.trim().length === 0) {
      return res.status(400).json({ error: "IDEMPOTENCY_KEY_REQUIRED", message: "idempotencyKey must be a non-empty string" });
    }

    if (description !== undefined && typeof description !== "string") {
      return res.status(400).json({ error: "INVALID_DESCRIPTION", message: "description must be a string when provided" });
    }

    // Development-only response. No wallet reads/writes, ledger entries,
    // transaction records, idempotency records, or payment provider calls occur here.
    return res.status(200).json({
      ok: true,
      status: "validated",
      message: "Transfer request validated. No transfer has occurred; money movement is not implemented yet.",
    });
  });

  // Proxy Google Calendar API requests securely through the backend
  app.get("/api/calendar/events", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ error: "No authorization header" });
      }

      const response = await fetch(
        "https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=" + new Date().toISOString() + "&maxResults=10&singleEvents=true&orderBy=startTime",
        {
          headers: {
            Authorization: authHeader,
            Accept: "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        return res.status(response.status).json(errorData);
      }

      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Calendar API Error:", error);
      res.status(500).json({ error: "Failed to fetch calendar events" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true,  },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`UniqueOS Server running on http://localhost:${PORT}`);
  });
}

startServer();
