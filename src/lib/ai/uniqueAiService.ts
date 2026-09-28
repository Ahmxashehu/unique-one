import { GoogleGenAI } from "@google/genai";
import { getFirestore } from "firebase-admin/firestore";

const DEFAULT_MODEL = "gemini-3.8-flash";
const MAX_PROMPT_LENGTH = 4_000;
const MAX_ORDER_CONTEXT = 20;
const MAX_BUSINESS_CONTEXT = 5;
const MAX_PRODUCT_CONTEXT = 30;

const SYSTEM_INSTRUCTION = [
  "You are Unique AI, the assistant for the Unique One platform.",
  "Be accurate, practical, and concise.",
  "Do not invent Unique One platform data, balances, orders, businesses, listings, bookings, users, or other records.",
  "This service is read-only: do not claim that you completed an action or changed platform data.",
  "Only use platform records explicitly supplied as authoritative context.",
  "Never reveal another user's private identifiers, contact details, payment credentials, authentication data, or sensitive identity data.",
  "If a platform-specific fact is not provided to you, say that you do not have that data yet.",
].join(" ");

export class UniqueAiValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UniqueAiValidationError";
  }
}

type UniqueAiUserContext = {
  fullName: string;
  uniqueOneId?: string;
  preferredLanguage?: string;
  roles: string[];
  status?: string;
  verificationStatus?: string;
};

type UniqueAiOrderContext = {
  id: string;
  side: "customer" | "seller";
  status: string;
  totalAmount: number;
  currency: string;
  itemCount: number;
  createdAt?: string;
};

type UniqueAiBusinessContext = {
  id: string;
  name: string;
  category?: string;
  status?: string;
  verificationStatus?: string;
  createdAt?: string;
};

type UniqueAiProductContext = {
  id: string;
  name: string;
  category?: string;
  price?: number;
  currency: string;
  quantity?: number;
  status?: string;
};

async function getAuthorizedUserContext(uid: string): Promise<UniqueAiUserContext> {
  const snapshot = await getFirestore().collection("users").doc(uid).get();
  if (!snapshot.exists) {
    return { fullName: "Unique One user", roles: [] };
  }

  const data = snapshot.data() ?? {};
  return {
    fullName: typeof data.fullName === "string" ? data.fullName : "Unique One user",
    uniqueOneId: typeof data.uniqueOneId === "string" ? data.uniqueOneId : undefined,
    preferredLanguage: typeof data.preferredLanguage === "string" ? data.preferredLanguage : undefined,
    roles: Array.isArray(data.roles)
      ? data.roles.filter((role): role is string => typeof role === "string").slice(0, 20)
      : [],
    status: typeof data.status === "string" ? data.status : undefined,
    verificationStatus: typeof data.verificationStatus === "string" ? data.verificationStatus : undefined,
  };
}

function toIsoString(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as { toDate?: unknown }).toDate === "function"
  ) {
    const date = (value as { toDate: () => Date }).toDate();
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
  }
  return undefined;
}

async function getAuthorizedOrderContext(uid: string): Promise<UniqueAiOrderContext[]> {
  const db = getFirestore();
  const [customerSnapshot, sellerSnapshot] = await Promise.all([
    db.collection("orders").where("customerId", "==", uid).limit(MAX_ORDER_CONTEXT).get(),
    db.collection("orders").where("sellerId", "==", uid).limit(MAX_ORDER_CONTEXT).get(),
  ]);

  const orders = new Map<string, UniqueAiOrderContext>();

  for (const snapshot of [
    ...customerSnapshot.docs.map((doc) => ({ doc, side: "customer" as const })),
    ...sellerSnapshot.docs.map((doc) => ({ doc, side: "seller" as const })),
  ]) {
    const data = snapshot.doc.data();
    const items = Array.isArray(data.items) ? data.items : [];
    const totalAmount = typeof data.totalAmount === "number" && Number.isFinite(data.totalAmount)
      ? data.totalAmount
      : 0;
    const currency = typeof data.currency === "string" ? data.currency : "NGN";
    const status = typeof data.status === "string" ? data.status : "unknown";

    orders.set(snapshot.doc.id, {
      id: snapshot.doc.id,
      side: snapshot.side,
      status,
      totalAmount,
      currency,
      itemCount: items.length,
      createdAt: toIsoString(data.createdAt),
    });
  }

  return Array.from(orders.values()).slice(0, MAX_ORDER_CONTEXT);
}

async function getAuthorizedBusinessContext(uid: string): Promise<UniqueAiBusinessContext[]> {
  const snapshot = await getFirestore()
    .collection("businesses")
    .where("ownerUid", "==", uid)
    .limit(MAX_BUSINESS_CONTEXT)
    .get();

  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      name: typeof data.name === "string"
        ? data.name
        : typeof data.businessName === "string"
          ? data.businessName
          : "Unnamed business",
      category: typeof data.category === "string" ? data.category : undefined,
      status: typeof data.status === "string" ? data.status : undefined,
      verificationStatus: typeof data.verificationStatus === "string"
        ? data.verificationStatus
        : undefined,
      createdAt: toIsoString(data.createdAt),
    };
  });
}

async function getAuthorizedProductContext(uid: string): Promise<UniqueAiProductContext[]> {
  const snapshot = await getFirestore()
    .collection("products")
    .where("sellerId", "==", uid)
    .limit(MAX_PRODUCT_CONTEXT)
    .get();

  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      name: typeof data.name === "string" ? data.name : "Unnamed product",
      category: typeof data.category === "string" ? data.category : undefined,
      price: typeof data.price === "number" && Number.isFinite(data.price) ? data.price : undefined,
      currency: typeof data.currency === "string" ? data.currency : "NGN",
      quantity: typeof data.quantity === "number" && Number.isFinite(data.quantity) ? data.quantity : undefined,
      status: typeof data.status === "string" ? data.status : undefined,
    };
  });
}

function getPrompt(value: unknown): string {
  if (typeof value !== "string") {
    throw new UniqueAiValidationError("message must be a string.");
  }

  const message = value.trim();
  if (!message) {
    throw new UniqueAiValidationError("message must not be empty.");
  }
  if (message.length > MAX_PROMPT_LENGTH) {
    throw new UniqueAiValidationError(
      `message exceeds the maximum length of ${MAX_PROMPT_LENGTH} characters.`,
    );
  }

  return message;
}

export async function generateUniqueAiResponse(input: {
  uid: string;
  message: unknown;
}): Promise<string> {
  const prompt = getPrompt(input.message);
  const [userContext, orderContext, businessContext, productContext] = await Promise.all([
    getAuthorizedUserContext(input.uid),
    getAuthorizedOrderContext(input.uid),
    getAuthorizedBusinessContext(input.uid),
    getAuthorizedProductContext(input.uid),
  ]);

  const contextualPrompt = [
    `Authenticated user context (read-only, authoritative): ${JSON.stringify(userContext)}`,
    `Authorized order context (read-only, authoritative; only this user's customer/seller orders): ${JSON.stringify(orderContext)}`,
    `Authorized business context (read-only, authoritative; only businesses owned by this user): ${JSON.stringify(businessContext)}`,
    `Authorized product context (read-only, authoritative; only products owned by this user as seller): ${JSON.stringify(productContext)}`,
    `User request: ${prompt}`,
  ].join("\n");

  const apiKey = process.env.GEMINI_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL,
    contents: contextualPrompt,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      temperature: 0.2,
      maxOutputTokens: 1_000,
    },
  });

  const text = typeof response.text === "string" ? response.text.trim() : "";
  if (!text) {
    throw new Error("Gemini returned an empty response.");
  }

  return text;
}
