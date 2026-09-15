import React, { useState } from 'react';
import { ArrowDownRight, Send, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useOfflineQueue } from '../../contexts/OfflineQueueContext';
import { useNavigate } from 'react-router-dom';

export default function CreatePaymentRequestPage() {
  const { enqueueOperation } = useOfflineQueue();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  
  const handleSubmit = (e: React.FormEvent, isDraft: boolean) => {
    e.preventDefault();
    if (!recipient || !amount || !description) return;
    setLoading(true);

    enqueueOperation(`Save Payment Request for ${recipient}`, async () => {
       await new Promise(r => setTimeout(r, 800));
    });

    setTimeout(() => {
      setLoading(false);
      navigate('/os/payment-requests');
    }, 1000);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Request Payment</h1>
        <p className="text-sm text-slate-500 mt-1">Send a payment request to a customer, business, or parent.</p>
      </div>

      <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
        <div className="text-sm text-blue-800">
          <span className="font-semibold">Demo Notice: </span>
          This request will be created but no actual emails/SMS or real financial charges will be processed.
        </div>
      </div>

      <form className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 space-y-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Recipient *</label>
          <input type="text" value={recipient} onChange={e=>setRecipient(e.target.value)} required placeholder="Email, Phone, or Unique ID" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900" />
          <p className="text-xs text-slate-500 mt-1">We will securely look up the recipient before confirming.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Amount *</label>
            <div className="flex">
              <span className="px-4 py-3 bg-slate-50 border border-r-0 border-slate-200 rounded-l-xl text-slate-500">₦</span>
              <input type="number" min="0" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)} required placeholder="0.00" className="w-full px-4 py-3 rounded-r-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Due Date</label>
            <input type="date" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Description *</label>
          <textarea rows={3} value={description} onChange={e=>setDescription(e.target.value)} required placeholder="What is this payment for?" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 resize-none" />
        </div>

        <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row justify-end gap-3">
          <button type="button" onClick={(e)=>handleSubmit(e, true)} disabled={loading} className="px-6 py-2.5 rounded-xl font-medium border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors">
            Save Draft
          </button>
          <button type="button" onClick={(e)=>handleSubmit(e, false)} disabled={loading} className="bg-slate-900 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-slate-800 transition-colors flex items-center justify-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Send Request
          </button>
        </div>
      </form>
    </div>
  );
}
