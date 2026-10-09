import React, { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Cable, CheckCircle2, FileCheck2, Loader2, LockKeyhole, PlugZap, RefreshCw, ShieldCheck, Tv, Zap } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";

type Service = "electricity" | "cable" | "exam";
type ApiResult = { ok?: boolean; message?: string; code?: string; data?: unknown };

const SERVICE_META: Array<{ id: Service; title: string; description: string; icon: React.ElementType }> = [
  { id: "electricity", title: "Electricity", description: "Validate a prepaid or postpaid meter before payment.", icon: PlugZap },
  { id: "cable", title: "Cable TV", description: "Validate a DStv, GOtv, or StarTimes smartcard/IUC.", icon: Tv },
  { id: "exam", title: "Exam PIN", description: "Load available WAEC, NECO, and other supported exam PIN products.", icon: FileCheck2 },
];

function getProductRows(value: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(value)) return value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"));
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["products", "items", "results", "data"]) {
      if (Array.isArray(record[key])) return (record[key] as unknown[]).filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"));
    }
  }
  return [];
}

function prettyLabel(value: string) {
  return value.replace(/([A-Z])/g, " $1").replace(/[_-]+/g, " ").replace(/^./, (letter) => letter.toUpperCase());
}

export default function CheapDataHubBillsPage() {
  const { currentUser } = useAuth();
  const [searchParams] = useSearchParams();
  const [electricity, setElectricity] = useState({ discoId: "", meterType: "prepaid", meterNumber: "" });
  const [cable, setCable] = useState({ planId: "", smartCardNumber: "" });
  const [examProducts, setExamProducts] = useState<unknown>(null);
  const [examLoading, setExamLoading] = useState(false);
  const [validating, setValidating] = useState<Service | null>(null);
  const [results, setResults] = useState<Partial<Record<Service, ApiResult>>>({});
  const [pageError, setPageError] = useState("");

  const requestedService = searchParams.get("service");
  const serviceOrder = useMemo(() => {
    const preferred: Service | null = requestedService === "electricity" ? "electricity" : requestedService === "cable" ? "cable" : requestedService === "exam" ? "exam" : null;
    return preferred ? [...SERVICE_META].sort((a, b) => Number(b.id === preferred) - Number(a.id === preferred)) : SERVICE_META;
  }, [requestedService]);

  const authHeaders = async () => {
    if (!currentUser) throw new Error("Sign in to verify provider details.");
    return { Authorization: "Bearer " + await currentUser.getIdToken(), "Content-Type": "application/json", Accept: "application/json" };
  };

  const loadExamProducts = async () => {
    if (!currentUser) return;
    setExamLoading(true);
    setPageError("");
    try {
      const response = await fetch("/api/cheapdatahub/utilities/exam-products", { headers: await authHeaders() });
      const payload = await response.json().catch(() => null) as ApiResult | null;
      if (!response.ok || !payload?.ok) throw new Error(payload?.message || "Exam PIN products could not be loaded.");
      setExamProducts(payload.data ?? []);
      setResults((old) => ({ ...old, exam: { ok: true, message: "CheapDataHub exam product catalogue loaded.", data: payload.data } }));
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Exam PIN products could not be loaded.");
    } finally {
      setExamLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) void loadExamProducts();
  }, [currentUser]);

  const validateElectricity = async (event: React.FormEvent) => {
    event.preventDefault();
    setValidating("electricity");
    setResults((old) => ({ ...old, electricity: undefined }));
    try {
      const response = await fetch("/api/cheapdatahub/utilities/electricity/validate", {
        method: "POST", headers: await authHeaders(),
        body: JSON.stringify({ disco_id: Number(electricity.discoId), meter_type: electricity.meterType, meter_number: electricity.meterNumber.trim() }),
      });
      const payload = await response.json() as ApiResult;
      setResults((old) => ({ ...old, electricity: { ...payload, ok: response.ok && payload.ok === true } }));
    } catch (error) {
      setResults((old) => ({ ...old, electricity: { ok: false, message: error instanceof Error ? error.message : "Meter validation failed." } }));
    } finally { setValidating(null); }
  };

  const validateCable = async (event: React.FormEvent) => {
    event.preventDefault();
    setValidating("cable");
    setResults((old) => ({ ...old, cable: undefined }));
    try {
      const response = await fetch("/api/cheapdatahub/utilities/cable/validate", {
        method: "POST", headers: await authHeaders(),
        body: JSON.stringify({ plan_id: Number(cable.planId), smart_card_number: cable.smartCardNumber.trim() }),
      });
      const payload = await response.json() as ApiResult;
      setResults((old) => ({ ...old, cable: { ...payload, ok: response.ok && payload.ok === true } }));
    } catch (error) {
      setResults((old) => ({ ...old, cable: { ok: false, message: error instanceof Error ? error.message : "Smartcard validation failed." } }));
    } finally { setValidating(null); }
  };

  const renderResult = (service: Service) => {
    const result = results[service];
    if (!result) return null;
    const customer = result.data && typeof result.data === "object" ? result.data as Record<string, unknown> : null;
    return (
      <div role="status" aria-live="polite" className={`mt-4 rounded-xl border p-3 text-sm ${result.ok ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
        <div className="flex items-center gap-2 font-bold">{result.ok ? <CheckCircle2 className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}{result.message || (result.ok ? "Provider verified." : "Provider check did not complete.")}</div>
        {customer && Object.entries(customer).map(([key, value]) => (
          <p key={key} className="mt-1"><span className="font-semibold">{prettyLabel(key)}:</span> {typeof value === "string" || typeof value === "number" ? String(value) : JSON.stringify(value)}</p>
        ))}
        <p className="mt-2 text-xs opacity-80">Validation only. No money was taken and no service was purchased.</p>
      </div>
    );
  };

  const productRows = getProductRows(examProducts);

  return (
    <main className="mx-auto max-w-4xl space-y-5 pb-12">
      <section className="overflow-hidden rounded-3xl bg-slate-950 p-5 text-white shadow-xl sm:p-7">
        <div className="flex items-center gap-3"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-400 text-slate-950"><Zap className="h-6 w-6" /></span><div><p className="text-xs font-black uppercase tracking-[.2em] text-emerald-300">UniquePay · Bills & education</p><h1 className="mt-1 text-2xl font-black">Electricity, Cable TV & Exam PIN</h1></div></div>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">Provider-connected checks powered by CheapDataHub. Verify meter and smartcard details, or load the live exam PIN catalogue, before any payment flow is enabled.</p>
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-300/20 bg-amber-300/10 p-3 text-xs leading-5 text-amber-100"><LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" /><span>Live purchases remain locked until UniquePay wallet debit, idempotency, transaction status, and failure/refund reconciliation are implemented and tested. This page does not debit either wallet.</span></div>
      </section>

      {!currentUser && <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><p className="text-sm font-bold text-emerald-900">You can explore this page as a guest.</p><p className="mt-1 text-sm text-emerald-800">Sign in to run provider validation or load the account-specific catalogue.</p><Link to="/login" className="mt-3 inline-flex rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white">Sign in to verify</Link></section>}

      {serviceOrder.map(({ id, title, description, icon: Icon }) => (
        <section key={id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-start gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><Icon className="h-5 w-5" /></span><div className="min-w-0 flex-1"><h2 className="text-lg font-black text-slate-900">{title}</h2><p className="mt-1 text-sm text-slate-500">{description}</p></div><span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-black text-amber-800">Purchase locked</span></div>

          {id === "electricity" && <form onSubmit={validateElectricity} className="mt-5 grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-bold text-slate-700">DisCo ID <input required inputMode="numeric" pattern="[0-9]+" value={electricity.discoId} onChange={(e) => setElectricity({ ...electricity, discoId: e.target.value.replace(/\D/g, "") })} placeholder="From CheapDataHub Plan IDs" className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm font-medium" /></label>
            <label className="text-xs font-bold text-slate-700">Meter type <select value={electricity.meterType} onChange={(e) => setElectricity({ ...electricity, meterType: e.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-medium"><option value="prepaid">Prepaid</option><option value="postpaid">Postpaid</option></select></label>
            <label className="text-xs font-bold text-slate-700 sm:col-span-2">Meter number <input required minLength={5} maxLength={30} value={electricity.meterNumber} onChange={(e) => setElectricity({ ...electricity, meterNumber: e.target.value.replace(/[^a-zA-Z0-9-]/g, "") })} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm font-medium" placeholder="Enter meter number" /></label>
            <button disabled={!currentUser || validating !== null} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{validating === "electricity" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Validate meter</button>
            <button type="button" disabled className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-400">Pay electricity · Not enabled</button>
          </form>}

          {id === "cable" && <form onSubmit={validateCable} className="mt-5 grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-bold text-slate-700">Cable plan ID <input required inputMode="numeric" pattern="[0-9]+" value={cable.planId} onChange={(e) => setCable({ ...cable, planId: e.target.value.replace(/\D/g, "") })} placeholder="From CheapDataHub Plan IDs" className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm font-medium" /></label>
            <label className="text-xs font-bold text-slate-700">Smartcard / IUC number <input required minLength={5} maxLength={30} value={cable.smartCardNumber} onChange={(e) => setCable({ ...cable, smartCardNumber: e.target.value.replace(/[^a-zA-Z0-9-]/g, "") })} placeholder="Enter decoder number" className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm font-medium" /></label>
            <button disabled={!currentUser || validating !== null} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{validating === "cable" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Validate smartcard</button>
            <button type="button" disabled className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-400">Subscribe · Not enabled</button>
          </form>}

          {id === "exam" && <div className="mt-5">
            <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-slate-600">Products are retrieved from CheapDataHub, not sample inventory.</p><button type="button" onClick={() => void loadExamProducts()} disabled={!currentUser || examLoading} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-50"><RefreshCw className={examLoading ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} /> Refresh catalogue</button></div>
            {examLoading && <p className="mt-3 text-sm text-slate-500">Loading provider catalogue…</p>}
            {!examLoading && currentUser && productRows.length === 0 && <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-500">No product list was returned in the expected format. Check provider response or retry.</p>}
            {productRows.length > 0 && <div className="mt-3 space-y-2">{productRows.map((product, index) => <div key={String(product.id ?? product.product_id ?? index)} className="flex flex-col gap-3 rounded-xl border border-slate-200 p-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-bold text-slate-900">{String(product.name ?? product.title ?? product.exam_name ?? product.product_name ?? "Exam PIN product")}</p><p className="mt-1 text-xs text-slate-500">{Object.entries(product).filter(([key]) => !["name","title","exam_name","product_name"].includes(key)).map(([key,value]) => `${prettyLabel(key)}: ${typeof value === "string" || typeof value === "number" ? value : JSON.stringify(value)}`).join(" · ")}</p></div><button type="button" disabled className="shrink-0 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-400">Buy PIN · Not enabled</button></div>)}</div>}
          </div>}

          {renderResult(id)}
        </section>
      ))}

      <p className="text-xs leading-5 text-slate-500">API credential stays on the server. Validation is authenticated, rate-limited, and uses CheapDataHub's documented non-purchase endpoints. No live purchase has been submitted by this screen.</p>
    </main>
  );
}
