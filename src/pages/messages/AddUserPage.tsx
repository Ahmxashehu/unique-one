import React, { useEffect, useState } from 'react';
import { ArrowLeft, Search, UserPlus, Loader2, CheckCircle2 } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

type UserResult = {
  uid: string;
  fullName: string;
  username?: string;
  uniqueOneId?: string;
  profilePhotoUrl?: string;
};

export default function AddUserPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [sendingUid, setSendingUid] = useState<string | null>(null);
  const [sentUids, setSentUids] = useState<string[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const initialQuery = new URLSearchParams(location.search).get('q')?.trim() ?? '';
    if (initialQuery && initialQuery !== query) setQuery(initialQuery);
  }, [location.search]);

  const searchUsers = async () => {
    if (!currentUser) return;
    const value = query.trim();
    if (value.length < 2) { setError('Enter at least 2 characters.'); setResults([]); return; }
    setLoading(true);
    setError('');
    try {
      const token = await currentUser.getIdToken();
      const response = await fetch('/api/communication/users/search?q=' + encodeURIComponent(value), { headers: { Authorization: 'Bearer ' + token } });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error?.message ?? 'Failed to search for users.');
      setResults(Array.isArray(payload?.users) ? payload.users : []);
      if (!payload?.users?.length) setError('No Unique One user found.');
    } catch (err) {
      setResults([]);
      setError(err instanceof Error ? err.message : 'Failed to search for users.');
    } finally { setLoading(false); }
  };

  const sendRequest = async (uid: string) => {
    if (!currentUser || sendingUid) return;
    setSendingUid(uid);
    setError('');
    try {
      const token = await currentUser.getIdToken();
      const response = await fetch('/api/communication/message-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ toUid: uid }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error?.message ?? 'Failed to send request.');
      setSentUids((current) => current.includes(uid) ? current : [...current, uid]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send request.');
    } finally { setSendingUid(null); }
  };

  return (
    <div className="h-full min-h-[520px] bg-white rounded-2xl p-5 md:p-8 overflow-y-auto">
      <div className="max-w-xl mx-auto">
        <button onClick={() => navigate('/os/messages')} className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 mb-6"><ArrowLeft className="w-4 h-4" /> Messages</button>
        <div className="mb-6">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-3"><UserPlus className="w-6 h-6 text-slate-700" /></div>
          <h2 className="text-2xl font-bold text-slate-900">Add User</h2>
          <p className="text-sm text-slate-500 mt-1">Find a Unique One user by phone, email, Unique ID, or username.</p>
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void searchUsers(); }} placeholder="Phone, email, Unique ID or username" className="w-full pl-9 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
          </div>
          <button onClick={() => void searchUsers()} disabled={loading} className="px-4 py-3 rounded-xl bg-slate-900 text-white text-sm font-medium disabled:opacity-50">{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}</button>
        </div>
        {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
        <div className="mt-6 space-y-3">
          {results.map((user) => {
            const sent = sentUids.includes(user.uid);
            return (
              <div key={user.uid} className="flex items-center gap-3 p-4 border border-slate-200 rounded-2xl">
                {user.profilePhotoUrl ? <img src={user.profilePhotoUrl} alt="" className="w-12 h-12 rounded-full object-cover" /> : <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-lg font-semibold text-slate-500">{user.fullName.charAt(0).toUpperCase()}</div>}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 truncate">{user.fullName}</p>
                  {user.username && <p className="text-sm text-slate-500 truncate">@{user.username}</p>}
                  {user.uniqueOneId && <p className="text-xs text-slate-400 mt-0.5">{user.uniqueOneId}</p>}
                </div>
                <button onClick={() => void sendRequest(user.uid)} disabled={sent || sendingUid === user.uid} className="shrink-0 px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-medium disabled:opacity-50 flex items-center gap-1.5">
                  {sent ? <><CheckCircle2 className="w-4 h-4" /> Sent</> : sendingUid === user.uid ? 'Sending...' : <><UserPlus className="w-4 h-4" /> Add</>}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
