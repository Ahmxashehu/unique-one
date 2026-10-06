import React, { useEffect, useMemo, useState } from 'react';
import { Building2, Search, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';

interface AdminBusiness {
  id: string;
  name?: string;
  businessName?: string;
  description?: string;
  ownerUid?: string;
  category?: string;
  status?: string;
  verificationStatus?: string;
  createdAt?: unknown;
}

function formatDate(value: unknown) {
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate?: unknown }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toLocaleDateString();
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toLocaleDateString();
  }
  return '—';
}

export default function AdminBusinessesPage() {
  const [businesses, setBusinesses] = useState<AdminBusiness[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let active = true;

    const loadBusinesses = async () => {
      setLoading(true);
      setError('');
      try {
        const snapshot = await getDocs(collection(db, 'businesses'));
        if (!active) return;
        setBusinesses(snapshot.docs.map(item => ({ id: item.id, ...item.data() } as AdminBusiness)));
      } catch (loadError) {
        console.error('Failed to load admin businesses:', loadError);
        if (active) setError('Unable to load businesses. Check administrator access and try again.');
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadBusinesses();
    return () => { active = false; };
  }, []);

  const refreshBusinesses = async () => {
    setRefreshing(true);
    setError('');
    try {
      const snapshot = await getDocs(collection(db, 'businesses'));
      setBusinesses(snapshot.docs.map(item => ({ id: item.id, ...item.data() }) as AdminBusinesse));
    } catch (loadError) {
      console.error('Failed to refresh businesses:', loadError);
      setError('Unable to refresh businesses. Check administrator access and try again.');
    } finally {
      setRefreshing(false);
    }
  };

  const filteredBusinesses = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return businesses;
    return businesses.filter(business =>
      [business.name, business.businessName, business.description, business.ownerUid, business.category, business.status, business.verificationStatus, business.id]
        .filter(Boolean)
        .some(value => String(value).toLowerCase().includes(term))
    );
  }, [businesses, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Registered Businesses</h1>
          <p className="text-sm text-slate-500 mt-1">Monitor and manage business accounts.</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button type="button" onClick={() => void refreshBusinesses()} disabled={refreshing} className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            <RefreshCw className={refreshing ? 'w-4 h-4 animate-spin' : 'w-4 h-4'} /> Refresh
          </button>
          <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Search businesses..."
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-12 flex items-center justify-center gap-3 text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin" /> Loading businesses...
          </div>
        ) : error ? (
          <div className="p-12 text-center">
            <AlertCircle className="w-8 h-8 mx-auto text-rose-500 mb-3" />
            <p className="text-sm text-rose-700">{error}</p>
          </div>
        ) : filteredBusinesses.length === 0 ? (
          <div className="p-12 text-center">
            <Building2 className="w-8 h-8 text-slate-400 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-slate-900">
              {businesses.length === 0 ? 'No registered businesses' : 'No matching businesses'}
            </h3>
            <p className="text-slate-500 mt-1">
              {businesses.length === 0 ? 'Registered businesses will appear here.' : 'Try a different search term.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700">Business</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700">Owner</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700">Category</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700">Status</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredBusinesses.map(business => (
                  <tr key={business.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{business.businessName || business.name || 'Unnamed business'}</div>
                      <div className="text-xs text-slate-500">{business.id}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{business.ownerUid || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{business.category || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{business.verificationStatus || business.status || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(business.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
