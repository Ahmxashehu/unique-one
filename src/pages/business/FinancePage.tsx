import React, { useEffect, useState } from 'react';
import { CreditCard, ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export default function FinancePage() {
  const { currentUser, loading: authLoading } = useAuth();
  const [revenueMinor, setRevenueMinor] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;

    const loadRevenue = async () => {
      if (!currentUser) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError('');
      try {
        const token=await currentUser.getIdToken();
        const businessSession=localStorage.getItem('unique_business_session')||'';
        const response=await fetch('/api/business/orders',{headers:{Authorization:`Bearer ${token}`,'X-Business-Session':businessSession}});
        const data=await response.json().catch(()=>({}));
        if(!response.ok) throw new Error(data?.error?.message||'Business orders could not be loaded.');
        const completedStatuses = new Set(['delivered', 'completed']);
        const total = (Array.isArray(data?.orders)?data.orders:[]).reduce((sum: number, order: any) => {
          if (!completedStatuses.has(String(order?.status))) return sum;
          const amount = Number(order?.totalAmount);
          if (!Number.isFinite(amount) || amount < 0) return sum;
          return sum + amount;
        }, 0);
        if (!cancelled) setRevenueMinor(Math.round(total * 100));
      } catch (loadError) {
        console.error('Unable to load business revenue:', loadError);
        if (!cancelled) setError('Revenue data could not be loaded.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadRevenue();
    return () => { cancelled = true; };
  }, [authLoading, currentUser]);

  if (authLoading) return null;

  const revenueLabel = loading ? 'Loading…' : revenueMinor === null ? '—' : '₦' + (revenueMinor / 100).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Finance & Expenses</h1>
          <p className="text-sm text-slate-500 mt-1">Track business expenses and revenue.</p>
        </div>
        <div className="text-sm text-slate-500">Business financial records</div>
      </div>
      
      {error && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-emerald-50 border border-emerald-100 p-6 rounded-3xl">
           <ArrowDownRight className="w-8 h-8 text-emerald-600 mb-2" />
           <p className="text-sm font-medium text-emerald-800">Completed Order Revenue</p>
           <h3 className="text-2xl font-bold text-emerald-900 mt-1">{revenueLabel}</h3>
           <p className="text-xs text-emerald-700 mt-2">Based on completed or delivered orders.</p>
        </div>
        <div className="bg-rose-50 border border-rose-100 p-6 rounded-3xl">
           <ArrowUpRight className="w-8 h-8 text-rose-600 mb-2" />
           <p className="text-sm font-medium text-rose-800">Recorded Expenses</p>
           <h3 className="text-2xl font-bold text-rose-900 mt-1">—</h3>
           <p className="text-xs text-rose-700 mt-2">No expense record source is connected yet.</p>
        </div>
        <div className="bg-blue-50 border border-blue-100 p-6 rounded-3xl">
           <CreditCard className="w-8 h-8 text-blue-600 mb-2" />
           <p className="text-sm font-medium text-blue-800">Net Balance</p>
           <h3 className="text-2xl font-bold text-blue-900 mt-1">—</h3>
           <p className="text-xs text-blue-700 mt-2">Calculated after recorded expenses are available.</p>
        </div>
      </div>
    </div>
  );
}
