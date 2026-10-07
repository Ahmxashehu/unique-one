import React, { useEffect, useMemo, useState } from 'react';
import { Users, Search, Loader2, AlertCircle, RefreshCw, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface AdminUser {
  id: string;
  fullName?: string;
  email?: string;
  phone?: string;
  uniqueOneId?: string;
  roles?: string[];
  verificationStatus?: string;
  createdAt?: unknown;
}

function formatDate(value: unknown) {
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate?: unknown }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toLocaleDateString();
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toLocaleDateString();
  }
  return '—';
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const { currentUser } = useAuth();

  useEffect(() => {
    let active = true;

    const loadUsers = async () => {
      setLoading(true);
      setError('');
      try {
        if (!currentUser) return;
        const token = await currentUser.getIdToken();
        const response = await fetch('/api/admin/overview', { headers: { Authorization: 'Bearer ' + token } });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error?.message || 'Unable to load users.');
        if (!active) return;
        setUsers(payload.users || []);
      } catch (loadError) {
        console.error('Failed to load admin users:', loadError);
        if (active) setError('Unable to load users. Check administrator access and try again.');
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadUsers();
    return () => { active = false; };
  }, [currentUser]);

  const refreshUsers = async () => {
    setRefreshing(true);
    setError('');
    try {
      if (!currentUser) return;
      const token = await currentUser.getIdToken();
      const response = await fetch('/api/admin/overview', { headers: { Authorization: 'Bearer ' + token } });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error?.message || 'Unable to refresh users.');
      setUsers(payload.users || []);
    } catch (loadError) {
      console.error('Failed to refresh admin users:', loadError);
      setError('Unable to refresh users. Check administrator access and try again.');
    } finally {
      setRefreshing(false);
    }
  };

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return users;
    return users.filter(user =>
      [user.fullName, user.email, user.phone, user.uniqueOneId, user.id]
        .filter(Boolean)
        .some(value => String(value).toLowerCase().includes(term))
    );
  }, [users, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Ecosystem Users</h1>
          <p className="text-sm text-slate-500 mt-1">Manage accounts across the Unique One platform.</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button type="button" onClick={() => void refreshUsers()} disabled={refreshing} className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50" aria-label="Refresh users">
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Search name, email, phone, ID..."
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
        </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-12 flex items-center justify-center gap-3 text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin" /> Loading users...
          </div>
        ) : error ? (
          <div className="p-12 text-center">
            <AlertCircle className="w-8 h-8 mx-auto text-rose-500 mb-3" />
            <p className="text-sm text-rose-700">{error}</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-8 h-8 text-slate-400 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-slate-900">
              {users.length === 0 ? 'No registered users' : 'No matching users'}
            </h3>
            <p className="text-slate-500 mt-1">
              {users.length === 0 ? 'Registered users will appear here.' : 'Try a different search term.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700">User</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700">Contact</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700">Unique ID</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700">Roles</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700">Verification</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map(user => (
                  <tr key={user.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{user.fullName || 'Unnamed user'}</div>
                      <div className="text-xs text-slate-500">{user.id}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <div>{user.email || '—'}</div>
                      <div className="text-xs">{user.phone || '—'}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{user.uniqueOneId || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{user.roles?.join(', ') || 'user'}</td>
                    <td className="px-4 py-3"><span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600"><ShieldCheck className="w-3.5 h-3.5" />{user.verificationStatus || 'unverified'}</span></td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(user.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
