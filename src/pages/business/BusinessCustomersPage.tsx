import React, { useEffect, useMemo, useState } from 'react';
import { Users, MessageSquare, Loader2, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';

type CustomerOrder = {
  id: string;
  customerId: string;
  totalAmount?: number;
  currency?: string;
  status?: string;
  createdAt?: any;
  items?: Array<{ quantity?: number }>;
};

type CustomerSummary = {
  customerId: string;
  orderCount: number;
  totalSpent: number;
  currency: string;
  lastOrderAt: Date | null;
  status: string;
};

const asDate = (value: any) => {
  if (!value) return null;
  if (typeof value?.toDate === 'function') return value.toDate();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const money = (amount: number, currency = 'NGN') =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount);

export default function BusinessCustomersPage() {
  const { currentUser } = useAuth();
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadCustomers = async () => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const snapshot = await getDocs(
        query(collection(db, 'orders'), where('sellerId', '==', currentUser.uid))
      );
      setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CustomerOrder)));
    } catch (err) {
      console.error('Business customers load failed:', err);
      setError('We could not load customer data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCustomers();
  }, [currentUser?.uid]);

  const customers = useMemo<CustomerSummary[]>(() => {
    const map = new Map<string, CustomerSummary>();

    for (const order of orders) {
      if (!order.customerId) continue;

      const existing = map.get(order.customerId);
      const date = asDate(order.createdAt);
      const amount = Number(order.totalAmount || 0);

      if (!existing) {
        map.set(order.customerId, {
          customerId: order.customerId,
          orderCount: 1,
          totalSpent: amount,
          currency: order.currency || 'NGN',
          lastOrderAt: date,
          status: ['cancelled', 'refunded'].includes(String(order.status)) ? 'Inactive' : 'Active',
        });
      } else {
        existing.orderCount += 1;
        existing.totalSpent += amount;
        if (!existing.lastOrderAt || (date && date > existing.lastOrderAt)) {
          existing.lastOrderAt = date;
        }
        if (!['cancelled', 'refunded'].includes(String(order.status))) {
          existing.status = 'Active';
        }
      }
    }

    return Array.from(map.values()).sort(
      (a, b) => (b.lastOrderAt?.getTime() || 0) - (a.lastOrderAt?.getTime() || 0)
    );
  }, [orders]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Customers</h1>
          <p className="text-sm text-slate-500 mt-1">Customers are shown from your real Unique Store orders.</p>
        </div>
        <button
          onClick={() => void loadCustomers()}
          disabled={loading}
          className="bg-white border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw className={`inline w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="bg-white border border-slate-200 rounded-3xl p-12 flex justify-center">
          <Loader2 className="w-7 h-7 animate-spin text-slate-400" />
        </div>
      ) : customers.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center">
          <Users className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-900">No customers yet</h3>
          <p className="text-slate-500 mt-1">
            Customers will appear here automatically when they place real orders with your business.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden">
          <div className="divide-y divide-slate-100">
            {customers.map(customer => (
              <div key={customer.customerId} className="p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-slate-900 truncate">{customer.customerId}</p>
                    <span className={`px-2 py-1 text-xs font-bold rounded-md ${customer.status === 'Active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                      {customer.status}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 mt-1">
                    {customer.orderCount} order{customer.orderCount === 1 ? '' : 's'} ·
                    {' '}{money(customer.totalSpent, customer.currency)} total
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Last order: {customer.lastOrderAt?.toLocaleString('en-NG') || 'Date unavailable'}
                  </p>
                </div>
                <Link
                  to={`/os/messages/new?customer=${encodeURIComponent(customer.customerId)}`}
                  className="text-sm font-medium text-blue-600 hover:underline flex items-center gap-1 shrink-0"
                >
                  <MessageSquare className="w-4 h-4" />
                  Message Customer
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
