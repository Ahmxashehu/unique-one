import React, { useEffect, useMemo, useState } from 'react';
import {
  ShoppingBag, Users, DollarSign, Package, FileText,
  ArrowDownRight, ShieldAlert, Plus, CreditCard, UserPlus, Box,
  Loader2, RefreshCw
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';

type DashboardOrder = {
  id: string;
  customerId: string;
  items?: Array<{ name?: string; quantity?: number; price?: number }>;
  totalAmount?: number;
  currency?: string;
  status?: string;
  createdAt?: any;
};

type DashboardInvoice = {
  id: string;
  sellerId: string;
  total?: number;
  currency?: string;
  status?: string;
  dueDate?: string;
  createdAt?: any;
};

type DashboardProduct = {
  id: string;
  name: string;
  quantity?: number;
  price?: number;
  currency?: string;
  status?: string;
};

type DashboardTransaction = {
  id: string;
  reference?: string;
  senderId?: string;
  recipientId?: string;
  amount?: number;
  currency?: string;
  type?: string;
  status?: string;
  createdAt?: any;
};

const asDate = (value: any) => {
  if (!value) return null;
  if (typeof value?.toDate === 'function') return value.toDate();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const money = (amount: number, currency = 'NGN') =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount);

export default function SellerDashboardPage() {
  const { currentUser } = useAuth();
  const [orders, setOrders] = useState<DashboardOrder[]>([]);
  const [invoices, setInvoices] = useState<DashboardInvoice[]>([]);
  const [products, setProducts] = useState<DashboardProduct[]>([]);
  const [transactions, setTransactions] = useState<DashboardTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDashboard = async () => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const [orderSnap, invoiceSnap, productSnap, sentTxSnap, receivedTxSnap] = await Promise.all([
        getDocs(query(collection(db, 'orders'), where('sellerId', '==', currentUser.uid))),
        getDocs(query(collection(db, 'invoices'), where('sellerId', '==', currentUser.uid))),
        getDocs(query(collection(db, 'products'), where('sellerId', '==', currentUser.uid))),
        getDocs(query(collection(db, 'transactions'), where('senderId', '==', currentUser.uid))),
        getDocs(query(collection(db, 'transactions'), where('recipientId', '==', currentUser.uid))),
      ]);

      setOrders(orderSnap.docs.map(d => ({ id: d.id, ...d.data() } as DashboardOrder)));
      setInvoices(invoiceSnap.docs.map(d => ({ id: d.id, ...d.data() } as DashboardInvoice)));
      setProducts(productSnap.docs.map(d => ({ id: d.id, ...d.data() } as DashboardProduct)));

      const txMap = new Map<string, DashboardTransaction>();
      [...sentTxSnap.docs, ...receivedTxSnap.docs].forEach(d => {
        txMap.set(d.id, { id: d.id, ...d.data() } as DashboardTransaction);
      });
      setTransactions(Array.from(txMap.values()));
    } catch (err) {
      console.error('Business dashboard load failed:', err);
      setError('We could not load your live business data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDashboard();
  }, [currentUser?.uid]);

  const stats = useMemo(() => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const completedSales = orders
      .filter(order => ['confirmed', 'processing', 'ready_for_pickup', 'shipped', 'out_for_delivery', 'delivered', 'completed'].includes(String(order.status)))
      .filter(order => {
        const created = asDate(order.createdAt);
        return created ? created >= startOfToday : false;
      })
      .reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);

    const pending = orders.filter(order =>
      ['pending', 'confirmed', 'processing', 'ready_for_pickup', 'shipped', 'out_for_delivery'].includes(String(order.status))
    ).length;

    const unpaid = invoices.filter(invoice =>
      ['draft', 'sent', 'viewed', 'partially_paid', 'overdue'].includes(String(invoice.status))
    ).length;

    const lowStock = products.filter(product =>
      Number(product.quantity ?? 0) <= 10 && product.status !== 'draft'
    ).length;

    return { completedSales, pending, unpaid, lowStock };
  }, [orders, invoices, products]);

  const recentTransactions = useMemo(() =>
    [...transactions]
      .sort((a, b) => (asDate(b.createdAt)?.getTime() || 0) - (asDate(a.createdAt)?.getTime() || 0))
      .slice(0, 5),
    [transactions]
  );

  const inventoryAlerts = useMemo(() =>
    products
      .filter(product => Number(product.quantity ?? 0) <= 10 && product.status !== 'draft')
      .sort((a, b) => Number(a.quantity ?? 0) - Number(b.quantity ?? 0))
      .slice(0, 4),
    [products]
  );

  const recentOrders = useMemo(() =>
    [...orders]
      .sort((a, b) => (asDate(b.createdAt)?.getTime() || 0) - (asDate(a.createdAt)?.getTime() || 0))
      .slice(0, 5),
    [orders]
  );

  const statsCards = [
    { label: "Today's Sales", value: money(stats.completedSales), icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Pending Orders', value: String(stats.pending), icon: ShoppingBag, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Unpaid Invoices', value: String(stats.unpaid), icon: FileText, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Low Stock Items', value: String(stats.lowStock), icon: Package, color: 'text-rose-600', bg: 'bg-rose-50' },
  ];

  const quickActions = [
    { label: 'Add Product', icon: Box, to: '/os/business/catalog/new-product' },
    { label: 'Create Order', icon: ShoppingBag, to: '/os/business/orders/new' },
    { label: 'Create Invoice', icon: FileText, to: '/os/invoices/new' },
    { label: 'Request Payment', icon: ArrowDownRight, to: '/os/payment-requests/new' },
    { label: 'Add Customer', icon: UserPlus, to: '/os/business/customers/new' },
    { label: 'Record Expense', icon: CreditCard, to: '/os/business/finance/expense' },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Business Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">Live overview of your operations, inventory, orders, and finances.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => void loadDashboard()} disabled={loading} className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors disabled:opacity-50">
            <RefreshCw className={`inline w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <Link to="/store" className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors">Open Store</Link>
          <Link to="/os/pay" className="bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors">UniquePay</Link>
        </div>
      </div>

      {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${stat.bg} ${stat.color} mb-4`}><Icon className="w-6 h-6" /></div>
              {loading ? <Loader2 className="w-6 h-6 animate-spin text-slate-400" /> : <h3 className="text-2xl font-bold text-slate-900">{stat.value}</h3>}
              <p className="text-sm font-medium text-slate-500 mt-1">{stat.label}</p>
            </div>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8">
            <h3 className="font-semibold text-slate-900 mb-6">Quick Actions</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {quickActions.map(action => (
                <Link key={action.label} to={action.to} className="flex flex-col items-center justify-center gap-3 p-4 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-100 transition-colors text-center group">
                  <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-slate-600 group-hover:text-slate-900 transition-colors"><action.icon className="w-5 h-5" /></div>
                  <span className="text-sm font-medium text-slate-700">{action.label}</span>
                </Link>
              ))}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold text-slate-900">Recent Transactions</h3>
              <div className="flex gap-4">
                <Link to="/os/business/finance" className="text-sm text-blue-600 font-medium hover:underline">View Ledger</Link>
                <Link to="/os/messages/new?context=team" className="text-sm text-blue-600 font-medium hover:underline">Team Chat</Link>
              </div>
            </div>
            {loading ? <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div> :
              recentTransactions.length === 0 ? <p className="text-sm text-slate-500 text-center py-8">No transactions yet.</p> :
              <div className="space-y-3">
                {recentTransactions.map(tx => (
                  <div key={tx.id} className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{tx.reference || tx.type || 'Transaction'}</p>
                      <p className="text-xs text-slate-500">{asDate(tx.createdAt)?.toLocaleString('en-NG') || 'Date unavailable'} · {tx.status || 'unknown'}</p>
                    </div>
                    <span className="text-sm font-semibold text-slate-900">{money(Number(tx.amount || 0), tx.currency || 'NGN')}</span>
                  </div>
                ))}
              </div>
            }
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold text-slate-900">Inventory Alerts</h3>
              <Link to="/os/business/inventory" className="text-sm text-blue-600 font-medium hover:underline">Manage</Link>
            </div>
            {loading ? <Loader2 className="w-6 h-6 animate-spin text-slate-400" /> :
              inventoryAlerts.length === 0 ? <p className="text-sm text-slate-500 text-center py-6">No low-stock items.</p> :
              <div className="space-y-3">
                {inventoryAlerts.map(product => (
                  <div key={product.id} className="flex items-start gap-3 p-3 bg-amber-50 rounded-xl border border-amber-100">
                    <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{product.name}</p>
                      <p className="text-xs text-amber-700 mt-0.5">{Number(product.quantity ?? 0) === 0 ? 'Out of stock' : `Low stock: ${product.quantity} remaining`}</p>
                    </div>
                  </div>
                ))}
              </div>
            }
          </div>

          <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold text-slate-900">Recent Customer Activity</h3>
              <Link to="/os/business/activity" className="text-sm text-blue-600 font-medium hover:underline">View All</Link>
            </div>
            {loading ? <Loader2 className="w-6 h-6 animate-spin text-slate-400" /> :
              recentOrders.length === 0 ? <p className="text-sm text-slate-500 text-center py-6">No recent customer activity.</p> :
              <div className="space-y-3">
                {recentOrders.map(order => (
                  <div key={order.id} className="border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                    <p className="text-sm font-medium text-slate-900">Order {order.id}</p>
                    <p className="text-xs text-slate-500">{order.items?.reduce((n, item) => n + Number(item.quantity || 0), 0) || 0} item(s) · {order.status || 'unknown'}</p>
                  </div>
                ))}
              </div>
            }
          </div>
        </div>
      </div>
    </div>
  );
}
