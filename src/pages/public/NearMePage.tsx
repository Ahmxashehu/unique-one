import React, { useCallback, useEffect, useState } from "react";
import { auth } from "../../lib/firebase";
import { Building2, CheckCircle2, CircleAlert, LoaderCircle, PackageSearch, Search, Truck } from "lucide-react";

type Business = { id: string; name: string; description?: string; categories: string[]; address?: string };
type TrackingEvent = { status: string; at?: string };
type Tracking = { trackingId: string; status: string; createdAt?: string; updatedAt?: string; timeline: TrackingEvent[]; liveLocationAvailable: boolean; liveLocationMessage: string };

function readableStatus(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function NearMePage() {
  const [mode, setMode] = useState<"businesses" | "tracking">("businesses");
  const [query, setQuery] = useState("");
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [businessLoading, setBusinessLoading] = useState(false);
  const [businessError, setBusinessError] = useState("");
  const [trackingId, setTrackingId] = useState("");
  const [tracking, setTracking] = useState<Tracking | null>(null);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [trackingError, setTrackingError] = useState("");

  const searchBusinesses = useCallback(async (event?: React.FormEvent) => {
    event?.preventDefault();
    setBusinessLoading(true);
    setBusinessError("");
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      const response = await fetch("/api/discovery/businesses?" + params.toString(), { headers: { Accept: "application/json" } });
      const payload = await response.json().catch(() => null);
      if (!response.ok || payload?.ok !== true || !Array.isArray(payload.businesses)) {
        throw new Error(payload?.error?.message || payload?.message || "Registered business search is temporarily unavailable.");
      }
      setBusinesses(payload.businesses);
      if (!payload.businesses.length) setBusinessError("No matching active, verified UniquePlatform businesses were found. Try another search or check back later.");
    } catch (error) {
      setBusinesses([]);
      setBusinessError(error instanceof Error ? error.message : "Registered business search is temporarily unavailable.");
    } finally {
      setBusinessLoading(false);
    }
  }, [query]);

  useEffect(() => { void searchBusinesses(); }, []); // Load only platform-owned, approved listings on entry.

  const trackOrder = useCallback(async (event?: React.FormEvent) => {
    event?.preventDefault();
    const id = trackingId.trim();
    if (!id) { setTrackingError("Enter your UniquePlatform order ID or tracking number."); return; }
    const user = auth.currentUser;
    if (!user) {
      setTracking(null);
      setTrackingError("Sign in to your registered UniquePlatform account before tracking a shipment.");
      return;
    }
    setTrackingLoading(true);
    setTrackingError("");
    setTracking(null);
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/logistics/track/" + encodeURIComponent(id), {
        headers: { Authorization: "Bearer " + token, Accept: "application/json" },
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || payload?.ok !== true || !payload.tracking) {
        throw new Error(payload?.error?.message || payload?.message || "We could not retrieve this shipment.");
      }
      setTracking(payload.tracking as Tracking);
    } catch (error) {
      setTrackingError(error instanceof Error ? error.message : "Tracking is temporarily unavailable.");
    } finally {
      setTrackingLoading(false);
    }
  }, [trackingId]);

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl flex-col gap-5 px-4 py-6 sm:px-6">
      <header>
        <p className="mb-2 text-sm font-bold uppercase tracking-[0.14em] text-emerald-700">UniquePlatform</p>
        <h1 className="text-3xl font-black tracking-tight text-slate-900">Businesses & Logistics</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Discover approved businesses registered on UniquePlatform, or track an order linked to your account. External directory listings are not shown here.</p>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <button type="button" onClick={() => setMode("businesses")} aria-pressed={mode === "businesses"} className={`flex min-h-24 items-center gap-3 rounded-2xl border p-4 text-left transition ${mode === "businesses" ? "border-emerald-600 bg-emerald-50 shadow-sm" : "border-slate-200 bg-white hover:border-slate-300"}`}>
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-emerald-700"><Building2 className="h-5 w-5" /></span>
          <span><span className="block font-bold text-slate-900">Registered businesses</span><span className="mt-1 block text-xs text-slate-500">Approved UniquePlatform listings</span></span>
        </button>
        <button type="button" onClick={() => setMode("tracking")} aria-pressed={mode === "tracking"} className={`flex min-h-24 items-center gap-3 rounded-2xl border p-4 text-left transition ${mode === "tracking" ? "border-emerald-600 bg-emerald-50 shadow-sm" : "border-slate-200 bg-white hover:border-slate-300"}`}>
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-emerald-700"><Truck className="h-5 w-5" /></span>
          <span><span className="block font-bold text-slate-900">Track logistics</span><span className="mt-1 block text-xs text-slate-500">Check your order journey</span></span>
        </button>
      </div>

      {mode === "businesses" ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          <h2 className="text-lg font-bold text-slate-900">Find a registered business</h2>
          <p className="mt-1 text-sm text-slate-500">Only businesses marked active and verified in UniquePlatform records appear.</p>
          <form onSubmit={searchBusinesses} className="mt-4 flex flex-col gap-2 sm:flex-row">
            <div className="flex min-h-11 flex-1 items-center gap-2 rounded-xl border border-slate-200 px-3"><Search className="h-4 w-4 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} maxLength={120} aria-label="Search registered businesses" placeholder="Business name, category, or address" className="w-full bg-transparent text-sm text-slate-900 outline-none" /></div>
            <button type="submit" disabled={businessLoading} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 text-sm font-bold text-white disabled:opacity-60">{businessLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}{businessLoading ? "Searching…" : "Search"}</button>
          </form>
          {businessError && <p role="status" className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">{businessError}</p>}
          <div className="mt-4 space-y-3">
            {businesses.map((business) => <article key={business.id} className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700"><Building2 className="h-5 w-5" /></span><div className="min-w-0 flex-1"><h3 className="font-bold text-slate-900">{business.name}</h3><p className="mt-1 text-xs font-semibold text-emerald-700">Active • Verified on UniquePlatform</p>{business.categories?.length > 0 && <p className="mt-2 text-sm text-slate-600">{business.categories.join(" · ")}</p>}{business.description && <p className="mt-2 text-sm leading-5 text-slate-600">{business.description}</p>}{business.address && <p className="mt-2 text-sm text-slate-500">{business.address}</p>}</div><CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" /></div>
            </article>)}
          </div>
        </section>
      ) : (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          <div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><PackageSearch className="h-5 w-5" /></span><div><h2 className="text-lg font-bold text-slate-900">Track an order or shipment</h2><p className="mt-1 text-sm leading-5 text-slate-500">Any registered user can track an order connected to their account. Use the order ID until a dedicated carrier tracking number is issued.</p></div></div>
          <form onSubmit={trackOrder} className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input value={trackingId} onChange={(event) => setTrackingId(event.target.value)} maxLength={128} aria-label="Order ID or tracking number" placeholder="Enter order ID / tracking number" className="min-h-11 flex-1 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-emerald-600" />
            <button type="submit" disabled={trackingLoading} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 text-sm font-bold text-white disabled:opacity-60">{trackingLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />}{trackingLoading ? "Checking…" : "Track shipment"}</button>
          </form>
          {trackingError && <div role="alert" className="mt-4 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0" /><span>{trackingError}</span></div>}
          {tracking && <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Tracking ID</p><p className="mt-1 break-all font-bold text-slate-900">{tracking.trackingId}</p></div><span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-bold text-emerald-800">{readableStatus(tracking.status)}</span></div>
            <h3 className="mt-5 font-bold text-slate-900">Order journey</h3>
            {tracking.timeline.length ? <ol className="mt-3 space-y-3">{tracking.timeline.map((entry, index) => <li key={entry.status + String(entry.at) + index} className="flex gap-3"><span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-600" /><div><p className="text-sm font-semibold text-slate-800">{readableStatus(entry.status)}</p>{entry.at && <p className="mt-0.5 text-xs text-slate-500">{new Date(entry.at).toLocaleString()}</p>}</div></li>)}</ol> : <p className="mt-2 text-sm text-slate-600">Current status is available, but no status history has been recorded yet.</p>}
            <p className="mt-4 rounded-lg bg-white p-3 text-xs leading-5 text-slate-600">{tracking.liveLocationAvailable ? "Courier location is available." : tracking.liveLocationMessage}</p>
          </div>}
          <p className="mt-4 text-xs leading-5 text-slate-400">For privacy, tracking details are returned only when the signed-in user is the customer, seller, or assigned delivery user on that order. Live courier location is not fabricated.</p>
        </section>
      )}
    </div>
  );
}
