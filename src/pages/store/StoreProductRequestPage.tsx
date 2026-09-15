import { db } from '../../lib/firebase';
import { doc, collection, setDoc } from 'firebase/firestore';
import React, { useState } from 'react';
import { PackageSearch, Save, Send, Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useOfflineQueue } from '../../contexts/OfflineQueueContext';

export default function StoreProductRequestPage() {
  const { currentUser } = useAuth();
  const { enqueueOperation } = useOfflineQueue();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [budget, setBudget] = useState('');
  const [quantity, setQuantity] = useState('1');

  const handleSubmit = (e: React.FormEvent, status: 'draft' | 'published') => {
    e.preventDefault();
    if (!title || !description || !currentUser) return;
    
    setLoading(true);
    enqueueOperation(`Save Product Request: ${title}`, async () => {
       const requestId = doc(collection(db, 'productRequests')).id;
       const requestData = {
         id: requestId,
         customerId: currentUser.uid,
         title,
         description,
         quantity: quantity ? parseInt(quantity) : 1,
         budget: budget ? parseFloat(budget) : 0,
         location: '',
         requiredDate: '',
         isPublic: true,
         expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
         status,
         createdAt: new Date().toISOString()
       };
       await setDoc(doc(db, 'productRequests', requestId), requestData);
    });
    
    setTimeout(() => {
      setLoading(false);
      setSuccess(true);
    }, 1000);
  };

  if (success) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6">
          <PackageSearch className="w-10 h-10 text-emerald-600" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Request Submitted Successfully!</h2>
        <p className="text-slate-500 mb-8">Verified sellers will review your request and send you quotes.</p>
        <button onClick={() => setSuccess(false)} className="bg-slate-900 text-white px-6 py-2.5 rounded-xl font-medium">Create Another Request</button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Request a Product or Service</h1>
        <p className="text-sm text-slate-500 mt-1">Can't find what you need? Describe it, and verified sellers will send you quotes.</p>
      </div>

      <form className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">What do you need? *</label>
          <input type="text" value={title} onChange={e=>setTitle(e.target.value)} required className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-slate-900 focus:outline-none" placeholder="e.g., 500 bags of Dangote Cement" />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Detailed Description *</label>
          <textarea rows={4} value={description} onChange={e=>setDescription(e.target.value)} required className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-slate-900 focus:outline-none resize-none" placeholder="Provide specific details, measurements, or conditions..." />
        </div>

        <div className="grid sm:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Estimated Budget (Optional)</label>
            <input type="number" value={budget} onChange={e=>setBudget(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-slate-900 focus:outline-none" placeholder="0.00" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Quantity Needed *</label>
            <input type="number" min="1" value={quantity} onChange={e=>setQuantity(e.target.value)} required className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-slate-900 focus:outline-none" />
          </div>
        </div>

        <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row justify-end gap-3">
          <button type="button" onClick={(e) => handleSubmit(e, 'draft')} disabled={loading} className="px-6 py-2.5 rounded-xl font-medium border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors">
            Save as Draft
          </button>
          <button type="button" onClick={(e) => handleSubmit(e, 'published')} disabled={loading} className="bg-slate-900 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-slate-800 transition-colors flex items-center justify-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Submit Request
          </button>
        </div>
      </form>
    </div>
  );
}
