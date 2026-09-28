import React, { useEffect, useState } from 'react';
import { MapPin, Plus, Loader2, RefreshCw, X } from 'lucide-react';
import { addDoc, collection, deleteDoc, doc, getDocs, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';

type Branch = {
  id: string;
  ownerUid: string;
  businessId: string;
  name: string;
  type: 'headquarters' | 'branch' | 'warehouse' | 'farm_site' | 'storefront';
  address?: string;
  phone?: string;
  status: 'active' | 'inactive';
  createdAt?: any;
};

const branchTypes: Branch['type'][] = ['headquarters', 'branch', 'warehouse', 'farm_site', 'storefront'];

export default function BranchesPage() {
  const { currentUser } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', type: 'branch' as Branch['type'], address: '', phone: '' });

  const loadBranches = async () => {
    if (!currentUser) return;
    setLoading(true);
    setError('');
    try {
      const businessSnap = await getDocs(query(collection(db, 'businesses'), where('ownerUid', '==', currentUser.uid)));
      if (businessSnap.empty) {
        setBusinessId(null);
        setBranches([]);
        return;
      }
      const currentBusiness = businessSnap.docs[0];
      setBusinessId(currentBusiness.id);
      const branchSnap = await getDocs(query(collection(db, 'branches'), where('ownerUid', '==', currentUser.uid)));
      setBranches(
        branchSnap.docs
          .map(item => ({ id: item.id, ...item.data() } as Branch))
          .filter(branch => branch.businessId === currentBusiness.id)
          .sort((a, b) => String(a.name).localeCompare(String(b.name)))
      );
    } catch (err) {
      console.error('Branches load failed:', err);
      setError('We could not load your branches. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadBranches(); }, [currentUser?.uid]);

  const addBranch = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!currentUser || !businessId || !form.name.trim()) return;
    setSaving(true);
    setError('');
    try {
      await addDoc(collection(db, 'branches'), {
        ownerUid: currentUser.uid,
        businessId,
        name: form.name.trim(),
        type: form.type,
        address: form.address.trim() || null,
        phone: form.phone.trim() || null,
        status: 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setForm({ name: '', type: 'branch', address: '', phone: '' });
      setShowForm(false);
      await loadBranches();
    } catch (err) {
      console.error('Branch creation failed:', err);
      setError('We could not create this branch. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (branch: Branch) => {
    if (!currentUser) return;
    try {
      await updateDoc(doc(db, 'branches', branch.id), {
        status: branch.status === 'active' ? 'inactive' : 'active',
        updatedAt: serverTimestamp(),
      });
      await loadBranches();
    } catch (err) {
      console.error('Branch status update failed:', err);
      setError('We could not update this branch.');
    }
  };

  const removeBranch = async (branch: Branch) => {
    if (!currentUser || !window.confirm('Remove this branch?')) return;
    try {
      await deleteDoc(doc(db, 'branches', branch.id));
      await loadBranches();
    } catch (err) {
      console.error('Branch removal failed:', err);
      setError('We could not remove this branch.');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Branches & Locations</h1>
          <p className="text-sm text-slate-500 mt-1">Manage your storefronts, warehouses, or farm sites.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => void loadBranches()} disabled={loading} className="bg-white border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button onClick={() => setShowForm(true)} disabled={!businessId} className="bg-slate-900 text-white px-5 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 disabled:opacity-50">
            <Plus className="w-4 h-4" /> Add Branch
          </button>
        </div>
      </div>

      {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}

      {!loading && !businessId && (
        <div className="bg-white border border-slate-200 rounded-3xl p-10 text-center">
          <h3 className="text-lg font-semibold text-slate-900">No registered business</h3>
          <p className="text-sm text-slate-500 mt-2">Register your business before adding branches or locations.</p>
        </div>
      )}

      {showForm && businessId && (
        <form onSubmit={addBranch} className="bg-white border border-slate-200 rounded-3xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Add branch or location</h2>
            <button type="button" onClick={() => setShowForm(false)} aria-label="Close"><X className="w-5 h-5 text-slate-500" /></button>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Location name" className="border border-slate-200 rounded-xl px-4 py-3" />
            <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value as Branch['type'] })} className="border border-slate-200 rounded-xl px-4 py-3 bg-white">
              {branchTypes.map(type => <option key={type} value={type}>{type.replace(/_/g, ' ')}</option>)}
            </select>
            <input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Address (optional)" className="border border-slate-200 rounded-xl px-4 py-3" />
            <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="Phone (optional)" className="border border-slate-200 rounded-xl px-4 py-3" />
          </div>
          <button disabled={saving} className="bg-slate-900 text-white px-5 py-3 rounded-xl font-medium disabled:opacity-50">
            {saving ? 'Saving…' : 'Save Location'}
          </button>
        </form>
      )}

      {loading ? (
        <div className="bg-white border border-slate-200 rounded-3xl p-12 flex justify-center"><Loader2 className="w-7 h-7 animate-spin text-slate-400" /></div>
      ) : businessId && branches.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center">
          <MapPin className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-900">No branches yet</h3>
          <p className="text-slate-500 mt-1">Add your real storefronts, warehouses, or farm sites. No location is created automatically.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden divide-y divide-slate-100">
          {branches.map(branch => (
            <div key={branch.id} className="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-start gap-3 min-w-0">
                <MapPin className="w-5 h-5 text-slate-400 mt-1 shrink-0" />
                <div className="min-w-0">
                  <h3 className="font-semibold text-slate-900 truncate">{branch.name}</h3>
                  <p className="text-sm text-slate-500 mt-1 capitalize">{branch.type.replace(/_/g, ' ')}{branch.address ? ` · ${branch.address}` : ''}</p>
                  {branch.phone && <p className="text-xs text-slate-400 mt-1">{branch.phone}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => void toggleStatus(branch)} className={`px-3 py-1 rounded-md text-xs font-bold uppercase ${branch.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                  {branch.status}
                </button>
                <button onClick={() => void removeBranch(branch)} className="text-xs font-medium text-rose-600 hover:underline">Remove</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
