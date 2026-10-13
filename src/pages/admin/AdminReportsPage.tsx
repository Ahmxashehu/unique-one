import React, { useCallback, useEffect, useState } from 'react';
import { BarChart3, TrendingUp, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface ReportStats {
  users: number;
  businesses: number;
  products: number;
  transactionVolumeMinor: number;
}

function formatNaira(minor: number) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(minor / 100);
}

export default function AdminReportsPage() {
  const [stats, setStats] = useState<ReportStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const { currentUser } = useAuth();

  const loadReports = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      if (!currentUser) throw new Error('Administrator sign-in is required.');
      const token = await currentUser.getIdToken();
      const response = await fetch('/api/admin/overview', {
        headers: { Authorization: 'Bearer ' + token },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error?.message || 'Unable to load platform reports.');
      const source = payload?.stats;
      if (!source || !Number.isFinite(source.users) || !Number.isFinite(source.businesses) ||
          !Number.isFinite(source.products) || !Number.isFinite(source.transactionVolumeMinor)) {
        throw new Error('The platform report response was incomplete. Please try again.');
      }
      setStats({
        users: source.users,
        businesses: source.businesses,
        products: source.products,
        transactionVolumeMinor: source.transactionVolumeMinor,
      });
    } catch (loadError) {
      console.error('Failed to load admin reports:', loadError);
      setError(loadError instanceof Error ? loadError.message : 'Unable to load platform reports. Check administrator access and try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentUser]);

  useEffect(() => { void loadReports(); }, [loadReports]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Analytics & Reports</h1>
          <p className="text-sm text-slate-500 mt-1">Live platform metrics from the protected administrator service.</p>
        </div>
        <button type="button" onClick={() => void loadReports(true)} disabled={loading || refreshing}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
          aria-label="Refresh platform reports">
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white p-12 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading platform metrics...
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
          <AlertCircle className="mx-auto mb-3 h-8 w-8 text-rose-500" />
          <p className="text-sm text-rose-700">{error}</p>
          <button type="button" onClick={() => void loadReports(true)} className="mt-4 rounded-lg border px-4 py-2 text-sm font-medium">Try again</button>
        </div>
      ) : stats ? (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-medium text-slate-500">Completed Transaction Volume</p>
              <h3 className="mt-2 text-3xl font-bold text-slate-900">{formatNaira(stats.transactionVolumeMinor)}</h3>
              <div className="mt-4 flex items-center text-sm font-medium text-slate-500">
                <TrendingUp className="mr-1 h-4 w-4" /><span>Completed UniquePay transactions</span>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-medium text-slate-500">Total Users</p>
              <h3 className="mt-2 text-3xl font-bold text-slate-900">{stats.users.toLocaleString()}</h3>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-medium text-slate-500">Active Businesses</p>
              <h3 className="mt-2 text-3xl font-bold text-slate-900">{stats.businesses.toLocaleString()}</h3>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-8">
            <div className="mb-3 flex items-center gap-3">
              <BarChart3 className="h-6 w-6 text-slate-700" />
              <h3 className="text-lg font-semibold text-slate-900">Catalog Coverage</h3>
            </div>
            <p className="text-sm text-slate-500">The platform currently has {stats.products.toLocaleString()} product records available to the admin catalog.</p>
          </div>
        </>
      ) : null}
    </div>
  );
}
