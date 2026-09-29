import { useState } from "react";
import { Link } from "react-router-dom";
import { CalendarClock, CheckCircle2, CircleDollarSign, Plus, ShieldCheck, Users, WalletCards } from "lucide-react";

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
  const [amount, setAmount] = useState("");
  const [members, setMembers] = useState("5");
  const [frequency, setFrequency] = useState("monthly");
  const valid = Number(amount) > 0 && Number(members) >= 2;

  return (
    <div className="space-y-6 pb-12">
      <section className="rounded-3xl bg-slate-950 p-6 text-white">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl bg-emerald-400/15 p-3"><CircleDollarSign className="h-7 w-7 text-emerald-300" /></div>
          <div><p className="text-sm font-medium text-emerald-300">UniquePay Savings</p><h1 className="mt-1 text-2xl font-bold">Cycle Ajo</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Create a transparent contribution cycle for a trusted group. Money movement and payouts stay disabled until the required regulated payment integration is connected.</p>
          </div>
        </div>
      </section>

      {created && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">Cycle plan created locally for review. No money was moved and no payout was executed.</div>}

      <section className="grid gap-4 md:grid-cols-3">
        {[
          [Users, "Group", "Invite members and define who can manage the cycle."],
          [CalendarClock, "Schedule", "Set contribution frequency and payout sequence."],
          [ShieldCheck, "Controls", "Require clear rules and an auditable ledger before activation."],
        ].map(([Icon, title, text]) => { const C = Icon as typeof Users; return <div key={String(title)} className="rounded-2xl border border-slate-200 bg-white p-5"><C className="h-5 w-5 text-emerald-600" /><h2 className="mt-3 font-semibold text-slate-900">{String(title)}</h2><p className="mt-1 text-sm leading-5 text-slate-500">{String(text)}</p></div>; })}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">Build a cycle</h2>
        <p className="mt-1 text-sm text-slate-500">This creates the cycle definition first; activation will require the payment-provider layer.</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <label className="text-sm font-medium text-slate-700">Contribution per member (₦)<input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="10000" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none focus:border-emerald-500" /></label>
          <label className="text-sm font-medium text-slate-700">Members<input inputMode="numeric" value={members} onChange={(e) => setMembers(e.target.value)} min="2" type="number" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none focus:border-emerald-500" /></label>
          <label className="text-sm font-medium text-slate-700">Frequency<select value={frequency} onChange={(e) => setFrequency(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal"><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="custom">Custom</option></select></label>
        </div>
        <button type="button" disabled={!valid} onClick={() => setCreated(true)} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"><Plus className="h-4 w-4" /> Create cycle plan</button>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6"><div className="flex items-center gap-2"><WalletCards className="h-5 w-5 text-slate-700" /><h2 className="font-semibold text-slate-900">Cycle rules we will enforce</h2></div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">{rules.map(([title, text]) => <div key={title} className="rounded-xl bg-slate-50 p-4"><p className="text-sm font-semibold text-slate-900">{title}</p><p className="mt-1 text-sm text-slate-500">{text}</p></div>)}</div>
      </section>

      <div className="flex flex-wrap gap-3"><Link to="/os/pay" className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">Back to UniquePay</Link><Link to="/os/pay/verification" className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white"><CheckCircle2 className="h-4 w-4" /> Verification Center</Link></div>
    </div>
  );
}
