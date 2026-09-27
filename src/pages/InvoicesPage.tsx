import React, { useEffect, useMemo, useState } from 'react';
import { FileText, Plus, Search, Loader2, AlertCircle } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

type InvoiceItem = {
  description?: string;
  quantity?: number;
  unitPrice?: number;
  lineTotal?: number;
};

type InvoiceRecord = {
  id: string;
  customerIdentifier?: string;
  issueDate?: string;
  dueDate?: string | null;
  items?: InvoiceItem[];
  total?: number;
  currency?: string;
  status?: string;
  createdAt?: unknown;
};

function timestampMillis(value: unknown): number {
  if (value && typeof value === 'object' && 'toMillis' in value && typeof (value as { toMillis?: unknown }).toMillis === 'function') {
    return (value as { toMillis: () => number }).toMillis();
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const millis = new Date(value).getTime();
    return Number.isNaN(millis) ? 0 : millis;
  }
  return 0;
}

function formatDate(value: unknown): string {
  const millis = timestampMillis(value);
  return millis ? new Date(millis).toLocaleDateString() : '—';
}

function formatMoney(amount: unknown, currency = 'NGN'): string {
  const numeric = typeof amount === 'number' && Number.isFinite(amount) ? amount : 0;
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency, maximumFractionDigits: 2 }).format(numeric);
}

export default function InvoicesPage() {
  const { currentUser } = useAuth();
  const [searchParams] = useSearchParams();
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [tab, setTab] = useState<'all' | 'drafts'>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadInvoices() {
      if (!currentUser) {
        setInvoices([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');
      try {
        const snapshot = await getDocs(query(collection(db, 'invoices'), where('sellerId', '==', currentUser.uid)));
        const nextInvoices = snapshot.docs.map((invoiceDoc) => {
          const data = invoiceDoc.data() as Omit<InvoiceRecord, 'id'>;
          return { id: invoiceDoc.id, ...data };
        }).sort((a, b) => timestampMillis(b.createdAt) - timestampMillis(a.createdAt));

        if (!cancelled) setInvoices(nextInvoices);
      } catch (err) {
        console.error('Invoice list failed:', err);
        if (!cancelled) setError('We could not load your invoices. Please try again.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadInvoices();
    return () => { cancelled = true; };
  }, [currentUser]);

  const filteredInvoices = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return invoices.filter((invoice) => {
      if (tab === 'drafts' && invoice.status !== 'draft') return false;
      if (!normalized) return true;
      const haystack = [
        invoice.id,
        invoice.customerIdentifier,
        invoice.status,
        invoice.issueDate,
        invoice.dueDate,
        ...(invoice.items ?? []).map((item) => item.description),
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(normalized);
    });
  }, [invoices, search, tab]);

  const createdId = searchParams.get('created');

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Invoices</h1>
          <p className="text-sm text-slate-500 mt-1">Create and manage detailed bills for your customers.</p>
        </div>
        <Link to="/os/invoices/new" className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2">
          <Plus className="w-4 h-4" /> Create Invoice
        </Link>
      </div>

      {!currentUser && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Please sign in to view your invoices.
        </div>
      )}

      {createdId && !error && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          Invoice <span className="font-medium">{createdId}</span> was saved successfully.
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden">
        <div className="border-b border-slate-100 flex flex-col sm:flex-row p-2 gap-2">
          <div className="flex gap-2">
            <button type="button" onClick={() => setTab('all')} className={`px-6 py-2 rounded-lg text-sm font-semibold ${tab === 'all' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:bg-slate-50'}`}>
              All Invoices
            </button>
            <button type="button" onClick={() => setTab('drafts')} className={`px-6 py-2 rounded-lg text-sm font-medium ${tab === 'drafts' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:bg-slate-50'}`}>
              Drafts
            </button>
          </div>
          <div className="sm:ml-auto relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search invoices..."
              className="w-full sm:w-72 pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400"
            />
          </div>
        </div>

        {error && (
          <div className="m-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
          </div>
        )}

        {loading ? (
          <div className="p-12 text-center text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-3" />
            Loading invoices...
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-indigo-400" />
            </div>
            <p className="text-base font-medium text-slate-900">{search || tab === 'drafts' ? 'No matching invoices' : 'No invoices yet'}</p>
            <p className="text-sm text-slate-500 mt-1">
              {search || tab === 'drafts' ? 'Try another search or switch invoice tabs.' : "You haven't created any invoices."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredInvoices.map((invoice) => (
              <div key={invoice.id} className="p-5 hover:bg-slate-50 transition-colors">
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                  <div className="w-11 h-11 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5 text-indigo-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-slate-900 truncate">Invoice {invoice.id.slice(0, 10)}</p>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${invoice.status === 'draft' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                        {invoice.status || 'unknown'}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 mt-1">Customer: {invoice.customerIdentifier || '—'}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Issued {invoice.issueDate || '—'} · Due {invoice.dueDate || '—'} · {invoice.items?.length ?? 0} item{(invoice.items?.length ?? 0) === 1 ? '' : 's'}
                    </p>
                  </div>
                  <div className="lg:text-right">
                    <p className="font-bold text-slate-900">{formatMoney(invoice.total, invoice.currency || 'NGN')}</p>
                    <p className="text-xs text-slate-500 mt-1">Created {formatDate(invoice.createdAt)}</p>
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
