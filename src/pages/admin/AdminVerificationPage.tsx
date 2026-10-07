import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Check, Loader2, Search, ShieldCheck, X, RefreshCw } from 'lucide-react';

import { useAuth } from '../../contexts/AuthContext';

type VerificationStatus = 'unverified' | 'email_verified' | 'phone_verified' | 'fully_verified';

type UserRecord = {
  id: string;
  fullName?: string;
  email?: string;
  phone?: string;
  uniqueOneId?: string;
  verificationStatus?: string;
  createdAt?: unknown;
};

function dateValue(value: unknown): number {
  if (typeof value === 'object' && value !== null && 'toMillis' in value && typeof (value as any).toMillis === 'function') return (value as any).toMillis();
  if (typeof value === 'string') return Date.parse(value) || 0;
  if (typeof value === 'number') return value;
  return 0;
}

function statusLabel(status: string) {
  return status.replaceAll('_', ' ');
}

export default function AdminVerificationPage() {
  const { currentUser } = useAuth();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const refreshUsers = async () => {
    setRefreshing(true);
    setError('');
    try {
      if (!currentUser) return;
      const token = await currentUser.getIdToken();
      const response = await fetch('/api/admin/overview', { headers: { Authorization: 'Bearer ' + token } });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error?.message || 'Failed to load verification records.');
      setUsers(payload.users || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh verification records.');
    } finally {
      setRefreshing(false);
    }
  };

  const loadUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const snapshot = await getDocs(collection(db, 'users'));
      setUsers(snapshot.docs.map(item => ({ id: item.id, ...item.data() } as UserRecord)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load verification records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    void loadUsers().catch(() => undefined);
    return () => { active = false; };
  }, []);

  const counts = useMemo(() => {
    const result: Record<string, number> = { all: users.length };
    users.forEach(user => {
      const value = user.verificationStatus || 'unverified';
      result[value] = (result[value] || 0) + 1;
    });
    return result;
  }, [users]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return users
      .filter(user => filter === 'all' || (user.verificationStatus || 'unverified') === filter)
      .filter(user => !query || [user.fullName, user.email, user.phone, user.uniqueOneId, user.id].filter(Boolean).some(value => String(value).toLowerCase().includes(query)))
      .sort((a, b) => dateValue(b.createdAt) - dateValue(a.createdAt));
  }, [users, filter, search]);

  const updateVerification = async (uid: string, status: VerificationStatus) => {
    if (!currentUser) return;
    setActionLoading(true);
    setActionError('');
    setActionMessage('');
    try {
      const token = await currentUser.getIdToken();
      const response = await fetch('/api/admin/users/verification', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ uid, verificationStatus: status }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error?.message || 'Unable to update verification status.');
      setUsers(previous => previous.map(user => user.id === uid ? { ...user, verificationStatus: status } : user));
      setSelectedUser(previous => previous?.id === uid ? { ...previous, verificationStatus: status } : previous);
      setActionMessage('Verification status updated successfully.');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to update verification status.');
    } finally {
      setActionLoading(false);
    }
  };

  const filters = ['all', 'unverified', 'email_verified', 'phone_verified', 'fully_verified'];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Verification Center</h1>
        <p className="text-sm text-slate-500 mt-1">Review and manage platform user verification status.</p>
        <button type="button" onClick={() => void refreshUsers()} disabled={refreshing} className="mt-3 inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"><RefreshCw className={refreshing ? 'w-4 h-4 animate-spin' : 'w-4 h-4'} /> Refresh</button>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex flex-wrap gap-3 items-center">
          {filters.map(item => (
            <button key={item} onClick={() => setFilter(item)} className={filter === item ? 'text-sm font-medium text-slate-900 border-b-2 border-slate-900 pb-1' : 'text-sm font-medium text-slate-500 pb-1'}>
              {item === 'all' ? 'All' : statusLabel(item)} ({counts[item] || 0})
            </button>
          ))}
          <div className="relative ml-auto w-full sm:w-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search users..." className="pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-sm w-full sm:w-64" />
          </div>
        </div>

        {actionError && <div className="mx-6 mt-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"><AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />{actionError}</div>}
        {actionMessage && <div className="mx-6 mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{actionMessage}</div>}

        {loading ? <div className="p-12 text-center text-slate-500">Loading verification records...</div> :
          error ? <div className="p-12 text-center text-red-600">{error}</div> :
          filtered.length === 0 ? <div className="p-12 text-center"><ShieldCheck className="w-10 h-10 text-slate-300 mx-auto mb-3" /><p className="text-slate-500">No verification records match this filter.</p></div> :
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50 text-slate-500"><tr>
            <th className="text-left px-6 py-3">User</th><th className="text-left px-6 py-3">Contact</th><th className="text-left px-6 py-3">Unique ID</th><th className="text-left px-6 py-3">Verification</th><th className="text-left px-6 py-3">Action</th>
          </tr></thead><tbody className="divide-y divide-slate-100">
            {filtered.map(user => <tr key={user.id}>
              <td className="px-6 py-4 font-medium">{user.fullName || 'Unnamed user'}</td>
              <td className="px-6 py-4 text-slate-600">{user.email || user.phone || '—'}</td>
              <td className="px-6 py-4 text-slate-600">{user.uniqueOneId || user.id}</td>
              <td className="px-6 py-4">{statusLabel(user.verificationStatus || 'unverified')}</td>
              <td className="px-6 py-4"><button onClick={() => { setSelectedUser(user); setActionError(''); setActionMessage(''); }} className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50">Review</button></td>
            </tr>)}
          </tbody></table></div>}
      </div>

      {selectedUser && <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4">
        <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-xl p-6">
          <div className="flex items-start justify-between gap-4">
            <div><h2 className="text-lg font-bold text-slate-900">Review verification</h2><p className="text-sm text-slate-500 mt-1">{selectedUser.fullName || 'Unnamed user'}</p></div>
            <button onClick={() => setSelectedUser(null)} className="p-2 rounded-lg hover:bg-slate-100" aria-label="Close"><X className="w-5 h-5" /></button>
          </div>
          <div className="mt-5 space-y-3 text-sm">
            <div><span className="text-slate-500">User ID:</span> {selectedUser.id}</div>
            <div><span className="text-slate-500">Email:</span> {selectedUser.email || '—'}</div>
            <div><span className="text-slate-500">Phone:</span> {selectedUser.phone || '—'}</div>
            <div><span className="text-slate-500">Unique ID:</span> {selectedUser.uniqueOneId || '—'}</div>
            <div><span className="text-slate-500">Current status:</span> {statusLabel(selectedUser.verificationStatus || 'unverified')}</div>
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            <button disabled={actionLoading} onClick={() => void updateVerification(selectedUser.id, 'fully_verified')} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white disabled:opacity-50"><Check className="w-4 h-4" />Approve full verification</button>
            <button disabled={actionLoading} onClick={() => void updateVerification(selectedUser.id, 'unverified')} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-rose-200 text-rose-700 disabled:opacity-50"><X className="w-4 h-4" />Reset verification</button>
            {actionLoading && <Loader2 className="w-5 h-5 animate-spin text-slate-400 self-center" />}
          </div>
        </div>
      </div>}
    </div>
  );
}
