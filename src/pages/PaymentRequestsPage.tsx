import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Loader2, Plus, Search, Check, X, Ban } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

type PaymentRequest = { id: string; senderId: string; recipientId?: string; recipientIdentifier?: string; amount?: number; currency?: string; description?: string; status?: string; dueDate?: string; createdAt?: string | { _seconds?: number; seconds?: number } };

function createdLabel(value: PaymentRequest['createdAt']) {
  if (typeof value === 'string') return value;
  const seconds = value && (value._seconds ?? value.seconds);
  return typeof seconds === 'number' ? new Date(seconds * 1000).toISOString() : '';
}

export default function PaymentRequestsPage() {
  const { currentUser } = useAuth();
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [tab, setTab] = useState<'received' | 'sent'>('received');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!currentUser) { setRequests([]); setLoading(false); return; }
    setLoading(true); setError(null);
    try {
      const token = await currentUser.getIdToken();
      const response = await fetch('/api/payment-requests', { headers: { Authorization: 'Bearer ' + token } });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !Array.isArray(payload?.requests)) throw new Error(payload?.error?.message || 'Unable to load payment requests.');
      setRequests(payload.requests);
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to load payment requests.'); }
    finally { setLoading(false); }
  }, [currentUser]);

  useEffect(() => { void load(); }, [load]);

  const changeStatus = async (item: PaymentRequest, status: 'sent' | 'viewed' | 'rejected' | 'cancelled') => {
    if (!currentUser || busy) return;
    setBusy(item.id); setError(null);
    try {
      const token = await currentUser.getIdToken();
      const response = await fetch('/api/payment-requests/' + encodeURIComponent(item.id) + '/status', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ status }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error?.message || 'Unable to update request.');
      setRequests((old) => old.map((r) => r.id === item.id ? { ...r, status } : r));
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to update request.'); }
    finally { setBusy(null); }
  };

  const visible = useMemo(() => requests.filter((r) => {
    if (tab === 'received' ? r.recipientId !== currentUser?.uid : r.senderId !== currentUser?.uid) return false;
    const term = search.trim().toLowerCase();
    return !term || [r.id, r.description, r.status, r.recipientIdentifier].some((v) => String(v || '').toLowerCase().includes(term));
  }), [requests, tab, currentUser?.uid, search]);

  return <div className="mx-auto max-w-7xl space-y-6 pb-12">
    <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center"><div><h1 className="text-2xl font-bold tracking-tight text-slate-900">Payment Requests</h1><p className="mt-1 text-sm text-slate-500">Manage requests. Changing a request status does not transfer money.</p></div><Link to="/os/payment-requests/new" className="flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-medium text-white"><Plus className="h-4 w-4" /> New Request</Link></div>
    {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</div>}
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
      <div className="flex flex-col gap-2 border-b border-slate-100 p-2 sm:flex-row"><div className="flex gap-2"><button type="button" onClick={() => setTab('received')} className={`rounded-lg px-6 py-2 text-sm font-semibold ${tab === 'received' ? 'bg-slate-100 text-slate-900' : 'text-slate-500'}`}>Received</button><button type="button" onClick={() => setTab('sent')} className={`rounded-lg px-6 py-2 text-sm font-semibold ${tab === 'sent' ? 'bg-slate-100 text-slate-900' : 'text-slate-500'}`}>Sent</button></div><div className="relative ml-auto w-full sm:w-72"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search requests..." className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-4 text-sm" /></div></div>
      {loading ? <div className="flex items-center justify-center gap-2 p-12 text-sm text-slate-500"><Loader2 className="h-5 w-5 animate-spin" /> Loading requests...</div> : visible.length === 0 ? <div className="p-12 text-center"><div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-50">{tab === 'received' ? <ArrowDownRight className="h-8 w-8 text-slate-400" /> : <ArrowUpRight className="h-8 w-8 text-slate-400" />}</div><p className="font-medium text-slate-900">No {tab} requests found</p><p className="mt-1 text-sm text-slate-500">{search ? 'Try a different search.' : 'Your requests will appear here.'}</p></div> : <div className="divide-y divide-slate-100">{visible.map((r) => {
        const received = tab === 'received';
        const respond = received && ['sent', 'viewed'].includes(String(r.status));
        const cancel = !received && ['draft', 'sent'].includes(String(r.status));
        const canSend = !received && r.status === 'draft';
        return <div key={r.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="font-medium text-slate-900">{r.description || 'Payment request'}</p><p className="mt-1 truncate text-xs text-slate-500">#{r.id} · {r.status || 'unknown'} · {createdLabel(r.createdAt)}</p>{r.dueDate && <p className="mt-1 text-xs text-slate-500">Due {r.dueDate}</p>}</div><div className="flex flex-col gap-3 sm:items-end"><div className="text-left sm:text-right"><p className="font-semibold text-slate-900">{r.currency === 'NGN' ? '₦' : r.currency || ''}{Number(r.amount || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p><p className="text-xs text-slate-500">{received ? 'Received request' : `To ${r.recipientIdentifier || 'recipient'}`}</p></div><div className="flex flex-wrap gap-2">{respond && r.status === 'sent' && <button type="button" disabled={busy === r.id} onClick={() => void changeStatus(r, 'viewed')} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs disabled:opacity-50"><Check className="h-3.5 w-3.5" /> Viewed</button>}{respond && <button type="button" disabled={busy === r.id} onClick={() => void changeStatus(r, 'rejected')} className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-3 py-2 text-xs text-rose-700 disabled:opacity-50"><X className="h-3.5 w-3.5" /> Reject</button>}{canSend && <button type="button" disabled={busy === r.id} onClick={() => void changeStatus(r, 'sent')} className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 px-3 py-2 text-xs text-emerald-700 disabled:opacity-50">Send request</button>}{cancel && <button type="button" disabled={busy === r.id} onClick={() => void changeStatus(r, 'cancelled')} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs disabled:opacity-50"><Ban className="h-3.5 w-3.5" /> Cancel</button>}{busy === r.id && <Loader2 className="h-4 w-4 animate-spin" />}</div></div></div>;
      })}</div>}
    </div>
  </div>;
}
