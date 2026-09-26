import React, { useEffect, useMemo, useState } from 'react';
import { Search, Plus, MessageSquare, Loader2, VolumeX } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import type { Conversation } from '../../lib/os/communication-types';

export default function MessagesCenter() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'all' | 'business'>('all');
  const [search, setSearch] = useState('');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userResults, setUserResults] = useState<Array<{ uid: string; fullName: string; username?: string; uniqueOneId?: string; profilePhotoUrl?: string }>>([]);
  const [userSearchLoading, setUserSearchLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!currentUser) {
        setConversations([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError('');
      try {
        const token = await currentUser.getIdToken();
        const response = await fetch('/api/communication/conversations', {
          headers: { Authorization: 'Bearer ' + token },
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !Array.isArray(payload?.conversations)) {
          throw new Error(payload?.error?.message ?? 'Failed to load messages.');
        }
        if (!cancelled) {
          setConversations(payload.conversations);
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) setError('Failed to load messages.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    const refreshTimer = window.setInterval(() => { void load(); }, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(refreshTimer);
    };
  }, [currentUser]);

  useEffect(() => {
    const term = search.trim();
    if (!currentUser || term.length < 2) {
      setUserResults([]);
      setUserSearchLoading(false);
      return;
    }
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
      .filter((c) => activeTab === 'all' || c.type === 'business')
      .filter((c) => !term || (c.title ?? '').toLowerCase().includes(term))
      .sort((a, b) => new Date(b.lastMessageAt ?? b.updatedAt).getTime() - new Date(a.lastMessageAt ?? a.updatedAt).getTime());
  }, [conversations, activeTab, search]);

  return (
    <div className="flex h-[calc(100vh-64px)] -m-4 md:-m-6 lg:-m-8 bg-white md:bg-transparent">
      <div className="w-full md:w-80 lg:w-96 flex flex-col border-r border-slate-200 bg-white md:rounded-l-3xl md:h-[calc(100vh-100px)]">
        <div className="p-4 border-b border-slate-100">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-xl font-bold text-slate-900">Messages</h1>
            <button onClick={() => navigate('/os/messages/add')} aria-label="Add user" title="Add user" className="w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded-full">
              <Plus className="w-5 h-5 text-slate-700" />
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search messages..." className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
          </div>
        </div>

        <div className="flex border-b border-slate-100 px-2 pt-2">
          {(['all', 'business'] as const).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 text-sm font-medium border-b-2 ${activeTab === tab ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500'}`}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {search.trim().length >= 2 && (userSearchLoading || userResults.length > 0) && (
          <div className="border-b border-slate-100 bg-white p-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">People</h3>
            {userSearchLoading && <div className="flex justify-center py-2"><Loader2 className="w-4 h-4 animate-spin text-slate-400" /></div>}
            <div className="space-y-2">
              {userResults.map((user) => (
                <div key={user.uid} className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50">
                  {user.profilePhotoUrl ? <img src={user.profilePhotoUrl} alt="" className="w-10 h-10 rounded-full object-cover" /> : <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-semibold text-slate-500">{user.fullName.charAt(0).toUpperCase()}</div>}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{user.fullName}</p>
                    <p className="text-xs text-slate-500 truncate">{user.username ? '@' + user.username : user.uniqueOneId ?? 'Unique One user'}</p>
                  </div>
                  <button onClick={() => navigate('/os/messages/add?q=' + encodeURIComponent(user.uniqueOneId ?? user.username ?? user.fullName))} className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs">Add</button>
                </div>
              ))}
            </div>
          </div>
        )}

                <div className="flex-1 overflow-y-auto">
          {loading && <div className="p-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>}
          {!loading && error && <div className="p-8 text-center text-sm text-red-600">{error}</div>}
          {!loading && !error && filtered.map((conv) => (
            <button key={conv.id} onClick={() => navigate(`/os/messages/${conv.id}`)} className="w-full text-left flex items-start gap-3 p-4 border-b border-slate-50 hover:bg-slate-50">
              <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center text-lg font-bold text-slate-500 shrink-0 overflow-hidden">
                {conv.avatarUrl ? (
                  <img src={conv.avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  (conv.title ?? 'U').charAt(0).toUpperCase()
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between gap-2">
                  <h4 className="font-semibold text-slate-900 truncate">{conv.title ?? 'Messages'}</h4>
                  <span className="text-xs text-slate-500 whitespace-nowrap">{conv.lastMessageAt ? new Date(conv.lastMessageAt).toLocaleDateString() : ''}</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5"><p className="text-sm text-slate-500 truncate">{conv.type === 'business' ? 'Business conversation' : 'Tap to open chat'}</p>{conv.muted && <VolumeX className="w-3.5 h-3.5 text-slate-400 shrink-0" />}{(conv.unreadCount ?? 0) > 0 && <span className="ml-auto min-w-5 h-5 px-1.5 rounded-full bg-slate-900 text-white text-[10px] font-bold flex items-center justify-center">{(conv.unreadCount ?? 0) > 99 ? '99+' : conv.unreadCount}</span>}</div>
              </div>
            </button>
          ))}
          {!loading && !error && filtered.length === 0 && (
            <div className="p-8 text-center text-slate-500">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No messages found.</p>
            </div>
          )}
        </div>
      </div>

      <div className="hidden md:flex flex-1 flex-col bg-slate-50 md:rounded-r-3xl md:h-[calc(100vh-100px)] items-center justify-center">
        <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm mb-4">
          <MessageSquare className="w-8 h-8 text-slate-300" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900">Your Messages</h3>
        <p className="text-slate-500 text-sm mt-1">Select a conversation to start messaging</p>
      </div>
    </div>
  );
}
