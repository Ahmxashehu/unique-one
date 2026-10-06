import React, { useEffect, useMemo, useState } from 'react';
import { Activity, Search, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';

interface AdminTransaction {
  id: string;
  reference?: string;
  senderId?: string;
  recipientId?: string;
  amount?: number;
  currency?: string;
  type?: string;
  status?: string;
  sourceModule?: string;
  recordKind?: string;
  schemaVersion?: number;
  amountUnit?: string;
  createdAt?: unknown;
}

function formatDate(value: unknown) {
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate?: unknown }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toLocaleString();
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toLocaleString();
  }
  return '—';
}

function formatAmount(amount: unknown, currency = 'NGN') {
  if (typeof amount !== 'number' || !Number.isSafeInteger(amount)) return '—';
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency }).format(amount / 100);
}

export default function AdminTransactionsPage() {
  const [transactions, setTransactions] = useState<AdminTransaction[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const refreshTransactions = async () => {
    setRefreshing(true);
    setError('');
    try {
      const snapshot = await getDocs(collection(db, 'transactions'));
      const rows = snapshot.docs
        .map(item => ({ id: item.id, ...item.data() } as AdminTransaction))
        .filter(item => item.recordKind === 'financial' && item.schemaVersion === 2 && item.amountUnit === 'minor')
        .sort((a, b) => {
          const getMillis = (value: unknown) => {
            if (value && typeof value === 'object' && 'toMillis' in value && typeof (value as { toMillis?: unknown }).toMillis === 'function') return (value as { toMillis: () => number }).toMillis();
            const parsed = typeof value === 'string' || typeof value === 'number' ? new Date(value).getTime() : 0;
            return Number.isFinite(parsed) ? parsed : 0;
          };
          return getMillis(b.createdAt) - getMillis(a.createdAt);
        });
      setTransactions(rows);
    } catch (loadError) {
      console.error('Failed to refresh admin transactions:', loadError);
      setError('Unable to refresh transactions. Check administrator access and try again.');
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    let active = true;

    const loadTransactions = async () => {
      setLoading(true);
      setError('');
      try {
        const snapshot = await getDocs(collection(db, 'transactions'));
        if (!active) return;

        const rows = snapshot.docs
          .map(item => ({ id: item.id, ...item.data() } as AdminTransaction))
          .filter(item => item.recordKind === 'financial' && item.schemaVersion === 2 && item.amountUnit === 'minor')
          .sort((a, b) => {
            const getMillis = (value: unknown) => {
              if (value && typeof value === 'object' && 'toMillis' in value && typeof (value as { toMillis?: unknown }).toMillis === 'function') {
                return (value as { toMillis: () => number }).toMillis();
              }
              const parsed = typeof value === 'string' || typeof value === 'number' ? new Date(value).getTime() : 0;
              return Number.isFinite(parsed) ? parsed : 0;
            };
            return getMillis(b.createdAt) - getMillis(a.createdAt);
          });

        setTransactions(rows);
      } catch (loadError) {
        console.error('Failed to load admin transactions:', loadError);
        if (active) setError('Unable to load transactions. Check administrator access and try again.');
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadTransactions();
    return () => { active = false; };
  }, []);

  const filteredTransactions = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return transactions;
    return transactions.filter(transaction =>
      [transaction.reference, transaction.senderId, transaction.recipientId, transaction.type, transaction.status, transaction.sourceModule, transaction.id]
        .filter(Boolean)
        .some(value => String(value).toLowerCase().includes(term))
    );
  }, [transactions, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Global Ledger</h1>
          <p className="text-sm text-slate-500 mt-1">Read-only view of financial transactions recorded by UniquePay.</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto"><button type="button" onClick={() => void refreshTransactions()} disabled={refreshing} className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"><RefreshCw className={refreshing ? "w-4 h-4 animate-spin" : "w-4 h-4"} /> Refresh</button><div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Search reference, user, status..."
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-12 flex items-center justify-center gap-3 text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin" /> Loading ledger...
          </div>
        ) : error ? (
          <div className="p-12 text-center">
            <AlertCircle className="w-8 h-8 mx-auto text-rose-500 mb-3" />
            <p className="text-sm text-rose-700">{error}</p>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="p-12 text-center">
            <Activity className="w-8 h-8 text-slate-400 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-slate-900">
              {transactions.length === 0 ? 'No financial transactions' : 'No matching transactions'}
            </h3>
            <p className="text-slate-500 mt-1">
              {transactions.length === 0 ? 'Completed financial transactions will appear here.' : 'Try a different search term.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700">Reference</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700">Amount</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700">Type</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700">Status</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700">Sender</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700">Recipient</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTransactions.map(transaction => (
                  <tr key={transaction.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-700">{transaction.reference || transaction.id}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{formatAmount(transaction.amount, transaction.currency || 'NGN')}</td>
                    <td className="px-4 py-3 text-slate-600">{transaction.type || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{transaction.status || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{transaction.senderId || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{transaction.recipientId || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(transaction.createdAt)}</td>
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
