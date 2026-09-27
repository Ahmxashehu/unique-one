import React, { useState } from 'react';
import { ArrowUpRight, Search, ShieldCheck, User, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

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
  const [error, setError] = useState<string | null>(null);

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
    if (!navigator.onLine) {
      setError('Live money movement cannot be completed offline. Please connect to the internet.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const token = await currentUser.getIdToken();
      const amountMinor = Math.round(amountValue * 100);
      const idempotencyKey = typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `transfer-${Date.now()}-${Math.random().toString(36).slice(2)}`;

      const response = await fetch('/api/wallet/transfer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          recipientId: recipient.uid,
          amountMinor,
          currency: 'NGN',
          idempotencyKey,
          ...(description.trim() ? { description: description.trim() } : {}),
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.id) {
        throw new Error(payload?.error?.message || 'The transfer could not be completed.');
      }

      navigate(`/os/pay/receipts/${payload.id}`);
    } catch (sendError) {
      console.error('Wallet transfer failed:', sendError);
      setError(sendError instanceof Error ? sendError.message : 'The transfer could not be completed.');
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
