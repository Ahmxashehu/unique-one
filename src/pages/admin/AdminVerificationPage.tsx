import React, { useEffect, useMemo, useState } from 'react';
import { ShieldCheck, Search } from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';

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
  if (typeof value === 'object' && value !== null && 'toMillis' in value && typeof (value as any).toMillis === 'function') {
    return (value as any).toMillis();
  }
  if (typeof value === 'string') return Date.parse(value) || 0;
  if (typeof value === 'number') return value;
  return 0;
}

export default function AdminVerificationPage() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    getDocs(collection(db, 'users'))
      .then((snapshot) => {
        if (active) setUsers(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as UserRecord)));
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Failed to load verification records.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const counts = useMemo(() => {
    const result: Record<string, number> = { all: users.length };
    users.forEach((user) => {
      const value = user.verificationStatus || 'unverified';
      result[value] = (result[value] || 0) + 1;
    });
    return result;
  }, [users]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return users
      .filter((user) => filter === 'all' || (user.verificationStatus || 'unverified') === filter)
      .filter((user) => !query || [user.fullName, user.email, user.phone, user.uniqueOneId, user.id]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)))
      .sort((a, b) => dateValue(b.createdAt) - dateValue(a.createdAt));
  }, [users, filter, search]);

  const filters = ['all', 'unverified', 'email_verified', 'phone_verified', 'fully_verified'];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Verification Center</h1>
        <p className="text-sm text-slate-500 mt-1">Review verification status recorded for platform users.</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex flex-wrap gap-3 items-center">
          {filters.map((item) => (
            <button key={item} onClick={() => setFilter(item)} className={filter === item ? 'text-sm font-medium text-slate-900 border-b-2 border-slate-900 pb-1' : 'text-sm font-medium text-slate-500 pb-1'}>
              {item === 'all' ? 'All' : item.replaceAll('_', ' ')} ({counts[item] || 0})
            </button>
          ))}
          <div className="relative ml-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search users..." className="pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-sm" />
          </div>
        </div>

        {loading ? <div className="p-12 text-center text-slate-500">Loading verification records...</div> :
          error ? <div className="p-12 text-center text-red-600">{error}</div> :
          filtered.length === 0 ? <div className="p-12 text-center"><ShieldCheck className="w-10 h-10 text-slate-300 mx-auto mb-3" /><p className="text-slate-500">No verification records match this filter.</p></div> :
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50 text-slate-500"><tr>
            <th className="text-left px-6 py-3">User</th><th className="text-left px-6 py-3">Contact</th><th className="text-left px-6 py-3">Unique ID</th><th className="text-left px-6 py-3">Verification</th><th className="text-left px-6 py-3">Joined</th>
          </tr></thead><tbody className="divide-y divide-slate-100">
            {filtered.map((user) => <tr key={user.id}>
              <td className="px-6 py-4 font-medium">{user.fullName || 'Unnamed user'}</td>
              <td className="px-6 py-4 text-slate-600">{user.email || user.phone || '—'}</td>
              <td className="px-6 py-4 text-slate-600">{user.uniqueOneId || user.id}</td>
              <td className="px-6 py-4">{(user.verificationStatus || 'unverified').replaceAll('_', ' ')}</td>
              <td className="px-6 py-4 text-slate-600">{dateValue(user.createdAt) ? new Date(dateValue(user.createdAt)).toLocaleDateString() : '—'}</td>
            </tr>)}
          </tbody></table></div>}
      </div>
    </div>
  );
}
