import React, { useEffect, useState } from 'react';
import { BarChart3, TrendingUp, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { collection, getDocs, getCountFromServer } from 'firebase/firestore';
import { db } from '../../lib/firebase';

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

  const refreshReports = async () => {
    setRefreshing(true);
    setError('');
    try {
      const [users, businesses, products, transactions] = await Promise.all([
        getCountFromServer(collection(db, 'users')),
        getCountFromServer(collection(db, 'businesses')),
        getCountFromServer(collection(db, 'products')),
        getDocs(collection(db, 'transactions')),
      ]);
      let transactionVolumeMinor = 0;
      transactions.forEach(item => {
        const data = item.data();
        if (data.recordKind === 'financial' && data.amountUnit === 'minor' && data.currency === 'NGN' && data.status === 'completed' && typeof data.amount === 'number' && Number.isSafeInteger(data.amount)) transactionVolumeMinor += data.amount;
      });
      setStats({ users: users.data().count, businesses: businesses.data().count, products: products.data().count, transactionVolumeMinor });
    } catch (loadError) {
      console.error('Failed to refresh admin reports:', loadError);
      setError('Unable to refresh platform reports. Check administrator access and try again.');
    } finally { setRefreshing(false); }
  };

  useEffect(() => {
    let active = true;

    const loadReports = async () => {
      setLoading(true);
      setError('');
      try {
        const [users, businesses, products, transactions] = await Promise.all([
          getCountFromServer(collection(db, 'users')),
          getCountFromServer(collection(db, 'businesses')),
          getCountFromServer(collection(db, 'products')),
          getDocs(collection(db, 'transactions')),
        ]);

        let transactionVolumeMinor = 0;
        transactions.forEach(item => {
          const data = item.data();
          if (data.recordKind === 'financial' && data.amountUnit === 'minor' && data.currency === 'NGN' && data.status === 'completed' && typeof data.amount === 'number' && Number.isSafeInteger(data.amount)) {
            transactionVolumeMinor += data.amount;
          }
        });

        if (active) {
          setStats({
            users: users.data().count,
            businesses: businesses.data().count,
            products: products.data().count,
            transactionVolumeMinor,
          });
        }
      } catch (loadError) {
        console.error('Failed to load admin reports:', loadError);
        if (active) setError('Unable to load platform reports. Check administrator access and try again.');
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadReports();
    return () => { active = false; };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Analytics & Reports</h1>
        <p className="text-sm text-slate-500 mt-1">Live platform metrics from the current Firestore data.</p>
      </div>

      {loading ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 flex items-center justify-center gap-3 text-slate-500">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading platform metrics...
        </div>
      ) : error ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
          <AlertCircle className="w-8 h-8 mx-auto text-rose-500 mb-3" />
          <p className="text-sm text-rose-700">{error}</p>
        </div>
      ) : stats ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Completed Transaction Volume</p>
            <h3 className="text-3xl font-bold text-slate-900 mt-2">{formatNaira(stats.transactionVolumeMinor)}</h3>
            <div className="mt-4 flex items-center text-sm text-slate-500 font-medium">
              <TrendingUp className="w-4 h-4 mr-1" />
              <span>Completed UniquePay transactions</span>
            </div>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Total Users</p>
            <h3 className="text-3xl font-bold text-slate-900 mt-2">{stats.users.toLocaleString()}</h3>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Active Businesses</p>
            <h3 className="text-3xl font-bold text-slate-900 mt-2">{stats.businesses.toLocaleString()}</h3>
          </div>
        </div>
      ) : null}

      {!loading && !error && stats && (
        <div className="bg-white border border-slate-200 rounded-2xl p-8">
          <div className="flex items-center gap-3 mb-3">
            <BarChart3 className="w-6 h-6 text-slate-700" />
            <h3 className="text-lg font-semibold text-slate-900">Catalog Coverage</h3>
          </div>
          <p className="text-sm text-slate-500">
            The platform currently has {stats.products.toLocaleString()} product records available to the admin catalog.
          </p>
        </div>
      )}
    </div>
  );
}
