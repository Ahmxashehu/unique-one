import { useEffect, useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Loader2, Plus, Search } from 'lucide-react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';

type PaymentRequest = {
  id: string;
  senderId: string;
  recipientId?: string;
  recipientIdentifier?: string;
  amount?: number;
  currency?: string;
  description?: string;
  status?: string;
  dueDate?: string;
  createdAt?: string;
};

export default function PaymentRequestsPage() {
  const { currentUser } = useAuth();
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [tab, setTab] = useState<'received' | 'sent'>('received');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser) {
      setRequests([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [sentSnapshot, receivedSnapshot] = await Promise.all([
          getDocs(query(collection(db, 'payment_requests'), where('senderId', '==', currentUser.uid))),
          getDocs(query(collection(db, 'payment_requests'), where('recipientId', '==', currentUser.uid))),
        ]);

        const merged = new Map<string, PaymentRequest>();
        [...sentSnapshot.docs, ...receivedSnapshot.docs].forEach((doc) => {
          merged.set(doc.id, { id: doc.id, ...doc.data() } as PaymentRequest);
        });

        if (!cancelled) {
          setRequests(Array.from(merged.values()).sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''))));
        }
      } catch (loadError) {
        console.error('Unable to load payment requests:', loadError);
        if (!cancelled) setError('We could not load your payment requests. Please try again.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => { cancelled = true; };
  }, [currentUser]);

  const visibleRequests = useMemo(() => {
    const term = search.trim().toLowerCase();
    return requests.filter((request) => {
      const isReceived = request.recipientId === currentUser?.uid;
      if (tab === 'received' ? !isReceived : request.senderId !== currentUser?.uid) return false;
      if (!term) return true;
      return [request.id, request.description, request.status, request.recipientIdentifier]
        .some((value) => String(value || '').toLowerCase().includes(term));
    });
  }, [currentUser?.uid, requests, search, tab]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-12">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Payment Requests</h1>
          <p className="mt-1 text-sm text-slate-500">Manage money requested by you or from you.</p>
        </div>
        <Link to="/os/payment-requests/new" className="flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800">
          <Plus className="h-4 w-4" /> New Request
        </Link>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-2 border-b border-slate-100 p-2 sm:flex-row">
          <div className="flex gap-2">
            <button type="button" onClick={() => setTab('received')} className={`rounded-lg px-6 py-2 text-sm font-semibold ${tab === 'received' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:bg-slate-50'}`}>Received</button>
            <button type="button" onClick={() => setTab('sent')} className={`rounded-lg px-6 py-2 text-sm font-medium ${tab === 'sent' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:bg-slate-50'}`}>Sent</button>
          </div>
          <div className="relative ml-auto w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search requests..." className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-4 text-sm focus:border-slate-400 focus:outline-none" />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 p-12 text-sm text-slate-500"><Loader2 className="h-5 w-5 animate-spin" /> Loading requests...</div>
        ) : error ? (
          <div className="p-12 text-center text-sm text-rose-600">{error}</div>
        ) : visibleRequests.length === 0 ? (
          <div className="p-12 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-50">
              {tab === 'received' ? <ArrowDownRight className="h-8 w-8 text-slate-400" /> : <ArrowUpRight className="h-8 w-8 text-slate-400" />}
            </div>
            <p className="text-base font-medium text-slate-900">No {tab} requests found</p>
            <p className="mt-1 text-sm text-slate-500">{search ? 'Try a different search.' : tab === 'received' ? 'You have no payment requests addressed to your account yet.' : 'You have not created any payment requests yet.'}</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {visibleRequests.map((request) => (
              <div key={request.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-medium text-slate-900">{request.description || 'Payment request'}</p>
                  <p className="mt-1 truncate text-xs text-slate-500">#{request.id} · {request.status || 'unknown'}</p>
                  {request.dueDate && <p className="mt-1 text-xs text-slate-500">Due {request.dueDate}</p>}
                </div>
                <div className="text-left sm:text-right">
                  <p className="font-semibold text-slate-900">{request.currency === 'NGN' ? '₦' : request.currency || ''}{Number(request.amount || 0).toLocaleString()}</p>
                  <p className="text-xs text-slate-500">{tab === 'received' ? 'From requester' : `To ${request.recipientIdentifier || 'recipient'}`}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
