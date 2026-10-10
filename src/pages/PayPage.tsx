import React, { useEffect, useState } from 'react';
import {
  ArrowDownLeft, ArrowUpRight, Banknote, ChevronRight, Clock3, Copy,
  History, Landmark, Receipt, ShieldCheck, Smartphone, Users, Wallet,
  WalletCards, Zap, Wifi, PhoneCall
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { collection, getDocs, orderBy, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { FinancialTransactionViewModel, formatFinancialTransactionAmount, mapFinancialTransaction } from '../lib/os/pay/financialTransaction';

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
  const [fundingStep, setFundingStep] = useState<1 | 2>(1);
  const [billingEmail, setBillingEmail] = useState('');
  const [funding, setFunding] = useState(false);
  const [fundingMessage, setFundingMessage] = useState('');
  const [fundingError, setFundingError] = useState('');
  const [recentTransactions, setRecentTransactions] = useState<FinancialTransactionViewModel[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [activityError, setActivityError] = useState('');

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
    if (authLoading) return;
    let cancelled = false;
    const loadRecentActivity = async () => {
      if (!currentUser) {
        if (!cancelled) {
          setRecentTransactions([]);
          setActivityLoading(false);
        }
        return;
      }
      setActivityLoading(true);
      setActivityError('');
      try {
        const transactionsRef = collection(db, 'transactions');
        const [sentSnapshot, receivedSnapshot] = await Promise.all([
          getDocs(query(transactionsRef, where('senderId', '==', currentUser.uid), orderBy('createdAt', 'desc'))),
          getDocs(query(transactionsRef, where('recipientId', '==', currentUser.uid), orderBy('createdAt', 'desc'))),
        ]);
        if (cancelled) return;
        const byId = new Map<string, FinancialTransactionViewModel>();
        sentSnapshot.forEach((document) => {
          const transaction = mapFinancialTransaction(document.id, document.data(), currentUser.uid);
          if (transaction) byId.set(document.id, transaction);
        });
        receivedSnapshot.forEach((document) => {
          const transaction = mapFinancialTransaction(document.id, document.data(), currentUser.uid);
          if (transaction) byId.set(document.id, transaction);
        });
        setRecentTransactions([...byId.values()]
          .filter((transaction) => transaction.status === 'completed')
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .slice(0, 3));
      } catch (error) {
        console.error('Unable to load recent UniquePay activity:', error);
        if (!cancelled) setActivityError('Recent wallet activity could not be loaded. Open Transaction History to retry.');
      } finally {
        if (!cancelled) setActivityLoading(false);
      }
    };
    void loadRecentActivity();
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

          <div className="mt-4 rounded-2xl border border-emerald-300/20 bg-slate-900/80 p-3.5 sm:p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-300"><Landmark className="h-4.5 w-4.5" /></div>
                <div className="min-w-0"><p className="text-sm font-black text-white">Add money</p><p className="text-[10px] text-slate-400">Secure checkout · Paystack Test Mode</p></div>
              </div>
              <span className="shrink-0 rounded-full border border-white/10 px-2 py-1 text-[10px] font-semibold text-slate-300">Step {fundingStep} of 2</span>
            </div>
            <div className="mt-3 flex gap-1.5"><span className="h-1 flex-1 rounded-full bg-emerald-400" /><span className={"h-1 flex-1 rounded-full " + (fundingStep === 2 ? "bg-emerald-400" : "bg-white/10")} /></div>
            {fundingStep === 1 ? (
              <form className="mt-3" onSubmit={(event) => { event.preventDefault(); const amount = Number(fundAmount); if (!Number.isSafeInteger(amount) || amount < 1 || amount > 1000000) { setFundingError("Enter an amount from ₦1 to ₦1,000,000."); return; } setFundingError(""); setFundingStep(2); }}>
                <label htmlFor="unique-pay-fund-amount" className="mb-1.5 block text-xs font-semibold text-slate-300">How much would you like to add?</label>
                <div className="flex items-center rounded-xl border border-white/10 bg-white/5 px-3"><span className="mr-2 text-lg font-bold text-emerald-300">₦</span><input id="unique-pay-fund-amount" inputMode="numeric" type="number" min="1" max="1000000" step="1" required value={fundAmount} onChange={(event) => setFundAmount(event.target.value)} className="w-full bg-transparent py-3 text-lg font-black text-white outline-none placeholder:text-slate-500" placeholder="1,000" /></div>
                <p className="mt-1.5 text-[10px] text-slate-400">Enter an amount from ₦1 to ₦1,000,000.</p>
                <button type="submit" className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-emerald-300">Next <ChevronRight className="h-4 w-4" /></button>
              </form>
            ) : (
              <form className="mt-3" onSubmit={(event) => { event.preventDefault(); void startWalletFunding(); }}>
                <p className="text-xs text-slate-300">Amount to add</p><p className="mt-0.5 text-xl font-black text-white">₦{Number(fundAmount || 0).toLocaleString("en-NG")}</p>
                <label htmlFor="unique-pay-receipt-email" className="mb-1.5 mt-3 block text-xs font-semibold text-slate-300">Email for payment receipt</label>
                <input id="unique-pay-receipt-email" type="email" autoComplete="email" required value={billingEmail} onChange={(event) => setBillingEmail(event.target.value)} className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-emerald-300/60" placeholder="you@example.com" />
                <div className="mt-3 grid grid-cols-[auto_1fr] gap-2"><button type="button" disabled={funding} onClick={() => { setFundingError(""); setFundingStep(1); }} className="rounded-xl border border-white/10 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/10 disabled:opacity-50">Back</button><button type="submit" disabled={funding || !currentUser} className="rounded-xl bg-emerald-400 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60">{funding ? "Please wait…" : "Continue to Pay"}</button></div>
              </form>
            )}
            {fundingMessage && <p role="status" className="mt-2 text-xs text-emerald-200">{fundingMessage}</p>}
            {fundingError && <p role="alert" className="mt-2 text-xs text-rose-200">{fundingError}</p>}
            <p className="mt-2 text-[10px] leading-4 text-slate-400">Test mode only. Your wallet updates only after server-side payment verification.</p>
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
          <div className="mt-4 rounded-2xl bg-slate-50">
            {activityLoading ? (
              <p className="p-6 text-center text-sm text-slate-500">Loading verified wallet activity…</p>
            ) : activityError ? (
              <div className="p-6 text-center">
                <p className="text-sm font-bold text-slate-900">Activity unavailable</p>
                <p className="mt-1 text-xs text-slate-500">{activityError}</p>
              </div>
            ) : recentTransactions.length === 0 ? (
              <div className="p-6 text-center">
                <Clock3 className="mx-auto h-7 w-7 text-slate-300" />
                <p className="mt-2 text-sm font-bold text-slate-900">No verified transactions yet</p>
                <p className="mt-1 text-xs text-slate-500">Completed wallet transactions will appear here.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {recentTransactions.map((transaction) => (
                  <div key={transaction.id} className="flex items-center gap-3 p-3">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${transaction.direction === 'outgoing' ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      {transaction.direction === 'outgoing' ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownLeft className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold capitalize text-slate-900">{transaction.type.replaceAll('_', ' ')}</p>
                      <p className="truncate text-xs text-slate-500">{new Date(transaction.createdAt).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                    </div>
                    <p className={`shrink-0 text-sm font-bold ${transaction.direction === 'outgoing' ? 'text-slate-900' : 'text-emerald-700'}`}>
                      {transaction.direction === 'outgoing' ? '-' : '+'}{formatFinancialTransactionAmount(transaction)}
                    </p>
                  </div>
                ))}
              </div>
            )}
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