export type UniqueAiIntentCategory =
  | "find" | "compare" | "recommend" | "buy" | "book" | "pay" | "send"
  | "sell" | "hire" | "travel" | "communicate" | "learn" | "plan" | "create"
  | "track" | "navigate" | "help" | "general";

export type UniqueAiRoute =
  | "store" | "uniquepay" | "communication" | "conference" | "travel"
  | "services" | "transportation" | "active-edge" | "business" | "global-search"
  | "history" | "ai" | "general";

export interface UniqueAiIntent {
  category: UniqueAiIntentCategory;
  route: UniqueAiRoute;
  action: "inform" | "discover" | "compare" | "prepare" | "confirm" | "protected-action";
  confidence: number;
  requiresConfirmation: boolean;
  requiresAuth: boolean;
  requiresProtectedAuth: boolean;
  entities: string[];
  budget?: number;
  currency?: string;
  keywords: string[];
}

const CAPABILITY_KEYWORDS: Array<{ route: UniqueAiRoute; words: string[] }> = [
  { route: "store", words: ["product", "phone", "laptop", "buy", "cart", "seller", "shop", "price", "item", "stock"] },
  { route: "uniquepay", words: ["pay", "payment", "transfer", "airtime", "data", "bill", "wallet", "money", "send money"] },
  { route: "communication", words: ["message", "chat", "contact", "call", "send a message"] },
  { route: "conference", words: ["conference", "meeting", "screen share", "video meeting"] },
  { route: "travel", words: ["flight", "hotel", "travel", "trip", "airport", "booking", "holiday"] },
  { route: "services", words: ["mechanic", "cleaner", "electrician", "plumber", "service", "repair", "professional"] },
  { route: "transportation", words: ["driver", "taxi", "ride", "transport", "car hire"] },
  { route: "active-edge", words: ["post", "status", "update", "following", "creator", "business update"] },
  { route: "business", words: ["business", "customer", "supplier", "cac", "inventory", "sales"] },
  { route: "history", words: ["history", "recent activity", "what did i", "my activity", "previous searches"] },
  { route: "global-search", words: ["search", "find near", "nearby", "around me", "global search"] },
];

const CATEGORY_WORDS: Array<{ category: UniqueAiIntentCategory; words: string[] }> = [
  { category: "compare", words: ["compare", "versus", "vs", "difference", "cheapest", "best value"] },
  { category: "recommend", words: ["recommend", "suggest", "which should", "best for me", "what would you choose"] },
  { category: "find", words: ["find", "look for", "search for", "where can i", "locate"] },
  { category: "buy", words: ["buy", "purchase", "add to cart", "checkout"] },
  { category: "book", words: ["book", "reserve", "reservation"] },
  { category: "pay", words: ["pay", "transfer", "send money"] },
  { category: "send", words: ["send", "message", "share"] },
  { category: "hire", words: ["hire", "arrange a", "get a driver", "get a mechanic"] },
  { category: "track", words: ["track", "where is my order", "status of my order", "delivery"] },
  { category: "learn", words: ["explain", "teach", "what is", "how does", "meaning of"] },
  { category: "plan", words: ["plan", "planning", "itinerary", "strategy", "roadmap"] },
  { category: "create", words: ["write", "create", "draft", "make", "design"] },
  { category: "navigate", words: ["open", "take me to", "go to"] },
  { category: "help", words: ["help", "how do i", "how can i"] },
];

function normalized(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9₦\s]/g, " ").replace(/\s+/g, " ").trim();
}

function includesAny(text: string, words: string[]): boolean {
  return words.some((word) => text.includes(word));
}

function extractBudget(text: string): number | undefined {
  const match = text.replace(/,/g, "").match(/(?:₦|ngn\s*)(\d+(?:\.\d+)?)(?:\s*(?:k|thousand|m|million))?/i);
  if (!match) return undefined;
  let amount = Number(match[1]);
  const suffix = match[0].toLowerCase();
  if (suffix.includes("million") || /\d\s*m\b/i.test(match[0])) amount *= 1_000_000;
  else if (suffix.includes("thousand") || /\d\s*k\b/i.test(match[0])) amount *= 1_000;
  return Number.isFinite(amount) && amount > 0 ? amount : undefined;
}

export function buildUniqueAiIntent(message: string): UniqueAiIntent {
  const text = normalized(message);
  const routeScores = CAPABILITY_KEYWORDS.map(({ route, words }) => ({
    route,
    score: words.filter((word) => text.includes(word)).length,
  })).sort((a, b) => b.score - a.score);

  const categoryScores = CATEGORY_WORDS.map(({ category, words }) => ({
    category,
    score: words.filter((word) => text.includes(word)).length,
  })).sort((a, b) => b.score - a.score);

  const route = routeScores[0]?.score ? routeScores[0].route : "ai";
  const category = categoryScores[0]?.score ? categoryScores[0].category : "general";
  const protectedAction = category === "pay" || route === "uniquepay";
  const mutation = /\b(?:buy|book|pay|transfer|send|checkout|hire|reserve|cancel|delete|create)\b/i.test(text);
  const requiresConfirmation = mutation || ["buy", "book", "pay", "send", "hire"].includes(category);
  const confidence = Math.min(0.98, 0.45 + (Math.max(routeScores[0]?.score ?? 0, categoryScores[0]?.score ?? 0) * 0.12));

  const keywords = [...new Set(
    [...routeScores.filter((x) => x.score > 0).map((x) => x.route), ...categoryScores.filter((x) => x.score > 0).map((x) => x.category)],
  )].slice(0, 8);

  return {
    category,
    route,
    action: protectedAction ? "protected-action" : requiresConfirmation ? "confirm" : category === "find" || category === "compare" || category === "recommend" ? "discover" : "inform",
    confidence,
    requiresConfirmation,
    requiresAuth: protectedAction || requiresConfirmation,
    requiresProtectedAuth: protectedAction,
    entities: text.split(" ").filter((word) => word.length >= 4).slice(0, 12),
    budget: extractBudget(message),
    currency: extractBudget(message) ? "NGN" : undefined,
    keywords,
  };
}

export function uniqueAiCapabilitySummary(intent: UniqueAiIntent): string {
  const routeLabels: Record<UniqueAiRoute, string> = {
    store: "Unique Store",
    uniquepay: "UniquePay",
    communication: "Communication",
    conference: "Conference",
    travel: "Travel",
    services: "Professional Services",
    transportation: "Transportation",
    "active-edge": "Active Edge",
    business: "Business",
    "global-search": "Global Search",
    history: "Activity & History",
    ai: "Unique AI",
    general: "Unique One",
  };
  const actionLabels: Record<UniqueAiIntent["action"], string> = {
    inform: "answer or explain",
    discover: "find and compare live options",
    compare: "compare available options",
    prepare: "prepare the next step",
    confirm: "ask for confirmation before an action",
    "protected-action": "require protected authorization before payment or other sensitive action",
  };
  return `Likely route: ${routeLabels[intent.route]}. Intended behavior: ${actionLabels[intent.action]}. Confirmation required: ${intent.requiresConfirmation ? "yes" : "no"}. Protected authorization required: ${intent.requiresProtectedAuth ? "yes" : "no"}.${intent.budget ? ` Budget detected: NGN ${intent.budget.toLocaleString()}.` : ""}`;
}
