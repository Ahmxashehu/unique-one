import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, orderBy, query, where } from 'firebase/firestore';
import { AlertCircle, ArrowDownLeft, ArrowUpRight, Filter, Loader2, Search, Wallet } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../lib/firebase';
import { TransactionModel } from '../../lib/os/types';

type TransactionRecord = TransactionModel & { isOutgoing: boolean };

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function formatAmount(transaction: TransactionRecord) {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: transaction.currency,
    maximumFractionDigits: 2,
  }).format(transaction.amount);
}

export default function TransactionHistoryPage() {
  const { currentUser, loading: authLoading } = useAuth();
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'sent' | 'received'>('all');

  useEffect(() => {
    let isMounted = true;

    const loadTransactions = async () => {
      if (authLoading) return;
      if (!currentUser) {
        if (isMounted) {
          setTransactions([]);
          setLoading(false);
          setError('You must be signed in to view transaction history.');
        }
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const transactionsRef = collection(db, 'transactions');
        const [sentSnapshot, receivedSnapshot] = await Promise.all([
          getDocs(query(transactionsRef, where('senderId', '==', currentUser.uid), orderBy('createdAt', 'desc'))),
          getDocs(query(transactionsRef, where('recipientId', '==', currentUser.uid), orderBy('createdAt', 'desc'))),
        ]);

        if (!isMounted) return;

        const byId = new Map<string, TransactionRecord>();
        sentSnapshot.forEach((document) => {
          const transaction = { id: document.id, ...document.data() } as TransactionModel;
          byId.set(document.id, { ...transaction, isOutgoing: true });
        });
        receivedSnapshot.forEach((document) => {
          const transaction = { id: document.id, ...document.data() } as TransactionModel;
          const existing = byId.get(document.id);
          byId.set(document.id, { ...transaction, isOutgoing: existing?.isOutgoing ?? false });
        });

        setTransactions([...byId.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      } catch (loadError) {
        console.error('Unable to load transaction history:', loadError);
        if (isMounted) setError('We could not load your transactions. Please try again.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    void loadTransactions();
    return () => {
      isMounted = false;
    };
  }, [authLoading, currentUser]);

  const visibleTransactions = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return transactions.filter((transaction) => {
      const matchesFilter = filter === 'all' || (filter === 'sent' ? transaction.isOutgoing : !transaction.isOutgoing);
      const searchableValues = [
        transaction.reference,
        transaction.type,
        transaction.sourceModule,
        transaction.status,
        transaction.senderId,
        transaction.recipientId,
      ];
      const matchesSearch = !normalizedSearch || searchableValues.some((value) => value.toLowerCase().includes(normalizedSearch));
      return matchesFilter && matchesSearch;
    });
  }, [filter, search, transactions]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-12">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Transaction History</h1>
          <p className="mt-1 text-sm text-slate-500">View your complete UniquePay ledger.</p>
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:border-slate-400">
            <option value="all">All transactions</option>
            <option value="sent">Sent</option>
            <option value="received">Received</option>
          </select>
          <button type="button" className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 sm:hidden">
            <Filter className="h-4 w-4" /> Filter
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 p-3">
          <div className="relative w-full sm:ml-auto sm:w-80">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} type="search" placeholder="Search transactions..." className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-4 text-sm outline-none focus:border-slate-400" />
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <Loader2 className="mb-4 h-8 w-8 animate-spin text-slate-400" />
            <p className="text-sm text-slate-500">Loading your transactions...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <AlertCircle className="mb-4 h-10 w-10 text-red-400" />
            <p className="font-medium text-slate-900">Unable to load transactions</p>
            <p className="mt-1 text-sm text-slate-500">{error}</p>
          </div>
        ) : visibleTransactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-50"><Wallet className="h-8 w-8 text-slate-400" /></div>
            <p className="font-medium text-slate-900">{transactions.length ? 'No matching transactions' : 'No transactions'}</p>
            <p className="mt-1 text-sm text-slate-500">{transactions.length ? 'Try a different search or filter.' : 'Your ledger is completely clean.'}</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {visibleTransactions.map((transaction) => (
              <div key={transaction.id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                <div className="flex min-w-0 items-center gap-3">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${transaction.isOutgoing ? 'bg-orange-50 text-orange-600' : 'bg-emerald-50 text-emerald-600'}`}>
                    {transaction.isOutgoing ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownLeft className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium capitalize text-slate-900">{transaction.type.replaceAll('_', ' ')}</p>
                    <p className="truncate text-xs text-slate-500">{transaction.isOutgoing ? `To ${transaction.recipientId}` : `From ${transaction.senderId}`}</p>
                    <p className="mt-1 truncate text-xs text-slate-400">{transaction.reference} · {transaction.sourceModule} · {formatDate(transaction.createdAt)}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-4 sm:justify-end">
                  <div className="text-left sm:text-right">
                    <p className={`font-semibold ${transaction.isOutgoing ? 'text-slate-900' : 'text-emerald-600'}`}>{transaction.isOutgoing ? '-' : '+'}{formatAmount(transaction)}</p>
                    <span className="text-xs capitalize text-slate-500">{transaction.status}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
