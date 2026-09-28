import { FormEvent, useEffect, useRef, useState } from "react";
import { Bot, Send, Sparkles, Trash2 } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

const QUICK_PROMPTS = [
  "What can you help me with in Unique One?",
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
  "Which of my businesses have missing category, status, or verification data?",
  "What order data is unknown or potentially incomplete?",
  "Which summaries are guaranteed to be based on all loaded records?",
  "Why might my Unique AI counts be incomplete?",
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
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      text: trimmed,
    };
    setMessages((current) => [...current, userMessage]);
    setLoading(true);

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 30_000);

    try {
      const token = await currentUser.getIdToken();
      const historySource = retryMessage ? messages.slice(0, -1) : messages;
      const history = historySource.slice(-6).map(({ role, text }) => ({ role, text }));
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: trimmed, history }),
        signal: controller.signal,
      });

      const payload = (await response.json().catch(() => null)) as
        | { message?: string; error?: { message?: string } }
        | null;

      if (!response.ok) {
        throw new Error(payload?.error?.message || "Unique AI is temporarily unavailable.");
      }

      if (typeof payload?.message !== "string" || !payload.message.trim()) {
        throw new Error("Unique AI returned an empty response.");
      }

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
    }
  };

  const clearConversation = () => {
    if (loading) return;
    setMessages([]);
    setError("");
    setLastFailedMessage(null);
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
              <div className="mt-6 grid w-full gap-2 sm:grid-cols-3">
                {QUICK_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
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
                    Unique AI is thinking…
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
          <p className="mt-2 px-1 text-xs text-slate-400">
            Read-only assistant for now. It cannot change payments, orders, products, or other platform records. Some summaries are bounded by the records loaded for the request and may be incomplete when a context limit is reached.
          </p>
        </form>
      </div>
    </div>
  );
}
