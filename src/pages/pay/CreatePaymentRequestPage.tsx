import { useState } from 'react';
import { AlertCircle, Loader2, Send } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export default function CreatePaymentRequestPage() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (isDraft: boolean) => {
    if (!currentUser) return setError('You must be signed in to create a payment request.');
    const recipientIdentifier = recipient.trim();
    const requestDescription = description.trim();
    const amountValue = Number(amount);
    if (!recipientIdentifier || !Number.isFinite(amountValue) || amountValue <= 0 || !requestDescription) {
      return setError('Enter a recipient, a valid amount, and a description.');
    }
    setLoading(true);
    setError(null);
    try {
      const token = await currentUser.getIdToken();
      const response = await fetch('/api/payment-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({
          recipientIdentifier,
          amount: amountValue,
          description: requestDescription,
          ...(dueDate ? { dueDate } : {}),
          status: isDraft ? 'draft' : 'sent',
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.id) throw new Error(payload?.error?.message || 'We could not create the payment request.');
      navigate('/os/payment-requests');
    } catch (submitError) {
      console.error('Unable to create payment request:', submitError);
      setError(submitError instanceof Error ? submitError.message : 'We could not save this payment request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-12">
      <div><h1 className="text-2xl font-bold tracking-tight text-slate-900">Request Payment</h1><p className="mt-1 text-sm text-slate-500">Create a real payment request stored in your UniquePay account.</p></div>
      {error && <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><AlertCircle className="mt-0.5 h-5 w-5 shrink-0" /><span>{error}</span></div>}
      <div className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 md:p-8">
        <div><label className="mb-1 block text-sm font-medium text-slate-700">Recipient *</label><input type="text" value={recipient} onChange={(e) => setRecipient(e.target.value)} required placeholder="Email, phone, or Unique One ID" className="w-full rounded-xl border border-slate-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-slate-900" disabled={loading} /><p className="mt-1 text-xs text-slate-500">The recipient is verified before the request is saved.</p></div>
        <div className="grid gap-6 md:grid-cols-2"><div><label className="mb-1 block text-sm font-medium text-slate-700">Amount *</label><div className="flex"><span className="rounded-l-xl border border-r-0 border-slate-200 bg-slate-50 px-4 py-3 text-slate-500">₦</span><input type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required placeholder="0.00" className="w-full rounded-r-xl border border-slate-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-slate-900" disabled={loading} /></div></div><div><label className="mb-1 block text-sm font-medium text-slate-700">Due Date</label><input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full rounded-xl border border-slate-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-slate-900" disabled={loading} /></div></div>
        <div><label className="mb-1 block text-sm font-medium text-slate-700">Description *</label><textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} required placeholder="What is this payment for?" className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-slate-900" disabled={loading} /></div>
        <div className="flex flex-col justify-end gap-3 border-t border-slate-100 pt-6 sm:flex-row"><button type="button" onClick={() => void handleSubmit(true)} disabled={loading} className="rounded-xl border border-slate-200 px-6 py-2.5 font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-60">{loading ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : 'Save Draft'}</button><button type="button" onClick={() => void handleSubmit(false)} disabled={loading} className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 py-2.5 font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-60">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send Request</button></div>
      </div>
    </div>
  );
}