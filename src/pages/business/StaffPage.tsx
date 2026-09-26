import React, { useEffect, useState } from 'react';
import { Users, Plus, Loader2, RefreshCw, X } from 'lucide-react';
import { addDoc, collection, getDocs, query, where, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';

type StaffInvite = { id: string; inviteeEmail: string; role: string; branchName?: string; status: string };
const roles = ['admin', 'manager', 'sales', 'cashier', 'accountant', 'inventory', 'support', 'delivery', 'branch_manager', 'viewer'];

export default function StaffPage() {
  const { currentUser } = useAuth();
  const [invites, setInvites] = useState<StaffInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('manager');
  const [branchName, setBranchName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadInvites = async () => {
    if (!currentUser) return;
    setLoading(true);
    setError('');
    try {
      const snapshot = await getDocs(query(collection(db, 'staffInvites'), where('businessOwnerUid', '==', currentUser.uid)));
      setInvites(snapshot.docs.map(item => ({ id: item.id, ...item.data() } as StaffInvite)));
    } catch (err) {
      console.error('Staff invites load failed:', err);
      setError('We could not load staff invitations. Please try again.');
    } finally { setLoading(false); }
  };

  useEffect(() => { void loadInvites(); }, [currentUser?.uid]);

  const inviteStaff = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!currentUser || !email.trim()) return;
    setSaving(true); setError(''); setSuccess('');
    try {
      await addDoc(collection(db, 'staffInvites'), {
        businessOwnerUid: currentUser.uid,
        inviteeEmail: email.trim().toLowerCase(),
        role,
        branchName: branchName.trim() || null,
        status: 'pending',
        invitedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      });
      setEmail(''); setBranchName(''); setRole('manager'); setShowForm(false);
      setSuccess('Staff invitation created successfully.');
      await loadInvites();
    } catch (err) {
      console.error('Staff invitation failed:', err);
      setError('We could not create the invitation. Please try again.');
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div><h1 className="text-2xl font-bold tracking-tight text-slate-900">Staff & Teams</h1><p className="text-sm text-slate-500 mt-1">Invite team members and assign business roles.</p></div>
        <button onClick={() => setShowForm(true)} className="bg-slate-900 text-white px-5 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2"><Plus className="w-4 h-4" /> Invite Staff</button>
      </div>
      {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}
      {success && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{success}</div>}
      {showForm && (
        <form onSubmit={inviteStaff} className="bg-white border border-slate-200 rounded-3xl p-5 space-y-4">
          <div className="flex items-center justify-between"><h2 className="font-semibold text-slate-900">Invite a staff member</h2><button type="button" onClick={() => setShowForm(false)}><X className="w-5 h-5 text-slate-500" /></button></div>
          <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="Staff email address" className="w-full border border-slate-200 rounded-xl px-4 py-3 outline-none" />
          <div className="grid sm:grid-cols-2 gap-4">
            <select value={role} onChange={e => setRole(e.target.value)} className="border border-slate-200 rounded-xl px-4 py-3 bg-white">{roles.map(item => <option key={item} value={item}>{item.replace('_', ' ')}</option>)}</select>
            <input value={branchName} onChange={e => setBranchName(e.target.value)} placeholder="Branch (optional)" className="border border-slate-200 rounded-xl px-4 py-3 outline-none" />
          </div>
          <button disabled={saving} className="bg-slate-900 text-white px-5 py-3 rounded-xl font-medium disabled:opacity-50">{saving ? 'Creating invitation…' : 'Create Invitation'}</button>
        </form>
      )}
      {loading ? <div className="bg-white border border-slate-200 rounded-3xl p-12 flex justify-center"><Loader2 className="w-7 h-7 animate-spin text-slate-400" /></div> :
       invites.length === 0 ? <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center"><Users className="w-12 h-12 text-slate-400 mx-auto mb-4" /><h3 className="text-lg font-semibold text-slate-900">No staff invitations yet</h3><p className="text-slate-500 mt-1">Create an invitation above to start building your real business team.</p></div> :
       <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden"><div className="flex justify-end p-3 border-b border-slate-100"><button onClick={() => void loadInvites()} className="text-sm text-slate-600 flex items-center gap-1"><RefreshCw className="w-4 h-4" /> Refresh</button></div><div className="divide-y divide-slate-100">{invites.map(invite => <div key={invite.id} className="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"><div><p className="font-semibold text-slate-900">{invite.inviteeEmail}</p><p className="text-sm text-slate-500 mt-1">{invite.role.replace('_', ' ')}{invite.branchName ? ' · ' + invite.branchName : ''}</p></div><span className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-800 text-xs font-bold uppercase">{invite.status}</span></div>)}</div></div>}
    </div>
  );
}
