import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  AlertCircle, ArrowLeft, CheckCircle2, Clock3, Headphones,
  LoaderCircle, MessageSquare, PlusCircle, Send, ShieldCheck,
} from 'lucide-react';

type SupportCase = {
  id: string;
  subject: string;
  category: string;
  department: string;
  orderReference?: string | null;
  status: string;
  priority: string;
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
const categories = [
  { value: 'payment', label: 'UniquePay / Payment' },
  { value: 'store', label: 'Store / Product order' },
  { value: 'booking', label: 'Flights / Hotels / Tickets / Booking' },
  { value: 'delivery', label: 'Shipping / Delivery' },
  { value: 'restaurant', label: 'Restaurant / Service' },
  { value: 'account', label: 'Account / Security' },
  { value: 'other', label: 'Other question' },
];
const statusLabels: Record<string, string> = {
  open: 'Open',
  in_progress: 'In progress',
  waiting_for_customer: 'Waiting for your reply',
  resolved: 'Resolved',
  closed: 'Closed',
};
function formatDate(value?: string) {
  if (!value) return 'Just now';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Recently updated' : date.toLocaleString();
}

export default function SupportPage() {
  const { currentUser, isAuthenticated } = useAuth();
  const [cases, setCases] = useState<SupportCase[]>([]);
  const [activeId, setActiveId] = useState('');
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [category, setCategory] = useState('other');
  const [subject, setSubject] = useState('');
  const [orderReference, setOrderReference] = useState('');
  const [message, setMessage] = useState('');
  const [reply, setReply] = useState('');
  const [creating, setCreating] = useState(false);
  const [sending, setSending] = useState(false);
  const [loadingCases, setLoadingCases] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const headers = useCallback(async () => {
    if (!currentUser) throw new Error('Please sign in to continue.');
    return { Authorization: `Bearer ${await currentUser.getIdToken()}`, 'Content-Type': 'application/json' };
  }, [currentUser]);

  const loadCases = useCallback(async () => {
    if (!currentUser) return;
    setLoadingCases(true);
    try {
      const response = await fetch('/api/support/cases', { headers: await headers() });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error?.message || 'Your support cases could not be loaded.');
      const next: SupportCase[] = Array.isArray(data.cases) ? data.cases : [];
      setCases(next);
      setActiveId(current => current && next.some(item => item.id === current) ? current : (next[0]?.id || ''));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Your support cases could not be loaded.');
    } finally {
      setLoadingCases(false);
    }
  }, [currentUser, headers]);

  const loadMessages = useCallback(async (caseId: string) => {
    if (!currentUser || !caseId) {
      setMessages([]);
      return;
    }
    setLoadingMessages(true);
    try {
      const response = await fetch(`/api/support/cases/${encodeURIComponent(caseId)}/messages`, { headers: await headers() });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error?.message || 'The conversation could not be loaded.');
      setMessages(Array.isArray(data.messages) ? data.messages : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The conversation could not be loaded.');
    } finally {
      setLoadingMessages(false);
    }
  }, [currentUser, headers]);

  useEffect(() => {
    if (currentUser) void loadCases();
  }, [currentUser, loadCases]);

  useEffect(() => {
    void loadMessages(activeId);
  }, [activeId, loadMessages]);

  const createCase = async (event: React.FormEvent) => {
    event.preventDefault();
    if (creating) return;
    setCreating(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/support/cases', {
        method: 'POST',
        headers: await headers(),
        body: JSON.stringify({ category, subject, orderReference, message }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error?.message || 'Your support request could not be created.');
      setSubject('');
      setOrderReference('');
      setMessage('');
      setShowForm(false);
      setNotice('Your support case has been created. Keep the case reference for follow-up.');
      if (data.case?.id) setActiveId(data.case.id);
      await loadCases();
      if (data.case?.id) setActiveId(data.case.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Your support request could not be created.');
    } finally {
      setCreating(false);
    }
  };

  const sendReply = async (event: React.FormEvent) => {
    event.preventDefault();
    const body = reply.trim();
    if (!activeId || !body || sending) return;
    setSending(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch(`/api/support/cases/${encodeURIComponent(activeId)}/messages`, {
        method: 'POST',
        headers: await headers(),
        body: JSON.stringify({ message: body }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error?.message || 'Your reply could not be sent.');
      if (data.message) setMessages(previous => [...previous, data.message]);
      setReply('');
      setNotice('Your reply was sent.');
      await loadCases();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Your reply could not be sent.');
    } finally {
      setSending(false);
    }
  };

  const activeCase = cases.find(item => item.id === activeId) || null;

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8 sm:px-6 sm:py-12">
      <header className="rounded-3xl bg-slate-950 p-6 text-white sm:p-8">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-emerald-400/15 p-3 text-emerald-300"><Headphones className="h-8 w-8" /></div>
          <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">One company. Specialist teams.</p><h1 className="mt-2 text-3xl font-bold sm:text-4xl">UniquePlatform Support</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">Get help with payments, products, shipping, bookings, tickets and your account. Your case stays connected to UniquePlatform so you do not have to explain the issue repeatedly.</p></div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2 text-xs font-medium"><span className="rounded-full bg-white/10 px-3 py-1.5">Private case history</span><span className="rounded-full bg-white/10 px-3 py-1.5">Order reference support</span><span className="rounded-full bg-white/10 px-3 py-1.5">One official support identity</span></div>
      </header>

      {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div>}
      {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}

      {!isAuthenticated ? <section className="rounded-2xl border border-slate-200 bg-white p-6 text-center sm:p-10"><ShieldCheck className="mx-auto h-10 w-10 text-emerald-700" /><h2 className="mt-4 text-xl font-bold text-slate-900">Sign in for protected support</h2><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-600">Sign in to create a trackable case connected to your orders and bookings. We do not display your registered phone number to suppliers through this support page.</p><Link to="/login" className="mt-5 inline-flex rounded-xl bg-emerald-700 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-800">Sign in to contact support</Link></section> : (
        <section className="grid gap-5 lg:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.4fr)]">
          <aside className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 p-4"><div><h2 className="font-bold text-slate-900">My support cases</h2><p className="mt-1 text-xs text-slate-500">Private to your account</p></div><button type="button" onClick={() => { setShowForm(value => !value); setError(''); }} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-3 py-2 text-xs font-bold text-white"><PlusCircle className="h-4 w-4" /> New case</button></div>
            {showForm && <form onSubmit={createCase} className="space-y-3 border-b border-slate-100 bg-slate-50 p-4">
              <label className="block text-xs font-semibold text-slate-700">Department<select value={category} onChange={e => setCategory(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal">{categories.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
              <label className="block text-xs font-semibold text-slate-700">Subject<input value={subject} onChange={e => setSubject(e.target.value)} required minLength={3} maxLength={160} placeholder="What do you need help with?" className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal" /></label>
              <label className="block text-xs font-semibold text-slate-700">Order or booking reference (optional)<input value={orderReference} onChange={e => setOrderReference(e.target.value)} maxLength={128} placeholder="e.g. order / booking reference" className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal" /></label>
              <label className="block text-xs font-semibold text-slate-700">Message<textarea value={message} onChange={e => setMessage(e.target.value)} required minLength={5} maxLength={4000} rows={4} placeholder="Explain the issue. Never include your password, PIN or OTP." className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal" /></label>
              <button type="submit" disabled={creating} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{creating ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Submit support case</button>
            </form>}
            <div className="max-h-[560px] overflow-y-auto">
              {loadingCases ? <div className="flex items-center justify-center gap-2 p-8 text-sm text-slate-500"><LoaderCircle className="h-4 w-4 animate-spin" /> Loading your cases…</div>
                : cases.length === 0 ? <div className="p-8 text-center"><MessageSquare className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-3 text-sm font-semibold text-slate-800">No support cases yet</p><p className="mt-1 text-xs text-slate-500">Create a case and the support team can reply here.</p></div>
                : cases.map(item => <button type="button" key={item.id} onClick={() => setActiveId(item.id)} className={`block w-full border-b border-slate-100 p-4 text-left hover:bg-slate-50 ${activeId === item.id ? 'bg-emerald-50 ring-1 ring-inset ring-emerald-200' : ''}`}><div className="font-semibold text-slate-900">{item.subject}</div><div className="mt-1 text-xs text-slate-500">{item.department}</div><div className="mt-2 flex items-center justify-between gap-2"><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">{statusLabels[item.status] || item.status}</span><span className="text-[10px] text-slate-400">{formatDate(item.updatedAt)}</span></div></button>)}
            </div>
          </aside>

          <section className="flex min-h-[460px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {activeCase ? <>
              <header className="border-b border-slate-100 p-4 sm:p-5"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Case {activeCase.id}</p><h2 className="mt-1 text-lg font-bold text-slate-900">{activeCase.subject}</h2><div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500"><span>{activeCase.department}</span><span>·</span><span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" /> {statusLabels[activeCase.status] || activeCase.status}</span></div></header>
              <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50/70 p-4">
                {loadingMessages ? <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500"><LoaderCircle className="h-4 w-4 animate-spin" /> Loading conversation…</div>
                  : messages.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">No messages in this case yet.</p>
                  : messages.map(item => <div key={item.id} className={`flex ${item.senderType === 'support' ? 'justify-start' : 'justify-end'}`}><div className={`max-w-[92%] rounded-2xl px-4 py-3 sm:max-w-[80%] ${item.senderType === 'support' ? 'border border-emerald-100 bg-white text-slate-800' : 'bg-emerald-700 text-white'}`}><div className="mb-1 flex items-center gap-2 text-[11px] font-semibold opacity-70"><span>{item.senderType === 'support' ? 'UniquePlatform Support' : 'You'}</span><span>·</span><span>{formatDate(item.createdAt)}</span></div><p className="whitespace-pre-wrap break-words text-sm">{item.body}</p></div></div>)}
              </div>
              {activeCase.status !== 'closed' && <form onSubmit={sendReply} className="border-t border-slate-100 p-3 sm:p-4"><label htmlFor="customer-support-reply" className="mb-2 block text-xs font-semibold text-slate-600">Reply to this case</label><div className="flex items-end gap-2"><textarea id="customer-support-reply" value={reply} onChange={e => setReply(e.target.value)} maxLength={4000} rows={2} placeholder="Write your reply…" className="min-h-[48px] flex-1 resize-y rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" /><button type="submit" disabled={!reply.trim() || sending} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-bold text-white disabled:opacity-50">{sending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}<span className="hidden sm:inline">Send</span></button></div></form>}
            </> : <div className="flex flex-1 flex-col items-center justify-center p-8 text-center"><CheckCircle2 className="h-9 w-9 text-emerald-700" /><h2 className="mt-3 font-bold text-slate-900">Your support space</h2><p className="mt-1 max-w-sm text-sm text-slate-500">Select a case to read the conversation, or create a new case to contact the support team.</p></div>}
          </section>
        </section>
      )}

      <footer className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" /><div><p className="text-sm font-semibold text-slate-800">Your contact details stay private by default</p><p className="mt-1 text-xs leading-5 text-slate-500">Support staff work from your case and order reference. Do not send passwords, payment PINs or one-time codes. Official WhatsApp integration is a later step and is not connected yet.</p></div></footer>
      <div className="text-center"><Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-800"><ArrowLeft className="h-4 w-4" /> Back to UniquePlatform</Link></div>
    </main>
  );
}
