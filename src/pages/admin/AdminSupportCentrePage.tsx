import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle, ArrowUpRight, CheckCircle2, Clock3, Headphones, LoaderCircle,
  MessageSquare, RefreshCw, Send, ShieldCheck, UserRound, Users,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

type SupportCase = {
  id: string;
  userUid: string;
  subject: string;
  category: string;
  department: string;
  orderReference?: string | null;
  status: string;
  priority: string;
  assignedToUid?: string | null;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
};

type SupportMessage = {
  id: string;
  senderType: 'customer' | 'support';
  senderLabel: string;
  body: string;
  createdAt: string;
};

type SupportAgent = { uid: string; displayName: string; roles: string[] };

const STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  in_progress: 'In progress',
  waiting_for_customer: 'Waiting for customer',
  resolved: 'Resolved',
  closed: 'Closed',
};

function formatDate(value?: string) {
  if (!value) return 'Just now';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Recently updated' : date.toLocaleString();
}

export default function AdminSupportCentrePage() {
  const { currentUser, hasPermission } = useAuth();
  const [cases, setCases] = useState<SupportCase[]>([]);
  const [staff, setStaff] = useState<SupportAgent[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [reply, setReply] = useState('');
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const tokenHeaders = useCallback(async () => {
    if (!currentUser) throw new Error('Please sign in again.');
    return {
      Authorization: `Bearer ${await currentUser.getIdToken()}`,
      'Content-Type': 'application/json',
    };
  }, [currentUser]);

  const loadQueue = useCallback(async (keepSelection = true) => {
    if (!currentUser) return;
    setLoading(true);
    setError('');
    try {
      const headers = await tokenHeaders();
      const [queueResponse, staffResponse] = await Promise.all([
        fetch('/api/admin/support/cases?limit=100', { headers }),
        fetch('/api/admin/support/staff', { headers }),
      ]);
      if (!queueResponse.ok || !staffResponse.ok) throw new Error('The support queue could not be loaded. Check your support permissions and try again.');
      const queueData = await queueResponse.json();
      const staffData = await staffResponse.json();
      const nextCases: SupportCase[] = Array.isArray(queueData.cases) ? queueData.cases : [];
      setCases(nextCases);
      setStaff(Array.isArray(staffData.staff) ? staffData.staff : []);
      if (!keepSelection || !nextCases.some(item => item.id === selectedId)) {
        setSelectedId(nextCases[0]?.id || '');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load support cases.');
    } finally {
      setLoading(false);
    }
  }, [currentUser, selectedId, tokenHeaders]);

  const loadMessages = useCallback(async (caseId: string) => {
    if (!currentUser || !caseId) {
      setMessages([]);
      return;
    }
    setMessagesLoading(true);
    try {
      const headers = await tokenHeaders();
      const response = await fetch(`/api/support/cases/${encodeURIComponent(caseId)}/messages`, { headers });
      if (!response.ok) throw new Error('Could not load this case conversation.');
      const data = await response.json();
      setMessages(Array.isArray(data.messages) ? data.messages : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load messages.');
    } finally {
      setMessagesLoading(false);
    }
  }, [currentUser, tokenHeaders]);

  useEffect(() => {
    void loadQueue(false);
  }, [currentUser, loadQueue]);

  useEffect(() => {
    void loadMessages(selectedId);
  }, [selectedId, loadMessages]);

  const updateCase = async (patch: Record<string, unknown>) => {
    if (!selectedId) return;
    setNotice('');
    setError('');
    try {
      const headers = await tokenHeaders();
      const response = await fetch(`/api/admin/support/cases/${encodeURIComponent(selectedId)}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(patch),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error?.message || 'Could not update the case.');
      setCases(previous => previous.map(item => item.id === selectedId ? { ...item, ...patch, updatedAt: data.updatedAt || new Date().toISOString() } : item));
      setNotice('Case updated.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update the case.');
    }
  };

  const sendReply = async (event: React.FormEvent) => {
    event.preventDefault();
    const body = reply.trim();
    if (!selectedId || !body || sending) return;
    setSending(true);
    setError('');
    setNotice('');
    try {
      const headers = await tokenHeaders();
      const response = await fetch(`/api/support/cases/${encodeURIComponent(selectedId)}/messages`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ message: body }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error?.message || 'The reply could not be sent.');
      if (data.message) setMessages(previous => [...previous, data.message]);
      setReply('');
      setNotice('Reply sent as UniquePlatform Support.');
      await loadQueue(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The reply could not be sent.');
    } finally {
      setSending(false);
    }
  };

  const selectedCase = cases.find(item => item.id === selectedId) || null;
  const filteredCases = cases.filter(item => filter === 'all' || item.status === filter);
  const openCount = cases.filter(item => ['open', 'in_progress'].includes(item.status)).length;

  if (!hasPermission('manage:support')) {
    return <div className="mx-auto max-w-2xl p-6"><div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-800"><ShieldCheck className="mb-3 h-8 w-8" /><h1 className="text-xl font-bold">Restricted Support Centre</h1><p className="mt-2 text-sm">Your account does not have permission to access support cases. Ask the Super Admin to grant the appropriate support role.</p></div></div>;
  }

  return (
    <main className="mx-auto w-full max-w-7xl space-y-5 p-3 pb-10 sm:p-6">
      <header className="flex flex-col gap-4 rounded-2xl bg-slate-950 p-5 text-white sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-emerald-400/15 p-3 text-emerald-300"><Headphones className="h-7 w-7" /></div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">UniquePlatform Operations</p>
            <h1 className="mt-1 text-2xl font-bold sm:text-3xl">Support Centre</h1>
            <p className="mt-1 max-w-xl text-sm text-slate-300">One company identity, specialist teams, and case history tied to the platform.</p>
          </div>
        </div>
        <button type="button" onClick={() => void loadQueue(true)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-sm font-semibold hover:bg-white/10"><RefreshCw className="h-4 w-4" /> Refresh queue</button>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-center gap-2 text-sm text-slate-500"><MessageSquare className="h-4 w-4" /> Total cases</div><p className="mt-2 text-2xl font-bold text-slate-900">{cases.length}</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-center gap-2 text-sm text-slate-500"><Clock3 className="h-4 w-4" /> Active</div><p className="mt-2 text-2xl font-bold text-slate-900">{openCount}</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-center gap-2 text-sm text-slate-500"><Users className="h-4 w-4" /> Authorised agents</div><p className="mt-2 text-2xl font-bold text-slate-900">{staff.length}</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-center gap-2 text-sm text-slate-500"><ShieldCheck className="h-4 w-4" /> Phone privacy</div><p className="mt-2 text-sm font-bold text-emerald-700">Restricted by default</p></div>
      </section>

      {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div>}
      {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}

      <section className="grid min-h-[520px] gap-4 lg:grid-cols-[minmax(280px,0.85fr)_minmax(0,1.5fr)]">
        <aside className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 p-4">
            <h2 className="font-bold text-slate-900">Case queue</h2>
            <select value={filter} onChange={e => setFilter(e.target.value)} aria-label="Filter support cases" className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs">
              <option value="all">All statuses</option>
              <option value="open">Open</option>
              <option value="in_progress">In progress</option>
              <option value="waiting_for_customer">Waiting for customer</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
          </div>
          <div className="max-h-[620px] overflow-y-auto">
            {loading ? <div className="flex items-center justify-center gap-2 p-10 text-sm text-slate-500"><LoaderCircle className="h-4 w-4 animate-spin" /> Loading cases…</div>
              : filteredCases.length === 0 ? <div className="p-8 text-center"><CheckCircle2 className="mx-auto h-9 w-9 text-emerald-600" /><p className="mt-3 font-semibold text-slate-800">No cases in this view</p><p className="mt-1 text-sm text-slate-500">New customer requests will appear here when submitted.</p></div>
              : filteredCases.map(item => <button type="button" key={item.id} onClick={() => setSelectedId(item.id)} className={`block w-full border-b border-slate-100 p-4 text-left transition hover:bg-slate-50 ${selectedId === item.id ? 'bg-emerald-50/70 ring-1 ring-inset ring-emerald-200' : ''}`}>
                  <div className="flex items-start justify-between gap-2"><span className="line-clamp-2 font-semibold text-slate-900">{item.subject}</span><span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase text-slate-600">{item.priority}</span></div>
                  <p className="mt-1 text-xs text-slate-500">{item.department} · {STATUS_LABELS[item.status] || item.status}</p>
                  <p className="mt-2 text-[11px] text-slate-400">{formatDate(item.updatedAt)} · {item.messageCount || 0} messages</p>
                </button>)}
          </div>
        </aside>

        <section className="flex min-h-[520px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {selectedCase ? <>
            <header className="space-y-3 border-b border-slate-100 p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{selectedCase.department} · {selectedCase.id}</p><h2 className="mt-1 text-lg font-bold text-slate-900">{selectedCase.subject}</h2>{selectedCase.orderReference && <p className="mt-1 text-xs text-slate-500">Order reference: {selectedCase.orderReference}</p>}</div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{STATUS_LABELS[selectedCase.status] || selectedCase.status}</span></div>
              <div className="grid gap-2 sm:grid-cols-3">
                <label className="text-xs font-semibold text-slate-600">Status<select value={selectedCase.status} onChange={e => void updateCase({ status: e.target.value })} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm font-normal text-slate-900">{Object.entries(STATUS_LABELS).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                <label className="text-xs font-semibold text-slate-600">Priority<select value={selectedCase.priority} onChange={e => void updateCase({ priority: e.target.value })} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm font-normal text-slate-900"><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></label>
                <label className="text-xs font-semibold text-slate-600">Assigned agent<select value={selectedCase.assignedToUid || ''} onChange={e => void updateCase({ assignedToUid: e.target.value || null })} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm font-normal text-slate-900"><option value="">Unassigned</option>{staff.map(agent => <option key={agent.uid} value={agent.uid}>{agent.displayName}</option>)}</select></label>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500"><UserRound className="h-4 w-4" /> Customer ID: {selectedCase.userUid} <span className="text-emerald-700">· Phone number hidden</span></div>
            </header>
            <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50/70 p-4">
              {messagesLoading ? <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500"><LoaderCircle className="h-4 w-4 animate-spin" /> Loading conversation…</div>
                : messages.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">No messages yet.</p>
                : messages.map(message => <div key={message.id} className={`flex ${message.senderType === 'support' ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[92%] rounded-2xl px-4 py-3 sm:max-w-[80%] ${message.senderType === 'support' ? 'bg-emerald-700 text-white' : 'border border-slate-200 bg-white text-slate-800'}`}><div className="mb-1 flex items-center gap-2 text-[11px] font-semibold opacity-75"><span>{message.senderType === 'support' ? 'UniquePlatform Support' : 'Customer'}</span><span>·</span><span>{formatDate(message.createdAt)}</span></div><p className="whitespace-pre-wrap break-words text-sm">{message.body}</p></div></div>)}
            </div>
            <form onSubmit={sendReply} className="border-t border-slate-100 bg-white p-3 sm:p-4">
              <label htmlFor="support-reply" className="mb-2 block text-xs font-semibold text-slate-600">Reply as UniquePlatform Support</label>
              <div className="flex items-end gap-2"><textarea id="support-reply" value={reply} onChange={e => setReply(e.target.value)} maxLength={4000} rows={2} placeholder="Write a clear, professional response…" className="min-h-[48px] flex-1 resize-y rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" /><button type="submit" disabled={!reply.trim() || sending} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{sending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}<span className="hidden sm:inline">Send</span></button></div>
              <p className="mt-2 text-[11px] text-slate-500">Replies use the shared company identity. Do not ask customers to send passwords, PINs or OTPs.</p>
            </form>
          </> : <div className="flex flex-1 flex-col items-center justify-center p-8 text-center"><div className="rounded-full bg-emerald-50 p-4 text-emerald-700"><Headphones className="h-8 w-8" /></div><h2 className="mt-4 text-lg font-bold text-slate-900">Select a support case</h2><p className="mt-1 max-w-sm text-sm text-slate-500">Choose a case from the queue to view messages, assign an authorised agent and respond as UniquePlatform Support.</p><a href="/support" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 hover:underline">Customer support page <ArrowUpRight className="h-4 w-4" /></a></div>}
        </section>
      </section>
      <p className="text-xs leading-5 text-slate-500">Privacy rule: this queue does not display customer phone numbers. Full-number access is a separate restricted permission and must be audited. WhatsApp is not connected by this dashboard yet; this is the internal case centre.</p>
    </main>
  );
}
