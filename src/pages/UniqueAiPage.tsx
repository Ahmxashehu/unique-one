import { FormEvent, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { FileDown, Send, Sparkles } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { getLanguage, type SupportedLanguage } from "../lib/i18n";

type UniqueAiCapabilities = {
  version: 1;
  readOnly: true;
  contexts: string[];
  mutations: string[];
};

type AiLocation = { latitude: number; longitude: number; radiusMeters?: number };

type DiscoveryResult = {
  type: "product" | "service" | "business" | "google_place";
  id: string;
  name: string;
  category?: string;
  description?: string;
  providerName?: string;
  address?: string;
  rating?: number;
  ratingCount?: number;
  businessStatus?: string;
  mapsUrl?: string;
  source?: "unique_one" | "google_places";
  price?: number;
  currency?: string;
  score: number;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  discovery?: DiscoveryResult[];
  pdfEligible?: boolean;
};

const shouldUseDeviceLocation = (value: string) =>
  /\b(near me|nearby|nearest|closest|around me|where is|where are|in my area|close to me)\b/i.test(value);

async function getDeviceLocation(): Promise<AiLocation | undefined> {
  if (!navigator.geolocation) return undefined;
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        radiusMeters: 5_000,
      }),
      () => resolve(undefined),
      { enableHighAccuracy: false, maximumAge: 120_000, timeout: 5_000 },
    );
  });
}

const shouldLoadDiscovery = (value: string) =>
  /\b(find|search|look for|show me|where can i|where is|available|buy|sell|hire|book|service|product|business|store|marketplace|cement|rice|phone|solar|car|hotel|restaurant|delivery|near me)\b/i.test(value);

function userExplicitlyRequestedPdf(text: string) {
  return /\b(create|make|generate|download|export|turn|convert)\b[\s-]*(this|that|it|the (answer|response|breakdown|report|document))?[\s-]*(as|into|to)?[\s-]*pdf\b|\bpdf\b/i.test(text.trim());
}

function shouldOfferPdfRequest(text: string) {
  return /\b(detailed|breakdown|report|proposal|business plan|roadmap|assessment|comparison|strategy|implementation plan|project plan|market analysis|financial analysis|brief|document|guide|specification|requirements)\b/i.test(text.trim());
}

function cleanPdfText(body: string) {
  const normalize = (value: string) => value
    .replace(/\r/g, "")
    .replace(/\*{2,}/g, "")
    .replace(/_{2,}/g, "")
    .replace(/#{1,6}\s*/g, "")
    .replace(/[•●▪◦]/g, "-")
    .replace(/[–—]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+$/g, "")
    .trim();

  const filler = /^(here(?:'s| is)|sure[!.]?$|of course[!.]?$|i(?:'ll| will) explain|i hope (this|that) helps|would you like me to|let me know if you(?:'d| would) like|feel free to ask|if you need anything else)/i;

  return normalize(body)
    .split("\n")
    .map((line) => normalize(line))
    .filter((line) => line && !filler.test(line))
    .join("\n")
    .trim();
}

function downloadAiPdf(title: string, body: string) {
  const sanitize = (value: string) => value
    .replace(/₦/g, "NGN ")
    .replace(/[–—]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\*{2,}/g, "")
    .replace(/_{2,}/g, "")
    .replace(/#{1,6}\s*/g, "")
    .replace(/[•●▪◦]/g, "-")
    .replace(/[^\x20-\x7E\n]/g, "");

  const wrap = (value: string, width = 88) => {
    const output: string[] = [];
    for (const raw of sanitize(value).split("\n")) {
      if (!raw.trim()) {
        output.push("");
        continue;
      }
      let line = raw.trim();
      while (line.length > width) {
        let cut = line.lastIndexOf(" ", width);
        if (cut < 20) cut = width;
        output.push(line.slice(0, cut));
        line = line.slice(cut).trimStart();
      }
      output.push(line);
    }
    return output;
  };

  const titleText = sanitize(title).slice(0, 120) || "Unique AI Answer";
  const preparedBody = cleanPdfText(body) || "No answer available.";

  // A4 portrait: 595 x 842 points. Body text is 12 pt with 18 pt leading (1.5 spacing).
  const pageWidth = 595;
  const pageHeight = 842;
  const margin = 57;
  const contentWidth = pageWidth - margin * 2;
  const headerY = pageHeight - 48;
  const titleY = pageHeight - 82;
  const bodyStartY = pageHeight - 135;
  const footerY = 30;
  const lineHeight = 18;
  const bodyFontSize = 12;
  const titleFontSize = 17;
  const subtitleFontSize = 8;
  const charsPerLine = Math.max(55, Math.floor(contentWidth / 6.1));
  const bodyLines = wrap(preparedBody, charsPerLine);
  const maxBodyLines = Math.max(1, Math.floor((bodyStartY - footerY - 18) / lineHeight));
  const pages: string[][] = [];
  for (let i = 0; i < bodyLines.length; i += maxBodyLines) {
    pages.push(bodyLines.slice(i, i + maxBodyLines));
  }
  if (!pages.length) pages.push([""]);

  const objects: string[] = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "PAGES_PLACEHOLDER",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
  ];
  const pageRefs: number[] = [];

  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const page = pages[pageIndex];
    const contentNumber = objects.length + 2;
    const pageNumber = objects.length + 1;
    pageRefs.push(pageNumber);
    const esc = (value: string) =>
      value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

    const commands: string[] = [
      "q",
      "0.05 0.55 0.32 rg",
      margin + " " + (headerY - 4) + " " + contentWidth + " 4 re f",
      "Q",
      "BT",
      "/F2 " + titleFontSize + " Tf",
      "0.06 0.12 0.18 rg",
      margin + " " + titleY + " Td",
      "(" + esc(titleText) + ") Tj",
      "/F1 " + subtitleFontSize + " Tf",
      "0.35 0.40 0.45 rg",
      "0 -18 Td",
      "(UNIQUE PLATFORM  |  UNIQUE AI) Tj",
      "ET",
      "BT",
      "/F1 " + bodyFontSize + " Tf",
      "0.12 0.15 0.18 rg",
      margin + " " + bodyStartY + " Td",
    ];

    page.forEach((line, index) => {
      commands.push("(" + esc(line) + ") Tj");
      if (index < page.length - 1) commands.push("0 -" + lineHeight + " Td");
    });

    commands.push(
      "ET",
      "q",
      "0.06 0.12 0.18 rg",
      margin + " " + (footerY + 10) + " " + contentWidth + " 1 re f",
      "Q",
      "BT",
      "/F1 8 Tf",
      "0.35 0.40 0.45 rg",
      margin + " " + footerY + " Td",
      "(Unique Platform  |  Powered by Unique AI) Tj",
      "ET",
      "BT",
      "/F1 8 Tf",
      "0.35 0.40 0.45 rg",
      (pageWidth - margin - 45) + " " + footerY + " Td",
      "(" + (pageIndex + 1) + " / " + pages.length + ") Tj",
      "ET",
    );

    const stream = commands.join("\n");
    objects.push("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " + pageWidth + " " + pageHeight + "] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents " + contentNumber + " 0 R >>");
    objects.push("<< /Length " + stream.length + " >>\\nstream\\n" + stream + "\\nendstream");
  }

  objects[1] = "<< /Type /Pages /Kids [" + pageRefs.map((n) => n + " 0 R").join(" ") + "] /Count " + pageRefs.length + " >>";
  const chunks = ["%PDF-1.4\n%UniquePlatform\n"];
  const offsets = [0];
  let length = chunks[0].length;

  objects.forEach((obj, index) => {
    offsets[index + 1] = length;
    const chunk = (index + 1) + " 0 obj\n" + obj + "\nendobj\n";
    chunks.push(chunk);
    length += chunk.length;
  });

  const xrefOffset = length;
  chunks.push("xref\n0 " + (objects.length + 1) + "
0000000000 65535 f 
");
  for (let i = 1; i <= objects.length; i += 1) {
    chunks.push(String(offsets[i]).padStart(10, "0") + " 00000 n \n");
  }
  chunks.push("trailer\n<< /Size " + (objects.length + 1) + " /Root 1 0 R >>
startxref
" + xrefOffset + "
%%EOF");

  const blob = new Blob([chunks.join("")], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = (titleText.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70) || "unique-platform-answer") + ".pdf";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const QUICK_PROMPTS = [
  "What can Unique One do for my everyday life, business, shopping, travel, payments, and services?",
  "I have a budget. Help me find the best option, the best-value option, and the premium option.",
  "Find a product that matches my needs and budget, compare the best choices, and guide me to checkout.",
  "I need a flight. Help me search the right route, date, budget, and travel preference, then guide me through booking.",
  "I need a nearby driver. Help me find a suitable option based on price, distance, rating, and my trip.",
  "I need a mechanic. Help me find a suitable nearby provider and guide me through requesting the service.",
  "Find the cheapest suitable option for me without sacrificing the things I care about.",
  "Show me the best-value option if I want a balance of price, quality, and benefits.",
  "Show me a premium option and explain what extra benefits I get for paying more.",
  "Based on my stated preferences and my Unique One activity, what would you recommend for me?",
  "Help me find a hotel that fits my budget, location, rating, and preferred experience.",
  "Help me find a restaurant that matches my taste, budget, location, and occasion.",
  "I need a service provider. Help me discover, compare, contact, and arrange the right provider.",
  "Help me find something nearby that can solve what I need right now.",
  "Can Unique AI understand what I mean even when I do not know which Unique One service I need?",
  "Can Unique AI turn a simple request into the steps needed to finish the job for me?",
  "What can you search for me inside Unique Store?",
  "Can you compare products, prices, sellers, availability, and benefits before I buy?",
  "Can you help me add the right product to my cart and guide me through checkout?",
  "What can you do for me before I make a payment or booking?",
  "How do you know when you need my confirmation before taking an important action?",
  "How do you protect payments, bookings, personal information, and other sensitive actions?",
  "Help me discover a better option than what I originally planned to buy.",
  "Help me save money today across products, services, travel, food, or transportation.",
  "What would a personal Unique AI assistant do for me from discovery to completion?",
  "How can Unique AI connect my needs with real Unique One products, businesses, services, orders, and payments?",
  "What should I ask Unique AI if I want it to save me time?",
  "What should I ask Unique AI if I want it to save me money?",
  "What should I ask Unique AI if I want it to arrange a service for me?",
  "What should I ask Unique AI if I want it to help me plan a trip?",
  "What should I ask Unique AI if I want it to help me grow my business?",
  "How can Unique AI personalize recommendations without making assumptions about sensitive parts of my life?",
  "What can Unique AI do for a guest, and what becomes possible after I register?",
  "Show me the most useful thing Unique AI can help me do today.",
];

const SMART_OPPORTUNITIES = [
  { label: "For You", icon: "✦", text: "Find something that matches what I need.", prompt: "Find something that matches what I need and show me the most suitable options." },
  { label: "Save Money", icon: "₦", text: "Find the cheapest suitable option.", prompt: "Find the cheapest suitable option without sacrificing the things I care about." },
  { label: "Best Value", icon: "◆", text: "Balance price, quality, and benefits.", prompt: "Show me the best-value option by balancing price, quality, and benefits." },
  { label: "Premium", icon: "◇", text: "Show me the best premium choices.", prompt: "Show me the best premium options and explain the extra benefits." },
  { label: "Nearby", icon: "⌖", text: "Find a suitable option near me.", prompt: "Help me find a suitable nearby product, business, or service for what I need." },
  { label: "Fastest", icon: "→", text: "Find the fastest suitable option.", prompt: "Find the fastest suitable option for what I need." },
  { label: "Best Rated", icon: "★", text: "Show highly rated choices.", prompt: "Show me the best-rated suitable options and compare them." },
  { label: "Travel", icon: "✈", text: "Plan and compare my trip.", prompt: "Help me plan my trip and compare the best travel options for my budget." },
  { label: "Services", icon: "⚒", text: "Find and arrange a service.", prompt: "Help me find, compare, and arrange the right service provider." },
  { label: "Business", icon: "▦", text: "Find ways to improve my business.", prompt: "Help me find products, services, and ideas that can improve my business." },
];

export default function UniqueAiPage() {
  const { currentUser } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [message, setMessage] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageBusy, setImageBusy] = useState(false);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(null);
  const [requestState, setRequestState] = useState<"idle" | "sending" | "retrying">("idle");
  const [lastRequestId, setLastRequestId] = useState<string | null>(null);
  const [suggestedIndex, setSuggestedIndex] = useState(0);
  const [smartOpportunityIndex, setSmartOpportunityIndex] = useState(0);
  const [smartOpportunityOpen, setSmartOpportunityOpen] = useState(false);
  const [smartOpportunityDismissed, setSmartOpportunityDismissed] = useState(false);
  const [language, setLanguage] = useState<SupportedLanguage>(getLanguage());
  const guestSessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    const handleLanguageChange = (event: Event) => {
      setLanguage((event as CustomEvent<SupportedLanguage>).detail);
    };
    window.addEventListener("unique-language-change", handleLanguageChange);
    return () => window.removeEventListener("unique-language-change", handleLanguageChange);
  }, []);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (currentUser || guestSessionIdRef.current) return;
    const storageKey = "unique-ai-guest-session-v1";
    let sessionId = window.sessionStorage.getItem(storageKey);
    if (!sessionId) {
      sessionId = crypto.randomUUID().replace(/-/g, "");
      window.sessionStorage.setItem(storageKey, sessionId);
    }
    guestSessionIdRef.current = sessionId;
  }, [currentUser]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setSuggestedIndex((current) => (current + 1) % QUICK_PROMPTS.length);
    }, 6_000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (smartOpportunityDismissed) return;
    const showId = window.setTimeout(() => setSmartOpportunityOpen(true), 12_000);
    return () => window.clearTimeout(showId);
  }, [smartOpportunityDismissed]);

  useEffect(() => {
    if (!smartOpportunityOpen || smartOpportunityDismissed) return;
    const hideId = window.setTimeout(() => setSmartOpportunityOpen(false), 9_000);
    const rotateId = window.setTimeout(() => {
      setSmartOpportunityIndex((current) => (current + 1) % SMART_OPPORTUNITIES.length);
      setSmartOpportunityOpen(true);
    }, 30_000);
    return () => {
      window.clearTimeout(hideId);
      window.clearTimeout(rotateId);
    };
  }, [smartOpportunityOpen, smartOpportunityDismissed]);


  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading, error]);

  const handleImageSelected = async (file: File | undefined) => {
    if (!file) return;
    const allowed = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
    if (!allowed.has(file.type)) {
      setError("Please choose a JPG, PNG, WEBP, HEIC, or HEIF image.");
      return;
    }
    if (file.size > 6 * 1024 * 1024) {
      setError("Please choose an image smaller than 6 MB.");
      return;
    }
    setError("");
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const analyzeSelectedImage = async () => {
    if (!imageFile || imageBusy || loading) return;
    setImageBusy(true);
    setError("");
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Could not read image."));
        reader.onerror = () => reject(new Error("Could not read image."));
        reader.readAsDataURL(imageFile);
      });
      const comma = dataUrl.indexOf(",");
      if (comma < 0) throw new Error("Invalid image data.");
      const requestId = crypto.randomUUID();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "X-Request-ID": requestId,
      };
      if (currentUser) headers.Authorization = `Bearer ${await currentUser.getIdToken()}`;
      else if (guestSessionIdRef.current) headers["X-AI-Session-ID"] = guestSessionIdRef.current;
      const response = await fetch(currentUser ? "/api/ai/vision" : "/api/ai/public-vision", {
        method: "POST",
        headers,
        body: JSON.stringify({
          prompt: message.trim() || "Identify this image, especially any product or object. Give the likely name, category, visible brand/model if readable, key visible details, and what I can do next in Unique One. Be clear about uncertainty.",
          mimeType: imageFile.type,
          imageData: dataUrl.slice(comma + 1),
          preferredLanguage: language,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error?.message || "Image analysis is temporarily unavailable.");
      setMessages((current) => [
        ...current,
        { id: crypto.randomUUID(), role: "user", text: message.trim() || "Identify this image.", },
        { id: crypto.randomUUID(), role: "assistant", text: payload.message || "I could not identify the image confidently." },
      ]);
      setMessage("");
      if (imagePreview) URL.revokeObjectURL(imagePreview);
      setImagePreview(null);
      setImageFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Image analysis is temporarily unavailable.");
    } finally {
      setImageBusy(false);
    }
  };

  const sendMessage = async (event?: FormEvent, retryMessage?: string) => {
    event?.preventDefault();
    const trimmed = (retryMessage ?? message).trim();
    if (!trimmed || loading) return;

    setError("");
    setLastFailedMessage(null);
    setMessage("");
    if (!retryMessage) {
      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        text: trimmed,
      };
      setMessages((current) => [...current, userMessage]);
    }
    setLoading(true);
    setRequestState(retryMessage ? "retrying" : "sending");
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 30_000);

    try {
      const requestId = crypto.randomUUID();
      const history = messages.slice(-6).map(({ role, text }) => ({ role, text }));
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "X-Request-ID": requestId,
      };
      if (currentUser) {        headers.Authorization = `Bearer ${await currentUser.getIdToken()}`;
      } else if (guestSessionIdRef.current) {
        headers["X-AI-Session-ID"] = guestSessionIdRef.current;
      }
      const response = await fetch(currentUser ? "/api/ai/chat" : "/api/ai/public-chat", {
        method: "POST",
        headers,
        body: JSON.stringify({ message: trimmed, history, preferredLanguage: language, ...(shouldUseDeviceLocation(trimmed) ? { location: await getDeviceLocation() } : {}) }),
        signal: controller.signal,
      });

      const payload = (await response.json().catch(() => null)) as
        | { message?: string; readOnly?: boolean; requestId?: string; capabilities?: UniqueAiCapabilities; error?: { message?: string; code?: string }; aiAccess?: AiAccess }
        | null;
      if (payload?.aiAccess) {
        setAiAccess(payload.aiAccess);
        setDisplayRemainingSeconds(payload.aiAccess.remainingSeconds);
      }
      const remainingHeader = response.headers.get("X-AI-Remaining-Seconds");
      if (remainingHeader && /^\\d+$/.test(remainingHeader)) {
        setDisplayRemainingSeconds(Number(remainingHeader));
      }

      const responseRequestId = response.headers.get("X-Request-ID")?.trim();
      if (responseRequestId && !/^[A-Za-z0-9._:-]{1,64}$/.test(responseRequestId)) {
        throw new Error("Unique AI returned an invalid response request ID.");
      }
      if (!response.ok) {
        const errorRequestId =
          responseRequestId ||
          (typeof payload?.requestId === "string" ? payload.requestId : undefined);
        if (errorRequestId) setLastRequestId(errorRequestId);
        throw new Error(payload?.error?.message || "Unique AI is temporarily unavailable.");
      }

      if (payload?.readOnly !== true) {
        throw new Error("Unique AI returned an invalid response contract.");
      }
      if (currentUser) {
        if (
          !payload.capabilities ||
          payload.capabilities.version !== 1 ||
          payload.capabilities.readOnly !== true ||
          !Array.isArray(payload.capabilities.contexts) ||
          JSON.stringify([...payload.capabilities.contexts].sort()) !== JSON.stringify(["account", "businesses", "orders", "products"]) ||
          !Array.isArray(payload.capabilities.mutations) ||
          payload.capabilities.mutations.length !== 0
        ) {
          throw new Error("Unique AI returned an invalid capability contract.");
        }
      }

      if (payload.requestId !== undefined && payload.requestId !== requestId) {
        throw new Error("Unique AI returned a mismatched request ID.");
      }

      if (typeof payload?.requestId !== "string" || !/^[A-Za-z0-9._:-]{1,64}$/.test(payload.requestId)) {
        throw new Error("Unique AI returned an invalid request ID.");
      }

      if (typeof payload?.message !== "string" || !payload.message.trim()) {
        throw new Error("Unique AI returned an empty response.");
      }

      setLastRequestId(responseRequestId || payload.requestId);

      let discoveryResults: DiscoveryResult[] = [];
      if (shouldLoadDiscovery(trimmed)) {
        try {
          const discoveryResponse = await fetch("/api/ai/discovery", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: trimmed, ...(location ? { location } : {}) }),
            signal: controller.signal,
          });
          if (discoveryResponse.ok) {
            const discoveryPayload = (await discoveryResponse.json().catch(() => null)) as { results?: DiscoveryResult[] } | null;
            if (Array.isArray(discoveryPayload?.results)) {
              discoveryResults = discoveryPayload.results
                .filter((item) => item && typeof item.id === "string" && typeof item.name === "string")
                .slice(0, 6);
            }
          }
        } catch {
          // AI text remains usable when the optional discovery cards are unavailable.
        }
      }

      setMessages((current) => [
        ...current,
        { id: crypto.randomUUID(), role: "assistant", text: payload.message!.trim(), pdfEligible: userExplicitlyRequestedPdf(trimmed) || shouldOfferPdfRequest(trimmed), ...(discoveryResults.length ? { discovery: discoveryResults } : {}) },
      ]);
    } catch (err) {
      setLastFailedMessage(trimmed);
      if (err instanceof DOMException && err.name === "AbortError") {
        setError("Unique AI took too long to respond. Please try again.");
      } else {
        setError(err instanceof Error ? err.message : "Unable to contact Unique AI.");
      }
    } finally {
      window.clearTimeout(timeoutId);
      setLoading(false);
      setRequestState("idle");
    }
  };

  return (
    <>
      <style>{`
        @keyframes uniqueAiSuggestedSlide {
          0% { opacity: 0; transform: translate3d(28px, 0, 0); filter: blur(3px); }
          65% { opacity: 1; transform: translate3d(-2px, 0, 0); filter: blur(0); }
          100% { opacity: 1; transform: translate3d(0, 0, 0); filter: blur(0); }
        }
        @keyframes uniqueAiSuggestionSweep {
          0% { transform: translateX(-105%); opacity: .15; }
          12% { opacity: 1; }
          88% { opacity: 1; }
          100% { transform: translateX(105%); opacity: .15; }
        }
        @keyframes uniqueAiSuggestionGlow {
          0%, 100% { opacity: .35; }
          50% { opacity: .95; }
        }
        @keyframes uniqueAiTypingDot {
          0%, 60%, 100% { transform: translateY(0) scale(.72); opacity: .35; }
          30% { transform: translateY(-4px) scale(1); opacity: 1; }
        }
        @keyframes uniqueAiTypingGlow {
          0%, 100% { opacity: .35; transform: scale(.92); }
          50% { opacity: .9; transform: scale(1.08); }
        }
        @keyframes uniqueAiComposerShine {
          0% { transform: translateX(-120%); opacity: 0; }
          25% { opacity: .45; }
          70% { opacity: .2; }
          100% { transform: translateX(120%); opacity: 0; }
        }
        @keyframes uniqueAiSearchGlow {
          0%, 100% { opacity: .42; transform: scale(.985); }
          50% { opacity: .88; transform: scale(1.012); }
        }
        @keyframes uniqueAiSearchSmoke {
          0%, 100% { transform: translate3d(-2%, 0, 0) scale(1); opacity: .28; }
          50% { transform: translate3d(2%, -1px, 0) scale(1.035); opacity: .55; }
        }
        @keyframes uniqueAiTitleFloat {
          0%, 100% { transform: translate3d(0, 0, 0); text-shadow: 0 0 0 rgba(16,185,129,0); }
          50% { transform: translate3d(0, -3px, 0); text-shadow: 0 0 18px rgba(16,185,129,.24); }
        }
        @keyframes uniqueAiOrbPulse {
          0%, 100% { transform: scale(.98); }
          50% { transform: scale(1.06); }
        }
        @keyframes uniqueAiOrbSweep {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          .unique-ai-suggestion-motion,
          .unique-ai-suggestion-motion * {
            animation: none !important;
            transition: none !important;
          }
        }
        @keyframes uniqueAiFlagOrbit {
          0% { transform: rotate(0deg) translateX(34px) rotate(0deg); }
          25% { transform: rotate(90deg) translateX(34px) rotate(-90deg); }
          50% { transform: rotate(180deg) translateX(34px) rotate(-180deg); }
          75% { transform: rotate(270deg) translateX(34px) rotate(-270deg); }
          100% { transform: rotate(360deg) translateX(34px) rotate(-360deg); }
        }
      `}</style>
      <div className="flex h-full min-h-0 min-w-0 flex-col gap-2 overflow-x-hidden sm:gap-4">
      {aiAccess && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-100 bg-emerald-50/80 px-3 py-2 text-xs text-emerald-900 shadow-sm">
          <div className="min-w-0">
            <div className="font-semibold">
              {aiAccess.mode === "guest" ? "Guest AI access" : aiAccess.mode === "registered" ? "Daily AI access" : "Unique AI Premium"}
            </div>            <div className="truncate opacity-80">
              {aiAccess.mode === "guest"
                ? "Register to unlock 1 hour of Unique AI every day."
                : aiAccess.mode === "registered"
                  ? "Your daily allowance is shared across conversations."
                  : "Extended AI access with fair-use protection."}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {aiAccess.mode !== "subscriber" && (
              <Link
                to="/ai/premium"
                className="rounded-full border border-emerald-300 bg-white px-2.5 py-1.5 text-[10px] font-bold text-emerald-700 shadow-sm transition hover:bg-emerald-50"
              >
                ✨ Premium
              </Link>
            )}
            <div className="text-right">
              <div className="font-bold">{displayRemainingSeconds === null ? formatAiTime(aiAccess.remainingSeconds) : formatAiTime(displayRemainingSeconds)}</div>
              <div className="opacity-70">remaining</div>
            </div>
          </div>
        </div>
      )}
      {premiumNoticeOpen && aiAccess?.mode !== "subscriber" && (
        <div className="pointer-events-none fixed inset-x-3 top-20 z-40 flex justify-center sm:inset-x-auto sm:right-5 sm:top-24 sm:w-[360px]">
          <div className="pointer-events-auto w-full rounded-2xl border border-emerald-200 bg-white/95 p-3 shadow-[0_14px_45px_rgba(15,23,42,.16)] backdrop-blur-xl">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-950 text-sm text-emerald-300 shadow-[0_0_16px_rgba(16,185,129,.28)]">✨</div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-black text-slate-900">Unique AI Premium</div>
                <div className="mt-0.5 text-[11px] leading-4 text-slate-500">Extended AI access from ₦180. Your conversation stays exactly where it is.</div>
                <Link to="/ai/premium" className="mt-2 inline-flex rounded-full bg-slate-950 px-3 py-1.5 text-[10px] font-bold text-white hover:bg-emerald-600">View plans</Link>
              </div>
              <button type="button" onClick={() => setPremiumNoticeOpen(false)} className="shrink-0 px-1 text-slate-400 hover:text-slate-700" aria-label="Dismiss Premium notice">×</button>
            </div>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 shrink-0 text-emerald-500" aria-hidden="true" />
          <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Try asking</span>
          <span className="hidden text-[10px] text-slate-400 sm:inline">— a quick idea to get started</span>
        </div>
      </div>
      <div className="relative min-w-0 overflow-hidden rounded-2xl border border-emerald-100/90 bg-gradient-to-r from-white via-emerald-50/70 to-white p-2.5 shadow-[0_4px_18px_rgba(15,23,42,.045)] sm:p-3">
        <div className="pointer-events-none absolute inset-y-0 left-0 w-1 rounded-l-2xl bg-gradient-to-b from-emerald-300 via-emerald-500 to-teal-300" aria-hidden="true" />
        <div className="pointer-events-none absolute -right-5 -top-7 h-20 w-20 rounded-full bg-emerald-300/15 blur-2xl" style={{ animation: "uniqueAiSuggestionGlow 2.8s ease-in-out infinite" }} aria-hidden="true" />
        <button
          key={QUICK_PROMPTS[suggestedIndex]}
          type="button"
          disabled={loading}
          onClick={() => setMessage(QUICK_PROMPTS[suggestedIndex])}
          className="group relative flex w-full min-w-0 items-center gap-2.5 rounded-xl px-1.5 py-1 text-left transition-colors hover:bg-white/80 disabled:opacity-60 sm:gap-3 sm:px-2"
          aria-label={`Use suggested question: ${QUICK_PROMPTS[suggestedIndex]}`}
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-emerald-100 bg-white text-emerald-600 shadow-sm sm:h-9 sm:w-9">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="mb-0.5 block text-[9px] font-bold uppercase tracking-[0.1em] text-emerald-700/80">Suggested prompt</span>
            <span
              className="block min-w-0 whitespace-normal break-words text-[13px] font-semibold leading-[1.4rem] text-slate-800 transition-colors group-hover:text-emerald-800 sm:text-sm"
              style={{ animation: "uniqueAiSuggestedSlide 900ms cubic-bezier(.22,1,.36,1) both" }}
            >
              {QUICK_PROMPTS[suggestedIndex]}
            </span>
          </span>
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-emerald-100 bg-white text-sm font-bold text-emerald-700 transition-transform group-hover:translate-x-0.5" aria-hidden="true">↗</span>
        </button>
        <div className="pointer-events-none absolute inset-x-2 bottom-0.5 h-px overflow-hidden bg-emerald-100" aria-hidden="true">
          <span key={suggestedIndex} className="absolute inset-y-0 left-0 w-1/2 rounded-full bg-emerald-400/80" style={{ animation: "uniqueAiSuggestionSweep 5.5s linear both" }} />
        </div>
      </div>

      {smartOpportunityOpen && !smartOpportunityDismissed && (
        <div
          className="unique-ai-suggestion-motion pointer-events-none fixed inset-x-3 bottom-[calc(88px+env(safe-area-inset-bottom,0px))] z-30 flex justify-end sm:inset-x-auto sm:right-5 sm:bottom-24 sm:w-[320px]"
          aria-live="polite"
        >
          <div className="pointer-events-auto w-full rounded-2xl border border-emerald-200/80 bg-white/95 p-2.5 shadow-[0_12px_38px_rgba(15,23,42,.16)] backdrop-blur-xl">
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  setMessage(SMART_OPPORTUNITIES[smartOpportunityIndex].prompt);
                  setSmartOpportunityOpen(false);
                }}
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
                aria-label={`Use Smart Opportunity: ${SMART_OPPORTUNITIES[smartOpportunityIndex].text}`}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-sm font-bold text-emerald-300">
                  {SMART_OPPORTUNITIES[smartOpportunityIndex].icon}
                </span>
                <span className="min-w-0">
                  <span className="block text-[9px] font-black uppercase tracking-[0.12em] text-emerald-700">
                    {SMART_OPPORTUNITIES[smartOpportunityIndex].label}
                  </span>
                  <span className="mt-0.5 block text-[11px] font-semibold leading-4 text-slate-700">
                    {SMART_OPPORTUNITIES[smartOpportunityIndex].text}
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSmartOpportunityOpen(false);
                  setSmartOpportunityDismissed(true);
                }}
                className="shrink-0 rounded-full px-1.5 py-1 text-xs text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Dismiss Smart Opportunity"
              >
                ×
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="min-w-0 flex-1 overflow-y-auto overscroll-contain p-2.5 sm:p-6">
          {messages.length === 0 ? (
            <div className="mx-auto flex h-full max-w-2xl flex-col items-center justify-end pb-2 text-center sm:pb-4">
              <div className="unique-ai-platform-mark relative flex h-[74px] w-[74px] translate-y-0 items-center justify-center sm:h-[82px] sm:w-[82px]" aria-hidden="true">
                <span className="absolute -inset-4 rounded-full bg-emerald-300/20 blur-2xl" style={{ animation: "uniqueAiSearchGlow 3.6s ease-in-out infinite" }} />
                <span className="absolute -inset-1.5 rounded-full border border-emerald-300/30" style={{ animation: "uniqueAiOrbPulse 3s ease-in-out infinite" }} />
                <span className="absolute inset-[-10px] rounded-full border border-emerald-400/20" style={{ animation: "uniqueAiOrbSweep 5.5s linear infinite" }} />
                <span className="absolute inset-[-4px] flex items-center justify-center">
                  {Array.from({ length: 8 }, (_, index) => (
                    <span
                      key={index}
                      className="absolute flex h-5 w-7 items-center justify-center overflow-hidden rounded-[4px] border border-white/70 bg-white text-[14px] leading-none shadow-[0_2px_8px_rgba(15,23,42,.22)]"
                      style={{ animation: "uniqueAiFlagOrbit 8s linear infinite", animationDelay: `${-(index * 1)}s` }}
                    >🇳🇬</span>
                  ))}
                </span>
                <span className="absolute inset-[-5px] rounded-full border border-emerald-200/20 bg-emerald-400/10 blur-md" style={{ animation: "uniqueAiOrbPulse 2.6s ease-in-out infinite" }} />
                <span className="relative z-10 flex h-16 w-16 items-center justify-center rounded-full border border-white/90 bg-slate-950 text-xs font-black tracking-[0.12em] text-emerald-300 shadow-[0_0_28px_rgba(16,185,129,.42)] sm:h-[70px] sm:w-[70px] sm:text-sm">
                  <span className="relative">AI<span className="absolute -right-1 -top-1 h-1 w-1 rounded-full bg-white shadow-[0_0_5px_rgba(255,255,255,.9)]" /></span>
                </span>
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-3xl space-y-4">
              {messages.map((item) => (
                <div
                  key={item.id}
                  className={`flex ${item.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`relative max-w-[88%] whitespace-pre-wrap rounded-[22px] px-4 py-3 text-sm leading-6 ${item.role === "user" ? "rounded-br-md bg-slate-900 text-white shadow-slate-900/10" : "rounded-bl-md border border-slate-200/80 bg-white text-slate-800 shadow-black/5"}`}
                  >
                    {item.role === "assistant" && (
                      <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-600">
                        <span className="unique-ai-mini-mark relative flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[6px] font-black text-white shadow-[0_0_10px_rgba(52,211,153,.45)]">
                          UP
                          <span className="absolute inset-0 rounded-full border border-emerald-200/60" />
                        </span>
                        Unique AI
                      </div>
                    )}
                    <div>{item.text}</div>
                    {item.role === "assistant" && item.pdfEligible && (
                      <button type="button" onClick={() => downloadAiPdf("Unique AI Answer", item.text)} className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-bold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100" aria-label="Create a professional Unique Platform PDF">
                        <FileDown className="h-3.5 w-3.5" />
                        Create PDF
                      </button>
                    )}
                    {item.discovery && item.discovery.length > 0 && (
                      <div className="mt-3 space-y-2 border-t border-slate-200/80 pt-3">
                        <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-600">Live Unique One results</div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {item.discovery.map((result) => (
                            <Link
                              key={`${result.type}-${result.id}`}                              to={result.type === "product" ? `/store/search?q=${encodeURIComponent(result.name)}` : `/store/search?q=${encodeURIComponent(result.name)}`}
                              className="block rounded-xl border border-slate-200 bg-slate-50/80 p-2.5 text-left transition hover:border-emerald-300 hover:bg-emerald-50/50"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-400">{result.type}</span>
                                {typeof result.price === "number" && (
                                  <span className="text-[10px] font-bold text-emerald-700">{result.currency || "NGN"} {result.price.toLocaleString()}</span>
                                )}
                              </div>
                              <div className="mt-1 text-xs font-semibold leading-4 text-slate-800">{result.name}</div>
                              {(result.category || result.providerName) && (
                                <div className="mt-1 truncate text-[10px] text-slate-500">{result.providerName || result.category}</div>
                              )}
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} aria-hidden="true" />
              {loading && (
                <div className="flex justify-start">
                  <div className="relative flex items-center gap-3 rounded-[22px] rounded-bl-md border border-emerald-100 bg-white px-4 py-3 shadow-sm">
                    <span className="absolute -left-2 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full bg-emerald-300/25 blur-xl" style={{ animation: "uniqueAiTypingGlow 1.8s ease-in-out infinite" }} aria-hidden="true" />
                    <span className="relative flex h-7 w-7 items-center justify-center rounded-full bg-slate-950 text-[8px] font-black text-emerald-300 shadow-[0_0_14px_rgba(52,211,153,.35)]">U1</span>
                    <span className="flex items-center gap-1" aria-label={requestState === "retrying" ? "Retrying Unique AI" : "Unique AI is typing"}>
                      {[0, 1, 2].map((delay) => (
                        <span key={delay} className="h-1.5 w-1.5 rounded-full bg-emerald-500" style={{ animation: `uniqueAiTypingDot 1.1s ease-in-out ${delay * 140}ms infinite` }} />
                      ))}
                    </span>
                    <span className="text-xs font-medium text-slate-500">{requestState === "retrying" ? "Retrying…" : "Typing…"}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="flex items-center justify-between gap-3 border-t border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            <span role="alert">{error}</span>
            {lastFailedMessage && !loading && (
              <button
                type="button"
                onClick={() => {
                  void sendMessage(undefined, lastFailedMessage);
                }}
                className="shrink-0 rounded-lg border border-red-200 bg-white px-3 py-1.5 font-medium text-red-700 hover:bg-red-100"
              >
                Retry
              </button>
            )}
          </div>
        )}

        <form onSubmit={sendMessage} className="shrink-0 border-t border-slate-200/80 bg-white/95 px-2.5 pb-2.5 pt-2 backdrop-blur-xl sm:px-4 sm:pb-4 sm:pt-3">
          <div className="unique-ai-search-shell relative mx-auto flex max-w-3xl items-end gap-2 overflow-visible rounded-[26px]">
            <span className="pointer-events-none absolute -inset-1 rounded-[30px] bg-emerald-300/20 blur-md" aria-hidden="true" />
            <span className="pointer-events-none absolute -inset-[2px] rounded-[28px] border border-emerald-300/40 bg-gradient-to-r from-emerald-300/10 via-white/30 to-teal-300/10 blur-[1px]" style={{ animation: "uniqueAiSearchGlow 3.8s ease-in-out infinite" }} aria-hidden="true" />
            <span className="pointer-events-none absolute -inset-2 rounded-[32px] bg-[radial-gradient(ellipse_at_center,rgba(16,185,129,0.20),transparent_68%)] blur-lg" style={{ animation: "uniqueAiSearchSmoke 5s ease-in-out infinite" }} aria-hidden="true" />
            <div className="relative flex min-w-0 flex-1 items-end gap-2 overflow-hidden rounded-[26px] border border-emerald-200/80 bg-white/95 p-1.5 shadow-[0_0_22px_rgba(16,185,129,0.2)] backdrop-blur-xl transition-all duration-300 focus-within:border-emerald-400 focus-within:bg-white focus-within:shadow-[0_0_34px_rgba(16,185,129,0.34)]">
              <span className="pointer-events-none absolute inset-y-0 left-0 w-1/3 -translate-x-full bg-gradient-to-r from-transparent via-emerald-200/35 to-transparent" style={{ animation: "uniqueAiComposerShine 3.8s ease-in-out infinite" }} aria-hidden="true" />
              <span className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-emerald-300/80 to-transparent" style={{ animation: "uniqueAiComposerShine 2.8s ease-in-out infinite" }} aria-hidden="true" />
              <input
                ref={imageInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                className="hidden"
                onChange={(event) => {
                  void handleImageSelected(event.target.files?.[0]);
                  event.currentTarget.value = "";
                }}
              />
              <button
                type="button"
                disabled={loading || imageBusy}
                onClick={() => imageInputRef.current?.click()}
                className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-emerald-200 bg-white text-emerald-700 shadow-sm transition hover:bg-emerald-50 disabled:opacity-50 sm:h-11 sm:w-11"
                aria-label="Scan or add an image"
                title="Scan or add an image"
              >
                📷
              </button>
              {imagePreview && (
                <div className="absolute -top-20 left-2 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-white/95 p-1.5 shadow-lg backdrop-blur-xl">
                  <img src={imagePreview} alt="Selected for Unique AI" className="h-16 w-16 rounded-xl object-cover" />
                  <div className="pr-1">
                    <div className="max-w-[150px] truncate text-[10px] font-bold text-slate-700">{imageFile?.name || "Image"}</div>
                    <button type="button" onClick={() => { if (imagePreview) URL.revokeObjectURL(imagePreview); setImagePreview(null); setImageFile(null); }} className="mt-1 rounded-full bg-emerald-600 px-2.5 py-1 text-[10px] font-bold text-white">Remove</button>
                  </div>
                  <button type="button" onClick={() => void analyzeSelectedImage()} disabled={imageBusy} className="rounded-full bg-slate-950 px-3 py-2 text-[10px] font-bold text-white disabled:opacity-50">{imageBusy ? "Reading…" : "Identify"}</button>
                </div>
              )}
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void sendMessage();
                  }
                }}
                rows={1}
                maxLength={4000}
                disabled={loading}
                aria-label="Message Unique AI"
                placeholder="Ask Unique AI anything — or scan an image"
                className="relative min-h-[42px] min-w-0 flex-1 resize-none bg-transparent px-3 py-2.5 text-sm leading-5 text-slate-800 outline-none placeholder:text-slate-400 disabled:opacity-60 sm:min-h-[44px] sm:px-4 sm:py-3"
              />
              <button type="submit" disabled={!message.trim() || loading} aria-label="Send message" className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-950 text-white shadow-[0_4px_14px_rgba(15,23,42,.2)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-emerald-600 hover:shadow-[0_6px_18px_rgba(16,185,129,.25)] disabled:translate-y-0 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none sm:h-11 sm:w-11">
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
          {!currentUser && (
            <div className="mt-2 flex items-center justify-between gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-2.5 py-2 text-[10px] leading-4 text-emerald-800 sm:mt-3 sm:gap-3 sm:px-3 sm:text-xs">
              <span className="min-w-0 line-clamp-2">Enjoying Unique AI? Register to unlock your full Unique One experience and personalized AI.</span>
              <Link to="/register" className="shrink-0 rounded-full bg-slate-900 px-2.5 py-1.5 font-bold text-white sm:px-3">Register free</Link>
            </div>
          )}
          <div className="mt-1.5 flex min-w-0 items-center justify-between gap-2 px-0.5 text-[9px] leading-3.5 text-slate-400 sm:mt-2 sm:gap-3 sm:text-xs sm:leading-4">
            
            <span className="max-w-full truncate text-left sm:text-right" aria-live="polite">
              {lastRequestId ? `Request: ${lastRequestId}` : "Support request ID will appear after a response"} · {message.length}/4000
            </span>
          </div>
        </form>
      </div>
    </div>
    </>
  );
}