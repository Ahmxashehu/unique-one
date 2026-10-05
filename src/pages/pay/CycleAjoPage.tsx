import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CalendarClock, Check, CheckCircle2, CircleDollarSign, Clock3, Plus, ShieldCheck, Sparkles, Users, WalletCards } from "lucide-react";

const rules = [
  ["Contribution amount", "Set a fixed amount per member"],
  ["Frequency", "Weekly, monthly or custom schedule"],
  ["Members", "Invite people by Unique ID or phone"],
  ["Payout order", "Agree and record the order before activation"],
  ["Missed contribution", "Record as pending; apply only documented cycle rules"],
  ["Ledger", "Every contribution and payout must have a traceable reference"],
];

export default function CycleAjoPage() {
  const [created, setCreated] = useState(false);
  const [cycleName, setCycleName] = useState("");
  const [amount, setAmount] = useState("");
  const [members, setMembers] = useState("5");
  const [frequency, setFrequency] = useState("monthly");
  const [startDate, setStartDate] = useState("");
  const [payoutOrder, setPayoutOrder] = useState("fixed");
  const [invite, setInvite] = useState("");
  const [invites, setInvites] = useState<string[]>([]);

  const valid = Number(amount) > 0 && Number(members) >= 2 && cycleName.trim().length >= 2;
  const totalCycle = useMemo(() => Number(amount || 0) * Number(members || 0), [amount, members]);

  const addInvite = () => {
    const value = invite.trim();
    if (!value || invites.includes(value)) return;
    setInvites((current) => [...current, value]);
    setInvite("");
  };

  return (
    <div className="space-y-5 pb-12">
      <section className="relative overflow-hidden rounded-3xl bg-slate-950 p-5 text-white shadow-[0_16px_50px_rgba(15,23,42,0.18)] sm:p-7">
        <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-emerald-400/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 left-1/3 h-32 w-56 rounded-full bg-teal-400/10 blur-3xl" />
        <div className="relative flex items-start gap-3 sm:gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-400/15 ring-1 ring-emerald-300/15">
            <CircleDollarSign className="h-6 w-6 text-emerald-300" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300">UniquePay • Community Savings</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">Unique Cycle / Aju</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Organise trusted rotating contributions with clear rules, members, schedules and a visible payout order.</p>
          </div>
        </div>
        <div className="relative mt-5 grid grid-cols-3 gap-2">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3"><p className="text-[10px] text-slate-400">Members</p><p className="mt-1 font-black">{members}</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3"><p className="text-[10px] text-slate-400">Per round</p><p className="mt-1 font-black">₦{totalCycle.toLocaleString()}</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3"><p className="text-[10px] text-slate-400">Frequency</p><p className="mt-1 font-black capitalize">{frequency}</p></div>
        </div>
      </section>

      {created && (
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
          <div><p className="font-black">Cycle plan ready for review</p><p className="mt-0.5 text-xs leading-5">No money moved and no payout was executed. The payment-provider layer must be connected before activation.</p></div>
        </div>
      )}

      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div><p className="text-[10px] font-black uppercase tracking-[0.15em] text-emerald-600">Step 1</p><h2 className="mt-1 text-lg font-black text-slate-900">Create your cycle</h2><p className="mt-1 text-xs leading-5 text-slate-500">Set the agreement before inviting people or collecting money.</p></div>
          <span className="hidden rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black text-emerald-700 sm:block">PLAN FIRST</span>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="text-xs font-bold text-slate-700">Cycle name<input value={cycleName} onChange={(e) => setCycleName(e.target.value)} placeholder="e.g. Family Aju 2026" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-normal outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" /></label>
          <label className="text-xs font-bold text-slate-700">Contribution per member (₦)<input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="10000" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-normal outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" /></label>
          <label className="text-xs font-bold text-slate-700">Number of members<input inputMode="numeric" value={members} onChange={(e) => setMembers(e.target.value)} min="2" type="number" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-normal outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" /></label>
          <label className="text-xs font-bold text-slate-700">Contribution frequency<select value={frequency} onChange={(e) => setFrequency(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-normal"><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="custom">Custom schedule</option></select></label>
          <label className="text-xs font-bold text-slate-700">Start date<input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-normal outline-none focus:border-emerald-500" /></label>
          <label className="text-xs font-bold text-slate-700">Payout order<select value={payoutOrder} onChange={(e) => setPayoutOrder(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-normal"><option value="fixed">Fixed agreed order</option><option value="organizer">Organizer-defined order</option><option value="random">Randomised order</option></select></label>
        </div>

        <div className="mt-5 rounded-2xl bg-slate-50 p-4">
          <div className="flex items-center gap-2"><Users className="h-4 w-4 text-emerald-600" /><p className="text-xs font-black text-slate-900">Invite members</p></div>
          <div className="mt-3 flex gap-2">
            <input value={invite} onChange={(e) => setInvite(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addInvite(); } }} placeholder="Unique ID or phone number" className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500" />
            <button type="button" onClick={addInvite} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-slate-950 px-3 py-2.5 text-xs font-black text-white"><Plus className="h-3.5 w-3.5" /> Add</button>
          </div>
          {invites.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{invites.map((item) => <span key={item} className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[11px] font-bold text-slate-700 ring-1 ring-slate-200"><Check className="h-3 w-3 text-emerald-600" />{item}</span>)}</div>}
        </div>

        <button type="button" disabled={!valid} onClick={() => setCreated(true)} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3.5 text-sm font-black text-white shadow-[0_8px_24px_rgba(16,185,129,0.22)] transition hover:bg-emerald-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"><Plus className="h-4 w-4" /> Create cycle plan <ArrowRight className="h-4 w-4" /></button>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        {[
          [Users, "Members", "Invite by Unique ID or phone and keep the group visible."],
          [CalendarClock, "Schedule", "Set contribution timing and payout sequence."],
          [ShieldCheck, "Controls", "Keep rules and every future payment traceable."],
        ].map(([Icon, title, text]) => { const C = Icon as typeof Users; return <div key={String(title)} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><C className="h-5 w-5 text-emerald-600" /><h2 className="mt-2 font-black text-slate-900">{String(title)}</h2><p className="mt-1 text-xs leading-5 text-slate-500">{String(text)}</p></div>; })}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex items-center gap-2"><WalletCards className="h-5 w-5 text-slate-700" /><h2 className="font-black text-slate-900">Cycle rules</h2></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">{rules.map(([title, text]) => <div key={title} className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-black text-slate-900">{title}</p><p className="mt-1 text-xs leading-5 text-slate-500">{text}</p></div>)}</div>
      </section>

      <div className="flex flex-wrap gap-2">
        <Link to="/os/pay" className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-black text-slate-700">Back to UniquePay</Link>
        <Link to="/os/pay/verification" className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-xs font-black text-white"><CheckCircle2 className="h-4 w-4" /> Verification Center</Link>
      </div>

      <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <div><p className="text-xs font-black text-amber-900">Safe activation</p><p className="mt-1 text-[11px] leading-5 text-amber-800">This planning stage does not move funds. Live contributions and payouts will only be enabled after the appropriate regulated payment integration is connected.</p></div>
      </div>
    </div>
  );
}
