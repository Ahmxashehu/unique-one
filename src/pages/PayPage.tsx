import React, { useEffect, useState } from 'react';
import {
  ArrowDownRight, ArrowUpRight, Banknote, CalendarClock, CircleDollarSign,
  FileText, Fingerprint, Landmark, Receipt, ShieldCheck, Smartphone,
  Wallet, WalletCards, Users, Settings
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const money = (minor: number) => '₦' + (minor / 100).toLocaleString('en-NG', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export default function PayPage() {
  const { currentUser, loading: authLoading } = useAuth();
  const [balanceMinor, setBalanceMinor] = useState<number | null>(null);
  const [walletLoading, setWalletLoading] = useState(true);
  const [walletError, setWalletError] = useState('');

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    const loadWallet = async () => {
      if (!currentUser) { setWalletLoading(false); return; }
      setWalletLoading(true);
      setWalletError('');
      try {
        const token = await currentUser.getIdToken();
        const response = await fetch('/api/wallet', { headers: { Authorization: 'Bearer ' + token } });
        if (response.status === 404) {
          const initializeResponse = await fetch('/api/wallet', { method: 'POST', headers: { Authorization: 'Bearer ' + token } });
          if (!initializeResponse.ok) throw new Error('Unable to initialize wallet');
          const wallet = await initializeResponse.json() as { availableBalanceMinor?: unknown };
          const balance = Number(wallet.availableBalanceMinor);
          if (!Number.isSafeInteger(balance) || balance < 0) throw new Error('Invalid wallet balance');
          if (!cancelled) setBalanceMinor(balance);
          return;
        }
        if (!response.ok) throw new Error('Unable to load wallet');
        const wallet = await response.json() as { availableBalanceMinor?: unknown };
        const balance = Number(wallet.availableBalanceMinor);
        if (!Number.isSafeInteger(balance) || balance < 0) throw new Error('Invalid wallet balance');
        if (!cancelled) setBalanceMinor(balance);
      } catch (error) {
        console.error('Unable to load UniquePay wallet:', error);
        if (!cancelled) setWalletError('Your wallet balance could not be loaded.');
      } finally {
        if (!cancelled) setWalletLoading(false);
      }
    };
    void loadWallet();
    return () => { cancelled = true; };
  }, [authLoading, currentUser]);

  if (authLoading) return null;

  const quick = [
    { to: '/os/pay/send', icon: ArrowUpRight, title: 'Send', text: 'UniquePay or bank' },
    { to: '/os/pay/receive', icon: ArrowDownRight, title: 'Receive', text: 'ID, phone or temporary ID' },
    { to: '/os/pay/ajo', icon: CircleDollarSign, title: 'Cycle Ajo', text: 'Group contribution cycles' },
    { to: '/os/pay/verification', icon: ShieldCheck, title: 'Verify', text: 'NIN, BVN and account KYC' },
  ];

  const services = [
    { to: '/os/pay/history', icon: Receipt, title: 'Transactions' },
    { to: '/os/pay/beneficiaries', icon: Users, title: 'Beneficiaries' },
    { to: '/os/pay/school-payments', icon: FileText, title: 'School fees' },
    { to: '/os/pay/security', icon: ShieldCheck, title: 'Security' },
  ];

  const verification = [
    { icon: Fingerprint, title: 'NIN / vNIN', text: 'Identity validation' },
    { icon: Landmark, title: 'BVN', text: 'Bank identity validation' },
    { icon: Banknote, title: 'Bank account', text: 'Account ownership check' },
    { icon: Smartphone, title: 'Phone', text: 'Account phone verification' },
  ];

  return (
    <div className="space-y-6 pb-12 max-w-6xl mx-auto">
      <section className="rounded-3xl bg-slate-950 p-6 text-white md:p-8">
        <div className="flex items-start justify-between gap-4">
          <div><p className="text-sm font-medium text-emerald-300">UNIQUEPAY</p><h1 className="mt-1 text-2xl font-bold">Money, identity and everyday payments</h1><p className="mt-2 max-w-2xl text-sm text-slate-300">Your wallet, transfers, savings, Cycle Ajo and verification tools in one place.</p></div>
          <Link to="/os/pay/settings" aria-label="UniquePay settings" className="rounded-xl bg-white/10 p-3 hover:bg-white/15"><Settings className="h-5 w-5" /></Link>
        </div>
        <div className="mt-6 rounded-2xl bg-emerald-500/15 p-5">
          <p className="text-sm text-slate-300">Available Balance</p>
          <p className="mt-1 text-4xl font-bold">{walletLoading ? 'Loading…' : balanceMinor === null ? '—' : money(balanceMinor)}</p>
          {walletError && <p className="mt-2 text-sm text-amber-300">{walletError}</p>}
          <div className="mt-5 flex flex-wrap gap-3"><Link to="/os/pay/send" className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-slate-950"><ArrowUpRight className="h-4 w-4" /> Send money</Link><Link to="/os/payment-requests/new" className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm font-semibold text-white"><ArrowDownRight className="h-4 w-4" /> Request money</Link></div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {quick.map(({ to, icon: Icon, title, text }) => <Link key={to} to={to} className="rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-emerald-300 hover:bg-emerald-50"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-950 text-emerald-300"><Icon className="h-5 w-5" /></div><h2 className="mt-3 text-sm font-semibold text-slate-900">{title}</h2><p className="mt-1 text-xs leading-5 text-slate-500">{text}</p></Link>)}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6">
        <div className="flex items-center justify-between"><div><p className="text-sm font-medium text-emerald-600">Identity & KYC</p><h2 className="mt-1 text-xl font-bold text-slate-900">Verification Center</h2></div><Link to="/os/pay/verification" className="text-sm font-semibold text-emerald-700">View all</Link></div>
        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">{verification.map(({ icon: Icon, title, text }) => <Link key={title} to="/os/pay/verification" className="rounded-2xl bg-slate-50 p-4"><Icon className="h-5 w-5 text-slate-700" /><p className="mt-3 text-sm font-semibold text-slate-900">{title}</p><p className="mt-1 text-xs text-slate-500">{text}</p><span className="mt-3 inline-block rounded-full bg-white px-2 py-1 text-[10px] font-medium text-slate-500">Provider required</span></Link>)}</div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Link to="/os/pay/ajo" className="rounded-3xl border border-slate-200 bg-white p-6 hover:border-emerald-300"><div className="flex items-center gap-3"><div className="rounded-xl bg-emerald-50 p-3"><CalendarClock className="h-6 w-6 text-emerald-600" /></div><div><p className="text-sm font-medium text-emerald-600">Savings</p><h2 className="font-bold text-slate-900">Cycle Ajo</h2></div></div><p className="mt-4 text-sm leading-6 text-slate-500">Create contribution rules, member count, schedule and payout order. Activation remains behind the regulated payment integration.</p></Link>
        <div className="rounded-3xl border border-slate-200 bg-white p-6"><div className="flex items-center gap-3"><div className="rounded-xl bg-slate-100 p-3"><WalletCards className="h-6 w-6 text-slate-700" /></div><div><p className="text-sm font-medium text-slate-500">Financial tools</p><h2 className="font-bold text-slate-900">Payments & services</h2></div></div><div className="mt-4 grid grid-cols-2 gap-2">{services.map(({ to, icon: Icon, title }) => <Link key={to} to={to} className="rounded-xl bg-slate-50 px-3 py-3 text-xs font-semibold text-slate-700"><Icon className="mb-1 h-4 w-4 text-slate-500" />{title}</Link>)}</div></div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-6"><div className="flex items-center justify-between"><h2 className="font-semibold text-slate-900">Recent Transactions</h2><Link to="/os/pay/history" className="text-sm font-semibold text-emerald-700">View All</Link></div><div className="py-10 text-center"><Wallet className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-3 text-sm font-medium text-slate-900">No recent transactions</p><p className="mt-1 text-xs text-slate-500">Real payment activity will appear here.</p></div></div>
        <div className="rounded-3xl border border-slate-200 bg-white p-6"><div className="flex items-center justify-between"><h2 className="font-semibold text-slate-900">Account verification</h2><Link to="/os/pay/verification" className="text-sm font-semibold text-emerald-700">Open</Link></div><div className="mt-4 rounded-2xl bg-amber-50 p-4"><p className="text-sm font-semibold text-amber-900">Provider integrations pending</p><p className="mt-1 text-xs leading-5 text-amber-800">The UI is ready, but UniquePay will only display a verified NIN/BVN result after an authorized provider returns it.</p></div></div>
      </section>
    </div>
  );
}
