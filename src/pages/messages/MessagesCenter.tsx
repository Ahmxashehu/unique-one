import React, { useState, useEffect, useMemo } from 'react';
import { Search, Plus, MessageSquare, Loader2, VolumeX, UsersRound, Sparkles, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import type { Conversation } from '../../lib/os/communication-types';

export default function MessagesCenter() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'users' | 'groups'>('users');
  const [search, setSearch] = useState('');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userResults, setUserResults] = useState<Array<{ uid: string; fullName: string; username?: string; uniqueOneId?: string; profilePhotoUrl?: string }>>([]);
  const [userSearchLoading, setUserSearchLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!currentUser) { setConversations([]); setLoading(false); return; }
      if (conversations.length === 0) setLoading(true);
      setError('');
      try {
        const token = await currentUser.getIdToken();
        const response = await fetch('/api/communication/conversations', { headers: { Authorization: 'Bearer ' + token } });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !Array.isArray(payload?.conversations)) throw new Error(payload?.error?.message ?? 'Failed to load messages.');
        if (!cancelled) setConversations(payload.conversations);
      } catch (err) {
        console.error(err);
        if (!cancelled) setError('Failed to load messages.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    const refreshTimer = window.setInterval(() => { void load(); }, 5000);
    return () => { cancelled = true; window.clearInterval(refreshTimer); };
  }, [currentUser, conversations.length]);

  useEffect(() => {
    const term = search.trim();
    if (!currentUser || term.length < 2) { setUserResults([]); setUserSearchLoading(false); return; }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setUserSearchLoading(true);
      try {
        const token = await currentUser.getIdToken();
        const response = await fetch('/api/communication/users/search?q=' + encodeURIComponent(term), { headers: { Authorization: 'Bearer ' + token } });
        const payload = await response.json().catch(() => null);
        if (!response.ok) throw new Error(payload?.error?.message ?? 'User search failed.');
        if (!cancelled) setUserResults(Array.isArray(payload?.users) ? payload.users : []);
      } catch (err) {
        console.error('Communication user search failed:', err);
        if (!cancelled) setUserResults([]);
      } finally {
        if (!cancelled) setUserSearchLoading(false);
      }
    }, 300);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [currentUser, search]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return conversations
      .filter((c) => activeTab === 'groups' ? c.type === 'group' : c.type !== 'group')
      .filter((c) => !term || (c.title ?? '').toLowerCase().includes(term))
      .sort((a, b) => new Date(b.lastMessageAt ?? b.updatedAt).getTime() - new Date(a.lastMessageAt ?? a.updatedAt).getTime());
  }, [conversations, activeTab, search]);

  return (
    <div className="relative h-full min-h-0 w-full overflow-hidden bg-slate-50">
      <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-emerald-400/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 left-1/3 h-56 w-56 rounded-full bg-cyan-400/10 blur-3xl" />

      <div className="relative flex h-full min-h-0 w-full overflow-hidden bg-white">
        <div className="flex w-full flex-col md:w-96 md:border-r md:border-slate-200">
          <div className="bg-slate-950 p-4 text-white md:p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-900/30">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold tracking-[0.2em] text-emerald-300">UNIQUE COMMUNICATION</p>
                  <h1 className="text-xl font-black">Connect</h1>
                </div>
              </div>
              <button onClick={() => navigate('/os/messages/add')} aria-label="Add user" title="Add user" className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/10 hover:bg-white/15">
                <Plus className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-300">Private messaging, people, groups and business communication — all in one place.</p>
            <div className="mt-4 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search people, Unique ID or conversations" className="w-full rounded-xl border border-white/10 bg-white/10 py-2.5 pl-9 pr-4 text-sm text-white outline-none placeholder:text-slate-400 focus:border-emerald-400/60" />
            </div>
          </div>

          <div className="flex border-b border-slate-100 bg-white px-3 pt-2">
            {(['users', 'groups'] as const).map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2.5 text-sm font-bold border-b-2 ${activeTab === tab ? 'border-emerald-500 text-slate-900' : 'border-transparent text-slate-400'}`}>
                {tab === 'users' ? 'Users' : 'Groups'}
              </button>
            ))}
          </div>

          {search.trim().length >= 2 && (userSearchLoading || userResults.length > 0) && (
            <div className="border-b border-slate-100 bg-white p-3">
              <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-400"><UsersRound className="h-3.5 w-3.5" /> People</div>
              {userSearchLoading && <div className="flex justify-center py-2"><Loader2 className="h-4 w-4 animate-spin text-slate-400" /></div>}
              <div className="space-y-2">
                {userResults.map((user) => (
                  <div key={user.uid} className="flex items-center gap-3 rounded-xl p-2 hover:bg-slate-50">
                    {user.profilePhotoUrl ? <img src={user.profilePhotoUrl} alt="" className="h-10 w-10 rounded-full object-cover" /> : <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 font-bold text-emerald-700">{user.fullName.charAt(0).toUpperCase()}</div>}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-slate-900">{user.fullName}</p>
                      <p className="truncate text-xs text-slate-500">{user.username ? '@' + user.username : user.uniqueOneId ?? 'Unique One user'}</p>
                    </div>
                    <button onClick={() => navigate('/os/messages/add?q=' + encodeURIComponent(user.uniqueOneId ?? user.username ?? user.fullName))} className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white">Add</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto bg-white">
            {loading && <div className="flex justify-center p-10"><Loader2 className="h-5 w-5 animate-spin text-emerald-500" /></div>}
            {!loading && error && <div className="p-8 text-center text-sm text-red-600">{error}</div>}
            {!loading && !error && filtered.map((conv) => (
              <button key={conv.id} onClick={() => navigate(`/os/messages/${conv.id}`)} className="group flex w-full items-start gap-3 border-b border-slate-50 p-4 text-left transition hover:bg-emerald-50/50">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-slate-100 text-lg font-black text-slate-500">
                  {conv.avatarUrl ? <img src={conv.avatarUrl} alt="" className="h-full w-full object-cover" /> : (conv.title ?? 'U').charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="truncate text-sm font-bold text-slate-900">{conv.title ?? 'Messages'}</h4>
                    <span className="whitespace-nowrap text-[10px] text-slate-400">{conv.lastMessageAt ? new Date(conv.lastMessageAt).toLocaleDateString() : ''}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <p className="truncate text-xs text-slate-500">{conv.type === 'group' ? 'Group conversation' : conv.type === 'business' ? 'Business conversation' : 'User conversation'}</p>
                    {conv.muted && <VolumeX className="h-3.5 w-3.5 shrink-0 text-slate-400" />}
                    {(conv.unreadCount ?? 0) > 0 && <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-500 px-1.5 text-[10px] font-black text-white">{(conv.unreadCount ?? 0) > 99 ? '99+' : conv.unreadCount}</span>}
                  </div>
                </div>
                <ChevronRight className="mt-2 hidden h-4 w-4 text-slate-300 group-hover:block" />
              </button>
            ))}
            {!loading && !error && filtered.length === 0 && (
              <div className="p-10 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100"><MessageSquare className="h-7 w-7 text-slate-300" /></div>
                <p className="mt-3 text-sm font-bold text-slate-800">No conversations yet</p>
                <p className="mt-1 text-xs text-slate-500">Search for a person or start a new conversation.</p>
              </div>
            )}
          </div>
        </div>

        <div className="hidden flex-1 flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-emerald-50 md:flex">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-white shadow-lg"><Sparkles className="h-7 w-7 text-emerald-500" /></div>
          <h3 className="mt-4 text-xl font-black text-slate-900">Your communication space</h3>
          <p className="mt-1 max-w-sm text-center text-sm text-slate-500">Select a conversation to continue, or use the + button to find a person.</p>
        </div>
      </div>
    </div>
  );
}
