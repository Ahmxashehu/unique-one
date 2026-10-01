import { FormEvent, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Bot, Send, Sparkles, Trash2 } from "lucide-react";
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
  "How does Unique AI protect my platform data?",
  "What happens if the AI service times out?",
  "How does Unique AI handle temporary model failures?",
  "Why might an AI answer be blocked or rejected?",
  "Can Unique AI make changes to my account?",
  "Are AI answers based on all my records or only loaded records?",
  "What can you help me with in Unique One?",
  "What can Unique AI access right now?",
  "Summarize my current orders.",
  "What businesses and products do I have?",
  "How many orders, businesses, and products do I have?",
  "How many of my orders are active or cancelled?",
  "What order statuses do I currently have?",
  "How are my businesses grouped by category?",
  "How are my products grouped by category?",
  "How are my orders split between customer and seller status?",
  "How are my businesses split by status and verification?",
  "How are my products split by status?",
  "How many inventory units do my loaded products contain?",
  "Which of my AI summaries may be incomplete because of context limits?",
  "Which of my products are missing category, status, or quantity data?",
  "Which of my products have invalid inventory quantities?",
  "Which of my businesses have missing category, status, or verification data?",
  "What order data is unknown or potentially incomplete?",
  "Which summaries are guaranteed to be based on all loaded records?",
  "Why might my Unique AI counts be incomplete?",
  "What request ID should I give support if Unique AI fails?",
  "What does a blocked AI response mean?",
  "What happens when Unique AI has no usable model response?",
  "Does Unique AI cache my platform response?",
  "Can Unique AI expose another user’s private data?",
  "What happens when one of my data fields is missing?",
  "What happens when the AI context reaches its size limit?",
  "How does Unique AI handle an invalid model response?",
  "How does Unique AI trace a failed request?",
  "How can I give support the request ID safely?",
  "Does Unique AI verify that its authorized context is internally consistent?",
  "What does the Unique AI context completeness status mean?",
  "What does it mean when AI context is incomplete?",
  "What data is never exposed to Unique AI?",
  "Which loaded order totals are unavailable?",
  "What is my account verification status?",
  "Can you change a payment or order for me?",
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
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

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

  const clearConversation = () => {
    if (loading) return;
    setMessages([]);
    setError("");
    setLastFailedMessage(null);
    setLastRequestId(null);
  };

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col gap-2 overflow-x-hidden sm:gap-4">
      <div className="flex min-w-0 items-center justify-between gap-2 px-0.5 sm:gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-950 shadow-[0_0_24px_rgba(52,211,153,0.35)] sm:h-12 sm:w-12">
            <span className="absolute inset-0 rounded-full border border-emerald-300/50 animate-ping" />
            <span className="absolute inset-1 rounded-full border border-emerald-400/30 animate-[spin_5s_linear_infinite]" />
            <span className="relative flex h-7 w-7 items-center justify-center rounded-full bg-emerald-400 text-[10px] font-black tracking-tight text-slate-950 shadow-[0_0_16px_rgba(52,211,153,0.8)] sm:h-8 sm:w-8 sm:text-xs">
              U1
            </span>
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold tracking-tight text-slate-900 sm:text-2xl">Ask Unique AI anything.</h1>
            <div className="mt-0.5 flex items-center gap-1.5 text-[10px] font-medium text-emerald-600 sm:text-xs">
              <Sparkles className="h-3 w-3" />
              <span>Unique AI</span>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={clearConversation}
          disabled={messages.length === 0 || loading}
          className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-600 disabled:cursor-not-allowed disabled:opacity-40 sm:h-auto sm:gap-2 sm:rounded-lg sm:px-3 sm:py-2 sm:text-sm"
        >
          <Trash2 className="h-4 w-4" />
          Clear
        </button>
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
              <div className="mt-3 w-full sm:mt-6">
                <div className="mb-2 flex items-center justify-between px-0.5">
                  <span className="text-xs font-bold text-slate-700">Suggested questions</span>
                  <span className="text-[10px] text-slate-400 sm:text-xs">Tap one to start</span>
                </div>
                <div className="grid max-h-44 grid-cols-2 gap-1.5 overflow-y-auto overscroll-contain pr-0.5 sm:mt-0 sm:max-h-none sm:grid-cols-3 sm:gap-2">
                {QUICK_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    disabled={loading}
                    onClick={() => setMessage(prompt)}
                    className="min-w-0 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-left text-[11px] leading-4 text-slate-700 transition-colors hover:border-emerald-300 hover:bg-emerald-50 sm:p-3 sm:text-sm sm:leading-normal"
                  >
                    {prompt}
                  </button>
                ))}
                </div>
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
                    className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 ${
                      item.role === "user"
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-800"
                    }`}
                  >
                    {item.text}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} aria-hidden="true" />
              {loading && (
                <div className="flex justify-start">
                  <div className="rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-500">
                    {requestState === "retrying" ? "Retrying Unique AI…" : "Unique AI is thinking…"}
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

        <form onSubmit={sendMessage} className="shrink-0 border-t border-slate-200 bg-white p-2 sm:p-4">
          <div className="flex min-w-0 items-end gap-2">
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void sendMessage();
                }
              }}
              rows={2}
              maxLength={4000}
              disabled={loading}
              aria-label="Message Unique AI"
              placeholder="Ask Unique AI…"
              className="min-h-[46px] min-w-0 flex-1 resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none sm:min-h-[48px] sm:px-4 sm:py-3 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-50"
            />
            <button
              type="submit"
              disabled={!message.trim() || loading}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40 sm:h-12 sm:w-auto sm:gap-2 sm:px-4"
            >
              <Send className="h-4 w-4" />
              <span className="hidden sm:inline">Send</span>
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
  );
}
