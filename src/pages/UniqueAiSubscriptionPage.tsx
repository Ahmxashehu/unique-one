import { useEffect, useState } from "react";
import { Check, ChevronLeft, WalletCards, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const PLANS = [
  { id: "day", label: "1 Day", price: 180, note: "Quick access" },
  { id: "three-days", label: "3 Days", price: 450, note: "Save ₦90" },
  { id: "week", label: "7 Days", price: 900, note: "Save ₦360" },
  { id: "month", label: "30 Days", price: 2700, note: "Best value" },
  { id: "year", label: "1 Year", price: 27000, note: "Biggest saving" },
] as const;

export default function UniqueAiSubscriptionPage() {
  const { currentUser } = useAuth();
  const [selectedId, setSelectedId] = useState<(typeof PLANS)[number]["id"]>("month");
  const [balance, setBalance] = useState<number | null>(null);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [loadingBalance, setLoadingBalance] = useState(false);

  const selected = PLANS.find((plan) => plan.id === selectedId) ?? PLANS[3];

  useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;
    setLoadingBalance(true);
    currentUser.getIdToken().then((token) =>
      fetch("/api/wallet", { headers: { Authorization: `Bearer ${token}` } })
    ).then(async (response) => {
      if (!response.ok) return null;
      return response.json();
    }).then((data) => {
      if (!cancelled && Number.isSafeInteger(data?.availableBalanceMinor)) {
        setBalance(data.availableBalanceMinor / 100);
      }
    }).catch(() => undefined).finally(() => {
      if (!cancelled) setLoadingBalance(false);
    });
    return () => { cancelled = true; };
  }, [currentUser]);

  if (!currentUser) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-8 text-white">
        <div className="mx-auto max-w-md rounded-3xl border border-white/10 bg-white/5 p-6 text-center">
          <h1 className="text-xl font-black">Unique AI Premium</h1>
          <p className="mt-2 text-sm text-slate-300">Register or sign in to subscribe and pay from your UniquePay wallet.</p>
          <Link to="/login" className="mt-5 inline-flex rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-black text-slate-950">Sign in</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-3 py-4 text-white">
      <div className="mx-auto max-w-md">
        <Link to="/ai" className="mb-4 inline-flex items-center gap-1 text-xs font-bold text-emerald-300">
          <ChevronLeft className="h-4 w-4" /> Back to Unique AI
        </Link>

        <section className="rounded-[28px] border border-emerald-400/20 bg-gradient-to-br from-emerald-950 via-slate-900 to-slate-950 p-5 shadow-2xl">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-400/15 text-emerald-300">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300">Unique AI</p>
              <h1 className="text-xl font-black">Premium Access</h1>
            </div>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-300">Extended AI access for documents, quotations, reports, business help and everyday work.</p>
        </section>

        <section className="mt-4 grid grid-cols-2 gap-2">
          {PLANS.map((plan) => {
            const active = plan.id === selectedId;
            return (
              <button key={plan.id} type="button" onClick={() => setSelectedId(plan.id)}
                className={`rounded-2xl border p-3 text-left transition ${active ? "border-emerald-400 bg-emerald-400/10" : "border-white/10 bg-white/5"}`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black">{plan.label}</span>
                  {active && <Check className="h-4 w-4 text-emerald-300" />}
                </div>
                <div className="mt-2 text-lg font-black">₦{plan.price.toLocaleString()}</div>
                <div className="mt-0.5 text-[10px] text-slate-400">{plan.note}</div>
              </button>
            );
          })}
        </section>

        <section className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300">UniquePay wallet</span>
            <WalletCards className="h-4 w-4 text-emerald-300" />
          </div>
          <div className="mt-2 text-xl font-black">
            {loadingBalance ? "Checking…" : balance === null ? "—" : `₦${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          </div>
        </section>

        <button type="button" onClick={() => setInvoiceOpen(true)}
          className="mt-4 w-full rounded-2xl bg-emerald-400 px-5 py-3.5 text-sm font-black text-slate-950 shadow-lg shadow-emerald-950/30">
          Create ₦{selected.price.toLocaleString()} Subscription Invoice
        </button>

        <p className="mt-3 text-center text-[10px] leading-5 text-slate-500">
          Payment will require your existing 4-digit UniquePay Transaction PIN. No PIN is stored in this page.
        </p>

        {invoiceOpen && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4">
            <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-slate-900 p-5 shadow-2xl">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300">Subscription Invoice</p>
              <h2 className="mt-1 text-xl font-black">Unique AI Premium</h2>
              <div className="mt-4 rounded-2xl bg-white/5 p-4">
                <div className="flex justify-between text-sm"><span>{selected.label}</span><strong>₦{selected.price.toLocaleString()}</strong></div>
                <div className="mt-2 text-xs text-slate-400">Payment method: UniquePay Wallet</div>
              </div>
              <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-400/5 p-3 text-xs leading-5 text-slate-300">
                The wallet authorization screen will be connected only after the Unique One subscription settlement account is configured. This prevents any charge from going to an unverified destination.
              </div>
              <div className="mt-4 flex gap-2">
                <button type="button" onClick={() => setInvoiceOpen(false)} className="flex-1 rounded-xl border border-white/10 px-4 py-3 text-xs font-black">Close</button>
                <Link to="/os/pay" className="flex-1 rounded-xl bg-emerald-400 px-4 py-3 text-center text-xs font-black text-slate-950">Open UniquePay</Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
