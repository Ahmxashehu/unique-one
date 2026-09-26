import React, { useEffect, useMemo, useState } from 'react';
import { Search, Plus, MessageSquare, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getUserConversations } from '../../lib/os/communication-db';
import type { Conversation } from '../../lib/os/communication-types';

export default function MessagesCenter() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'all' | 'business'>('all');
  const [search, setSearch] = useState('');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
        const result = await getUserConversations();
        if (!cancelled) setConversations(result);
      } catch (err) {
        console.error(err);
        if (!cancelled) setError('Failed to load messages.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [currentUser]);

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
            <button onClick={() => navigate('/os/messages/new')} aria-label="New message" className="w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded-full">
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

        <div className="flex-1 overflow-y-auto">
          {loading && <div className="p-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>}
          {!loading && error && <div className="p-8 text-center text-sm text-red-600">{error}</div>}
          {!loading && !error && filtered.map((conv) => (
            <button key={conv.id} onClick={() => navigate(`/os/messages/${conv.id}`)} className="w-full text-left flex items-start gap-3 p-4 border-b border-slate-50 hover:bg-slate-50">
              <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center text-lg font-bold text-slate-500 shrink-0">
                {(conv.title ?? 'U').charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between gap-2">
                  <h4 className="font-semibold text-slate-900 truncate">{conv.title ?? 'Conversation'}</h4>
                  <span className="text-xs text-slate-500 whitespace-nowrap">{conv.lastMessageAt ? new Date(conv.lastMessageAt).toLocaleDateString() : ''}</span>
                </div>
                <p className="text-sm text-slate-500 truncate mt-0.5">{conv.type === 'business' ? 'Business conversation' : 'Conversation'}</p>
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
