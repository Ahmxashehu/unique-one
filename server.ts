import express, { Request, Response, NextFunction } from "express";
import http from "http";
import path from "path";
import { createServer as createViteServer } from "vite";
import { initializeApp, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

// Initialize Firebase Admin (Uses Application Default Credentials if available, otherwise just relies on the project configuration)
if (getApps().length === 0) {
  initializeApp({
    projectId: "gen-lang-client-0680695304",
  });
}

const db = getFirestore();

type AuthenticatedRequest = Request & {
  user?: {
    uid: string;
  };
};

type TransferValidationBody = {
  recipientId?: unknown;
  amountMinor?: unknown;
};

const getWalletActiveState = (wallet: Record<string, unknown>): boolean => {
  if (wallet.active === true) return true;
  const status = wallet.status;
  if (typeof status === "string" && status.toLowerCase() === "active") return true;
  return false;
};

const getWalletCurrency = (wallet: Record<string, unknown>): string | null => {
  const currency = wallet.currency;
  return typeof currency === "string" ? currency.toUpperCase() : null;
};

const getWalletBalanceMinor = (wallet: Record<string, unknown>): number | null => {
  const balanceMinor = wallet.balanceMinor;
  if (typeof balanceMinor === "number") return balanceMinor;
  const balance = wallet.balance;
  if (typeof balance === "number") return balance;
  return null;
};

type RateLimitState = {
  count: number;
  windowStartMs: number;
};

async function startServer() {
  const app = express();
  const PORT = 3000;
  const httpServer = http.createServer(app);

  app.use(express.json());

  const transferValidationRateLimitWindowMs = 60_000;
  const transferValidationRateLimitMaxRequests = 30;
  const transferValidationRateLimitStore = new Map<string, RateLimitState>();

  // Firebase Authentication Middleware
  const authenticate = async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }

    const token = authHeader.split('Bearer ')[1];
    
    // We skip verification of the Google Workspace token used for Calendar, because that's an OAuth token, not a Firebase ID Token.
    // If the token is meant for our own Firebase backend, we verify it:
    try {
      const decodedToken = await getAuth().verifyIdToken(token);
      (req as AuthenticatedRequest).user = { uid: decodedToken.uid };
      next();
    } catch (error) {
      console.error('Error verifying Firebase auth token:', error);
      res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }
  };

  const rateLimitTransferValidation = (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    const identifier = req.user?.uid ?? req.ip;
    const now = Date.now();
    const existing = transferValidationRateLimitStore.get(identifier);

    if (!existing || now - existing.windowStartMs >= transferValidationRateLimitWindowMs) {
      transferValidationRateLimitStore.set(identifier, { count: 1, windowStartMs: now });
      return next();
    }

    if (existing.count >= transferValidationRateLimitMaxRequests) {
      return res.status(429).json({
        error: "Too many transfer validation requests",
        code: "RATE_LIMIT_EXCEEDED",
      });
    }

    existing.count += 1;
    transferValidationRateLimitStore.set(identifier, existing);
    return next();
  };

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", ecosystem: "Unique One", version: "1.0.0" });
  });

  app.post(
    "/api/transfers/validate",
    authenticate,
    rateLimitTransferValidation,
    async (req: AuthenticatedRequest, res: Response) => {
      const senderUid = req.user?.uid;
      if (!senderUid) {
        return res.status(401).json({
          error: "Unauthorized: Missing authenticated user",
          code: "UNAUTHORIZED",
        });
      }

      const { recipientId, amountMinor } = (req.body ?? {}) as TransferValidationBody;
      if (
        typeof recipientId !== "string" ||
        recipientId.trim().length === 0 ||
        typeof amountMinor !== "number" ||
        !Number.isSafeInteger(amountMinor) ||
        amountMinor <= 0
      ) {
        return res.status(400).json({
          error: "Invalid transfer validation request",
          code: "INVALID_TRANSFER_REQUEST",
        });
      }

      const normalizedRecipientId = recipientId.trim();
      const senderWalletRef = db.doc(`wallets/${senderUid}`);
      const recipientWalletRef = db.doc(`wallets/${normalizedRecipientId}`);
      const [senderWalletSnap, recipientWalletSnap] = await Promise.all([
        senderWalletRef.get(),
        recipientWalletRef.get(),
      ]);

      if (!senderWalletSnap.exists) {
        return res.status(404).json({
          error: "Sender wallet not found",
          code: "WALLET_NOT_FOUND",
        });
      }

      if (!recipientWalletSnap.exists) {
        return res.status(404).json({
          error: "Recipient wallet not found",
          code: "WALLET_NOT_FOUND",
        });
      }

      const senderWallet = senderWalletSnap.data() as Record<string, unknown>;
      const recipientWallet = recipientWalletSnap.data() as Record<string, unknown>;

      if (!getWalletActiveState(senderWallet)) {
        return res.status(409).json({
          error: "Sender wallet is not active",
          code: "WALLET_NOT_ACTIVE",
        });
      }

      if (!getWalletActiveState(recipientWallet)) {
        return res.status(409).json({
          error: "Recipient wallet is not active",
          code: "WALLET_NOT_ACTIVE",
        });
      }

      if (getWalletCurrency(senderWallet) !== "NGN" || getWalletCurrency(recipientWallet) !== "NGN") {
        return res.status(400).json({
          error: "Only NGN wallets are supported for this transfer flow",
          code: "UNSUPPORTED_WALLET_CURRENCY",
        });
      }

      const senderBalanceMinor = getWalletBalanceMinor(senderWallet);
      if (!Number.isSafeInteger(senderBalanceMinor)) {
        return res.status(409).json({
          error: "Sender wallet balance is invalid",
          code: "INVALID_WALLET_BALANCE",
        });
      }

      if ((senderBalanceMinor as number) < amountMinor) {
        return res.status(409).json({
          error: "Insufficient funds",
          code: "INSUFFICIENT_FUNDS",
        });
      }

      return res.status(200).json({
        ok: true,
        code: "TRANSFER_VALIDATED",
        message: "Transfer validation succeeded; no money has moved yet.",
        data: {
          senderUid,
          recipientId: normalizedRecipientId,
          amountMinor,
        },
      });
    },
  );

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
