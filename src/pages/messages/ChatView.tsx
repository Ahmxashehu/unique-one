import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Phone, Video, MoreVertical, Paperclip, Send, Loader2, Check, CheckCheck, Clock } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getConversation, getMessagesForConversation } from '../../lib/os/communication-db';
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

  const loadChat = useCallback(async () => {
    if (!id || !currentUser) return;
    setLoading(true);
    setError('');
    try {
      const [conv, msgs] = await Promise.all([getConversation(id), getMessagesForConversation(id)]);
      setConversation(conv);
      setMessages(msgs);
    } catch (err) {
      console.error(err);
      setError('Unable to load this conversation.');
    } finally {
      setLoading(false);
    }
  }, [id, currentUser]);

  useEffect(() => { void loadChat(); }, [loadChat]);

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
    const timer = window.setInterval(() => { void loadChat(); }, 5000);
    return () => window.clearInterval(timer);
  }, [id, currentUser, loadChat]);

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
      await loadChat();
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
            <p className="text-xs text-slate-500">{conversation?.status ?? 'Loading...'}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button className="p-2 text-slate-400 rounded-full hidden sm:block" aria-label="Voice call"><Phone className="w-5 h-5" /></button>
          <button className="p-2 text-slate-400 rounded-full hidden sm:block" aria-label="Video call"><Video className="w-5 h-5" /></button>
          <button className="p-2 text-slate-400 rounded-full" aria-label="More options"><MoreVertical className="w-5 h-5" /></button>
        </div>
      </div>

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

      <div className="bg-white border-t border-slate-200 p-3 sm:p-4 shrink-0">
        <div className="flex items-end gap-2 bg-slate-50 border border-slate-200 rounded-2xl p-1 pr-2">
          <button className="p-3 text-slate-400 shrink-0" aria-label="Attach file"><Paperclip className="w-5 h-5" /></button>
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSend(); }
          }} placeholder="Type a message..." className="flex-1 bg-transparent border-none py-3 focus:ring-0 resize-none max-h-32 text-sm focus:outline-none" rows={1} />
          <button onClick={() => void handleSend()} disabled={!message.trim() || sending} className="p-3 bg-slate-900 text-white rounded-xl disabled:opacity-50 shrink-0 mb-1" aria-label="Send">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
