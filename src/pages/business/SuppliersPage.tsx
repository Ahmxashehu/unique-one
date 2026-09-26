import React, { useEffect, useState } from 'react';
import { Truck, Plus, Loader2, RefreshCw, X } from 'lucide-react';
import { addDoc, collection, getDocs, query, where, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';

type Supplier = { id: string; name: string; companyName: string; phone: string; email?: string; address?: string; category: string; outstandingAmount: number; verificationStatus: string; };

export default function SuppliersPage() {
  const { currentUser } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', companyName: '', phone: '', email: '', address: '', category: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadSuppliers = async () => {
    if (!currentUser) return;
    setLoading(true); setError('');
    try {
      const snap = await getDocs(query(collection(db, 'suppliers'), where('businessOwnerUid', '==', currentUser.uid)));
      setSuppliers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Supplier)));
    } catch (err) {
      console.error('Suppliers load failed:', err);
      setError('We could not load your suppliers. Please try again.');
    } finally { setLoading(false); }
  };

  useEffect(() => { void loadSuppliers(); }, [currentUser?.uid]);

  const addSupplier = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!currentUser || !form.name.trim() || !form.companyName.trim() || !form.phone.trim() || !form.category.trim()) return;
    setSaving(true); setError(''); setSuccess('');
    try {
      await addDoc(collection(db, 'suppliers'), {
        businessOwnerUid: currentUser.uid,
        name: form.name.trim(),
        companyName: form.companyName.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || null,
        address: form.address.trim() || null,
        category: form.category.trim(),
        outstandingAmount: 0,
        verificationStatus: 'unverified',
        createdAt: serverTimestamp(),
      });
      setForm({ name: '', companyName: '', phone: '', email: '', address: '', category: '' });
      setShowForm(false); setSuccess('Supplier added successfully.');
      await loadSuppliers();
    } catch (err) {
      console.error('Supplier creation failed:', err);
      setError('We could not add the supplier. Please try again.');
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div><h1 className="text-2xl font-bold tracking-tight text-slate-900">Suppliers</h1><p className="text-sm text-slate-500 mt-1">Manage vendors, farmers, and distributors.</p></div>
        <button onClick={() => setShowForm(true)} className="bg-slate-900 text-white px-5 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2"><Plus className="w-4 h-4" /> Add Supplier</button>
      </div>
      {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}
      {success && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{success}</div>}
      {showForm && (
        <form onSubmit={addSupplier} className="bg-white border border-slate-200 rounded-3xl p-5 space-y-4">
          <div className="flex items-center justify-between"><h2 className="font-semibold text-slate-900">Add supplier</h2><button type="button" onClick={() => setShowForm(false)}><X className="w-5 h-5 text-slate-500" /></button></div>
          <div className="grid sm:grid-cols-2 gap-4">
            <input required value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Contact name" className="border border-slate-200 rounded-xl px-4 py-3" />
            <input required value={form.companyName} onChange={e => setForm({...form, companyName: e.target.value})} placeholder="Company name" className="border border-slate-200 rounded-xl px-4 py-3" />
            <input required value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder="Phone number" className="border border-slate-200 rounded-xl px-4 py-3" />
            <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="Email (optional)" className="border border-slate-200 rounded-xl px-4 py-3" />
            <input required value={form.category} onChange={e => setForm({...form, category: e.target.value})} placeholder="Supply category" className="border border-slate-200 rounded-xl px-4 py-3" />
            <input value={form.address} onChange={e => setForm({...form, address: e.target.value})} placeholder="Address (optional)" className="border border-slate-200 rounded-xl px-4 py-3" />
          </div>
          <button disabled={saving} className="bg-slate-900 text-white px-5 py-3 rounded-xl font-medium disabled:opacity-50">{saving ? 'Saving…' : 'Save Supplier'}</button>
        </form>
      )}
      {loading ? <div className="bg-white border border-slate-200 rounded-3xl p-12 flex justify-center"><Loader2 className="w-7 h-7 animate-spin text-slate-400" /></div> :
       suppliers.length === 0 ? <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center"><Truck className="w-12 h-12 text-slate-400 mx-auto mb-4" /><h3 className="text-lg font-semibold text-slate-900">No suppliers yet</h3><p className="text-slate-500 mt-1">Add your real vendors, farmers, or distributors above.</p></div> :
       <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden"><div className="flex justify-end p-3 border-b border-slate-100"><button onClick={() => void loadSuppliers()} className="text-sm text-slate-600 flex items-center gap-1"><RefreshCw className="w-4 h-4" /> Refresh</button></div><div className="divide-y divide-slate-100">{suppliers.map(s => <div key={s.id} className="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"><div><p className="font-semibold text-slate-900">{s.companyName}</p><p className="text-sm text-slate-500 mt-1">{s.name} · {s.category} · {s.phone}</p></div><span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold uppercase">{s.verificationStatus}</span></div>)}</div></div>}
    </div>
  );
}
