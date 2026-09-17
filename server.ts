import express, { Request, Response, NextFunction } from "express";
import http from "http";
import path from "path";
import { createServer as createViteServer } from "vite";
import { initializeApp, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

interface WalletDocument {
  uid: string;
  currency: string;
  availableBalanceMinor: number;
  status: 'active' | 'suspended' | 'locked';
  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
}

// Initialize Firebase Admin (Uses Application Default Credentials if available, otherwise just relies on the project configuration)
if (getApps().length === 0) {
  initializeApp({
    projectId: "gen-lang-client-0680695304",
  });
}

const adminDb = getFirestore();

async function ensureWalletForUser(uid: string): Promise<WalletDocument> {
  if (!uid || typeof uid !== 'string') {
    throw new Error('Invalid authenticated UID');
  }

  const walletRef = adminDb.collection('wallets').doc(uid);
  const walletSnapshot = await walletRef.get();

  if (walletSnapshot.exists) {
    return walletSnapshot.data() as WalletDocument;
  }

  const now = Timestamp.now();
  const wallet: WalletDocument = {
    uid,
    currency: 'NGN',
    availableBalanceMinor: 0,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  };

  await walletRef.create(wallet);
  return wallet;
}

async function startServer() {
  const app = express();
  const PORT = 3000;
  const httpServer = http.createServer(app);

  app.use(express.json());

  // Firebase Authentication Middleware
  const authenticate = async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }

    const token = authHeader.split('Bearer ')[1];

    try {
      const decodedToken = await getAuth().verifyIdToken(token);
      (req as any).user = decodedToken;
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

  app.get("/api/wallet", authenticate, async (req, res) => {
    const uid = (req as any).user?.uid as string | undefined;

    if (!uid) {
      return res.status(401).json({ error: "Unauthorized: Missing authenticated user" });
    }

    try {
      const walletRef = adminDb.collection('wallets').doc(uid);
      const snapshot = await walletRef.get();

      if (!snapshot.exists) {
        return res.status(404).json({ error: "Wallet not found" });
      }

      return res.status(200).json(snapshot.data());
    } catch (error) {
      console.error('Error fetching wallet:', error);
      return res.status(500).json({ error: 'Failed to fetch wallet' });
    }
  });

  app.post("/api/wallet", authenticate, async (req, res) => {
    const uid = (req as any).user?.uid as string | undefined;

    if (!uid) {
      return res.status(401).json({ error: "Unauthorized: Missing authenticated user" });
    }

    try {
      const wallet = await ensureWalletForUser(uid);
      res.status(200).json({
        uid: wallet.uid,
        currency: wallet.currency,
        availableBalanceMinor: wallet.availableBalanceMinor,
        status: wallet.status,
        createdAt: wallet.createdAt.toDate().toISOString(),
        updatedAt: wallet.updatedAt.toDate().toISOString(),
      });
    } catch (error) {
      console.error("Error initializing wallet:", error);
      res.status(500).json({ error: "Failed to initialize wallet" });
    }
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

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
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
