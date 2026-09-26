import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Phone, Video, MoreVertical, Paperclip, Send, Loader2, Check, CheckCheck, Clock, ShieldAlert, Ban } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getConversation, getConversationMembers, subscribeToMessagesForConversation } from '../../lib/os/communication-db';
import type { Conversation, Message } from '../../lib/os/communication-types';

export default function ChatView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [otherPresence, setOtherPresence] = useState<{ uid: string; status: 'online' | 'offline'; lastSeenAt: string | null } | null>(null);
  const [otherUid, setOtherUid] = useState<string | null>(null);
  const [showNewContactWarning, setShowNewContactWarning] = useState(() => new URLSearchParams(window.location.search).get('new') === '1');
  const [blocked, setBlocked] = useState(false);

  const updatePresence = useCallback(async (status: 'online' | 'offline') => {
    if (!currentUser) return;
    try {
      const token = await currentUser.getIdToken();
      await fetch('/api/communication/presence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
        keepalive: status === 'offline',
      });
    } catch (err) {
      console.error('Presence update failed:', err);
    }
  }, [currentUser]);

  useEffect(() => {
    void updatePresence('online');
    const handleVisibility = () => { void updatePresence(document.visibilityState === 'visible' ? 'online' : 'offline'); };
    document.addEventListener('visibilitychange', handleVisibility);
    const handleBeforeUnload = () => { void updatePresence('offline'); };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      void updatePresence('offline');
    };
  }, [updatePresence]);

  const loadOtherPresence = useCallback(async () => {
    if (!id || !currentUser) return;
    try {
      const members = await getConversationMembers(id);
      const otherMember = members.find((member) => member.uid !== currentUser.uid);
      setOtherUid(otherMember?.uid ?? null);
      if (!otherMember) {
        setOtherPresence(null);
        return;
      }
      const token = await currentUser.getIdToken();
      const response = await fetch(`/api/communication/conversations/${id}/presence`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error?.message ?? 'Failed to load presence.');
      const presence = Array.isArray(payload?.presences)
        ? payload.presences.find((item: { uid?: string }) => item.uid === otherMember.uid)
        : null;
      setOtherPresence(presence ?? { uid: otherMember.uid, status: 'offline', lastSeenAt: null });
    } catch (err) {
      console.error('Presence read failed:', err);
    }
  }, [id, currentUser]);

  useEffect(() => { void loadOtherPresence(); }, [loadOtherPresence]);

  const blockUser = async () => {
    if (!currentUser || !otherUid || blocked) return;
    try {
      const token = await currentUser.getIdToken();
      const response = await fetch('/api/communication/blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ blockedUid: otherUid }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error?.message ?? 'Failed to block this user.');
      setBlocked(true);
      setShowNewContactWarning(false);
      navigate('/os/messages');
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to block this user.'); }
  };

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;
    setLoading(true);
    setError('');
    void (async () => {
      if (!id || !currentUser) return;
      try {
        const conv = await getConversation(id);
        if (!active) return;
        setConversation(conv);
        unsubscribe = await subscribeToMessagesForConversation(
          id,
          (items) => {
            if (!active) return;
            setMessages(items);
            setLoading(false);
          },
          (subscriptionError) => {
            if (!active) return;
            setError(subscriptionError.message);
            setLoading(false);
          },
        );
      } catch (err) {
        console.error(err);
        if (active) {
          setError('Unable to load this conversation.');
          setLoading(false);
        }
      }
    })();
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [id, currentUser]);

  const markVisibleMessagesRead = useCallback(async (items: Message[]) => {
    if (!currentUser) return;
    const unread = items.filter((item) => item.senderId !== currentUser.uid && item.status !== 'read');
    if (unread.length === 0) return;
    const token = await currentUser.getIdToken();
    await Promise.all(unread.map((item) => fetch(`/api/communication/messages/${item.id}/delivery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: 'read' }),
    })));
  }, [currentUser]);

  useEffect(() => {
    if (messages.length > 0) void markVisibleMessagesRead(messages);
  }, [messages, markVisibleMessages]);

  useEffect(() => {
    if (!id || !currentUser) return;
    const timer = window.setInterval(() => { void loadOtherPresence(); }, 5000);
    return () => window.clearInterval(timer);
  }, [id, currentUser, loadOtherPresence]);

  const handleSend = async () => {
    const text = message.trim();
    if (!text || !id || !currentUser || sending) return;
    setSending(true);
    setError('');
    try {
      const token = await currentUser.getIdToken();
      const response = await fetch('/api/communication/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ conversationId: id, type: 'text', text }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error?.message ?? 'Failed to send message.');
      setMessage('');
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] -m-4 md:-m-6 lg:-m-8 bg-slate-50 md:rounded-3xl md:h-[calc(100vh-100px)] overflow-hidden">
      <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/os/messages')} className="p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-full md:hidden" aria-label="Back">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-600">
            {(conversation?.title ?? 'U').charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="font-bold text-slate-900 text-sm md:text-base">{conversation?.title ?? 'Conversation'}</h2>
            <p className="text-xs text-slate-500">{otherPresence?.status === 'online' ? 'Online' : otherPresence?.lastSeenAt ? `Last seen ${new Date(otherPresence.lastSeenAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : conversation?.status ?? 'Loading...'}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button className="p-2 text-slate-400 rounded-full hidden sm:block" aria-label="Voice call"><Phone className="w-5 h-5" /></button>
          <button className="p-2 text-slate-400 rounded-full hidden sm:block" aria-label="Video call"><Video className="w-5 h-5" /></button>
          <button className="p-2 text-slate-400 rounded-full" aria-label="More options"><MoreVertical className="w-5 h-5" /></button>
        </div>
      </div>

        {showNewContactWarning && otherUid && !blocked && (
          <div className="mx-4 mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 shrink-0">
            <div className="flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900">New contact</p>
                <p className="text-xs text-slate-600 mt-1">You may not know this person. Read the message first. If it looks familiar, you can reply; if you don't recognize the person, you can block them.</p>
                <div className="flex gap-2 mt-3">
                  <button onClick={() => setShowNewContactWarning(false)} className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-medium">Reply</button>
                  <button onClick={() => void blockUser()} className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-medium flex items-center gap-1.5"><Ban className="w-3.5 h-3.5" /> Block</button>
                </div>
              </div>
            </div>
          </div>
        )}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading && <div className="flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>}
        {error && <div className="text-center text-xs text-red-600 bg-red-50 rounded-lg p-2">{error}</div>}
        {!loading && messages.map((msg) => {
          const mine = msg.senderId === currentUser?.uid;
          return (
            <div key={msg.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] md:max-w-[60%] rounded-2xl px-4 py-2 ${mine ? 'bg-slate-900 text-white rounded-tr-sm' : 'bg-white border border-slate-200 text-slate-900 rounded-tl-sm'}`}>
                {msg.text && <p className="text-sm whitespace-pre-wrap">{msg.text}</p>}
                <div className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${mine ? 'text-slate-400' : 'text-slate-400'}`}>
                  <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  {mine && msg.status === 'sent' && <Check className="w-3 h-3" />}
                  {mine && msg.status === 'delivered' && <CheckCheck className="w-3 h-3" />}
                  {mine && msg.status === 'read' && <CheckCheck className="w-3 h-3 text-blue-400" />}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {!blocked && <div className="bg-white border-t border-slate-200 p-3 sm:p-4 shrink-0">
        <div className="flex items-end gap-2 bg-slate-50 border border-slate-200 rounded-2xl p-1 pr-2">
          <button className="p-3 text-slate-400 shrink-0" aria-label="Attach file"><Paperclip className="w-5 h-5" /></button>
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSend(); }
          }} placeholder="Type a message..." className="flex-1 bg-transparent border-none py-3 focus:ring-0 resize-none max-h-32 text-sm focus:outline-none" rows={1} />
          <button onClick={() => void handleSend()} disabled={!message.trim() || sending} className="p-3 bg-slate-900 text-white rounded-xl disabled:opacity-50 shrink-0 mb-1" aria-label="Send">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>}
    </div>
  );
}
