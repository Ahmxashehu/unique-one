import { useCallback, useEffect, useState, type ChangeEvent } from 'react';
import { ArrowLeft, Phone, Video, MoreVertical, Paperclip, Send, Loader2, Check, CheckCheck, ShieldAlert, Ban, CornerUpLeft, X, Smile, Trash2, VolumeX, Volume2 } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { subscribeToMessagesForConversation } from '../../lib/os/communication-db';
import type { Conversation, Message, MessageAttachmentMetadata } from '../../lib/os/communication-types';
import { uploadMedia } from '../../lib/media/upload';

const formatMessageDate = (value: string) => {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' });
};

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
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [reactionTarget, setReactionTarget] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [attachments, setAttachments] = useState<MessageAttachmentMetadata[]>([]);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [attachmentProgress, setAttachmentProgress] = useState(0);

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
      const token = await currentUser.getIdToken();
      const response = await fetch(`/api/communication/conversations/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error?.message ?? 'Failed to load conversation.');
      const members = Array.isArray(payload?.members) ? payload.members : [];
      const otherMember = members.find((member) => member.uid !== currentUser.uid);
      setOtherUid(otherMember?.uid ?? null);
      if (!otherMember) {
        setOtherPresence(null);
        return;
      }
      const presenceToken = await currentUser.getIdToken();
      const presenceResponse = await fetch(`/api/communication/conversations/${id}/presence`, {
        headers: { Authorization: `Bearer ${presenceToken}` },
      });
      const presencePayload = await presenceResponse.json().catch(() => null);
      if (!presenceResponse.ok) throw new Error(presencePayload?.error?.message ?? 'Failed to load presence.');
      const presence = Array.isArray(presencePayload?.presences)
        ? presencePayload.presences.find((item: { uid?: string }) => item.uid === otherMember.uid)
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
    let pollTimer: number | undefined;
    setLoading(true);
    setError('');

    const loadChat = async () => {
      if (!id || !currentUser) return;
      try {
        const token = await currentUser.getIdToken();
        const [conversationResponse, messagesResponse] = await Promise.all([
          fetch(`/api/communication/conversations/${id}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`/api/communication/conversations/${id}/messages?limit=100`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);
        const conversationPayload = await conversationResponse.json().catch(() => null);
        const messagesPayload = await messagesResponse.json().catch(() => null);
        if (!conversationResponse.ok || !conversationPayload?.conversation) {
          throw new Error(conversationPayload?.error?.message ?? 'Failed to load conversation.');
        }
        if (!messagesResponse.ok || !Array.isArray(messagesPayload?.messages)) {
          throw new Error(messagesPayload?.error?.message ?? 'Failed to load conversation messages.');
        }
        if (!active) return;
        setConversation(conversationPayload.conversation);
        setMuted(conversationPayload.conversation?.muted === true);
        setMessages(messagesPayload.messages);
        if (showNewContactWarning && typeof window !== 'undefined' && window.localStorage.getItem(`unique-one:contact-reply:${id}`) === '1') {
          setShowNewContactWarning(false);
        }
        setLoading(false);
      } catch (err) {
        console.error(err);
        if (active) {
          setError(err instanceof Error ? err.message : 'Unable to load this conversation.');
          setLoading(false);
        }
      }
    };

    void loadChat();
    pollTimer = window.setInterval(() => { void loadChat(); }, 3000);

    return () => {
      active = false;
      if (pollTimer !== undefined) window.clearInterval(pollTimer);
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
  }, [messages, markVisibleMessagesRead]);

  useEffect(() => {
    if (!id || !currentUser) return;
    const timer = window.setInterval(() => { void loadOtherPresence(); }, 5000);
    return () => window.clearInterval(timer);
  }, [id, currentUser, loadOtherPresence]);

  const updateReaction = async (messageId: string, reaction: string) => {
    if (!currentUser) return;
    try {
      const token = await currentUser.getIdToken();
      const target = messages.find((item) => item.id === messageId);
      const method = target?.myReaction === reaction ? 'DELETE' : 'POST';
      const response = await fetch(`/api/communication/messages/${messageId}/reactions`, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        ...(method === 'POST' ? { body: JSON.stringify({ reaction }) } : {}),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error?.message ?? 'Failed to update reaction.');
      setReactionTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update reaction.');
    }
  };

  const deleteMessage = async (messageId: string) => {
    if (!currentUser || !window.confirm('Delete this message?')) return;
    try {
      const token = await currentUser.getIdToken();
      const response = await fetch(`/api/communication/messages/${messageId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error?.message ?? 'Failed to delete message.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete message.');
    }
  };

  const toggleMute = async () => {
    if (!id || !currentUser) return;
    try {
      const nextMuted = !muted;
      const token = await currentUser.getIdToken();
      const response = await fetch(`/api/communication/conversations/${id}/mute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ muted: nextMuted }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error?.message ?? 'Failed to update mute setting.');
      setMuted(nextMuted);
      setConversation((current) => current ? { ...current, muted: nextMuted } : current);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update mute setting.');
    }
  };

  const handleAttachmentSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (!id || !currentUser || files.length === 0) return;
    if (files.length + attachments.length > 5) {
      setError('You can attach up to 5 files to one message.');
      return;
    }
    setUploadingAttachment(true);
    setError('');
    try {
      const uploaded: MessageAttachmentMetadata[] = [];
      for (const file of files) {
        const metadata = await uploadMedia(file, {
          ownerId: currentUser.uid,
          pathPrefix: `messages/${id}/${currentUser.uid}`,
          maxBytes: file.type.startsWith('image/') ? 5 * 1024 * 1024 : 20 * 1024 * 1024,
          allowedMimeTypes: file.type.startsWith('image/')
            ? ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
            : ['application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
          optimizeImage: file.type.startsWith('image/'),
          imageMaxDimension: 1600,
          imageTargetBytes: 450 * 1024,
          onProgress: setAttachmentProgress,
        });
        uploaded.push({
          id: metadata.fileId,
          name: metadata.originalName,
          contentType: metadata.mimeType,
          sizeBytes: metadata.sizeBytes,
          url: metadata.downloadUrl,
          storagePath: metadata.storagePath,
        });
      }
      setAttachments((current) => [...current, ...uploaded]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload attachment.');
    } finally {
      setUploadingAttachment(false);
      setAttachmentProgress(0);
    }
  };

  const handleSend = async () => {
    const text = message.trim();
    if ((!text && attachments.length === 0) || !id || !currentUser || sending || uploadingAttachment) return;
    setSending(true);
    setError('');
    try {
      const token = await currentUser.getIdToken();
      const response = await fetch('/api/communication/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          conversationId: id,
          type: attachments.length > 0 ? (attachments.every((item) => item.contentType.startsWith('image/')) ? 'image' : 'file') : 'text',
          ...(text ? { text } : {}),
          ...(attachments.length > 0 ? { attachments: attachments.map((item) => ({
            ...item,
            storagePath: item.storagePath,
          })) } : {}),
          replyToMessageId: replyingTo?.id,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error?.message ?? 'Failed to send message.');
      setMessage('');
      setAttachments([]);
      setReplyingTo(null);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0 -m-4 md:-m-6 lg:-m-8 bg-slate-50 md:rounded-3xl overflow-hidden">
      <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/os/messages')} className="p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-full md:hidden" aria-label="Back">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-600">
            {(conversation?.title ?? 'U').charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="font-bold text-slate-900 text-sm md:text-base">{conversation?.title ?? 'Messages'}</h2>
            <p className="text-xs text-slate-500">{otherPresence?.status === 'online' ? 'Online' : otherPresence?.lastSeenAt ? `Last seen ${new Date(otherPresence.lastSeenAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : conversation?.status ?? 'Loading...'}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button className="p-2 text-slate-400 rounded-full hidden sm:block" aria-label="Voice call"><Phone className="w-5 h-5" /></button>
          <button className="p-2 text-slate-400 rounded-full hidden sm:block" aria-label="Video call"><Video className="w-5 h-5" /></button>
          <button onClick={() => void toggleMute()} className="p-2 text-slate-500 rounded-full hover:bg-slate-100" aria-label={muted ? 'Unmute conversation' : 'Mute conversation'} title={muted ? 'Unmute conversation' : 'Mute conversation'}>{muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}</button>
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
                  <button onClick={() => {
                    setShowNewContactWarning(false);
                    if (id) window.localStorage.setItem(`unique-one:contact-reply:${id}`, '1');
                  }} className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-medium">Reply</button>
                  <button onClick={() => void blockUser()} className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-medium flex items-center gap-1.5"><Ban className="w-3.5 h-3.5" /> Block</button>
                </div>
              </div>
            </div>
          </div>
        )}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
        {loading && <div className="flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>}
        {error && <div className="text-center text-xs text-red-600 bg-red-50 rounded-lg p-2">{error}</div>}
        {!loading && messages.map((msg, index) => {
          const mine = msg.senderId === currentUser?.uid;
          const previous = index > 0 ? messages[index - 1] : null;
          const showDate = !previous || new Date(previous.createdAt).toDateString() !== new Date(msg.createdAt).toDateString();
          return (
            <div key={msg.id}>
              {showDate && <div className="flex justify-center my-2"><span className="px-3 py-1 rounded-full bg-slate-200 text-slate-500 text-[10px] font-medium">{formatMessageDate(msg.createdAt)}</span></div>}
              <div id={`message-${msg.id}`} className={`flex ${mine ? 'justify-end' : 'justify-start'} group`}>
              <div className="relative max-w-[75%] md:max-w-[60%]">
                <button onClick={() => setReplyingTo(msg)} className={`absolute -top-10 ${mine ? '-left-1' : '-right-1'} sm:-top-3 ${mine ? 'sm:-left-10' : 'sm:-right-10'} flex items-center justify-center w-8 h-8 rounded-full bg-white border border-slate-200 shadow-sm text-slate-500 hover:text-slate-900 z-10`} aria-label="Reply to message" title="Reply">
                  <CornerUpLeft className="w-4 h-4" />
                </button>
                <div className={`rounded-2xl px-4 py-2 ${mine ? 'bg-slate-900 text-white rounded-tr-sm' : 'bg-white border border-slate-200 text-slate-900 rounded-tl-sm'}`}>
                  {msg.replyToMessageId && (() => {
                    const replied = messages.find((item) => item.id === msg.replyToMessageId);
                    return replied ? (
                      <button onClick={() => document.getElementById(`message-${replied.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })} className="w-full text-left mb-2 rounded-lg bg-black/10 px-2.5 py-1.5 border-l-2 border-current/40">
                        <p className="text-[10px] font-semibold opacity-80">{replied.senderId === currentUser?.uid ? 'You' : (conversation?.title ?? 'User')}</p>
                        <p className="text-xs opacity-75 truncate">{replied.text ?? 'Message'}</p>
                      </button>
                    ) : null;
                  })()}
                  {msg.deleted ? <p className="text-sm italic opacity-70">This message was deleted</p> : msg.text && <p className="text-sm whitespace-pre-wrap">{msg.text}</p>}
                  {!msg.deleted && msg.attachments?.length ? <div className="mt-2 space-y-2">
                    {msg.attachments.map((attachment) => attachment.contentType.startsWith('image/')
                      ? <a key={attachment.id} href={attachment.url} target="_blank" rel="noreferrer"><img src={attachment.url} alt={attachment.name} className="max-w-full max-h-64 rounded-xl object-cover" loading="lazy" /></a>
                      : <a key={attachment.id} href={attachment.url} target="_blank" rel="noreferrer" className="block rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs underline">{attachment.name}</a>)}
                  </div>}
                  {msg.reactions && Object.keys(msg.reactions).length > 0 && <div className="flex flex-wrap gap-1 mt-2">
                    {Object.entries(msg.reactions).map(([emoji, count]) => <button key={emoji} onClick={() => void updateReaction(msg.id, emoji)} className={`px-1.5 py-0.5 rounded-full text-xs border ${msg.myReaction === emoji ? 'border-slate-900 bg-slate-100' : 'border-slate-200 bg-white/80'}`}>{emoji} {count}</button>)}
                  </div>}
                  <div className="flex items-center justify-between gap-2 mt-1 text-[10px] text-slate-400">
                    <div className="flex gap-1"><button onClick={() => setReactionTarget(reactionTarget === msg.id ? null : msg.id)} className="p-1 rounded hover:bg-black/10" aria-label="React"><Smile className="w-3 h-3" /></button>{mine && !msg.deleted && <button onClick={() => void deleteMessage(msg.id)} className="p-1 rounded hover:bg-black/10" aria-label="Delete"><Trash2 className="w-3 h-3" /></button>}</div>
                    <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    {mine && msg.status === 'sent' && <Check className="w-3 h-3" />}
                    {mine && msg.status === 'delivered' && <CheckCheck className="w-3 h-3" />}
                    {mine && msg.status === 'read' && <CheckCheck className="w-3 h-3 text-blue-400" />}
                  </div>
                  {reactionTarget === msg.id && <div className="absolute bottom-7 left-0 z-20 flex gap-1 rounded-full bg-white border border-slate-200 shadow-lg px-2 py-1">
                    {['👍','❤️','😂','😮','😢','🙏'].map((emoji) => <button key={emoji} onClick={() => void updateReaction(msg.id, emoji)} className="text-lg p-1 rounded-full hover:bg-slate-100" aria-label={`React ${emoji}`}>{emoji}</button>)}
                  </div>}
                </div>
              </div>
              </div>
            </div>
          );
        })}
      </div>

      {replyingTo && !blocked && (
        <div className="border-t border-slate-200 bg-slate-50 px-3 pt-2">
          <div className="flex items-center gap-2 rounded-xl bg-white border border-slate-200 px-3 py-2">
            <CornerUpLeft className="w-4 h-4 text-slate-500 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold text-slate-500">Replying to {replyingTo.senderId === currentUser?.uid ? 'yourself' : (conversation?.title ?? 'user')}</p>
              <p className="text-xs text-slate-600 truncate">{replyingTo.text ?? 'Message'}</p>
            </div>
            <button onClick={() => setReplyingTo(null)} className="p-1 text-slate-400 hover:text-slate-700" aria-label="Cancel reply"><X className="w-4 h-4" /></button>
          </div>
        </div>
      )}

      {!blocked && <div className="sticky bottom-0 z-30 bg-white border-t border-slate-200 p-3 sm:p-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shrink-0">
        <div className="flex items-end gap-2 bg-slate-50 border border-slate-200 rounded-2xl p-1 pr-2">
          <label className="p-3 text-slate-500 shrink-0 cursor-pointer hover:bg-slate-100 rounded-xl" aria-label="Attach file" title="Attach file">
            <Paperclip className="w-5 h-5" />
            <input type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif,.pdf,.txt,.doc,.docx,.xls,.xlsx" className="hidden" onChange={(event) => void handleAttachmentSelect(event)} disabled={uploadingAttachment || sending} />
          </label>
          {(attachments.length > 0 || uploadingAttachment) && <div className="absolute bottom-full left-0 right-0 mb-2 bg-white border border-slate-200 rounded-xl p-2 shadow-sm">
          {uploadingAttachment ? <p className="text-xs text-slate-500">Uploading attachment {attachmentProgress}%</p> : <div className="flex flex-wrap gap-1">{attachments.map((item) => <button key={item.id} onClick={() => setAttachments((current) => current.filter((entry) => entry.id !== item.id))} className="text-xs bg-slate-100 rounded-full px-2 py-1">{item.name} ×</button>)}</div>}
        </div>}
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSend(); }
          }} placeholder="Type a message..." className="flex-1 bg-transparent border-none py-3 focus:ring-0 resize-none max-h-32 text-sm focus:outline-none" rows={1} />
          <button onClick={() => void handleSend()} disabled={(!message.trim() && attachments.length === 0) || sending || uploadingAttachment} className="p-3 bg-slate-900 text-white rounded-xl disabled:opacity-50 shrink-0 mb-1" aria-label="Send">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>}
    </div>
  );
}
