import React, { useEffect, useState } from 'react';
import { FileText, Loader2, PackageSearch, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';

type ProductRequest = {
  id: string;
  title: string;
  description: string;
  quantity: number;
  budget: number;
  status: 'draft' | 'published' | string;
  createdAt?: unknown;
};

function getTimestampMillis(value: unknown) {
  if (!value) return 0;
  if (typeof value === 'string' || typeof value === 'number') {
    const millis = new Date(value).getTime();
    return Number.isNaN(millis) ? 0 : millis;
  }
  if (typeof value === 'object' && value !== null && 'toMillis' in value && typeof (value as { toMillis?: unknown }).toMillis === 'function') {
    return (value as { toMillis: () => number }).toMillis();
  }
  return 0;
}

function formatRequestDate(value: unknown) {
  const millis = getTimestampMillis(value);
  return millis ? new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date(millis)) : '';
}

export default function StoreQuoteRequestPage() {
  const { currentUser } = useAuth();
  const [requests, setRequests] = useState<ProductRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadRequests = async () => {
      if (!currentUser) {
        setRequests([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');
      try {
        const snap = await getDocs(
          query(collection(db, 'productRequests'), where('customerId', '==', currentUser.uid))
        );

        const loaded = snap.docs.map((item) => ({ id: item.id, ...item.data() } as ProductRequest));
        loaded.sort((a, b) => getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt));
        setRequests(loaded);
      } catch (err: any) {
        setError(err.message || 'Could not load your requests.');
      } finally {
        setLoading(false);
      }
    };

    loadRequests();
  }, [currentUser]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Your Quotes & Requests</h1>
          <p className="text-sm text-slate-500 mt-1">Manage your custom product requests and track their status.</p>
        </div>
        <Link to="/store/product-request" className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors text-center">
          New Request
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center text-red-700">{error}</div>
      ) : requests.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center mt-6">
          <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileText className="w-10 h-10 text-indigo-600" />
          </div>
          <h3 className="text-xl font-semibold text-slate-900">No requests yet</h3>
          <p className="text-slate-500 mt-2 max-w-sm mx-auto">Create a request and verified sellers can review it and respond with quotes.</p>
          <Link to="/store/product-request" className="inline-flex items-center gap-2 mt-6 bg-slate-900 text-white px-5 py-2.5 rounded-xl font-medium">
            <PackageSearch className="w-4 h-4" /> Create Request
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((request) => (
            <div key={request.id} className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="font-semibold text-slate-900">{request.title}</h2>
                  <p className="text-sm text-slate-500 mt-1 line-clamp-2">{request.description}</p>
                </div>
                <span className="shrink-0 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold uppercase">{request.status}</span>
              </div>
              <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600">
                <span>Quantity: {request.quantity}</span>
                {request.budget > 0 && <span>Budget: ₦{request.budget.toLocaleString()}</span>}
                {request.createdAt && formatRequestDate(request.createdAt) && <span>{formatRequestDate(request.createdAt)}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
