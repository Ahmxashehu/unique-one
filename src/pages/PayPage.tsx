import React, { useEffect, useState } from 'react';
import {
  ArrowDownLeft, ArrowUpRight, Banknote, ChevronRight, Clock3, Copy,
  History, Landmark, Receipt, ShieldCheck, Smartphone, Users, Wallet,
  WalletCards, Zap, Wifi, PhoneCall
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
  const [fundAmount, setFundAmount] = useState('1000');
  const [billingEmail, setBillingEmail] = useState('');
  const [funding, setFunding] = useState(false);
  const [fundingMessage, setFundingMessage] = useState('');
  const [fundingError, setFundingError] = useState('');

  useEffect(() => {
    if (currentUser?.email && !billingEmail) setBillingEmail(currentUser.email);
  }, [currentUser, billingEmail]);

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

  useEffect(() => {
    if (authLoading || !currentUser) return;
    const params = new URLSearchParams(window.location.search);
    const reference = params.get('reference') || params.get('trxref');
    if (!reference || !/^UP-PS-[A-Za-z0-9_-]{20,80}$/.test(reference)) return;
    let cancelled = false;
    const verifyReturn = async () => {
      setFunding(true);
      setFundingMessage('Checking payment status with Paystack…');
      setFundingError('');
      try {
        const token = await currentUser.getIdToken();
        const response = await fetch('/api/paystack/verify/' + encodeURIComponent(reference), {
          headers: { Authorization: 'Bearer ' + token },
        });
        const data = await response.json().catch(() => ({})) as { ok?: boolean; error?: { message?: string }; payment?: { amountMinor?: number } };
        if (!response.ok || !data.ok) throw new Error(data.error?.message || 'Payment is not yet confirmed.');
        if (!cancelled) {
          setFundingMessage('Payment verified. Your wallet has been updated by the server.');
          setWalletRetry(value => value + 1);
        }
      } catch (error) {
        if (!cancelled) setFundingError(error instanceof Error ? error.message : 'Could not verify payment. Please retry shortly.');
      } finally {
        if (!cancelled) {
          setFunding(false);
          const cleanUrl = new URL(window.location.href);
          cleanUrl.searchParams.delete('reference');
          cleanUrl.searchParams.delete('trxref');
          window.history.replaceState({}, '', cleanUrl.pathname + cleanUrl.search + cleanUrl.hash);
        }
      }
    };
    void verifyReturn();
    return () => { cancelled = true; };
  }, [authLoading, currentUser]);

  const startWalletFunding = async () => {
    if (!currentUser || funding) return;
    const amount = Number(fundAmount);
    const email = billingEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFundingError('Enter a valid email for the Paystack payment receipt.');
      return;
    }
    if (!Number.isSafeInteger(amount) || amount < 1 || amount > 1_000_000) {
      setFundingError('Enter an amount from ₦1 to ₦1,000,000.');
      return;
    }
    setFunding(true);
    setFundingError('');
    setFundingMessage('');
    try {
      const token = await currentUser.getIdToken();
      const response = await fetch('/api/paystack/initialize', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountMinor: amount * 100, email }),
      });
      const data = await response.json().catch(() => ({})) as { authorizationUrl?: string; error?: { message?: string } };
      if (!response.ok || !data.authorizationUrl || !/^https:\/\/checkout\.paystack\.com\//.test(data.authorizationUrl)) {
        throw new Error(data.error?.message || 'Payment could not be started.');
      }
      window.location.assign(data.authorizationUrl);
    } catch (error) {
      setFundingError(error instanceof Error ? error.message : 'Payment could not be started.');
      setFunding(false);
    }
  };

  if (authLoading) return null;

  const actions = [
    { to: '/os/pay/send', icon: ArrowUpRight, title: 'Send money', text: 'UniquePay, bank or supported recipient' },
    { to: '/os/pay/receive', icon: ArrowDownLeft, title: 'Receive money', text: 'Your ID, phone or temporary receiving ID' },
    { to: '/os/pay/airtime-data?service=data', icon: Wifi, title: 'Buy Data', text: 'Mobile data bundles and top-ups' },
    { to: '/os/pay/airtime-data?service=airtime', icon: PhoneCall, title: 'Buy Airtime', text: 'Recharge any supported mobile line' },
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

          <div className="mt-5 rounded-[25px] border border-white/10 bg-white/[0.07] p-5 backdrop-blur-xl md:p-6">
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

          <div className="mt-4 rounded-2xl border border-emerald-300/20 bg-slate-900/80 p-4">
            <div className="flex items-center gap-2">
              <Landmark className="h-5 w-5 text-emerald-300" />
              <div>
                <p className="text-sm font-black text-white">Add money to UniquePay</p>
                <p className="text-[11px] text-slate-300">Secure checkout powered by Paystack Test Mode</p>
              </div>
            </div>
            <form className="mt-3 flex flex-col gap-2 sm:flex-row" onSubmit={(event) => { event.preventDefault(); void startWalletFunding(); }}>
              <label className="sr-only" htmlFor="unique-pay-fund-amount">Amount in naira</label>
              <label className="flex flex-1 items-center rounded-xl border border-white/10 bg-white/5 px-3">
                <span className="sr-only">Email for payment receipt</span>
                <input type="email" autoComplete="email" required value={billingEmail} onChange={(event) => setBillingEmail(event.target.value)} className="w-full bg-transparent py-3 text-sm text-white outline-none placeholder:text-slate-400" placeholder="Email for receipt" />
              </label>
              <div className="flex flex-1 items-center rounded-xl border border-white/10 bg-white/5 px-3">
                <span className="mr-2 text-sm text-slate-300">₦</span>
                <input id="unique-pay-fund-amount" inputMode="numeric" type="number" min="1" max="1000000" step="1" value={fundAmount} onChange={(event) => setFundAmount(event.target.value)} className="w-full bg-transparent py-3 text-sm font-bold text-white outline-none" placeholder="Amount in naira" />
              </div>
              <button type="submit" disabled={funding || !currentUser} className="rounded-xl bg-emerald-400 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60">
                {funding ? 'Please wait…' : 'Continue to payment'}
              </button>
            </form>
            {fundingMessage && <p role="status" className="mt-2 text-xs text-emerald-200">{fundingMessage}</p>}
            {fundingError && <p role="alert" className="mt-2 text-xs text-rose-200">{fundingError}</p>}
            <p className="mt-2 text-[10px] leading-4 text-slate-400">Use test payment details only. Your balance changes only after server-side verification.</p>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {actions.map(({ to, icon: Icon, title }) => (
              <Link key={to} to={to} className="group min-h-[102px] rounded-2xl border border-white/10 bg-white/10 p-3.5 transition hover:-translate-y-0.5 hover:bg-white/15 active:scale-[0.98]">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-400 text-slate-950">
                  <Icon className="h-4.5 w-4.5" />
                </div>
                <p className="mt-2 text-xs font-bold text-white">{title}</p>
              </Link>
            ))}
          </div>

          <Link
            to="/os/payment-requests/new"
            className="group relative mt-3 block overflow-hidden rounded-2xl border border-emerald-300/20 bg-gradient-to-r from-emerald-400/15 via-white/10 to-cyan-400/10 p-3.5 shadow-[0_0_28px_rgba(52,211,153,0.10)] transition duration-300 hover:-translate-y-0.5 hover:border-emerald-300/35 hover:shadow-[0_0_34px_rgba(52,211,153,0.18)] active:scale-[0.99]"
          >
            <span className="pointer-events-none absolute -left-8 -top-10 h-24 w-24 animate-pulse rounded-full bg-emerald-300/15 blur-2xl" />
            <span className="pointer-events-none absolute -right-8 -bottom-12 h-28 w-28 animate-pulse rounded-full bg-cyan-300/10 blur-3xl [animation-delay:700ms]" />
            <span className="pointer-events-none absolute left-1/3 top-1/2 h-16 w-32 -translate-y-1/2 animate-pulse rounded-full bg-white/5 blur-2xl [animation-duration:3.5s]" />
            <div className="relative flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-300/20 bg-emerald-300/15 text-emerald-200 transition duration-300 group-hover:scale-105 group-hover:rotate-2">
                <Receipt className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-200">Request money</p>
                  <span className="rounded-full bg-emerald-300/10 px-2 py-0.5 text-[9px] font-bold text-emerald-100">Quick request</span>
                </div>
                <p className="mt-0.5 text-[11px] leading-4 text-slate-300">Send a payment request to a person or customer.</p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-emerald-200 transition group-hover:translate-x-1" />
            </div>
          </Link>
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
