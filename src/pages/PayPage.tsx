import React, { useEffect, useState } from 'react';
import {
  ArrowDownLeft, ArrowUpRight, Banknote, ChevronRight, Clock3, Copy,
  History, Landmark, Receipt, ShieldCheck, Smartphone, Users, Wallet,
  WalletCards, Zap
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
  const [walletRetry, setWalletRetry] = useState(0);

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    const loadWallet = async () => {
      if (!currentUser) { setWalletLoading(false); return; }
      setWalletLoading(true);
      setWalletError('');
      try {
        let token = await currentUser.getIdToken();
        let response = await fetch('/api/wallet', { headers: { Authorization: 'Bearer ' + token } });
        if (response.status === 401) {
          token = await currentUser.getIdToken(true);
          response = await fetch('/api/wallet', { headers: { Authorization: 'Bearer ' + token } });
        }
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
  }, [authLoading, currentUser, walletRetry]);

  if (authLoading) return null;

  const actions = [
    { to: '/os/pay/send', icon: ArrowUpRight, title: 'Send money', text: 'UniquePay, bank or supported recipient' },
    { to: '/os/pay/receive', icon: ArrowDownLeft, title: 'Receive money', text: 'Your ID, phone or temporary receiving ID' },
    { to: '/os/payment-requests/new', icon: Receipt, title: 'Request money', text: 'Create a payment request' },
  ];

  const tools = [
    { to: '/os/pay/history', icon: History, title: 'Transaction history', text: 'Review completed wallet activity' },
    { to: '/os/pay/beneficiaries', icon: Users, title: 'Beneficiaries', text: 'Manage saved payment recipients' },
    { to: '/os/pay/security', icon: ShieldCheck, title: 'Payment security', text: 'Review your UniquePay protection' },
  ];

  return (
    <div className="relative mx-auto max-w-6xl space-y-5 pb-12">
      <div className="pointer-events-none absolute -top-20 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-emerald-400/15 blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-80 h-56 w-56 rounded-full bg-cyan-400/10 blur-3xl" />

      <section className="relative overflow-hidden rounded-[30px] bg-slate-950 p-5 text-white shadow-2xl md:p-7">
        <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full border border-emerald-400/20 bg-emerald-400/10 blur-2xl" />
        <div className="absolute bottom-0 left-1/3 h-24 w-48 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="relative">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-300/20 bg-emerald-400/10">
                <WalletCards className="h-6 w-6 text-emerald-300" />
              </div>
              <div>
                <p className="text-[11px] font-bold tracking-[0.22em] text-emerald-300">UNIQUEPAY</p>
                <h1 className="text-xl font-black tracking-tight md:text-2xl">Your money, intelligently connected</h1>
              </div>
            </div>
            <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-semibold text-slate-300 sm:flex">
              <span className="h-2 w-2 rounded-full bg-emerald-400" /> Secure wallet
            </div>
          </div>

          <div className="mt-6 rounded-[25px] border border-white/10 bg-white/[0.07] p-5 backdrop-blur-xl md:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-slate-400">Available balance</p>
                <p className="mt-1 text-3xl font-black tracking-tight md:text-4xl">
                  {walletLoading ? 'Loading…' : balanceMinor === null ? '—' : money(balanceMinor)}
                </p>
                <p className="mt-2 text-[11px] text-slate-400">NGN wallet balance</p>
              </div>
              <div className="rounded-2xl bg-emerald-400/10 p-3">
                <Banknote className="h-6 w-6 text-emerald-300" />
              </div>
            </div>
            {walletError && (
              <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
                <span>{walletError}</span>
                <button type="button" onClick={() => setWalletRetry((value) => value + 1)} className="shrink-0 rounded-lg bg-white/10 px-2.5 py-1.5 font-bold text-white hover:bg-white/15">Retry</button>
              </div>
            )}
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2.5">
            {actions.map(({ to, icon: Icon, title }) => (
              <Link key={to} to={to} className="group rounded-2xl border border-white/10 bg-white/10 p-3.5 transition hover:-translate-y-0.5 hover:bg-white/15">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-400 text-slate-950">
                  <Icon className="h-4.5 w-4.5" />
                </div>
                <p className="mt-2 text-xs font-bold text-white">{title}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="relative rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-sm backdrop-blur md:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-600">Wallet centre</p>
            <h2 className="mt-1 text-lg font-black text-slate-900">Everything you need to manage your wallet</h2>
          </div>
          <Zap className="h-5 w-5 text-emerald-500" />
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {tools.map(({ to, icon: Icon, title, text }) => (
            <Link key={to} to={to} className="group rounded-2xl border border-slate-100 bg-slate-50 p-4 transition hover:border-emerald-200 hover:bg-emerald-50/60">
              <div className="flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-emerald-300"><Icon className="h-5 w-5" /></div>
                <ChevronRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-emerald-600" />
              </div>
              <h3 className="mt-3 text-sm font-bold text-slate-900">{title}</h3>
              <p className="mt-1 text-xs leading-5 text-slate-500">{text}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-[1.25fr_.75fr]">
        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Activity</p>
              <h2 className="mt-1 text-lg font-black text-slate-900">Recent wallet activity</h2>
            </div>
            <Link to="/os/pay/history" className="text-xs font-bold text-emerald-700">View all</Link>
          </div>
          <div className="mt-4 rounded-2xl bg-slate-50 p-6 text-center">
            <Clock3 className="mx-auto h-7 w-7 text-slate-300" />
            <p className="mt-2 text-sm font-bold text-slate-900">No recent transactions</p>
            <p className="mt-1 text-xs text-slate-500">Verified wallet activity will appear here.</p>
          </div>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-gradient-to-br from-emerald-50 to-cyan-50 p-5 shadow-sm md:p-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
          </div>
          <h2 className="mt-4 text-lg font-black text-slate-900">Built for secure payments</h2>
          <p className="mt-2 text-xs leading-5 text-slate-600">Wallet movement is authenticated and recorded through the UniquePay financial service. Payment credentials are never displayed on this page.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full bg-white px-3 py-1.5 text-[10px] font-bold text-slate-600">Verified wallet</span>
            <span className="rounded-full bg-white px-3 py-1.5 text-[10px] font-bold text-slate-600">Ledger-backed</span>
            <span className="rounded-full bg-white px-3 py-1.5 text-[10px] font-bold text-slate-600">NGN</span>
          </div>
        </div>
      </section>
    </div>
  );
}
