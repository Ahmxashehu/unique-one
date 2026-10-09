import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, CalendarClock, CircleAlert, CircleDollarSign, Loader2, Plus, ShieldCheck, Sparkles, Users, WalletCards } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";

type CycleRecord = {
  id: string;
  name: string;
  contributionAmountMinor: number;
  memberCount: number;
  frequency: "weekly" | "monthly" | "custom";
  currency?: string;
  status: string;
};

const controls = [
  ["Draft storage", "Cycle drafts are saved to the authenticated account."],
  ["Member invitations", "Invitations and member consent are not connected yet."],
  ["Payout order", "A complete agreed payout-order workflow is not available yet."],
  ["Contributions", "No contributions are collected when a draft is created."],
  ["Payouts", "No payouts are initiated from this page."],
  ["Ledger", "Financial activity must be enabled only through a verified payment workflow."],
];

export default function CycleAjoPage() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [cycleName, setCycleName] = useState("");
  const [amount, setAmount] = useState("");
  const [members, setMembers] = useState("5");
  const [frequency, setFrequency] = useState<"weekly" | "monthly" | "custom">("monthly");
  const [cycles, setCycles] = useState<CycleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const amountNaira = Number(amount);
  const memberCount = Number(members);
  const amountMinor = Math.round(amountNaira * 100);
  const amountHasValidPrecision = /^\\d+(?:\\.\\d{1,2})?$/.test(amount.trim());
  const valid = cycleName.trim().length >= 1 && cycleName.trim().length <= 100 &&
    amountHasValidPrecision && Number.isFinite(amountNaira) && amountNaira > 0 && Number.isSafeInteger(amountMinor) &&
    Number.isInteger(memberCount) && memberCount >= 2 && memberCount <= 1000;
  const totalCycle = useMemo(() => amountNaira * memberCount, [amountNaira, memberCount]);

  useEffect(() => {
    let active = true;
    if (!currentUser) {
      setLoading(false);
      return () => { active = false; };
    }
    setLoading(true);
    void (async () => {
      try {
        const token = await currentUser.getIdToken();
        const response = await fetch("/api/ajo/cycles", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data?.error?.message || "Saved cycles could not be loaded.");
        if (active) setCycles(Array.isArray(data?.cycles) ? data.cycles : []);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Saved cycles could not be loaded.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [currentUser]);

  const createCycle = async () => {
    if (!currentUser) {
      navigate("/login", { state: { from: { pathname: "/os/pay/ajo" }, message: "Sign in to save a Cycle Ajo draft." } });
      return;
    }
    if (!valid || saving) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const token = await currentUser.getIdToken();
      const response = await fetch("/api/ajo/cycles", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: cycleName.trim(),
          contributionAmountMinor: amountMinor,
          memberCount,
          frequency,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error?.message || "Cycle Ajo draft could not be saved.");
      const cycle = data?.cycle as CycleRecord | undefined;
      if (!cycle || typeof cycle.id !== "string" || !cycle.id) throw new Error("The server did not confirm a saved cycle record.");
      setCycles(previous => [cycle, ...previous.filter(item => item.id !== cycle.id)]);
      setNotice("Cycle draft saved to your account. No money moved and the cycle is not active.");
      setCycleName("");
      setAmount("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cycle Ajo draft could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 pb-12">
      <section className="relative overflow-hidden rounded-3xl bg-slate-950 p-5 text-white shadow-[0_16px_50px_rgba(15,23,42,0.18)] sm:p-7">
        <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-emerald-400/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 left-1/3 h-32 w-56 rounded-full bg-teal-400/10 blur-3xl" />
        <div className="relative flex items-start gap-3 sm:gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-400/15 ring-1 ring-emerald-300/15"><CircleDollarSign className="h-6 w-6 text-emerald-300" /></div>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300">UniquePay • Community Savings</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">Unique Cycle / Aju</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Save a real cycle draft to your account. This does not activate contributions, member invitations or payouts.</p>
          </div>
        </div>
        <div className="relative mt-5 grid grid-cols-3 gap-2">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3"><p className="text-[10px] text-slate-400">Members planned</p><p className="mt-1 font-black">{memberCount || 0}</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3"><p className="text-[10px] text-slate-400">Planned round</p><p className="mt-1 font-black">₦{Number.isFinite(totalCycle) ? totalCycle.toLocaleString("en-NG") : "0"}</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3"><p className="text-[10px] text-slate-400">Frequency</p><p className="mt-1 font-black capitalize">{frequency}</p></div>
        </div>
      </section>

      {notice && <div role="status" className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="font-black">Draft saved</p><p className="mt-0.5 text-xs leading-5">{notice}</p></div></div>}
      {error && <div role="alert" className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><CircleAlert className="mt-0.5 h-5 w-5 shrink-0" /><p className="text-xs leading-5">{error}</p></div>}

      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div><p className="text-[10px] font-black uppercase tracking-[0.15em] text-emerald-600">Draft setup</p><h2 className="mt-1 text-lg font-black text-slate-900">Define your cycle</h2><p className="mt-1 text-xs leading-5 text-slate-500">Only the fields supported by the saved-draft API are accepted here.</p></div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="text-xs font-bold text-slate-700">Cycle name<input value={cycleName} onChange={e => setCycleName(e.target.value)} maxLength={100} placeholder="e.g. Family Aju" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-normal outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" /></label>
          <label className="text-xs font-bold text-slate-700">Contribution per member (₦)<input inputMode="decimal" type="number" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="10000" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-normal outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" /></label>
          <label className="text-xs font-bold text-slate-700">Number of members<input inputMode="numeric" value={members} onChange={e => setMembers(e.target.value)} min="2" max="1000" type="number" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-normal outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" /></label>
          <label className="text-xs font-bold text-slate-700">Contribution frequency<select value={frequency} onChange={e => setFrequency(e.target.value as "weekly" | "monthly" | "custom")} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-normal"><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="custom">Custom schedule</option></select></label>
        </div>
        <button type="button" disabled={!valid || saving} onClick={createCycle} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3.5 text-sm font-black text-white shadow-[0_8px_24px_rgba(16,185,129,0.22)] transition hover:bg-emerald-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}{saving ? "Saving draft..." : "Save cycle draft"}<ArrowRight className="h-4 w-4" /></button>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex items-center gap-2"><WalletCards className="h-5 w-5 text-slate-700" /><h2 className="font-black text-slate-900">Your saved cycles</h2></div>
        {loading ? <div className="flex items-center gap-2 p-6 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading saved cycles...</div> : cycles.length === 0 ? <p className="mt-3 rounded-xl bg-slate-50 p-4 text-xs leading-5 text-slate-500">No saved cycles found for this account.</p> : <div className="mt-4 space-y-3">{cycles.map(cycle => <article key={cycle.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-sm font-black text-slate-900">{cycle.name}</h3><p className="mt-1 text-xs text-slate-500">{cycle.memberCount} planned members · {cycle.frequency}</p></div><span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-black capitalize text-amber-800">{cycle.status}</span></div><p className="mt-2 text-sm font-black text-slate-900">₦{(Number(cycle.contributionAmountMinor || 0) / 100).toLocaleString("en-NG")} per member</p></article>)}</div>}
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        {[[Users, "Members", "Invitations and member consent are not connected yet."], [CalendarClock, "Schedule", "Only weekly, monthly or custom frequency is stored on a draft."], [ShieldCheck, "Controls", "Contributions and payouts remain disabled until their workflows are verified."]].map(([Icon, title, text]) => { const C = Icon as typeof Users; return <div key={String(title)} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><C className="h-5 w-5 text-emerald-600" /><h2 className="mt-2 font-black text-slate-900">{String(title)}</h2><p className="mt-1 text-xs leading-5 text-slate-500">{String(text)}</p></div>; })}
      </section>

      <section className="rounded-3xl border border-amber-200 bg-amber-50 p-4 shadow-sm sm:p-6">
        <div className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-amber-700" /><h2 className="font-black text-amber-950">Financial safety boundary</h2></div>
        <p className="mt-2 text-xs leading-5 text-amber-900">Creating a draft does not debit a wallet or activate a cycle. Member invitations, agreed payout order, contributions, payment reconciliation and payouts must be implemented and verified before the cycle can be activated.</p>
      </section>

      <div className="flex flex-wrap gap-2"><Link to="/os/pay" className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-black text-slate-700">Back to UniquePay</Link><Link to="/os/pay/verification" className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-xs font-black text-white"><ShieldCheck className="h-4 w-4" /> Verification Center</Link></div>
    </div>
  );
}
