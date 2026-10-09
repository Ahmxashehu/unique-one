import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  Activity, AlertTriangle, BarChart3, Building2, CheckCircle2, ChevronRight,
  CreditCard, Database, FileCheck2, Globe2, LockKeyhole, Package, RefreshCw,
  ShieldCheck, Users, Wallet
} from 'lucide-react';

type Stats = {
  users: number;
  businesses: number;
  products: number;
  transactions: number;
  completedVolumeMinor: number;
  pendingVerification: number;
};

function formatNaira(minor: number) {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 2,
  }).format(minor / 100);
}

export default function SuperAdminDashboardPage() {
  const { currentUser, userData } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [cheapDataHubLoading, setCheapDataHubLoading] = useState(false);
  const [cheapDataHubResult, setCheapDataHubResult] = useState<{
    ok: boolean;
    connection?: string;
    providerBalanceNaira?: number;
    currency?: string;
    checkedAt?: string;
    message?: string;
  } | null>(null);

  const load = async () => {
    if (!currentUser) return;
    setLoading(true);
    setError('');
    try {
      const token = await currentUser.getIdToken();
      const response = await fetch('/api/admin/overview', { headers: { Authorization: 'Bearer ' + token } });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error?.message || 'Unable to load Super Admin platform data.');
      const s = payload.stats;
      setStats({
        users: s.users,
        businesses: s.businesses,
        products: s.products,
        transactions: s.transactions,
        completedVolumeMinor: s.transactionVolumeMinor,
        pendingVerification: s.pendingVerification,
      });
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load Super Admin platform data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [currentUser]);

  const checkCheapDataHub = async () => {
    if (!currentUser || cheapDataHubLoading) return;
    setCheapDataHubLoading(true);
    setCheapDataHubResult(null);
    try {
      const token = await currentUser.getIdToken();
      const response = await fetch('/api/cheapdatahub/connection-check', {
        method: 'GET',
        headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
      });
      const payload = await response.json();
      setCheapDataHubResult({
        ok: Boolean(response.ok && payload?.ok),
        connection: typeof payload?.connection === 'string' ? payload.connection : undefined,
        providerBalanceNaira: Number.isFinite(Number(payload?.providerBalanceNaira)) ? Number(payload.providerBalanceNaira) : undefined,
        currency: typeof payload?.currency === 'string' ? payload.currency : undefined,
        checkedAt: typeof payload?.checkedAt === 'string' ? payload.checkedAt : undefined,
        message: typeof payload?.message === 'string' ? payload.message : 'Connection check returned an unexpected response.',
      });
    } catch {
      setCheapDataHubResult({
        ok: false,
        connection: 'request_failed',
        message: 'Could not complete the connection check. Please retry when the service is available.',
      });
    } finally {
      setCheapDataHubLoading(false);
    }
  };

  const cards = useMemo(() => [
    { label: 'Platform users', value: stats?.users ?? 0, icon: Users, to: '/admin/users' },
    { label: 'Businesses', value: stats?.businesses ?? 0, icon: Building2, to: '/admin/businesses' },
    { label: 'Marketplace products', value: stats?.products ?? 0, icon: Package, to: '/admin/products' },
    { label: 'Financial records', value: stats?.transactions ?? 0, icon: CreditCard, to: '/admin/transactions' },
  ], [stats]);

  const operations = [
    { label: 'User & role governance', description: 'Manage users, roles, permissions and access profiles.', to: '/admin/control-tower', icon: Users },
    { label: 'Verification & compliance', description: 'Review identity status and sensitive verification actions.', to: '/admin/verification', icon: FileCheck2 },
    { label: 'Finance & settlement', description: 'Inspect the global ledger, settlement operations and reporting.', to: '/admin/workspace/finance', icon: Wallet },
    { label: 'Security & risk', description: 'Open the restricted security workspace for risk and audit operations.', to: '/admin/workspace/risk', icon: ShieldCheck },
    { label: 'Platform operations', description: 'Operate businesses, products, requests, reports and settings.', to: '/admin/workspace/platform', icon: Database },
    { label: 'System configuration', description: 'Review controlled platform-wide configuration.', to: '/admin/settings', icon: Activity },
  ];

  return (
    <div className="space-y-6 pb-12">
      <section className="relative overflow-hidden rounded-[2rem] bg-slate-950 p-5 text-white shadow-xl sm:p-7">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-emerald-400/20 blur-3xl" />
        <div className="relative">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[.18em] text-emerald-200">
              <LockKeyhole className="h-3.5 w-3.5" /> Super Admin
            </span>
            <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-bold text-white/70">Highest platform governance</span>
          </div>
          <h1 className="mt-4 text-2xl font-black sm:text-4xl">UniquePlatform Super Admin</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-white/70">
            Executive control over the entire Unique One ecosystem. This dashboard is the command layer;
            operational work stays inside the dedicated role dashboards below.
          </p>
          <div className="mt-5 flex flex-wrap gap-2 text-xs font-bold text-white/70">
            <span className="rounded-xl bg-white/10 px-3 py-2">Signed in as {userData?.fullName || currentUser?.email || 'Super Admin'}</span>
            <span className="rounded-xl bg-emerald-400/10 px-3 py-2 text-emerald-200">RBAC protected</span>
            <span className="rounded-xl bg-white/10 px-3 py-2">Audit-sensitive</span>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.label} to={card.to} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300">
              <div className="flex items-center justify-between">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><Icon className="h-4 w-4" /></span>
                <ChevronRight className="h-4 w-4 text-slate-300" />
              </div>
              <p className="mt-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">{card.label}</p>
              <p className="mt-1 text-2xl font-black text-slate-900">{loading ? '…' : card.value.toLocaleString()}</p>
            </Link>
          );
        })}
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.4fr_.6fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-slate-900">Executive platform indicators</h2>
              <p className="mt-1 text-sm text-slate-500">Live figures from the current platform data layer.</p>
            </div>
            <button onClick={() => void load()} disabled={loading} className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-50" aria-label="Refresh platform indicators">
              <RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
            </button>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Completed transaction volume</p>
              <p className="mt-2 text-xl font-black text-slate-900">{loading ? 'Loading…' : formatNaira(stats?.completedVolumeMinor || 0)}</p>
              <p className="mt-1 text-xs text-slate-500">NGN ledger records marked completed.</p>
            </div>
            <div className="rounded-2xl bg-amber-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-amber-700">Verification attention</p>
              <p className="mt-2 text-xl font-black text-slate-900">{loading ? 'Loading…' : (stats?.pendingVerification || 0).toLocaleString()}</p>
              <p className="mt-1 text-xs text-slate-500">User records not yet fully verified.</p>
            </div>
          </div>
          {error && (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>
          )}
          {lastUpdated && !error && <p className="mt-4 text-[11px] font-semibold text-slate-400">Last refreshed {lastUpdated.toLocaleTimeString()}</p>}
        </div>

        <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5">
          <div className="flex items-center gap-2">
            <Globe2 className="h-5 w-5 text-emerald-700" />
            <h2 className="font-black text-slate-900">Platform state</h2>
          </div>
          <div className="mt-4 space-y-3">
            {[
              ['RBAC', 'Protected', true],
              ['Admin portal', 'Operational', true],
              ['Financial ledger', 'Connected', Boolean(stats)],
              ['Verification center', 'Connected', Boolean(stats)],
            ].map(([label, value, ok]) => (
              <div key={String(label)} className="flex items-center justify-between rounded-xl bg-white/70 px-3 py-2.5">
                <span className="text-xs font-bold text-slate-600">{label}</span>
                <span className="flex items-center gap-1.5 text-[10px] font-black text-emerald-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> {String(value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <h2 className="text-lg font-black text-slate-900">CheapDataHub connection</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Run a read-only reseller wallet check using the server-side credential. This does not buy airtime or data and does not debit a UniquePay wallet.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void checkCheapDataHub()}
            disabled={cheapDataHubLoading || !currentUser}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={cheapDataHubLoading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
            {cheapDataHubLoading ? 'Checking provider…' : 'Test CheapDataHub Connection'}
          </button>
        </div>
        {cheapDataHubResult && (
          <div className={`mt-4 rounded-2xl border p-4 ${cheapDataHubResult.ok ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`} role="status" aria-live="polite">
            <div className="flex items-center gap-2">
              {cheapDataHubResult.ok ? <CheckCircle2 className="h-5 w-5 text-emerald-700" /> : <AlertTriangle className="h-5 w-5 text-amber-700" />}
              <p className="font-black text-slate-900">{cheapDataHubResult.ok ? 'Connection verified' : 'Connection not verified'}</p>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-700">{cheapDataHubResult.message}</p>
            {cheapDataHubResult.ok && cheapDataHubResult.providerBalanceNaira !== undefined && (
              <p className="mt-2 text-sm font-bold text-slate-900">
                Provider reseller balance: {new Intl.NumberFormat('en-NG', { style: 'currency', currency: cheapDataHubResult.currency || 'NGN' }).format(cheapDataHubResult.providerBalanceNaira)}
              </p>
            )}
            {cheapDataHubResult.connection && <p className="mt-1 text-xs text-slate-500">Status: {cheapDataHubResult.connection}</p>}
            {cheapDataHubResult.checkedAt && <p className="mt-1 text-xs text-slate-500">Checked: {new Date(cheapDataHubResult.checkedAt).toLocaleString()}</p>}
            <p className="mt-2 text-xs font-semibold text-slate-500">Purchase mode remains disabled.</p>
          </div>
        )}
      </section>

      <section>
        <div className="mb-3">
          <h2 className="text-lg font-black text-slate-900">Super Admin operations</h2>
          <p className="text-sm text-slate-500">Open the dedicated dashboard for each controlled area.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {operations.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.label} to={item.to} className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md">
                <div className="flex items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700 group-hover:bg-emerald-50 group-hover:text-emerald-700"><Icon className="h-5 w-5" /></span>
                  <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-emerald-600" />
                </div>
                <h3 className="mt-4 font-black text-slate-900">{item.label}</h3>
                <p className="mt-1 text-sm leading-5 text-slate-500">{item.description}</p>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
        <div className="flex gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
          <div>
            <h3 className="font-black text-slate-900">High-risk actions stay controlled</h3>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              This dashboard does not bypass RBAC. Financial changes, verification decisions, role changes and other sensitive operations must continue through their protected workflows and should later emit server-side audit events when the API layer is connected.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
        <div className="flex gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
          <div>
            <h3 className="font-black text-slate-900">Dashboard phase</h3>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Super Admin now has a dedicated executive dashboard while the existing role-specific dashboards remain intact. The next phase is to finish server/API enforcement, audit events, settlement integrations and external provider connections.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
