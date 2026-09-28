import { GoogleGenAI } from "@google/genai";
import { getFirestore } from "firebase-admin/firestore";

const DEFAULT_MODEL = "gemini-3.8-flash";
const MAX_PROMPT_LENGTH = 4_000;

const SYSTEM_INSTRUCTION = [
  "You are Unique AI, the assistant for the Unique One platform.",
  "Be accurate, practical, and concise.",
  "Do not invent Unique One platform data, balances, orders, businesses, listings, bookings, users, or other records.",
  "This initial service is read-only: do not claim that you completed an action or changed platform data.",
  "If a platform-specific fact is not provided to you, say that you do not have that data yet.",
].join(" ");

export class UniqueAiValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UniqueAiValidationError";
  }
}

type UniqueAiUserContext = {\n  fullName: string;\n  uniqueOneId?: string;\n  preferredLanguage?: string;\n  roles: string[];\n  status?: string;\n  verificationStatus?: string;\n};\n\nasync function getAuthorizedUserContext(uid: string): Promise<UniqueAiUserContext> {\n  const snapshot = await getFirestore().collection("users").doc(uid).get();\n  if (!snapshot.exists) {\n    return { fullName: "Unique One user", roles: [] };\n  }\n  const data = snapshot.data() ?? {};\n  return {\n    fullName: typeof data.fullName === "string" ? data.fullName : "Unique One user",\n    uniqueOneId: typeof data.uniqueOneId === "string" ? data.uniqueOneId : undefined,\n    preferredLanguage: typeof data.preferredLanguage === "string" ? data.preferredLanguage : undefined,\n    roles: Array.isArray(data.roles) ? data.roles.filter((role): role is string => typeof role === "string").slice(0, 20) : [],\n    status: typeof data.status === "string" ? data.status : undefined,\n    verificationStatus: typeof data.verificationStatus === "string" ? data.verificationStatus : undefined,\n  };\n}\n\nfunction getPrompt(value: unknown): string {
  if (typeof value !== "string") {
    throw new UniqueAiValidationError("message must be a string.");
  }

  const message = value.trim();
  if (!message) {
    throw new UniqueAiValidationError("message must not be empty.");
  }
  if (message.length > MAX_PROMPT_LENGTH) {
    throw new UniqueAiValidationError(`message exceeds the maximum length of ${MAX_PROMPT_LENGTH} characters.`);
  }

  return message;
}

export async function generateUniqueAiResponse(input: { uid: string; message: unknown }): Promise<string> {
  const prompt = getPrompt(input.message);\n  const userContext = await getAuthorizedUserContext(input.uid);\n  const contextualPrompt = [\n    `Authenticated user context (read-only, authoritative): ${JSON.stringify(userContext)}`,\n    `User request: ${prompt}`,\n  ].join("\\n");
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
