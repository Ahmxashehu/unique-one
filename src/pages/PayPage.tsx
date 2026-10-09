import React, { useEffect, useState } from 'react';
import {
  ArrowDownLeft, ArrowUpRight, Banknote, ChevronRight, Clock3, Copy,
  History, Landmark, Receipt, ShieldCheck, Smartphone, Users, Wallet,
  WalletCards, Zap, Wifi, PhoneCall
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
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
  const [searchParams, setSearchParams] = useSearchParams();
  const returnPaymentReference = searchParams.get('paymentReference');
  const [providerConfig, setProviderConfig] = useState<{ configured: boolean; environment: string; livePaymentsEnabled: boolean } | null>(null);
  const [fundingOpen, setFundingOpen] = useState(false);
  const [fundingAmount, setFundingAmount] = useState('500');
  const [fundingBusy, setFundingBusy] = useState(false);
  const [fundingError, setFundingError] = useState('');
  const [paymentStatusMessage, setPaymentStatusMessage] = useState('');
  const [paymentVerifyBusy, setPaymentVerifyBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetch('/api/payments/monnify/config')
      .then(async response => {
        if (!response.ok) throw new Error('Unable to check payment provider');
        return response.json() as Promise<{ configured?: boolean; environment?: string; livePaymentsEnabled?: boolean }>;
      })
      .then(value => {
        if (!cancelled) setProviderConfig({
          configured: value.configured === true,
          environment: value.environment === 'live' ? 'live' : 'sandbox',
          livePaymentsEnabled: value.livePaymentsEnabled === true,
        });
      })
      .catch(() => {
        if (!cancelled) setProviderConfig({ configured: false, environment: 'sandbox', livePaymentsEnabled: false });
      });
    return () => { cancelled = true; };
  }, []);

  const verifyReturnedPayment = async () => {
    if (!currentUser || !returnPaymentReference) return;
    setPaymentVerifyBusy(true);
    setPaymentStatusMessage('');
    try {
      let token = await currentUser.getIdToken();
      let response = await fetch('/api/payments/monnify/verify/' + encodeURIComponent(returnPaymentReference), {
        headers: { Authorization: 'Bearer ' + token },
      });
      if (response.status === 401) {
        token = await currentUser.getIdToken(true);
        response = await fetch('/api/payments/monnify/verify/' + encodeURIComponent(returnPaymentReference), {
          headers: { Authorization: 'Bearer ' + token },
        });
      }
      const payload = await response.json().catch(() => ({})) as { status?: string; error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message || 'Payment status could not be checked.');
      if (payload.status === 'credited' || payload.status === 'already_credited') {
        setPaymentStatusMessage('Payment verified. Your wallet balance has been updated.');
        setWalletRetry(value => value + 1);
        const next = new URLSearchParams(searchParams);
        next.delete('paymentReference');
        setSearchParams(next, { replace: true });
      } else if (payload.status === 'pending') {
        setPaymentStatusMessage('Payment is not confirmed yet. Your wallet has not been credited; check again shortly.');
      } else {
        setPaymentStatusMessage('Payment status: ' + String(payload.status || 'unconfirmed') + '. Your wallet was not credited.');
      }
    } catch (error) {
      setPaymentStatusMessage(error instanceof Error ? error.message : 'Payment status could not be checked.');
    } finally {
      setPaymentVerifyBusy(false);
    }
  };

  useEffect(() => {
    if (authLoading || !currentUser || !returnPaymentReference) return;
    void verifyReturnedPayment();
    // The reference is deliberately retained in the URL while status is pending, allowing a safe manual retry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, currentUser, returnPaymentReference]);

  const startWalletFunding = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFundingError('');
    if (!currentUser) {
      setFundingError('Sign in to fund your UniquePay wallet.');
      return;
    }
    if (!providerConfig?.configured || (providerConfig.environment === 'live' && !providerConfig.livePaymentsEnabled)) {
      setFundingError('Monnify funding is not enabled on the server yet.');
      return;
    }
    if (!/^\\d+(?:\\.\\d{1,2})?$/.test(fundingAmount.trim())) {
      setFundingError('Enter an amount with no more than two decimal places.');
      return;
    }
    const amountMinor = Math.round(Number(fundingAmount) * 100);
    if (!Number.isSafeInteger(amountMinor) || amountMinor < 2000 || amountMinor > 50_000_000) {
      setFundingError('Enter an amount between ₦20 and ₦500,000.');
      return;
    }
    setFundingBusy(true);
    try {
      const token = await currentUser.getIdToken();
      const response = await fetch('/api/payments/monnify/initialize', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountMinor, description: 'UniquePay wallet funding' }),
      });
      const payload = await response.json().catch(() => ({})) as { checkoutUrl?: string; error?: { message?: string } };
      if (!response.ok || typeof payload.checkoutUrl !== 'string') {
        throw new Error(payload.error?.message || 'Secure checkout could not be started. No wallet balance was changed.');
      }
      window.location.assign(payload.checkoutUrl);
    } catch (error) {
      setFundingError(error instanceof Error ? error.message : 'Secure checkout could not be started.');
      setFundingBusy(false);
    }
  };

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
    { to: '/os/pay', icon: Wifi, title: 'Buy Data', text: 'Mobile data bundles and top-ups' },
    { to: '/os/pay', icon: PhoneCall, title: 'Buy Airtime', text: 'Recharge any supported mobile line' },
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
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={() => { setFundingOpen(value => !value); setFundingError(''); }} disabled={walletLoading || balanceMinor === null} className="rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-black text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50">
                {fundingOpen ? 'Close funding' : 'Fund wallet'}
              </button>
              {providerConfig?.configured && (
                <span className="self-center text-[11px] text-slate-400">
                  Monnify {providerConfig.environment === 'live' ? 'live' : 'sandbox'} {providerConfig.environment === 'live' && !providerConfig.livePaymentsEnabled ? '— disabled' : ''}
                </span>
              )}
            </div>
            {fundingOpen && (
              <form onSubmit={startWalletFunding} className="mt-4 rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                <label htmlFor="uniquepay-funding-amount" className="block text-xs font-bold text-slate-200">Amount to add (NGN)</label>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <input id="uniquepay-funding-amount" type="number" min="20" max="500000" step="0.01" inputMode="decimal" value={fundingAmount} onChange={event => setFundingAmount(event.target.value)} className="min-w-0 flex-1 rounded-xl border border-white/10 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-emerald-300" required />
                  <button type="submit" disabled={fundingBusy || !providerConfig?.configured || (providerConfig.environment === 'live' && !providerConfig.livePaymentsEnabled)} className="rounded-xl bg-white px-4 py-3 text-sm font-black text-slate-950 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50">
                    {fundingBusy ? 'Preparing checkout…' : 'Continue to Monnify'}
                  </button>
                </div>
                <p className="mt-2 text-[11px] text-slate-400">Minimum ₦20, maximum ₦500,000 per payment. Your wallet is credited only after server-side confirmation.</p>
                {!providerConfig?.configured && <p className="mt-2 text-xs text-amber-200">Monnify credentials are not configured on the server yet.</p>}
                {providerConfig?.environment === 'live' && !providerConfig.livePaymentsEnabled && <p className="mt-2 text-xs text-amber-200">Live collections are deliberately disabled pending activation and production checks.</p>}
                {fundingError && <p role="alert" className="mt-2 text-xs text-rose-300">{fundingError}</p>}
              </form>
            )}
            {paymentStatusMessage && (
              <div role="status" className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-slate-200">
                <p>{paymentStatusMessage}</p>
                {returnPaymentReference && (
                  <button type="button" onClick={() => void verifyReturnedPayment()} disabled={paymentVerifyBusy} className="mt-2 rounded-lg bg-white/10 px-3 py-1.5 font-bold text-white disabled:opacity-50">
                    {paymentVerifyBusy ? 'Checking…' : 'Check payment status'}
                  </button>
                )}
              </div>
            )}
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
