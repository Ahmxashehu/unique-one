import React, { useState, useEffect, useMemo } from 'react';
import { Search, Plus, MessageSquare, Loader2, VolumeX, UsersRound, Sparkles, ChevronRight, X, Check, UserPlus, Contact } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import type { Conversation } from '../../lib/os/communication-types';

const withCommunicationTimeout = <T,>(operation: Promise<T>, message: string, timeoutMs = 12000): Promise<T> => {
  let timer: number | undefined;
  return Promise.race([
    operation,
    new Promise<T>((_, reject) => {
      timer = window.setTimeout(() => reject(new Error(message)), timeoutMs);
    }),
  ]).finally(() => {
    if (timer !== undefined) window.clearTimeout(timer);
  });
};

const fetchCommunicationWithTimeout = async (input: RequestInfo | URL, init: RequestInit, message: string, timeoutMs = 12000): Promise<Response> => {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) throw new Error(message);
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
};

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
  const [contactMatches, setContactMatches] = useState<Array<{ uid: string; fullName: string; username?: string; uniqueOneId?: string; profilePhotoUrl?: string }>>([]);
  const [contactLoading, setContactLoading] = useState(false);
  const [contactMessage, setContactMessage] = useState('');
  const [openingContactUid, setOpeningContactUid] = useState<string | null>(null);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [groupTitle, setGroupTitle] = useState('');
  const [groupSearch, setGroupSearch] = useState('');
  const [groupResults, setGroupResults] = useState<Array<{ uid: string; fullName: string; username?: string; uniqueOneId?: string; profilePhotoUrl?: string }>>([]);
  const [selectedMembers, setSelectedMembers] = useState<Array<{ uid: string; fullName: string; username?: string; uniqueOneId?: string; profilePhotoUrl?: string }>>([]);
  const [groupSearchLoading, setGroupSearchLoading] = useState(false);
  const [groupCreating, setGroupCreating] = useState(false);
  const [groupError, setGroupError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!currentUser) { setConversations([]); setLoading(false); return; }
      if (conversations.length === 0) setLoading(true);
      setError('');
      try {
        const token = await withCommunicationTimeout(currentUser.getIdToken(), 'Sign-in verification timed out. Reopen Messages and retry.');
        const response = await fetchCommunicationWithTimeout('/api/communication/conversations', { headers: { Authorization: 'Bearer ' + token } }, 'Loading conversations timed out. Check your connection and retry.');
        const payload = await withCommunicationTimeout(response.json().catch(() => null), 'The conversations response timed out. Retry Messages.');
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

  const findPhoneContacts = async () => {
    if (!currentUser || contactLoading) return;
    const picker = (navigator as Navigator & {
      contacts?: {
        select: (properties: string[], options?: { multiple?: boolean }) => Promise<Array<{ name?: string[]; tel?: string[] }>>;
      };
    }).contacts;
    if (!picker?.select) {
      setContactMessage('Contact picking is not supported in this browser. Open UniquePlatform in Chrome on Android, or use search by name, phone or Unique ID.');
      return;
    }
    setContactLoading(true);
    setContactMessage('');
    try {
      const picked = await picker.select(['name', 'tel'], { multiple: true });
      const numbers = Array.from(new Set(picked.flatMap((contact) => contact.tel ?? []).map((phone) => phone.trim()).filter(Boolean)));
      if (!numbers.length) {
        setContactMatches([]);
        setContactMessage('No phone numbers were selected. Try selecting contacts that have a phone number.');
        return;
      }
      const token = await currentUser.getIdToken();
      const response = await fetch('/api/communication/contacts/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ phoneNumbers: numbers.slice(0, 100) }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error?.message ?? 'Could not match your contacts.');
      const matches = Array.isArray(payload?.users) ? payload.users : [];
      setContactMatches(matches);
      setContactMessage(matches.length
        ? `Found ${matches.length} registered contact${matches.length === 1 ? '' : 's'} from the contacts you selected.`
        : 'None of the selected phone numbers matched a registered UniquePlatform profile yet. You can still search by name or Unique ID.');
    } catch (err) {
      if (err instanceof Error && /cancel|abort/i.test(err.name + ' ' + err.message)) {
        setContactMessage('Contact selection was cancelled.');
      } else {
        setContactMessage(err instanceof Error ? err.message : 'Could not match your contacts.');
      }
    } finally {
      setContactLoading(false);
    }
  };

  const openContactChat = async (uid: string) => {
    if (!currentUser || openingContactUid) return;
    setOpeningContactUid(uid);
    setContactMessage('');
    try {
      const token = await withCommunicationTimeout(currentUser.getIdToken(), 'Sign-in verification timed out. Please retry.');
      const response = await fetchCommunicationWithTimeout('/api/communication/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ type: 'direct', memberUids: [currentUser.uid, uid] }),
      }, 'Opening the conversation timed out. Check your connection and retry.');
      const payload = await withCommunicationTimeout(response.json().catch(() => null), 'The conversation response timed out. Please retry.');
      if (!response.ok) throw new Error(payload?.error?.message ?? 'Could not open this conversation.');
      if (!payload?.conversation?.id) throw new Error('Conversation could not be created.');
      navigate('/os/messages/' + payload.conversation.id);
    } catch (err) {
      setContactMessage(err instanceof Error ? err.message : 'Could not open this conversation.');
    } finally {
      setOpeningContactUid(null);
    }
  };

  const searchGroupMembers = async () => {
    if (!currentUser) return;
    const term = groupSearch.trim();
    if (term.length < 2) { setGroupError('Enter at least 2 characters to find a member.'); return; }
    setGroupSearchLoading(true);
    setGroupError('');
    try {
      const token = await currentUser.getIdToken();
      const response = await fetch('/api/communication/users/search?q=' + encodeURIComponent(term), { headers: { Authorization: 'Bearer ' + token } });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error?.message ?? 'Member search failed.');
      const found = Array.isArray(payload?.users) ? payload.users : [];
      setGroupResults(found.filter((u: { uid: string }) => !selectedMembers.some((selected) => selected.uid === u.uid)));
      if (!found.length) setGroupError('No matching users found.');
    } catch (err) {
      setGroupError(err instanceof Error ? err.message : 'Member search failed.');
    } finally { setGroupSearchLoading(false); }
  };

  const createGroup = async () => {
    if (!currentUser || groupCreating) return;
    const title = groupTitle.trim();
    if (title.length < 2) { setGroupError('Enter a group name with at least 2 characters.'); return; }
    if (selectedMembers.length < 1) { setGroupError('Select at least one friend to create a group.'); return; }
    setGroupCreating(true);
    setGroupError('');
    try {
      const token = await currentUser.getIdToken();
      const response = await fetch('/api/communication/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ type: 'group', title, memberUids: selectedMembers.map((member) => member.uid) }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error?.message ?? 'Could not create the group.');
      const conversationId = payload?.conversation?.id;
      if (!conversationId) throw new Error('Group was created but its conversation ID was missing.');
      setShowCreateGroup(false);
      setGroupTitle('');
      setGroupSearch('');
      setGroupResults([]);
      setSelectedMembers([]);
      navigate('/os/messages/' + conversationId);
    } catch (err) {
      setGroupError(err instanceof Error ? err.message : 'Could not create the group.');
    } finally { setGroupCreating(false); }
  };

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
              <button onClick={() => setShowAddMenu((open) => !open)} aria-label="Add user or create group" title="Add user or create group" className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/10 hover:bg-white/15">
                <Plus className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-300">Private messaging, people, groups and business communication — all in one place.</p>
            <div className="mt-4 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search people, Unique ID or conversations" className="w-full rounded-xl border border-white/10 bg-white/10 py-2.5 pl-9 pr-4 text-sm text-white outline-none placeholder:text-slate-400 focus:border-emerald-400/60" />
            </div>
            <button onClick={() => void findPhoneContacts()} disabled={contactLoading} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-300/30 bg-emerald-400/10 px-3 py-2.5 text-sm font-bold text-emerald-200 disabled:opacity-60">
              {contactLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Contact className="h-4 w-4" />}
              {contactLoading ? 'Matching selected contacts…' : 'Find people in my phone contacts'}
            </button>
          </div>

          {showAddMenu && (
            <div className="border-b border-slate-200 bg-slate-50 p-3">
              <button onClick={() => { setShowAddMenu(false); navigate('/os/messages/add'); }} className="flex w-full items-center gap-3 rounded-xl bg-white p-3 text-left text-sm font-semibold text-slate-800 shadow-sm">
                <UserPlus className="h-4 w-4 text-emerald-600" /> Find a friend and start a private chat
              </button>
              <button onClick={() => { setShowCreateGroup(true); setShowAddMenu(false); setGroupError(''); }} className="mt-2 flex w-full items-center gap-3 rounded-xl bg-white p-3 text-left text-sm font-semibold text-slate-800 shadow-sm">
                <UsersRound className="h-4 w-4 text-emerald-600" /> Create a group chat
              </button>
            </div>
          )}

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

          {(contactMessage || contactMatches.length > 0) && (
            <div className="border-b border-slate-100 bg-emerald-50/50 p-3">
              {contactMessage && <p role="status" className="mb-2 text-xs text-slate-600">{contactMessage}</p>}
              {contactMatches.length > 0 && (
                <div className="space-y-2">
                  {contactMatches.map((user) => (
                    <div key={user.uid} className="flex items-center gap-3 rounded-xl bg-white p-2">
                      {user.profilePhotoUrl ? <img src={user.profilePhotoUrl} alt="" className="h-10 w-10 rounded-full object-cover" /> : <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 font-bold text-emerald-800">{user.fullName.charAt(0).toUpperCase()}</div>}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-slate-900">{user.fullName}</p>
                        <p className="truncate text-xs text-slate-500">{user.username ? '@' + user.username : user.uniqueOneId ?? 'UniquePlatform user'}</p>
                      </div>
                      <button onClick={() => void openContactChat(user.uid)} disabled={openingContactUid !== null} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">
                        {openingContactUid === user.uid ? 'Opening…' : 'Message'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
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
      {showCreateGroup && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-3 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="create-group-title">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 p-4 sm:p-5">
              <div><h2 id="create-group-title" className="text-lg font-black text-slate-900">Create group chat</h2><p className="mt-1 text-xs text-slate-500">Name the group and choose people to include.</p></div>
              <button onClick={() => setShowCreateGroup(false)} aria-label="Close group creation" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-4 p-4 sm:p-5">
              <label className="block text-sm font-semibold text-slate-700">Group name
                <input value={groupTitle} onChange={(event) => setGroupTitle(event.target.value)} maxLength={80} placeholder="e.g. Family, Project Team" className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-emerald-500" />
              </label>
              <div><label className="block text-sm font-semibold text-slate-700" htmlFor="group-member-search">Add members</label>
                <div className="mt-1.5 flex gap-2">
                  <input id="group-member-search" value={groupSearch} onChange={(event) => setGroupSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void searchGroupMembers(); } }} placeholder="Name, username or Unique ID" className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-emerald-500" />
                  <button onClick={() => void searchGroupMembers()} disabled={groupSearchLoading} className="rounded-xl bg-slate-900 px-4 text-sm font-bold text-white disabled:opacity-50">{groupSearchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}</button>
                </div>
              </div>
              {selectedMembers.length > 0 && <div className="flex flex-wrap gap-2">{selectedMembers.map((member) => <button key={member.uid} onClick={() => setSelectedMembers((items) => items.filter((item) => item.uid !== member.uid))} className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800">{member.fullName}<X className="h-3 w-3" /></button>)}</div>}
              {groupResults.length > 0 && <div className="max-h-48 space-y-2 overflow-y-auto">{groupResults.map((member) => <div key={member.uid} className="flex items-center gap-3 rounded-xl border border-slate-100 p-2.5">
                {member.profilePhotoUrl ? <img src={member.profilePhotoUrl} alt="" className="h-9 w-9 rounded-full object-cover" /> : <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 font-bold text-emerald-700">{member.fullName.charAt(0).toUpperCase()}</div>}
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-800">{member.fullName}</p><p className="truncate text-xs text-slate-500">{member.username ? '@' + member.username : member.uniqueOneId ?? 'UniquePlatform user'}</p></div>
                <button onClick={() => { setSelectedMembers((items) => items.some((item) => item.uid === member.uid) ? items : [...items, member]); setGroupResults((items) => items.filter((item) => item.uid !== member.uid)); setGroupError(''); }} className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white"><Check className="h-3.5 w-3.5" /> Add</button>
              </div>)}</div>}
              {groupError && <p role="alert" className="text-sm text-red-600">{groupError}</p>}
              <p className="text-xs text-slate-500">Select 1–49 other members. Everyone must have a UniquePlatform account.</p>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setShowCreateGroup(false)} className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700">Cancel</button>
                <button onClick={() => void createGroup()} disabled={groupCreating || selectedMembers.length < 1 || groupTitle.trim().length < 2} className="flex-1 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{groupCreating ? 'Creating…' : 'Create group'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
