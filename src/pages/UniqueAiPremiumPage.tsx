import { useMemo, useState } from "react";
import { ArrowLeft, Check, LockKeyhole, WalletCards, Building2 } from "lucide-react";
import { Link } from "react-router-dom";

type Plan = { id: string; label: string; price: number; days: number; badge?: string };

const plans: Plan[] = [
  { id: "daily", label: "1 Day", price: 180, days: 1 },
  { id: "three-day", label: "3 Days", price: 450, days: 3 },
  { id: "weekly", label: "7 Days", price: 900, days: 7, badge: "Popular" },
  { id: "monthly", label: "30 Days", price: 2700, days: 30, badge: "Best value" },
  { id: "yearly", label: "1 Year", price: 27000, days: 365, badge: "Save most" },
];

const money = (value: number) => "₦" + value.toLocaleString("en-NG");

export default function UniqueAiPremiumPage() {
  const [selectedId, setSelectedId] = useState("monthly");
  const [method, setMethod] = useState<"wallet" | "bank">("wallet");
  const [showConfirm, setShowConfirm] = useState(false);

  const selected = useMemo(() => plans.find((plan) => plan.id === selectedId) ?? plans[0], [selectedId]);

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-5 text-white">
      <div className="mx-auto max-w-md">
        <Link to="/ai" className="mb-5 inline-flex items-center gap-2 text-sm text-emerald-300">
          <ArrowLeft size={17} /> Back to Unique AI
        </Link>

        <section className="rounded-3xl border border-emerald-400/20 bg-gradient-to-b from-emerald-950/70 to-slate-900 p-5 shadow-2xl">
          <div className="mb-5">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-200">
              <LockKeyhole size={13} /> Unique AI Premium
            </div>
            <h1 className="text-2xl font-bold">Extended AI access</h1>
            <p className="mt-1 text-sm text-slate-300">Choose the period that works for you. Longer plans give you more value.</p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {plans.map((plan) => (
              <button
                key={plan.id}
                type="button"
                onClick={() => setSelectedId(plan.id)}
                className={"relative rounded-2xl border p-3 text-left transition " + (selected.id === plan.id ? "border-emerald-300 bg-emerald-400/15" : "border-white/10 bg-white/[0.04]")}
              >
                {plan.badge && <span className="absolute right-2 top-2 rounded-full bg-emerald-300 px-1.5 py-0.5 text-[9px] font-bold text-slate-950">{plan.badge}</span>}
                <div className="text-sm font-semibold">{plan.label}</div>
                <div className="mt-1 text-lg font-bold">{money(plan.price)}</div>
                <div className="text-[11px] text-slate-400">Premium access</div>
              </button>
            ))}
          </div>

          <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-xs text-slate-400">Selected plan</div>
            <div className="mt-1 flex items-center justify-between">
              <span className="font-semibold">{selected.label} Premium</span>
              <span className="text-xl font-bold text-emerald-300">{money(selected.price)}</span>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <button type="button" onClick={() => setMethod("wallet")} className={"flex w-full items-center gap-3 rounded-2xl border p-3 text-left " + (method === "wallet" ? "border-emerald-300 bg-emerald-400/10" : "border-white/10 bg-white/[0.03]")}>
              <WalletCards size={20} className="text-emerald-300" />
              <span className="flex-1"><span className="block text-sm font-semibold">Pay with UniquePay Wallet</span><span className="block text-[11px] text-slate-400">Fastest • authorize with your 4-digit PIN</span></span>
              {method === "wallet" && <Check size={17} className="text-emerald-300" />}
            </button>
            <button type="button" onClick={() => setMethod("bank")} className={"flex w-full items-center gap-3 rounded-2xl border p-3 text-left " + (method === "bank" ? "border-emerald-300 bg-emerald-400/10" : "border-white/10 bg-white/[0.03]")}>
              <Building2 size={20} className="text-emerald-300" />
              <span className="flex-1"><span className="block text-sm font-semibold">Pay by Bank Transfer</span><span className="block text-[11px] text-slate-400">Generate a temporary account for this invoice</span></span>
              {method === "bank" && <Check size={17} className="text-emerald-300" />}
            </button>
          </div>

          <button type="button" onClick={() => setShowConfirm(true)} className="mt-5 w-full rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-emerald-950/40">
            Continue • {money(selected.price)}
          </button>

          <div className="mt-3 text-center text-[10px] text-slate-500">Secure payment • No card details required for UniquePay Wallet</div>
        </section>

        {showConfirm && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 sm:items-center">
            <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900 p-5 shadow-2xl">
              <div className="text-xs text-emerald-300">Payment invoice</div>
              <h2 className="mt-1 text-xl font-bold">Unique AI Premium</h2>
              <div className="mt-4 flex items-center justify-between rounded-2xl bg-white/[0.05] p-4">
                <span className="text-sm text-slate-300">{selected.label}</span>
                <span className="text-xl font-bold">{money(selected.price)}</span>
              </div>
              {method === "wallet" ? (
                <p className="mt-4 text-sm text-slate-300">Next: verify your existing UniquePay Transaction PIN, then activate Premium immediately after the wallet debit is confirmed.</p>
              ) : (
                <p className="mt-4 text-sm text-slate-300">Next: create a temporary account tied to this invoice. Premium activates automatically after the transfer is confirmed.</p>
              )}
              <div className="mt-5 flex gap-2">
                <button type="button" onClick={() => setShowConfirm(false)} className="flex-1 rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold">Back</button>
                <button type="button" onClick={() => setShowConfirm(false)} className="flex-1 rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-bold text-slate-950">{method === "wallet" ? "Authorize with PIN" : "Generate account"}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
