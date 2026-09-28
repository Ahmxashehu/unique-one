import { GoogleGenAI } from "@google/genai";
import { getAuthorizedPlatformContext } from "./aiTools";
import type { UniqueAiRequest } from "./aiTypes";

const DEFAULT_MODEL = "gemini-3.8-flash";
const MAX_PROMPT_LENGTH = 4_000;
const MAX_OUTPUT_LENGTH = 8_000;

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

function buildContextualPrompt(message: string, context: Awaited<ReturnType<typeof getAuthorizedPlatformContext>>): string {
  return [
    `Authenticated user context (read-only, authoritative): ${JSON.stringify(context.user)}`,
    `Authorized order context (read-only, authoritative; only this user's customer/seller orders): ${JSON.stringify(context.orders)}`,
    `Authorized business context (read-only, authoritative; only businesses owned by this user): ${JSON.stringify(context.businesses)}`,
    `Authorized product context (read-only, authoritative; only products owned by this user as seller): ${JSON.stringify(context.products)}`,
    `User request: ${message}`,
  ].join("\n");
}

function validateAiOutput(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("Gemini returned an invalid response.");
  }

  const text = value.trim();
  if (!text) {
    throw new Error("Gemini returned an empty response.");
  }
  return text.slice(0, MAX_OUTPUT_LENGTH);
}

export async function generateUniqueAiResponse(input: UniqueAiRequest): Promise<string> {
  const prompt = getPrompt(input.message);
  const context = await getAuthorizedPlatformContext(input.uid);
  const contextualPrompt = buildContextualPrompt(prompt, context);
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

  return validateAiOutput(response.text);
}
