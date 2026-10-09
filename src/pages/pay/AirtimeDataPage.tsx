import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, PhoneCall, Wifi, ShieldCheck, LockKeyhole, RefreshCw } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

type Service = "data" | "airtime";
type DataPlan = { network: string; name: string; bundleId: number; priceNaira: number; priceMinor: number };
type AirtimeNetwork = { network: string; providerId: number };
type Catalog = { dataPlans: DataPlan[]; airtimeNetworks: AirtimeNetwork[]; source: string; fetchedAt: string };
export default function AirtimeDataPage() {
  const { currentUser } = useAuth();
  const [searchParams] = useSearchParams();
  const [service, setService] = useState<Service>(searchParams.get("service") === "airtime" ? "airtime" : "data");
  const [phone, setPhone] = useState("");
  const [network, setNetwork] = useState("");
  const [amount, setAmount] = useState("");
  const [bundleId, setBundleId] = useState("");
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState("");
  const [message, setMessage] = useState("");

  const loadCatalog = async () => {
    if (!currentUser) { setCatalogError("Sign in to load the provider's current plan catalogue."); return; }
    setCatalogLoading(true);
    setCatalogError("");
    try {
      const response = await fetch("/api/cheapdatahub/vtu/catalog", { headers: { Authorization: "Bearer " + await currentUser.getIdToken(), Accept: "application/json" } });
      const payload = await response.json().catch(() => null);
      if (!response.ok || payload?.ok !== true || !Array.isArray(payload.dataPlans) || !Array.isArray(payload.airtimeNetworks)) {
        throw new Error(payload?.message || "The live provider catalogue could not be loaded.");
      }
      setCatalog(payload as Catalog);
    } catch (error) {
      setCatalogError(error instanceof Error ? error.message : "The live provider catalogue could not be loaded.");
      setCatalog(null);
    } finally { setCatalogLoading(false); }
  };

  useEffect(() => { if (currentUser) void loadCatalog(); }, [currentUser]);
  const availablePlans = useMemo(() => (catalog?.dataPlans ?? []).filter(plan => plan.network.toLowerCase() === network.toLowerCase()), [catalog, network]);
  const selectedPlan = availablePlans.find(plan => String(plan.bundleId) === bundleId);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setMessage("The live catalogue is loaded, but purchase submission remains disabled until the provider's idempotency/transaction-reference contract and UniquePay debit/refund reconciliation are verified. No money was taken and no provider purchase was submitted.");
  };

  return <main className="mx-auto max-w-2xl space-y-5 pb-12">
    <Link to="/os/pay" className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-emerald-700"><ArrowLeft className="h-4 w-4" /> Back to UniquePay</Link>
    <section className="overflow-hidden rounded-3xl bg-slate-950 p-6 text-white shadow-xl sm:p-8"><div className="flex items-center gap-3"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-400 text-slate-950">{service === "data" ? <Wifi className="h-6 w-6" /> : <PhoneCall className="h-6 w-6" />}</span><div><p className="text-xs font-black uppercase tracking-[.2em] text-emerald-300">UniquePay</p><h1 className="text-2xl font-black">{service === "data" ? "Buy Data" : "Buy Airtime"}</h1></div></div><p className="mt-3 text-sm leading-6 text-slate-300">Provider-sourced network and data-plan details are loaded from CheapDataHub's published catalogue. Live purchases remain locked until settlement safeguards are verified.</p></section>
    <form onSubmit={submit} className="space-y-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      <div className="grid grid-cols-2 gap-3"><button type="button" onClick={() => { setService("data"); setMessage(""); }} className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-sm font-bold ${service === "data" ? "border-emerald-600 bg-emerald-50 text-emerald-800" : "border-slate-200 text-slate-600"}`}><Wifi className="h-4 w-4" /> Buy Data</button><button type="button" onClick={() => { setService("airtime"); setMessage(""); }} className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-sm font-bold ${service === "airtime" ? "border-emerald-600 bg-emerald-50 text-emerald-800" : "border-slate-200 text-slate-600"}`}><PhoneCall className="h-4 w-4" /> Buy Airtime</button></div>
      <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3"><div className="text-xs text-slate-600">{catalog ? `Catalogue updated ${new Date(catalog.fetchedAt).toLocaleString()}` : "Live provider catalogue"}</div><button type="button" onClick={() => void loadCatalog()} disabled={!currentUser || catalogLoading} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-50"><RefreshCw className={catalogLoading ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} /> Refresh</button></div>
      {catalogLoading && <p className="text-sm text-slate-500">Loading provider catalogue…</p>}
      {catalogError && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{catalogError}</p>}
      {!currentUser && <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Sign in to load live provider plans and networks.</p>}
      <label className="block text-sm font-semibold text-slate-700">Mobile network<select required value={network} onChange={e => { setNetwork(e.target.value); setBundleId(""); setMessage(""); }} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-sm"><option value="">Select network</option>{(catalog?.airtimeNetworks ?? []).map(item => <option key={item.network} value={item.network}>{item.network}</option>)}</select></label>
      <label className="block text-sm font-semibold text-slate-700">Phone number<input required inputMode="tel" autoComplete="tel" minLength={10} maxLength={15} value={phone} onChange={e => setPhone(e.target.value.replace(/[^+0-9]/g, ""))} placeholder="e.g. 08012345678" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3.5 text-sm" /></label>
      {service === "airtime" ? <label className="block text-sm font-semibold text-slate-700">Amount (₦)<input required inputMode="decimal" type="number" min="50" max="50000" step="1" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Enter airtime amount" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3.5 text-sm" /></label> : <label className="block text-sm font-semibold text-slate-700">Data bundle<select required value={bundleId} onChange={e => { setBundleId(e.target.value); setMessage(""); }} disabled={!network || availablePlans.length === 0} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-sm disabled:bg-slate-100"><option value="">{network ? (availablePlans.length ? "Select a data bundle" : "No available bundles for this network") : "Select network first"}</option>{availablePlans.map(plan => <option key={plan.bundleId} value={String(plan.bundleId)}>{plan.name} — ₦{plan.priceNaira.toLocaleString("en-NG")}</option>)}</select>{selectedPlan && <p className="mt-2 text-xs text-slate-500">Published price: ₦{selectedPlan.priceNaira.toLocaleString("en-NG")} · Provider bundle ID: {selectedPlan.bundleId}</p>}</label>}
      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><LockKeyhole className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="font-bold">Purchase submission remains locked</p><p className="mt-1 text-xs leading-5">CheapDataHub documents a live purchase API but no public sandbox, and its published purchase payload does not document a client idempotency reference. We will not risk duplicate charges or an untraceable debit while that contract is unresolved.</p></div></div>
      <button type="submit" disabled={!catalog || !network || !phone || (service === "data" ? !selectedPlan : !amount)} className="w-full rounded-xl bg-slate-900 px-4 py-3.5 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-50">Review purchase readiness</button>
      {message && <div role="status" aria-live="polite" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{message}</div>}
    </form>
    <div className="flex items-start gap-3 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-900"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" /><p>Never enter your UniquePay Transaction PIN on an unverified screen. PIN authorization belongs in the server-backed purchase confirmation step.</p></div>
    {catalog?.source && <p className="text-xs text-slate-500">Catalogue source: <a href={catalog.source} target="_blank" rel="noreferrer" className="underline">CheapDataHub published plan IDs</a>. Live purchase APIs are not called from this screen.</p>}
  </main>;
}
