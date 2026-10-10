import React, { useRef, useState } from 'react';
import { ArrowUpRight, Search, ShieldCheck, User, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { createBiometricAssertion, type BiometricAssertion } from '../../components/security/PasskeySecurityCard';

type Recipient = {
  uid: string;
  fullName: string;
  uniqueOneId?: string;
  profilePhotoUrl?: string;
};

export default function SendMoneyPage() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const [step, setStep] = useState<1 | 2>(1);
  const [identifier, setIdentifier] = useState('');
  const [recipient, setRecipient] = useState<Recipient | null>(null);
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [transactionPin, setTransactionPin] = useState('');
  const [biometricBusy, setBiometricBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const transferAttemptRef = useRef<{ key: string; fingerprint: string } | null>(null);

  const handleResolveRecipient = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = identifier.trim();
    if (!value) return;

    if (!currentUser) {
      setError('You must be signed in to send money.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const token = await currentUser.getIdToken();
      const response = await fetch(`/api/users/resolve?identifier=${encodeURIComponent(value)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.uid) {
        throw new Error(payload?.error?.message || 'Recipient could not be verified.');
      }

      setRecipient(payload as Recipient);
      setStep(2);
    } catch (resolveError) {
      console.error('Recipient lookup failed:', resolveError);
      setRecipient(null);
      setError(resolveError instanceof Error ? resolveError.message : 'Recipient could not be verified.');
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountValue = Number(amount);
    if (!currentUser) {
      setError('You must be signed in to send money.');
      return;
    }
    if (!recipient?.uid || !Number.isFinite(amountValue) || amountValue <= 0) {
      setError('Enter a valid amount and verified recipient.');
      return;
    }
    if (!/^\d{4}$/.test(transactionPin)) {
      setError('Enter your 4-digit Transaction PIN to authorize this payment.');
      return;
    }
    if (!navigator.onLine) {
      setError('Live money movement cannot be completed offline. Please connect to the internet.');
      return;
    }

    const amountMinor = Math.round(amountValue * 100);
    if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0 || Math.abs(amountValue * 100 - amountMinor) > 1e-7) {
      setError('Enter a valid amount with no more than two decimal places.');
      return;
    }
    const attemptFingerprint = JSON.stringify({ recipientId: recipient.uid, amountMinor, currency: 'NGN', description: description.trim() });
    const attemptStorageKey = `uniqueplatform.walletTransferAttempt:${currentUser.uid}`;
    if (!transferAttemptRef.current) {
      try {
        const storedAttempt = sessionStorage.getItem(attemptStorageKey);
        if (storedAttempt) {
          const parsed = JSON.parse(storedAttempt);
          if (typeof parsed?.key === 'string' && typeof parsed?.fingerprint === 'string') transferAttemptRef.current = parsed;
          else sessionStorage.removeItem(attemptStorageKey);
        }
      } catch { /* Session storage may be unavailable; in-memory idempotency still applies. */ }
    }
    if (transferAttemptRef.current && transferAttemptRef.current.fingerprint !== attemptFingerprint) {
      setError('A previous transfer attempt may still be processing. Restore its original recipient, amount and description, then retry it; check your transaction history before starting a different transfer.');
      return;
    }

    setLoading(true);
    setError(null);
    let finalResponseStatus: number | null = null;
    let finalResponseCode: string | null = null;
    try {
      const token = await currentUser.getIdToken();
      const idempotencyKey = transferAttemptRef.current?.key ?? (typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `transfer-${Date.now()}-${Math.random().toString(36).slice(2)}`);
      transferAttemptRef.current = { key: idempotencyKey, fingerprint: attemptFingerprint };
      try { sessionStorage.setItem(attemptStorageKey, JSON.stringify(transferAttemptRef.current)); } catch { /* Keep the attempt in memory if storage is unavailable. */ }

      let biometricAssertion: BiometricAssertion | undefined;
      if (amountMinor >= 5_000_000) {
        setBiometricBusy(true);
        try { biometricAssertion = await createBiometricAssertion(currentUser, `wallet_transfer|${currentUser.uid}|${recipient.uid}|${amountMinor}|NGN|${description.trim()}`); }
        finally { setBiometricBusy(false); }
      }

      const transferBody = () => JSON.stringify({
        recipientId: recipient.uid,
        amountMinor,
        currency: 'NGN',
        idempotencyKey,
        ...(description.trim() ? { description: description.trim() } : {}),
        transactionPin,
        ...(biometricAssertion ? { biometricAssertion } : {}),
      });

      const submitTransfer = async () => fetch('/api/wallet/transfer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: transferBody(),
      });

      let response = await submitTransfer();
      let payload = await response.json().catch(() => null);
      finalResponseStatus = response.status;
      finalResponseCode = payload?.error?.code ?? null;

      if (!response.ok && payload?.error?.code === 'BIOMETRIC_REQUIRED' && !biometricAssertion) {
        setBiometricBusy(true);
        try {
          biometricAssertion = await createBiometricAssertion(currentUser, `wallet_transfer|${currentUser.uid}|${recipient.uid}|${amountMinor}|NGN|${description.trim()}`);
        } finally {
          setBiometricBusy(false);
        }
        response = await submitTransfer();
        payload = await response.json().catch(() => null);
        finalResponseStatus = response.status;
        finalResponseCode = payload?.error?.code ?? null;
      }

      if (!response.ok || !payload?.id) {
        throw new Error(payload?.error?.message || 'The transfer could not be completed.');
      }

      transferAttemptRef.current = null;
      try { sessionStorage.removeItem(attemptStorageKey); } catch { /* Best-effort cleanup. */ }
      navigate(`/os/pay/receipts/${payload.id}`);
    } catch (sendError) {
      // Keep the key after network/5xx ambiguity so a retry cannot create a second debit.
      // A definitive client error is safe to retry with a fresh key, except while the server
      // reports that the original idempotent operation is still in progress.
      if (finalResponseStatus !== null && finalResponseStatus >= 400 && finalResponseStatus < 500 && finalResponseCode !== 'TRANSFER_IN_PROGRESS') {
        transferAttemptRef.current = null;
        try { sessionStorage.removeItem(attemptStorageKey); } catch { /* Best-effort cleanup. */ }
      }
      console.error('Wallet transfer failed:', sendError);
      const message = sendError instanceof Error ? sendError.message : 'The transfer could not be completed.';
      if (/biometric|passkey|credential/i.test(message)) {
        setError(`${message} Open Pay → Security and enable biometric/passkey authorization on this device, then try again.`);
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Send Money</h1>
        <p className="text-sm text-slate-500 mt-1">Securely transfer funds to any verified Unique One user.</p>
      </div>

      <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-emerald-600 mt-0.5" />
        <div>
          <h4 className="font-semibold text-emerald-900">Secure transfer</h4>
          <p className="text-sm text-emerald-800 mt-1">
            Recipient verification and money movement are handled by the authenticated UniquePay wallet service.
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          {error}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8">
        {step === 1 ? (
          <form onSubmit={handleResolveRecipient} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Recipient Identifier</label>
              <div className="relative">
                <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={identifier}
                  onChange={e => setIdentifier(e.target.value)}
                  placeholder="Phone, Email, or UniquePay ID"
                  className="w-full pl-12 pr-4 py-4 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  required
                  disabled={loading}
                />
              </div>
              <p className="text-xs text-slate-500 mt-2">We verify the recipient before allowing the transfer.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Transaction PIN</label>
              <input
                type="password"
                inputMode="numeric"
                autoComplete="off"
                maxLength={4}
                value={transactionPin}
                onChange={e => setTransactionPin(e.target.value.replace(/\D/g, ''))}
                placeholder="••••"
                className="w-full px-4 py-4 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-lg tracking-[0.5em] text-center font-semibold"
                required
                disabled={loading}
                aria-label="4-digit Transaction PIN"
              />
              <p className="text-xs text-slate-500 mt-2">Required to authorize this transfer. Never share your PIN.</p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-slate-900 text-white py-4 rounded-xl font-medium hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Verify Recipient'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleSend} className="space-y-6">
            <div className="bg-slate-50 rounded-2xl p-4 flex items-center gap-4">
              {recipient?.profilePhotoUrl ? (
                <img src={recipient.profilePhotoUrl} alt="" className="w-12 h-12 rounded-full object-cover" />
              ) : (
                <div className="w-12 h-12 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center">
                  <User className="w-6 h-6" />
                </div>
              )}
              <div className="min-w-0">
                <h3 className="font-bold text-slate-900 truncate">{recipient?.fullName || 'Verified recipient'}</h3>
                <p className="text-sm text-slate-500 truncate">{recipient?.uniqueOneId || identifier}</p>
              </div>
              <button
                type="button"
                onClick={() => { setStep(1); setError(null); }}
                className="ml-auto shrink-0 text-sm text-blue-600 font-medium hover:underline"
              >
                Change
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Amount (₦)</label>
              <input
                type="number"
                min="1"
                step="0.01"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full px-4 py-4 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 text-lg font-semibold"
                required
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Description</label>
              <input
                type="text"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="What's this for?"
                className="w-full px-4 py-4 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900"
                maxLength={500}
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-slate-900 text-white py-4 rounded-xl font-medium hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><ArrowUpRight className="w-5 h-5" /> Send Money</>}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
