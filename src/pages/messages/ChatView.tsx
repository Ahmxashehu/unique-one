import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { ArrowLeft, Phone, Video, MoreVertical, Paperclip, Send, Loader2, Check, CheckCheck, ShieldAlert, Ban, CornerUpLeft, X, Smile, Trash2, VolumeX, Volume2, Copy, Search } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import type { Conversation, Message, MessageAttachmentMetadata } from '../../lib/os/communication-types';
import { optimizeImage } from '../../lib/media/image';
import { getOlderMessagesForConversation, subscribeToMessagesForConversation } from '../../lib/os/communication-db';
import { decryptFromUser, encryptForUser, ensureDeviceKeyPair, getUserPublicKey, registerPublicKey } from '../../lib/os/communication-crypto';

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
  const [actionMenuTarget, setActionMenuTarget] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMatchIndex, setSearchMatchIndex] = useState(0);
  const [newMessagesPending, setNewMessagesPending] = useState(0);
  const [attachments, setAttachments] = useState<MessageAttachmentMetadata[]>([]);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [attachmentStage, setAttachmentStage] = useState<'preparing' | 'uploading' | null>(null);
  const [attachmentProgress, setAttachmentProgress] = useState(0);
  const [encryptionReady, setEncryptionReady] = useState(false);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const [hasMoreOlderMessages, setHasMoreOlderMessages] = useState(true);
  const [peerPublicKey, setPeerPublicKey] = useState<JsonWebKey | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const previousMessageCountRef = useRef(0);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);

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
      const nextPresence = presence ?? { uid: otherMember.uid, status: 'offline', lastSeenAt: null };
      setOtherPresence((current) => (
        current?.uid === nextPresence.uid
        && current?.status === nextPresence.status
        && current?.lastSeenAt === nextPresence.lastSeenAt
          ? current
          : nextPresence
      ));
    } catch (err) {
      console.error('Presence read failed:', err);
    }
  }, [id, currentUser]);

  useEffect(() => {
    let active = true;
    const prepareEncryption = async () => {
      setEncryptionReady(false);
      setPeerPublicKey(null);
      if (!currentUser || conversation?.type !== 'direct' || !otherUid) return;
      try {
        const token = await currentUser.getIdToken();
        const publicKey = await ensureDeviceKeyPair(currentUser.uid);
        await registerPublicKey(currentUser.uid, token, publicKey);
        const peerKey = await getUserPublicKey(otherUid, token);
        if (!active) return;
        setPeerPublicKey(peerKey);
        setEncryptionReady(Boolean(peerKey));
      } catch (err) {
        if (!active) return;
        console.error('Communication encryption setup failed:', err);
        setPeerPublicKey(null);
        setEncryptionReady(false);
      }
    };
    void prepareEncryption();
    return () => { active = false; };
  }, [currentUser, conversation?.type, otherUid]);

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
    let unsubscribe: (() => void) | null = null;
    setLoading(true);
    setError('');
    setLoadingOlderMessages(false);
    setHasMoreOlderMessages(true);

    if (id) {
      try {
        const cached = window.sessionStorage.getItem(`unique-one:chat-cache:${id}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed?.messages)) {
            setMessages(parsed.messages as Message[]);
            setLoading(false);
          }
          if (parsed?.conversation) setConversation(parsed.conversation as Conversation);
        }
      } catch (err) {
        console.warn('Could not restore cached conversation:', err);
      }
    }

    const loadChat = async () => {
      if (!id || !currentUser) return;
      try {
        const token = await currentUser.getIdToken();
        const conversationResponse = await fetch('/api/communication/conversations/' + id, {
          headers: { Authorization: 'Bearer ' + token },
        });
        const conversationPayload = await conversationResponse.json().catch(() => null);
        if (!conversationResponse.ok || !conversationPayload?.conversation) {
          throw new Error(conversationPayload?.error?.message ?? 'Failed to load conversation.');
        }
        if (!active) return;
        setConversation(conversationPayload.conversation);
        setMuted(conversationPayload.conversation?.muted === true);
        if (showNewContactWarning && typeof window !== 'undefined' && window.localStorage.getItem('unique-one:contact-reply:' + id) === '1') {
          setShowNewContactWarning(false);
        }
        try {
          unsubscribe = await subscribeToMessagesForConversation(
            id,
            (nextMessages) => {
              if (!active) return;
              void (async () => {
                const hydrated = await Promise.all(nextMessages.map(async (item) => {
                  if (item.deleted || !item.encryptedPayload) return item;
                  try {
                    const text = await decryptFromUser(currentUser.uid, item.encryptedPayload.senderPublicKey, item.encryptedPayload);
                    return { ...item, text };
                  } catch (decryptError) {
                    console.error('Communication encrypted message decryption failed:', decryptError);
                    return { ...item, text: '[Unable to decrypt this message on this device]' };
                  }
                }));
                if (!active) return;
                try {
                  window.sessionStorage.setItem(`unique-one:chat-cache:${id}`, JSON.stringify({
                    conversation: conversationPayload.conversation,
                    messages: hydrated,
                  }));
                } catch (cacheError) {
                  console.warn('Could not cache conversation messages:', cacheError);
                }
                setMessages((current) => {
                  const merged = new Map<string, Message>(current.map((item) => [item.id, item]));
                  hydrated.forEach((item) => merged.set(item.id, item));
                  const nextMessages = Array.from(merged.values()).sort(
                    (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
                  );
                  if (current.length === nextMessages.length && current.every((item, index) => {
                    const next = nextMessages[index];
                    return item.id === next.id
                      && item.updatedAt === next.updatedAt
                      && item.status === next.status
                      && item.deleted === next.deleted
                      && item.text === next.text
                      && JSON.stringify(item.reactions ?? {}) === JSON.stringify(next.reactions ?? {})
                      && JSON.stringify(item.attachments ?? []) === JSON.stringify(next.attachments ?? []);
                  })) return current;
                  return nextMessages;
                });
                setHasMoreOlderMessages((current) => current || hydrated.length === 100);
                setLoading(false);
              })();
            },
            (messageError) => {
              if (!active) return;
              console.error('Communication live message subscription failed:', messageError);
              setError(messageError.message);
              setLoading(false);
            },
            100,
          );
        } catch (messageError) {
          if (active) {
            console.error('Communication live message subscription failed:', messageError);
            setError(messageError instanceof Error ? messageError.message : 'Failed to receive live Communication messages.');
            setLoading(false);
          }
        }
      } catch (err) {
        console.error(err);
        if (active) {
          setError(err instanceof Error ? err.message : 'Unable to load this conversation.');
          setLoading(false);
        }
      }
    };

    void loadChat();
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
    const batchSize = 20;
    for (let start = 0; start < unread.length; start += batchSize) {
      const batch = unread.slice(start, start + batchSize);
      await Promise.all(batch.map(async (item) => {
        const response = await fetch(`/api/communication/messages/${item.id}/delivery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ action: 'read' }),
        });
        if (!response.ok) {
          console.warn('Failed to mark message as read:', item.id, response.status);
        }
      }));
    }
  }, [currentUser]);

  useEffect(() => {
    if (messages.length > 0) void markVisibleMessagesRead(messages);
  }, [messages, markVisibleMessagesRead]);

  const scrollMessagesToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior, block: 'end' });
    setNewMessagesPending(0);
  }, []);

  const loadOlderMessages = useCallback(async () => {
    if (!id || loadingOlderMessages || !hasMoreOlderMessages || messages.length === 0) return;
    const oldestMessage = messages[0];
    const container = messagesContainerRef.current;
    if (!container) return;
    setLoadingOlderMessages(true);
    const previousScrollHeight = container.scrollHeight;
    const previousScrollTop = container.scrollTop;
    try {
      const result = await getOlderMessagesForConversation(id, oldestMessage.createdAt, 100);
      if (result.messages.length === 0) {
        setHasMoreOlderMessages(false);
        return;
      }
      setMessages((current) => {
        const merged = new Map<string, Message>(current.map((item) => [item.id, item]));
        result.messages.forEach((item) => merged.set(item.id, item));
        return Array.from(merged.values()).sort(
          (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
        );
      });
      setHasMoreOlderMessages(result.hasMore);
      requestAnimationFrame(() => {
        const nextContainer = messagesContainerRef.current;
        if (!nextContainer) return;
        nextContainer.scrollTop = previousScrollTop + (nextContainer.scrollHeight - previousScrollHeight);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load older messages.');
    } finally {
      setLoadingOlderMessages(false);
    }
  }, [id, loadingOlderMessages, hasMoreOlderMessages, messages]);

  const handleMessagesScroll = () => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    if (distanceFromBottom < 80) setNewMessagesPending(0);
    if (container.scrollTop < 120 && !loadingOlderMessages && hasMoreOlderMessages) {
      void loadOlderMessages();
    }
  };

  useEffect(() => {
    const previousCount = previousMessageCountRef.current;
    if (messages.length === 0) {
      previousMessageCountRef.current = 0;
      return;
    }
    const isInitialLoad = previousCount === 0;
    const countIncreased = messages.length > previousCount;
    const container = messagesContainerRef.current;
    const distanceFromBottom = container
      ? container.scrollHeight - container.scrollTop - container.clientHeight
      : 0;
    if (isInitialLoad) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
    } else if (countIncreased && distanceFromBottom < 160) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      setNewMessagesPending(0);
    } else if (countIncreased) {
      setNewMessagesPending((current) => current + (messages.length - previousCount));
    }
    previousMessageCountRef.current = messages.length;
  }, [messages.length]);

  useEffect(() => {
    if (!currentUser || !id) return;
    try {
      const saved = window.localStorage.getItem(`unique-one:message-draft:${currentUser.uid}:${id}`);
      if (saved !== null) setMessage(saved);
    } catch (err) {
      console.warn('Could not restore message draft:', err);
    }
  }, [currentUser, id]);

  useEffect(() => {
    if (!currentUser || !id) return;
    const timer = window.setTimeout(() => {
      try {
        const key = `unique-one:message-draft:${currentUser.uid}:${id}`;
        if (message.trim()) window.localStorage.setItem(key, message);
        else window.localStorage.removeItem(key);
      } catch (err) {
        console.warn('Could not save message draft:', err);
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [currentUser, id, message]);

  useEffect(() => {
    composerRef.current?.focus();
  }, [id]);

  useEffect(() => {
    if (!id || !currentUser) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void loadOtherPresence();
    }, 5000);
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
      setMessages((current) => current.map((item) => {
        if (item.id !== messageId) return item;
        const nextReactions = { ...(item.reactions ?? {}) };
        const previousReaction = item.myReaction;
        if (previousReaction) {
          nextReactions[previousReaction] = Math.max(0, (nextReactions[previousReaction] ?? 0) - 1);
          if (nextReactions[previousReaction] === 0) delete nextReactions[previousReaction];
        }
        if (method === 'POST') {
          nextReactions[reaction] = (nextReactions[reaction] ?? 0) + 1;
          return { ...item, reactions: nextReactions, myReaction: reaction };
        }
        return { ...item, reactions: nextReactions, myReaction: undefined };
      }));
      setReactionTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update reaction.');
    }
  };

  const searchMatches = searchQuery.trim()
    ? messages.filter((item) => !item.deleted && (item.text ?? '').toLocaleLowerCase().includes(searchQuery.trim().toLocaleLowerCase()))
    : [];

  useEffect(() => {
    setSearchMatchIndex(0);
  }, [searchQuery]);

  useEffect(() => {
    if (!searchOpen || searchMatches.length === 0) return;
    const target = searchMatches[searchMatchIndex];
    document.getElementById(`message-${target.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [searchOpen, searchMatchIndex, searchMatches]);

  const goToSearchMatch = (direction: 1 | -1) => {
    if (searchMatches.length === 0) return;
    setSearchMatchIndex((current) => (current + direction + searchMatches.length) % searchMatches.length);
  };

  const copyMessage = async (text: string) => {
    if (!text || typeof navigator === 'undefined' || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error('Message copy failed:', err);
      setError('Could not copy this message.');
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

  const cleanupUploadedAttachment = async (attachment: MessageAttachmentMetadata) => {
    try {
      const token = await currentUser?.getIdToken();
      if (!token || !id) return;
      const response = await fetch('/api/communication/media/upload', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ conversationId: id, fileId: attachment.id, storagePath: attachment.storagePath }),
      });
      if (!response.ok) console.warn('Attachment cleanup failed:', response.status);
    } catch (error) {
      console.warn('Attachment cleanup request failed:', error);
    }
  };

  const handleAttachmentSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []) as File[];
    event.target.value = '';
    if (!id || !currentUser || files.length === 0) return;
    if (files.length + attachments.length > 5) {
      setError('You can attach up to 5 files to one message.');
      return;
    }
    setUploadingAttachment(true);
    setAttachmentStage('preparing');
    setAttachmentProgress(0);
    setError('');
    const uploadedAttachments: MessageAttachmentMetadata[] = [];
    try {
      for (const file of files) {
        const isImage = file.type.startsWith('image/');
        const allowed = isImage
          ? ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
          : ['application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
        if (!allowed.includes(file.type)) throw new Error('This attachment type is not supported.');
        if (file.size > (isImage ? 5 : 20) * 1024 * 1024) throw new Error('The attachment is too large.');

        let body: Blob = file;
        let contentType = file.type.toLowerCase();
        if (isImage) {
          try {
            const optimized = await optimizeImage(file, 1600, 450 * 1024);
            body = optimized.blob;
            contentType = 'image/webp';
          } catch (optimizationError) {
            console.warn('Image optimization failed; uploading the original image.', optimizationError);
            if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(contentType)) {
              throw new Error('This image format cannot be uploaded on this device. Please choose a JPG, PNG, WebP, or GIF image.');
            }
          }
        }

        setAttachmentStage('uploading');
        setAttachmentProgress(0);
        const token = await currentUser.getIdToken();
        const result = await new Promise<{ fileId: string; storagePath: string; downloadUrl: string; mimeType: string; sizeBytes: number }>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', '/api/communication/media/upload', true);
          xhr.timeout = 120000;
          xhr.setRequestHeader('Authorization', 'Bearer ' + token);
          xhr.setRequestHeader('Content-Type', 'application/octet-stream');
          xhr.setRequestHeader('X-Conversation-Id', id);
          xhr.setRequestHeader('X-Content-Type', contentType);
          xhr.setRequestHeader('X-Original-Name', file.name.slice(0, 255));
          xhr.upload.onloadstart = () => setAttachmentProgress(0);
          xhr.upload.onprogress = (progressEvent) => {
            if (progressEvent.lengthComputable) setAttachmentProgress(Math.min(99, Math.round((progressEvent.loaded / progressEvent.total) * 100)));
          };
          xhr.onerror = () => reject(new Error('Network error while uploading the attachment. Please check your connection and try again.'));
          xhr.ontimeout = () => reject(new Error('The attachment upload timed out. Please try again.'));
          xhr.onabort = () => reject(new Error('The attachment upload was cancelled.'));
          xhr.onload = () => {
            let payload: { fileId?: string; storagePath?: string; downloadUrl?: string; mimeType?: string; sizeBytes?: number; error?: { message?: string } } | null = null;
            try { payload = JSON.parse(xhr.responseText); } catch (_) { /* handled below */ }
            if (xhr.status < 200 || xhr.status >= 300 || !payload?.downloadUrl) {
              reject(new Error(payload?.error?.message ?? `Upload failed (HTTP ${xhr.status}).`));
              return;
            }
            setAttachmentProgress(100);
            resolve({
              fileId: payload.fileId!,
              storagePath: payload.storagePath!,
              downloadUrl: payload.downloadUrl!,
              mimeType: payload.mimeType ?? contentType,
              sizeBytes: payload.sizeBytes ?? body.size,
            });
          };
          xhr.send(body);
        });

        const uploadedAttachment: MessageAttachmentMetadata = {
          id: result.fileId,
          name: file.name,
          contentType: result.mimeType,
          sizeBytes: result.sizeBytes,
          url: result.downloadUrl,
          storagePath: result.storagePath,
        };
        uploadedAttachments.push(uploadedAttachment);
        setAttachments((current) => [...current, uploadedAttachment]);
      }
    } catch (err) {
      await Promise.all(uploadedAttachments.map((attachment) => cleanupUploadedAttachment(attachment)));
      if (uploadedAttachments.length > 0) {
        setAttachments((current) => current.filter((entry) => !uploadedAttachments.some((uploaded) => uploaded.id === entry.id)));
      }
      setError(err instanceof Error ? err.message : 'Failed to upload attachment.');
    } finally {
      setUploadingAttachment(false);
      setAttachmentStage(null);
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
      let encryptedPayload: { version: 1; recipientId: string; senderPublicKey: JsonWebKey; iv: string; ciphertext: string } | undefined;
      if (text && conversation?.type === 'direct') {
        if (!encryptionReady || !peerPublicKey || !otherUid) throw new Error('The recipient has not registered an encryption key on this device yet. Open the conversation on the other device, then try again.');
        const senderPublicKey = await ensureDeviceKeyPair(currentUser.uid);
        const encrypted = await encryptForUser(currentUser.uid, peerPublicKey, text);
        encryptedPayload = { version: 1, recipientId: otherUid, senderPublicKey, ...encrypted };
      }
      const response = await fetch('/api/communication/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({
          conversationId: id,
          type: attachments.length > 0 ? (attachments.every((item) => item.contentType.startsWith('image/')) ? 'image' : 'file') : 'text',
          ...(text && !encryptedPayload ? { text } : {}),
          ...(encryptedPayload ? { encryptedPayload } : {}),
          ...(attachments.length > 0 ? { attachments: attachments.map((item) => ({ ...item, storagePath: item.storagePath })) } : {}),
          replyToMessageId: replyingTo?.id,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error?.message ?? 'Failed to send message.');
      setMessage('');
      try {
        window.localStorage.removeItem(`unique-one:message-draft:${currentUser.uid}:${id}`);
      } catch (err) {
        console.warn('Could not clear message draft:', err);
      }
      setAttachments([]);
      setReplyingTo(null);
    } catch (err) {
      console.error(err);
      await Promise.all(attachments.map((attachment) => cleanupUploadedAttachment(attachment)));
      setAttachments([]);
      setError(err instanceof Error ? err.message : 'Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0 -m-4 md:-m-6 lg:-m-8 bg-slate-50 md:rounded-3xl overflow-hidden">
      <style>{`@media (prefers-reduced-motion: reduce) { .unique-chat-motion { scroll-behavior: auto !important; transition: none !important; } }`}</style>
      <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/os/messages')} className="p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-full md:hidden" aria-label="Back">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="relative w-10 h-10 rounded-full bg-gradient-to-br from-slate-900 to-slate-600 text-white flex items-center justify-center font-bold shadow-sm">
            {(conversation?.title ?? 'U').charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="font-bold text-slate-900 text-sm md:text-base">{conversation?.title ?? 'Messages'}</h2>
            <p className="text-xs text-slate-500 flex items-center gap-1.5">
              {otherPresence?.status === 'online' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
              {otherPresence?.status === 'online' ? 'Online' : otherPresence?.lastSeenAt ? `Last seen ${new Date(otherPresence.lastSeenAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : conversation?.status ?? 'Loading...'}
              {conversation?.type === 'direct' && encryptionReady && <span title="End-to-end encrypted" aria-label="End-to-end encrypted">· 🔒</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => { setSearchOpen((current) => !current); if (searchOpen) setSearchQuery(''); }} className={`p-2 rounded-full hover:bg-slate-100 ${searchOpen ? 'text-slate-900 bg-slate-100' : 'text-slate-500'}`} aria-label="Search messages" title="Search messages"><Search className="w-5 h-5" /></button>
          <button disabled className="p-2 text-slate-300 rounded-full hidden sm:block cursor-not-allowed" aria-label="Voice calls coming soon" title="Voice calls coming soon"><Phone className="w-5 h-5" /></button>
          <button disabled className="p-2 text-slate-300 rounded-full hidden sm:block cursor-not-allowed" aria-label="Video calls coming soon" title="Video calls coming soon"><Video className="w-5 h-5" /></button>
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
      {searchOpen && (
        <div className="border-b border-slate-200 bg-white px-3 py-2 shrink-0">
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              autoFocus
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') { event.preventDefault(); goToSearchMatch(event.shiftKey ? -1 : 1); }
                if (event.key === 'Escape') { setSearchOpen(false); setSearchQuery(''); }
              }}
              placeholder="Search messages…"
              className="min-w-0 flex-1 bg-transparent border-none outline-none text-sm text-slate-800 placeholder:text-slate-400"
              aria-label="Search messages"
            />
            {searchQuery.trim() && <span className="text-[10px] text-slate-500 whitespace-nowrap">{searchMatches.length ? `${searchMatchIndex + 1}/${searchMatches.length}` : 'No matches'}</span>}
            {searchQuery.trim() && searchMatches.length > 1 && (
              <>
                <button onClick={() => goToSearchMatch(-1)} className="p-1 rounded hover:bg-slate-200 text-slate-500" aria-label="Previous match" title="Previous match">↑</button>
                <button onClick={() => goToSearchMatch(1)} className="p-1 rounded hover:bg-slate-200 text-slate-500" aria-label="Next match" title="Next match">↓</button>
              </>
            )}
            <button onClick={() => { setSearchOpen(false); setSearchQuery(''); }} className="p-1 rounded hover:bg-slate-200 text-slate-500" aria-label="Close search" title="Close search"><X className="w-4 h-4" /></button>
          </div>
        </div>
      )}
      <div ref={messagesContainerRef} onScroll={handleMessagesScroll} className="unique-chat-motion flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 py-4 sm:px-4 sm:py-5 space-y-3 sm:space-y-4">
        {loadingOlderMessages && (
          <div className="sticky top-1 z-10 flex justify-center pointer-events-none">
            <span className="rounded-full bg-white/95 border border-slate-200 px-3 py-1 text-[10px] text-slate-500 shadow-sm">
              Loading older messages…
            </span>
          </div>
        )}
        {loading && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center min-h-[220px] text-slate-400">
            <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center mb-3"><Loader2 className="w-5 h-5 animate-spin" /></div>
            <p className="text-xs">Loading conversation…</p>
          </div>
        )}
        {error && <div className="mx-auto max-w-xl text-center text-xs text-red-700 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</div>}
        {!loading && !error && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center min-h-[260px] text-center">
            <div className="w-14 h-14 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center text-2xl mb-3">💬</div>
            <p className="font-semibold text-slate-800">Start the conversation</p>
            <p className="text-xs text-slate-500 mt-1 max-w-xs">Send a message, photo, or document. Your conversation will appear here.</p>
          </div>
        )}
        {!loading && messages.map((msg, index) => {
          const mine = msg.senderId === currentUser?.uid;
          const previous = index > 0 ? messages[index - 1] : null;
          const showDate = !previous || new Date(previous.createdAt).toDateString() !== new Date(msg.createdAt).toDateString();
          return (
            <div key={msg.id}>
              {showDate && <div className="flex justify-center my-2"><span className="px-3 py-1 rounded-full bg-slate-200 text-slate-500 text-[10px] font-medium">{formatMessageDate(msg.createdAt)}</span></div>}
              <div id={`message-${msg.id}`} className={`flex ${mine ? 'justify-end' : 'justify-start'} group`}>
              <div className="relative max-w-[86%] sm:max-w-[75%] md:max-w-[60%]">
                <button onClick={() => setReplyingTo(msg)} className={`absolute -top-10 ${mine ? '-left-1' : '-right-1'} sm:-top-3 ${mine ? 'sm:-left-10' : 'sm:-right-10'} flex items-center justify-center w-8 h-8 rounded-full bg-white border border-slate-200 shadow-sm text-slate-500 hover:text-slate-900 z-10`} aria-label="Reply to message" title="Reply">
                  <CornerUpLeft className="w-4 h-4" />
                </button>
                <div className={`rounded-[20px] px-4 py-2.5 shadow-sm ${mine ? 'bg-slate-900 text-white rounded-tr-md' : 'bg-white border border-slate-200 text-slate-900 rounded-tl-md'}`}>
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
                  {!msg.deleted && msg.attachments?.length ? (
                    <div className="mt-2 space-y-2">
                      {msg.attachments.map((attachment) =>
                        attachment.contentType.startsWith('image/') ? (
                          <a key={attachment.id} href={attachment.url} target="_blank" rel="noreferrer">
                            <img src={attachment.url} alt={attachment.name} className="max-w-full max-h-64 rounded-xl object-cover" loading="lazy" />
                          </a>
                        ) : (
                          <a key={attachment.id} href={attachment.url} target="_blank" rel="noreferrer" className="block rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs underline">
                            {attachment.name}
                          </a>
                        )
                      )}
                    </div>
                  ) : null}
                  {msg.reactions && Object.keys(msg.reactions).length > 0 && <div className="flex flex-wrap gap-1 mt-2">
                    {Object.entries(msg.reactions).map(([emoji, count]) => <button key={emoji} onClick={() => void updateReaction(msg.id, emoji)} className={`px-1.5 py-0.5 rounded-full text-xs border ${msg.myReaction === emoji ? 'border-slate-900 bg-slate-100' : 'border-slate-200 bg-white/80'}`}>{emoji} {count}</button>)}
                  </div>}
                  <div className="flex items-center justify-between gap-2 mt-1 text-[10px] text-slate-400">
                    <div className="flex gap-1 relative">
                      <button onClick={() => setReactionTarget(reactionTarget === msg.id ? null : msg.id)} className="p-1 rounded hover:bg-black/10" aria-label="React" title="React"><Smile className="w-3 h-3" /></button>
                      <button onClick={() => setActionMenuTarget(actionMenuTarget === msg.id ? null : msg.id)} className="p-1 rounded hover:bg-black/10" aria-label="Message actions" title="More actions"><MoreVertical className="w-3 h-3" /></button>
                      {actionMenuTarget === msg.id && (
                        <div className={`absolute bottom-7 z-30 min-w-36 rounded-xl bg-white border border-slate-200 shadow-xl p-1 text-xs text-slate-700 ${mine ? 'left-0' : 'right-0'}`}>
                          <button onClick={() => { setReplyingTo(msg); setActionMenuTarget(null); }} className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100">Reply</button>
                          {msg.text && !msg.deleted && <button onClick={() => { void copyMessage(msg.text ?? ''); setActionMenuTarget(null); }} className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100">Copy</button>}
                          <button onClick={() => { setReactionTarget(msg.id); setActionMenuTarget(null); }} className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100">React</button>
                          {mine && !msg.deleted && <button onClick={() => { void deleteMessage(msg.id); setActionMenuTarget(null); }} className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 text-red-600">Delete</button>}
                        </div>
                      )}
                    </div>
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
        <div ref={messagesEndRef} aria-hidden="true" />
        {newMessagesPending > 0 && (
          <div className="sticky bottom-2 flex justify-center pointer-events-none">
            <button onClick={() => scrollMessagesToBottom('smooth')} className="pointer-events-auto rounded-full bg-slate-900 text-white px-3 py-1.5 text-xs font-medium shadow-lg">
              {newMessagesPending} new {newMessagesPending === 1 ? 'message' : 'messages'} ↓
            </button>
          </div>
        )}
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

      {!blocked && <div className="sticky bottom-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 p-2.5 sm:p-4 pb-[calc(0.65rem+env(safe-area-inset-bottom))] shrink-0">
        {(attachments.length > 0 || uploadingAttachment) && (
          <div className="mb-2 rounded-2xl border border-slate-200 bg-slate-50 p-2">
            {uploadingAttachment ? (
              <div className="flex items-center gap-2 px-2 py-1.5">
                <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
                <p className="text-xs text-slate-600">{attachmentStage === 'preparing' ? 'Preparing attachment…' : `Uploading attachment ${attachmentProgress}%`}</p>
              </div>
            ) : (
              <div className="flex gap-2 overflow-x-auto">
                {attachments.map((item) => (
                  <div key={item.id} className="relative shrink-0">
                    {item.contentType.startsWith('image/') ? (
                      <img src={item.url} alt={item.name} className="w-20 h-20 rounded-xl object-cover border border-slate-200" />
                    ) : (
                      <div className="w-20 h-20 rounded-xl border border-slate-200 bg-white flex items-center justify-center px-2 text-[10px] text-slate-600 text-center">{item.name}</div>
                    )}
                    <button type="button" onClick={async () => {
                                  await cleanupUploadedAttachment(item);
                                  setAttachments((current) => current.filter((entry) => entry.id !== item.id));
                                }} className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center shadow" aria-label={`Remove ${item.name}`}>
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        <div className="flex items-end gap-1.5 bg-slate-50 border border-slate-200 rounded-[22px] p-1 pr-1.5 shadow-sm focus-within:border-slate-300 focus-within:ring-2 focus-within:ring-slate-100">
          <div className="flex items-center shrink-0">
            <label className="p-3 text-slate-500 cursor-pointer hover:bg-slate-100 rounded-xl" aria-label="Gallery" title="Choose from gallery">
              <span className="text-base">🖼️</span>
              <input type="file" multiple accept="image/*" className="hidden" onChange={(event) => void handleAttachmentSelect(event)} disabled={uploadingAttachment || sending} />
            </label>
            <label className="p-3 text-slate-500 cursor-pointer hover:bg-slate-100 rounded-xl" aria-label="Camera" title="Take a photo">
              <span className="text-base">📷</span>
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(event) => void handleAttachmentSelect(event)} disabled={uploadingAttachment || sending} />
            </label>
            <label className="p-3 text-slate-500 cursor-pointer hover:bg-slate-100 rounded-xl" aria-label="Attach file" title="Attach document">
              <Paperclip className="w-5 h-5" />
              <input type="file" multiple accept=".pdf,.txt,.doc,.docx,.xls,.xlsx,application/pdf,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={(event) => void handleAttachmentSelect(event)} disabled={uploadingAttachment || sending} />
            </label>
          </div>
          <textarea ref={composerRef} value={message} onChange={(e) => setMessage(e.target.value)} onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSend(); }
          }} placeholder="Message…" className="flex-1 bg-transparent border-none py-3 px-1 focus:ring-0 resize-none max-h-32 text-sm leading-5 focus:outline-none placeholder:text-slate-400" rows={1} aria-label="Message" />
          <button onClick={() => void handleSend()} disabled={(!message.trim() && attachments.length === 0) || sending || uploadingAttachment} className="p-3 bg-slate-900 text-white rounded-full disabled:opacity-40 shrink-0 mb-1 transition-transform active:scale-95" aria-label="Send">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>}
    </div>
  );
}
