import React, { useState } from 'react';
import { AlertCircle, Briefcase, CheckCircle2, Clock, Loader2, Save } from 'lucide-react';
import { addDoc, collection } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../lib/firebase';

export default function AddServicePage() {
  const { currentUser, userData } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [duration, setDuration] = useState('1');
  const [category, setCategory] = useState('Professional Services');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'draft' | 'published'>('published');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!currentUser) {
      navigate('/login');
      return;
    }

    const cleanTitle = title.trim();
    const cleanDescription = description.trim();
    const parsedPrice = Number(price);
    const parsedDuration = Number(duration);

    if (!cleanTitle || !cleanDescription) {
      setError('Service title and description are required.');
      return;
    }
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      setError('Enter a valid service price.');
      return;
    }
    if (!Number.isFinite(parsedDuration) || parsedDuration <= 0) {
      setError('Duration must be greater than 0.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const now = new Date().toISOString();
      await addDoc(collection(db, 'services'), {
        ownerUid: currentUser.uid,
        providerName: userData?.fullName || userData?.firstName || 'Unique provider',
        title: cleanTitle,
        category: category.trim() || 'Professional Services',
        description: cleanDescription,
        price: parsedPrice,
        currency: 'NGN',
        durationHours: parsedDuration,
        status,
        createdAt: now,
        updatedAt: now,
      });
      setSuccess(true);
      window.setTimeout(() => navigate('/os/services'), 700);
    } catch (err) {
      console.error('Failed to publish service:', err);
      setError(err instanceof Error ? err.message : 'Unable to publish this service.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Create New Service</h1>
        <p className="text-sm text-slate-500 mt-1">Publish a real service that can appear in Discover and Active Edge.</p>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700 flex gap-3"><AlertCircle className="w-5 h-5 shrink-0" />{error}</div>}
      {success && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-700 flex gap-3"><CheckCircle2 className="w-5 h-5 shrink-0" />Service published successfully. Redirecting...</div>}

      <form onSubmit={submit} className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="p-8 space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Service Title *</label>
            <input value={title} onChange={e => setTitle(e.target.value)} required className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder="e.g. IT Consultation" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Base Price (₦) *</label>
              <input type="number" min="0" step="0.01" value={price} onChange={e => setPrice(e.target.value)} required className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder="0" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Duration (hours) *</label>
              <div className="relative"><Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" /><input type="number" min="0.25" step="0.25" value={duration} onChange={e => setDuration(e.target.value)} required className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500" /></div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
              <input value={category} onChange={e => setCategory(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder="Professional Services" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description *</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} required rows={5} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" placeholder="Describe what customers receive..." />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Publishing</label>
            <select value={status} onChange={e => setStatus(e.target.value as 'draft' | 'published')} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white">
              <option value="published">Publish now</option>
              <option value="draft">Save as draft</option>
            </select>
          </div>
        </div>
        <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button disabled={saving} className="bg-slate-900 disabled:opacity-60 text-white px-6 py-2.5 rounded-xl font-medium flex items-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Publishing...' : status === 'published' ? 'Publish Service' : 'Save Draft'}
          </button>
        </div>
      </form>
    </div>
  );
}
