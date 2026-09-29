import { FormEvent, useEffect, useRef, useState } from "react";
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
    if (!trimmed || loading || !currentUser) return;

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
      const token = await currentUser.getIdToken();
      const requestId = crypto.randomUUID();
      const history = messages.slice(-6).map(({ role, text }) => ({ role, text }));
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "X-Request-ID": requestId,
        },
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
      if (
        !payload.capabilities ||
        payload.capabilities.version !== 1 ||
        payload.capabilities.readOnly !== true ||
        !Array.isArray(payload.capabilities.contexts) ||
        !Array.isArray(payload.capabilities.mutations) ||
        payload.capabilities.mutations.length !== 0
      ) {
        throw new Error("Unique AI returned an invalid capability contract.");
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
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-emerald-600" />
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Unique AI</h1>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Your authenticated Unique One assistant. Platform information comes from authorized records.
          </p>
        </div>
        <button
          type="button"
          onClick={clearConversation}
          disabled={messages.length === 0 || loading}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Trash2 className="h-4 w-4" />
          Clear
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {messages.length === 0 ? (
            <div className="mx-auto flex max-w-2xl flex-col items-center py-10 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50">
                <Bot className="h-7 w-7 text-emerald-600" />
              </div>
              <h2 className="text-lg font-semibold text-slate-900">How can I help?</h2>
              <p className="mt-2 text-sm text-slate-500">
                Ask about your Unique One account, orders, businesses, or products. I will not invent records or claim actions I did not perform. Summary counts use only authorized records loaded for the current request. If a collection reaches its context limit, the summary may be incomplete.
              </p>
              <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-left text-xs leading-5 text-emerald-800">
                <strong>Current capability:</strong> read-only access to your authorized account, order, business, and product context. No payment, order, product, business, booking, transfer, or other platform mutation is exposed to Unique AI.
              </div>
              <div className="mt-6 grid w-full gap-2 sm:grid-cols-3">
                {QUICK_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    disabled={loading}
                    onClick={() => setMessage(prompt)}
                    className="rounded-xl border border-slate-200 p-3 text-left text-sm text-slate-700 hover:border-emerald-300 hover:bg-emerald-50"
                  >
                    {prompt}
                  </button>
                ))}
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

        <form onSubmit={sendMessage} className="border-t border-slate-200 p-3 sm:p-4">
          <div className="flex items-end gap-2">
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
              disabled={loading || !currentUser}
              aria-label="Message Unique AI"
              placeholder="Ask Unique AI…"
              className="min-h-[48px] flex-1 resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-50"
            />
            <button
              type="submit"
              disabled={!message.trim() || loading || !currentUser}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
              Send
            </button>
          </div>
          <div className="mt-2 flex items-center justify-between gap-3 px-1 text-xs text-slate-400">
            <span>Read-only assistant for now. It can read authorized account, order, business, and product context only; no platform mutations are exposed. Each request has a temporary support request ID. Answers use only authorized records loaded for the current request and may be incomplete when a context limit is reached.</span>
            <span className="text-right" aria-live="polite">
              {lastRequestId ? `Request: ${lastRequestId}` : "Support request ID will appear after a response"} · {message.length}/4000
            </span>
          </div>
        </form>
      </div>
    </div>
  );
}
