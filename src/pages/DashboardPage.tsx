import React, { useEffect, useState } from 'react';
import { Activity, Users, ShoppingBag } from 'lucide-react';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

export default function DashboardPage() {
  const { currentUser, loading: authLoading } = useAuth();
  const [balanceMinor, setBalanceMinor] = useState(0);
  const [activeOrders, setActiveOrders] = useState(0);
  const [connections, setConnections] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (authLoading) return;

    let cancelled = false;

    // Never block the Home screen on secondary Firestore reads. The route must
    // render immediately; wallet/orders/connections hydrate in the background.
    setLoading(false);

    const loadDashboard = async () => {
      if (!currentUser) {
        setLoading(false);
        return;
      }

      setError('');

      try {
        const ordersRef = collection(db, 'orders');
        const [walletSnapshot, customerOrders, sellerOrders, conversationSnapshot] = await Promise.all([
          getDoc(doc(db, 'wallets', currentUser.uid)),
          getDocs(query(ordersRef, where('customerId', '==', currentUser.uid))),
          getDocs(query(ordersRef, where('sellerId', '==', currentUser.uid))),
          getDocs(query(collection(db, 'conversations'), where('participants', 'array-contains', currentUser.uid))),
        ]);

        if (cancelled) return;

        const orderIds = new Set<string>();
        const completedStatuses = new Set(['delivered', 'completed', 'cancelled', 'refunded']);

        [...customerOrders.docs, ...sellerOrders.docs].forEach((order) => {
          if (!completedStatuses.has(String(order.data().status))) {
            orderIds.add(order.id);
          }
        });

        const walletData = walletSnapshot.exists() ? walletSnapshot.data() : null;
        const walletBalance = Number(walletData?.availableBalanceMinor ?? 0);

        setBalanceMinor(Number.isSafeInteger(walletBalance) && walletBalance >= 0 ? walletBalance : 0);
        setActiveOrders(orderIds.size);
        setConnections(conversationSnapshot.size);
      } catch (loadError) {
        console.error('Unable to load dashboard data:', loadError);
        if (!cancelled) setError('Some dashboard data could not be loaded.');
      } finally {
        // Data loading is intentionally non-blocking for Home navigation.
      }
    };

    void loadDashboard();

    return () => {
      cancelled = true;
    };
  }, [authLoading, currentUser]);

  if (authLoading) return null;
  if (!currentUser) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">Your live UniqueOS overview.</p>
      </div>

      {error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {error} Values shown are based only on data that could be read.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Available Balance</p>
              <h3 className="mt-2 text-3xl font-bold text-slate-900">
                ₦{(balanceMinor / 100).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
            </div>
            <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
              <Activity className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 text-sm font-medium text-slate-500">
            Current UniquePay wallet balance
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Active Orders</p>
              <h3 className="mt-2 text-3xl font-bold text-slate-900">{activeOrders}</h3>
            </div>
            <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
              <ShoppingBag className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 text-sm text-slate-500">Open customer or seller orders</div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Connections</p>
              <h3 className="mt-2 text-3xl font-bold text-slate-900">{connections}</h3>
            </div>
            <div className="rounded-lg bg-indigo-50 p-2 text-indigo-600">
              <Users className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 text-sm text-slate-500">Your active conversations</div>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-50">
          <Activity className="h-8 w-8 text-slate-400" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900">No recent activity</h3>
        <p className="mx-auto mt-1 max-w-sm text-slate-500">
          Your activities, transactions, and bookings across UniqueOS will appear here.
        </p>
      </div>
    </div>
  );
}
