import { FormEvent, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Send, Sparkles } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

type UniqueAiCapabilities = {
  version: 1;
  readOnly: true;
  contexts: string[];
  mutations: string[];
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

const QUICK_PROMPTS = [
  "What can Unique One do for individuals, families, businesses, and organizations?",
  "How does Unique One bring payments, shopping, services, communication, and discovery together?",
  "How does Unique Store work from discovery to checkout and delivery?",
  "How does UniquePay work for sending and receiving money?",
  "Can my phone number work as my UniquePay account number?",
  "How does UniquePay use a unique person ID for payments?",
  "Can I send money to another Unique One user by email?",
  "What payment, airtime, data, and bill services are planned for UniquePay?",
  "How will bank transfers work inside UniquePay?",
  "How does Unique Store connect with UniquePay?",
  "Can I switch between Unique Store and UniquePay without creating another account?",
  "How can a business register and create its Unique One business presence?",
  "How do business branches and ownership work in Unique One?",
  "How can sellers create and manage products in Unique Store?",
  "How can customers discover products and services near them?",
  "How does Unique Store location work from Nigeria to state, LGA, town, area, landmark, and GPS?",
  "How can I buy, sell, hire, book, send, travel, eat, discover, connect, and grow in Unique Store?",
  "How will business verification work on Unique One?",
  "How can a business manage customers, staff, suppliers, inventory, and orders?",
  "How does Unique One support SMEs and larger organizations?",
  "How can institutions and communities use Unique One?",
  "How can citizens use Unique One services?",
  "How can government services eventually fit into the Unique One ecosystem?",
  "How does Unique One support low-bandwidth users?",
  "Can Unique One work as an installable PWA on Android?",
  "How does Unique One work across web and mobile?",
  "What makes Unique One different from a normal marketplace?",
  "What makes Unique One different from a normal payment app?",
  "How does the Unique One super-app experience work?",
  "What does the human life operating system idea mean in Unique One?",
  "How does the Unique One trust/main branch concept work?",
  "How does Unique AI help me use Unique One?",
  "What can Unique AI access when I am registered?",
  "Can Unique AI understand my businesses, products, orders, and account context?",
  "Can Unique AI change my account, payments, or orders?",
  "Why is Unique AI read-only for protected platform context?",
  "How does Unique AI protect private platform data?",
  "How does Unique AI handle incomplete or missing data?",
  "What happens when Unique AI reaches a context limit?",
  "What happens if Unique AI temporarily fails?",
  "What does a Unique AI request ID do?",
  "How does Unique AI handle an invalid model response?",
  "How does Unique AI prevent another user’s private data from being exposed?",
  "Can Unique AI summarize my current orders?",
  "Can Unique AI summarize my businesses and products?",
  "Can Unique AI explain my inventory information?",
  "Can Unique AI explain my order statuses?",
  "Can Unique AI explain why some platform data may be incomplete?",
  "How can I ask Unique AI about my own platform activity?",
  "What does registered Unique AI context include?",
  "What is available in public Unique AI mode?",
  "How do I register for the full Unique One experience?",
  "How does Unique One authentication protect my account?",
  "How does Unique One handle sessions and access tokens?",
  "How does Unique One protect sensitive actions?",
  "How will transaction PIN protection work?",
  "How will OTP protection work?",
  "How will passkeys work in Unique One?",
  "How can fingerprint or face verification add security?",
  "How does Unique One protect financial routes?",
  "How does Unique One protect Firestore data?",
  "How does Unique One protect product and profile uploads?",
  "How does Unique One protect chat and file uploads?",
  "How are seller and business ownership permissions enforced?",
  "How does Unique One prevent clients from creating fake completed transactions?",
  "How does UniquePay use transaction ledgers and idempotency?",
  "How are Nigerian naira amounts represented safely in UniquePay?",
  "How will UniquePay connect to licensed financial partners?",
  "What role can a banking partner play in UniquePay?",
  "How could NIBSS services fit into UniquePay?",
  "How could NIN and BVN verification fit into UniquePay?",
  "What languages can Unique One support across Africa?",
  "How can Unique One expand from Nigeria to Africa and then globally?",
  "How can Unique One remain affordable as it grows?",
  "How does Unique One handle continuous platform upgrades?",
  "How does Unique Store handle product images?",
  "How can sellers upload product photos?",
  "How can users upload profile photos?",
  "How can users send photos and videos in communication?",
  "How can users send files in Unique One communication?",
  "How will the Unique One communication experience work?",
  "How can chat attachments be previewed before sending?",
  "How can Unique One avoid upload failures and stuck uploads?",
  "How can Unique One provide a WhatsApp-like communication experience?",
  "How can end-to-end encryption fit into Unique One communication?",
  "How does Unique Store handle carts?",
  "How does Unique Store handle checkout?",
  "How does Unique Store handle orders?",
  "How can customers track their orders?",
  "How can sellers manage order status?",
  "How can businesses manage inventory?",
  "How can customers save products or businesses?",
  "How can product hearts and favorites work?",
  "How can businesses showcase their services?",
  "How can providers appear in Discover?",
  "How will Discover use real platform data?",
  "How does the Active Edge experience work?",
  "How can Active Edge surface posts and updates from users and businesses?",
  "How can Unique One combine social updates with discovery?",
  "How can users discover nearby businesses and services?",
  "How can businesses reach relevant customers?",
  "How can customers discover trusted providers?",
  "How will Unique One avoid invented listings and use real platform data?",
  "How can AI help users discover real products and services?",
  "How can Unique One support bookings?",
  "How can Unique One support travel services?",
  "How can Unique One support food discovery and ordering?",
  "How can Unique One support hiring and service requests?",
  "How can Unique One support sending and delivery services?",
  "How can Unique One support business-to-business activity?",
  "How can Unique One support communities and institutions?",
  "How can Unique One support large organizations?",
  "How can Unique One support entrepreneurs starting a business?",
  "How can Unique One help a seller grow?",
  "How can Unique One help a customer save time?",
  "How can Unique One help a business understand its orders?",
  "How can Unique One help businesses understand products and inventory?",
  "How can Unique One connect a business presence to payments?",
  "How can Unique One connect commerce with communication?",
  "How can Unique One connect discovery with transactions?",
  "How can Unique One connect users, businesses, institutions, and communities?",
  "What is the role of the Unique One ID?",
  "How can Unique One identify people and businesses safely?",
  "How can a unique person ID be used instead of a QR code?",
  "How could temporary receiving account numbers work in UniquePay?",
  "How could future UniquePay ATM cards work?",
  "What are UniqueCoins and how might they fit into the future?",
  "How can Unique One support English, French, Hausa, Igbo, and Yoruba?",
  "How does Unique One handle notifications and important updates?",
  "How can Unique One make the home experience personalized?",
  "How can the home page bring together the whole Unique One experience?",
  "How can Unique One keep the interface simple despite many capabilities?",
  "How can Unique One remain fast on slower devices and networks?",
  "How can Unique One provide a consistent experience across Android and desktop?",
  "How can I find my account, business, orders, and products quickly?",
  "How can I use Unique AI to learn a feature step by step?",
  "Ask Unique AI to explain Unique Store.",
  "Ask Unique AI to explain UniquePay.",
  "Ask Unique AI to explain Unique One security.",
  "Ask Unique AI to explain my business dashboard.",
  "Ask Unique AI to explain my orders.",
  "Ask Unique AI to explain my products.",
  "Ask Unique AI to explain my account.",
  "What is Unique One building next?",
  "What capabilities are already available in Unique One?",
  "Which Unique One features are connected today?",
  "How can I get help when a Unique One feature fails?",
  "What should I give support when Unique One reports an error?",
  "What does a support request ID mean?",
  "What does it mean when Unique One says data is incomplete?",
  "How does Unique One handle service failures safely?",
  "How does Unique One keep protected actions separate from AI answers?",
  "What information should never be shared in a support request?",
];

export default function UniqueAiPage() {
  const { currentUser } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(null);
  const [requestState, setRequestState] = useState<"idle" | "sending" | "retrying">("idle");
  const [lastRequestId, setLastRequestId] = useState<string | null>(null);
  const [suggestedIndex, setSuggestedIndex] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setSuggestedIndex((current) => (current + 1) % QUICK_PROMPTS.length);
    }, 1_000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading, error]);

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
      if (currentUser) {
        headers.Authorization = `Bearer ${await currentUser.getIdToken()}`;
      }
      const response = await fetch(currentUser ? "/api/ai/chat" : "/api/ai/public-chat", {
        method: "POST",
        headers,
        body: JSON.stringify({ message: trimmed, history }),
        signal: controller.signal,
      });

      const payload = (await response.json().catch(() => null)) as
        | { message?: string; readOnly?: boolean; requestId?: string; capabilities?: UniqueAiCapabilities; error?: { message?: string } }
        | null;

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
      setMessages((current) => [
        ...current,
        { id: crypto.randomUUID(), role: "assistant", text: payload.message!.trim() },
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
      `}</style>
      <div className="flex h-full min-h-0 min-w-0 flex-col gap-2 overflow-x-hidden sm:gap-4">
      <div className="relative flex min-h-[58px] min-w-0 items-center overflow-hidden rounded-2xl border border-emerald-100 bg-white px-3 py-2.5 shadow-sm sm:min-h-[68px] sm:px-4">
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px] overflow-hidden bg-emerald-50" aria-hidden="true">
          <span
            key={suggestedIndex}
            className="absolute inset-y-0 left-0 w-1/2 rounded-full bg-emerald-400/80"
            style={{ animation: "uniqueAiSuggestionSweep 1s linear both" }}
          />
        </div>
        <div className="pointer-events-none absolute -left-8 top-1/2 h-14 w-14 -translate-y-1/2 rounded-full bg-emerald-300/20 blur-2xl" style={{ animation: "uniqueAiSuggestionGlow 2.8s ease-in-out infinite" }} aria-hidden="true" />
        <div className="min-w-0 w-full">
          <button
            key={QUICK_PROMPTS[suggestedIndex]}
            type="button"
            disabled={loading}
            onClick={() => setMessage(QUICK_PROMPTS[suggestedIndex])}
            className="group relative block w-full min-w-0 overflow-hidden pr-1 text-left"
            aria-label={`Use suggested question: ${QUICK_PROMPTS[suggestedIndex]}`}
          >
            <span
              className="block min-w-0 truncate text-sm font-semibold text-slate-800 transition-colors group-hover:text-emerald-700 sm:text-base"
              style={{ animation: "uniqueAiSuggestedSlide 700ms cubic-bezier(.22,1,.36,1) both" }}
            >
              <Sparkles className="mr-1.5 inline-block h-3.5 w-3.5 text-emerald-500 sm:h-4 sm:w-4" aria-hidden="true" />
              {QUICK_PROMPTS[suggestedIndex]}
            </span>
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="min-w-0 flex-1 overflow-y-auto overscroll-contain p-2.5 sm:p-6">
          {messages.length === 0 ? (
            <div className="mx-auto flex max-w-2xl flex-col items-center py-3 text-center sm:py-10">
              <div className="relative mb-2.5 flex h-14 w-14 items-center justify-center rounded-full bg-slate-950 shadow-[0_0_30px_rgba(52,211,153,0.4)] sm:mb-4 sm:h-16 sm:w-16">
                <span className="absolute inset-0 rounded-full border border-emerald-300/50 animate-ping" />
                <span className="absolute inset-1.5 rounded-full border border-emerald-400/30 animate-[spin_5s_linear_infinite]" />
                <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-emerald-400 text-xs font-black tracking-tight text-slate-950 shadow-[0_0_20px_rgba(52,211,153,0.85)] sm:h-10 sm:w-10 sm:text-sm">
                  U1
                </span>
              </div>
              <h2 className="text-lg font-black tracking-tight text-slate-900 sm:text-2xl">Ask Unique AI anything.</h2>

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
                    {${item.role === "assistant"} && (
                      <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-600">
                        <span className="relative flex h-4 w-4 items-center justify-center rounded-full bg-slate-950 text-[7px] font-black text-emerald-300">
                          U1
                          <span className="absolute inset-0 rounded-full border border-emerald-300/40" />
                        </span>
                        Unique AI
                      </div>
                    )}
                    {${item.text}}
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
          <div className="relative mx-auto flex max-w-3xl items-end gap-2 overflow-hidden rounded-[26px] border border-slate-200 bg-slate-50/90 p-1.5 shadow-[0_8px_30px_rgba(15,23,42,.07)] transition-all focus-within:border-emerald-300 focus-within:bg-white focus-within:shadow-[0_8px_32px_rgba(16,185,129,.12)]">
            <span className="pointer-events-none absolute inset-y-0 left-0 w-1/3 -translate-x-full bg-gradient-to-r from-transparent via-emerald-200/35 to-transparent" style={{ animation: "uniqueAiComposerShine 3.8s ease-in-out infinite" }} aria-hidden="true" />
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
              placeholder="Ask Unique AI…"
              className="relative min-h-[42px] min-w-0 flex-1 resize-none bg-transparent px-3 py-2.5 text-sm leading-5 text-slate-800 outline-none placeholder:text-slate-400 disabled:opacity-60 sm:min-h-[44px] sm:px-4 sm:py-3"
            />
            <button type="submit" disabled={!message.trim() || loading} aria-label="Send message" className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-950 text-white shadow-[0_4px_14px_rgba(15,23,42,.2)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-emerald-600 hover:shadow-[0_6px_18px_rgba(16,185,129,.25)] disabled:translate-y-0 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none sm:h-11 sm:w-11">
              <Send className="h-4 w-4" />
            </button>
          </div>
          {!currentUser && (
            <div className="mt-2 flex items-center justify-between gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-2.5 py-2 text-[10px] leading-4 text-emerald-800 sm:mt-3 sm:gap-3 sm:px-3 sm:text-xs">
              <span className="min-w-0 line-clamp-2">Enjoying Unique AI? Register to unlock your full Unique One experience and personalized AI.</span>
              <Link to="/register" className="shrink-0 rounded-full bg-slate-900 px-2.5 py-1.5 font-bold text-white sm:px-3">Register free</Link>
            </div>
          )}
          <div className="mt-1.5 flex min-w-0 items-center justify-between gap-2 px-0.5 text-[9px] leading-3.5 text-slate-400 sm:mt-2 sm:gap-3 sm:text-xs sm:leading-4">
            <span className="min-w-0 truncate">{currentUser ? "Registered mode: authorized Unique One context; mutations remain protected." : "Public mode is free. Register for personalized Unique One context."}</span>
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
