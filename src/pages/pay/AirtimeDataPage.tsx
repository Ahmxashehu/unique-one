import React, { useState } from "react";
import { ArrowLeft, PhoneCall, Wifi, ShieldCheck, LockKeyhole } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
type Service = "data" | "airtime";
export default function AirtimeDataPage() {
  const [searchParams] = useSearchParams();
  const [service, setService] = useState<Service>(searchParams.get("service") === "airtime" ? "airtime" : "data");
  const [phone, setPhone] = useState("");
  const [network, setNetwork] = useState("");
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setMessage("Purchase is not enabled yet. No wallet debit or provider request was made. The live provider purchase and refund-reconciliation flow still needs to be connected and verified.");
  };
  return <main className="mx-auto max-w-2xl space-y-5 pb-12">
    <Link to="/os/pay" className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-emerald-700"><ArrowLeft className="h-4 w-4" /> Back to UniquePay</Link>
    <section className="overflow-hidden rounded-3xl bg-slate-950 p-6 text-white shadow-xl sm:p-8"><div className="flex items-center gap-3"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-400 text-slate-950">{service === "data" ? <Wifi className="h-6 w-6" /> : <PhoneCall className="h-6 w-6" />}</span><div><p className="text-xs font-black uppercase tracking-[.2em] text-emerald-300">UniquePay</p><h1 className="text-2xl font-black">{service === "data" ? "Buy Data" : "Buy Airtime"}</h1></div></div><p className="mt-3 text-sm leading-6 text-slate-300">Enter recipient details below. Live purchases will only be enabled after secure wallet debit, provider confirmation, duplicate protection and failure reconciliation are verified.</p></section>
    <form onSubmit={submit} className="space-y-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      <div className="grid grid-cols-2 gap-3"><button type="button" onClick={() => { setService("data"); setMessage(""); }} className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-sm font-bold ${service === "data" ? "border-emerald-600 bg-emerald-50 text-emerald-800" : "border-slate-200 text-slate-600"}`}><Wifi className="h-4 w-4" /> Buy Data</button><button type="button" onClick={() => { setService("airtime"); setMessage(""); }} className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-sm font-bold ${service === "airtime" ? "border-emerald-600 bg-emerald-50 text-emerald-800" : "border-slate-200 text-slate-600"}`}><PhoneCall className="h-4 w-4" /> Buy Airtime</button></div>
      <label className="block text-sm font-semibold text-slate-700">Mobile network<select required value={network} onChange={e => setNetwork(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-sm"><option value="">Select network</option><option value="MTN">MTN</option><option value="Airtel">Airtel</option><option value="Glo">Glo</option><option value="9mobile">9mobile</option></select></label>
      <label className="block text-sm font-semibold text-slate-700">Phone number<input required inputMode="tel" autoComplete="tel" minLength={10} maxLength={15} value={phone} onChange={e => setPhone(e.target.value.replace(/[^+0-9]/g, ""))} placeholder="e.g. 08012345678" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3.5 text-sm" /></label>
      {service === "airtime" ? <label className="block text-sm font-semibold text-slate-700">Amount (₦)<input required inputMode="decimal" type="number" min="50" max="50000" step="1" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Enter airtime amount" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3.5 text-sm" /></label> : <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">Live data bundle catalogue and prices will load from the provider when its purchase API and wallet settlement checks are connected. No sample plans or prices are shown.</div>}
      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><LockKeyhole className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="font-bold">Live purchase not enabled</p><p className="mt-1 text-xs leading-5">This form collects input only. It does not charge your wallet, contact the provider, or claim a recharge succeeded.</p></div></div>
      <button type="submit" className="w-full rounded-xl bg-slate-900 px-4 py-3.5 text-sm font-bold text-white hover:bg-slate-800">Check purchase readiness</button>
      {message && <div role="status" aria-live="polite" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{message}</div>}
    </form>
    <div className="flex items-start gap-3 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-900"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" /><p>Never enter your UniquePay Transaction PIN on an unverified screen. PIN authorization belongs in the server-backed purchase confirmation step.</p></div>
  </main>;
}
