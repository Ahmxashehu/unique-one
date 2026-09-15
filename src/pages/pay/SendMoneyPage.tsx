import React, { useState } from 'react';
import { ArrowUpRight, Search, ShieldCheck, User, Send, Loader2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useOfflineQueue } from '../../contexts/OfflineQueueContext';

export default function SendMoneyPage() {
  const navigate = useNavigate();
  const { enqueueOperation } = useOfflineQueue();
  
  const [step, setStep] = useState<1 | 2>(1);
  const [identifier, setIdentifier] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Step 2 state
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');

  const handleResolveRecipient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier) return;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setStep(2);
    }, 800);
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount) return;
    
    // We strictly use offline queue just for safe drafting or returning a simulated offline behavior.
    // Financial transactions are NOT completed offline.
    if (!navigator.onLine) {
       alert("Live money movement cannot be completed offline. Please connect to the internet.");
       return;
    }

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      navigate('/os/pay/history');
    }, 1500);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Send Money</h1>
        <p className="text-sm text-slate-500 mt-1">Securely transfer funds to any Unique One user or business.</p>
      </div>

      <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-amber-600 mt-0.5" />
        <div>
          <h4 className="font-semibold text-amber-900">Integration Pending</h4>
          <p className="text-sm text-amber-800 mt-1">
            No live payment provider is connected. Transactions initiated here are simulated and no real money will be moved.
          </p>
        </div>
      </div>

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
                  onChange={e=>setIdentifier(e.target.value)}
                  placeholder="Phone, Email, or UniquePay ID" 
                  className="w-full pl-12 pr-4 py-4 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900" 
                  required
                />
              </div>
              <p className="text-xs text-slate-500 mt-2">We will securely look up the recipient before confirming the amount.</p>
            </div>
            
            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-slate-900 text-white py-4 rounded-xl font-medium hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Continue'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleSend} className="space-y-6">
            <div className="bg-slate-50 rounded-2xl p-4 flex items-center gap-4">
              <div className="w-12 h-12 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center">
                <User className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Demo User</h3>
                <p className="text-sm text-slate-500">{identifier}</p>
              </div>
              <button 
                type="button" 
                onClick={() => setStep(1)}
                className="ml-auto text-sm text-blue-600 font-medium hover:underline"
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
                onChange={e=>setAmount(e.target.value)}
                placeholder="0.00" 
                className="w-full px-4 py-4 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 text-lg font-semibold" 
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Description</label>
              <input 
                type="text" 
                value={description}
                onChange={e=>setDescription(e.target.value)}
                placeholder="What's this for?" 
                className="w-full px-4 py-4 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900" 
              />
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-slate-900 text-white py-4 rounded-xl font-medium hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><ArrowUpRight className="w-5 h-5" /> Send Money</>}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
