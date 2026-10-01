import React, { useEffect, useMemo, useRef, useState } from 'react';
import { signInWithCustomToken } from 'firebase/auth';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Camera, CameraOff, Copy, Crown, Hand, Mic, MicOff, MonitorUp,
  PhoneOff, Plus, ScreenShare, Settings, Users, Video, VideoOff,
  MessageCircle, Maximize2
} from 'lucide-react';
import {
  addDoc, collection, deleteDoc, doc, limit, onSnapshot, orderBy,
  query, serverTimestamp, setDoc, where
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

type Participant = { uid: string; displayName?: string; joinedAt?: unknown; handRaised?: boolean; role?: string };
type ChatMessage = { id: string; uid: string; displayName?: string; text: string; createdAt?: unknown };
type Signal = { id: string; from: string; to: string; type: 'offer' | 'answer' | 'ice'; payload: unknown };

const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];

export default function ConferencePage() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { currentUser, userData } = useAuth();
  const [newTitle, setNewTitle] = useState('Unique Conference');
  const [creating, setCreating] = useState(false);
  const [room, setRoom] = useState<{ title?: string; description?: string; public?: boolean; hostUid?: string; status?: string } | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [camera, setCamera] = useState(true);
  const [mic, setMic] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [hand, setHand] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [guestSigningIn, setGuestSigningIn] = useState(false);
  const [isGuest, setIsGuest] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatText, setChatText] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const peers = useRef<Record<string, RTCPeerConnection>>({});
  const processedSignals = useRef(new Set<string>());
  const isHost = room?.hostUid === currentUser?.uid;
  const inviteToken = new URLSearchParams(window.location.search).get('invite') || '';

  const displayName = useMemo(
    () => userData?.displayName || currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Unique user',
    [currentUser, userData],
  );

  useEffect(() => {
    if (!roomId || currentUser || !inviteToken || guestSigningIn) return;
    let active = true;
    setGuestSigningIn(true);
    fetch('/api/conference/guest-session', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, inviteToken }),
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || typeof payload.customToken !== 'string') throw new Error(payload?.error?.message || 'This conference invitation is invalid or expired.');
        await signInWithCustomToken(auth, payload.customToken);
        if (active) setIsGuest(true);
      })
      .catch((guestError) => {
        if (active) setError(guestError instanceof Error ? guestError.message : 'This conference invitation is invalid or expired.');
      })
      .finally(() => { if (active) setGuestSigningIn(false); });
    return () => { active = false; };
  }, [roomId, currentUser, inviteToken, guestSigningIn]);

  useEffect(() => {
    if (!roomId || !currentUser) return;
    const roomRef = doc(db, 'conferences', roomId);
    const participantRef = doc(db, 'conferences', roomId, 'participants', currentUser.uid);
    const unsubscribeRoom = onSnapshot(roomRef, (snap) => {
      if (snap.exists()) setRoom(snap.data() as typeof room);
      else setError('This conference does not exist.');
    }, () => setError('Unable to load this conference.'));

    const unsubscribeParticipants = onSnapshot(
      query(collection(db, 'conferences', roomId, 'participants'), orderBy('joinedAt', 'asc')),
      (snap) => setParticipants(snap.docs.map((item) => ({ uid: item.id, ...(item.data() as Omit<Participant, 'uid'>) }))),
      () => setError('Unable to load conference participants.'),
    );

    const unsubscribeChat = onSnapshot(
      query(collection(db, 'conferences', roomId, 'chat'), orderBy('createdAt', 'asc'), limit(100)),
      (snap) => setChatMessages(snap.docs.map((item) => ({ id: item.id, ...(item.data() as Omit<(typeof chatMessages)[number], 'id'>) }))),
      () => setError('Conference chat is unavailable.'),
    );

    const unsubscribeSignals = onSnapshot(
      query(collection(db, 'conferences', roomId, 'signals'), where('to', '==', currentUser.uid), limit(100)),
      (snap) => setSignals(snap.docs.map((item) => ({ id: item.id, ...(item.data() as Omit<Signal, 'id'>) }))),
      () => setError('Conference signaling is unavailable.'),
    );

    setDoc(participantRef, { uid: currentUser.uid, displayName, role: isHost ? 'host' : 'participant', handRaised: false, joinedAt: serverTimestamp() }, { merge: true }).catch(() => setError('Could not join this conference.'));

    return () => {
      unsubscribeRoom();
      unsubscribeParticipants();
      unsubscribeSignals();
      unsubscribeChat();
      deleteDoc(participantRef).catch(() => undefined);
      Object.values(peers.current).forEach((peer) => peer.close());
      peers.current = {};
    };
  }, [roomId, currentUser, displayName, isHost]);

  useEffect(() => {
    if (!currentUser) return;
    let active = true;
    navigator.mediaDevices?.getUserMedia({ video: true, audio: true })
      .then((localStream) => {
        if (!active) return localStream.getTracks().forEach((track) => track.stop());
        setStream(localStream);
      })
      .catch(() => setError('Camera or microphone permission was not granted. You can still join with audio/video disabled.'));
    return () => {
      active = false;
    };
  }, [currentUser]);

  const sendSignal = async (to: string, type: Signal['type'], payload: unknown) => {
    if (!roomId || !currentUser) return;
    await addDoc(collection(db, 'conferences', roomId, 'signals'), {
      from: currentUser.uid, to, type, payload, createdAt: serverTimestamp(),
    });
  };

  const createPeer = async (remoteUid: string, initiate: boolean) => {
    if (!stream || !currentUser || !roomId || remoteUid === currentUser.uid) return;
    if (peers.current[remoteUid]) return peers.current[remoteUid];

    const peer = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    peers.current[remoteUid] = peer;
    stream.getTracks().forEach((track) => peer.addTrack(track, stream));
    peer.ontrack = (event) => {
      const [remoteStream] = event.streams;
      if (remoteStream) setRemoteStreams((current) => ({ ...current, [remoteUid]: remoteStream }));
    };
    peer.onicecandidate = (event) => {
      if (event.candidate) sendSignal(remoteUid, 'ice', event.candidate.toJSON()).catch(() => undefined);
    };
    peer.onconnectionstatechange = () => {
      if (['failed', 'closed', 'disconnected'].includes(peer.connectionState)) {
        setRemoteStreams((current) => {
          const next = { ...current };
          delete next[remoteUid];
          return next;
        });
      }
    };

    if (initiate) {
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      await sendSignal(remoteUid, 'offer', offer);
    }
    return peer;
  };

  useEffect(() => {
    if (!currentUser || !stream) return;
    participants
      .filter((participant) => participant.uid !== currentUser.uid)
      .filter((participant) => currentUser.uid < participant.uid)
      .forEach((participant) => createPeer(participant.uid, true).catch(() => undefined));
  }, [participants, stream, currentUser]);

  useEffect(() => {
    if (!currentUser || !stream) return;
    signals.forEach(async (signal) => {
      if (processedSignals.current.has(signal.id) || signal.to !== currentUser.uid) return;
      processedSignals.current.add(signal.id);
      try {
        if (signal.type === 'offer') {
          const peer = await createPeer(signal.from, false);
          if (!peer) return;
          await peer.setRemoteDescription(signal.payload as RTCSessionDescriptionInit);
          const answer = await peer.createAnswer();
          await peer.setLocalDescription(answer);
          await sendSignal(signal.from, 'answer', answer);
        } else if (signal.type === 'answer') {
          const peer = peers.current[signal.from];
          if (peer) await peer.setRemoteDescription(signal.payload as RTCSessionDescriptionInit);
        } else if (signal.type === 'ice') {
          const peer = peers.current[signal.from];
          if (peer) await peer.addIceCandidate(signal.payload as RTCIceCandidateInit);
        }
      } catch (signalError) {
        console.error('Conference signal handling failed:', signalError);
      }
    });
  }, [signals, stream, currentUser]);

  const toggleCamera = () => {
    if (!stream) return;
    const next = !camera;
    stream.getVideoTracks().forEach((track) => { track.enabled = next; });
    setCamera(next);
  };

  const toggleMic = () => {
    if (!stream) return;
    const next = !mic;
    stream.getAudioTracks().forEach((track) => { track.enabled = next; });
    setMic(next);
  };

  const toggleScreenShare = async () => {
    if (!stream) return;
    if (sharing) {
      const cameraTrack = stream.getVideoTracks().find((track) => track.kind === 'video');
      if (cameraTrack) Object.values(peers.current).forEach((peer) => {
        const sender = peer.getSenders().find((item) => item.track?.kind === 'video');
        if (sender) sender.replaceTrack(cameraTrack).catch(() => undefined);
      });
      setSharing(false);
      return;
    }
    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const screenTrack = displayStream.getVideoTracks()[0];
      Object.values(peers.current).forEach((peer) => {
        const sender = peer.getSenders().find((item) => item.track?.kind === 'video');
        if (sender) sender.replaceTrack(screenTrack).catch(() => undefined);
      });
      screenTrack.onended = () => setSharing(false);
      setSharing(true);
    } catch {
      setError('Screen sharing was cancelled or is not available on this device.');
    }
  };

  const toggleHand = async () => {
    if (!roomId || !currentUser) return;
    const next = !hand;
    setHand(next);
    await setDoc(doc(db, 'conferences', roomId, 'participants', currentUser.uid), { handRaised: next }, { merge: true }).catch(() => undefined);
  };

  const sendChat = async () => {
    const text = chatText.trim();
    if (!roomId || !currentUser || !text) return;
    setChatText('');
    await addDoc(collection(db, 'conferences', roomId, 'chat'), {
      uid: currentUser.uid,
      displayName,
      text: text.slice(0, 1000),
      createdAt: serverTimestamp(),
    }).catch(() => setError('Unable to send conference message.'));
  };

  const removeParticipant = async (uid: string) => {
    if (!isHost || !roomId || uid === currentUser?.uid) return;
    await deleteDoc(doc(db, 'conferences', roomId, 'participants', uid)).catch(() => setError('Unable to remove participant.'));
    const peer = peers.current[uid];
    peer?.close();
    delete peers.current[uid];
    setRemoteStreams((current) => {
      const next = { ...current };
      delete next[uid];
      return next;
    });
  };

  const copyInvite = async () => {
    if (!currentUser || !roomId || !isHost) return;
    try {
      const idToken = await currentUser.getIdToken();
      const targetUniqueId = window.prompt('Invite by Unique ID (optional). Leave blank for a secure guest link.')?.trim() || undefined;
      const response = await fetch('/api/conference/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ roomId, targetUniqueId }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || typeof payload.inviteUrl !== 'string') throw new Error(payload?.error?.message || 'Unable to create conference invitation.');
      await navigator.clipboard?.writeText(payload.inviteUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch (inviteError) {
      setError(inviteError instanceof Error ? inviteError.message : 'Unable to create conference invitation.');
    }
  };

  if (currentUser && !roomId) {
    const createConference = async () => {
      setCreating(true);
      try {
        const idToken = await currentUser.getIdToken();
        const response = await fetch('/api/conference/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
          body: JSON.stringify({ title: newTitle.trim() || 'Unique Conference' }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || typeof payload.roomId !== 'string') throw new Error(payload?.error?.message || 'Could not create the conference.');
        navigate(`/conference/${payload.roomId}`);
      } catch (createError) {
        setError(createError instanceof Error ? createError.message : 'Could not create the conference. Please try again.');
      } finally {
        setCreating(false);
      }
    };
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-12 text-white">
        <div className="mx-auto max-w-2xl rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-2xl sm:p-9">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-400/15 text-emerald-300"><Video className="h-7 w-7" /></div>
          <p className="mt-6 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300">Unique Conference</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Meet, teach, present and connect.</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-white/60">Create a live room with camera, microphone, screen sharing, participant controls and an invite link.</p>
          <label className="mt-6 block text-xs font-bold text-white/70">Conference title
            <input value={newTitle} onChange={(event) => setNewTitle(event.target.value)} maxLength={120} className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-black/20 px-4 text-sm text-white outline-none focus:border-emerald-400" />
          </label>
          <button onClick={createConference} disabled={creating} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-5 py-3.5 text-sm font-black text-slate-950 disabled:opacity-60">
            {creating ? 'Creating conference…' : 'Start Public Conference'} <Plus className="h-4 w-4" />
          </button>
          <Link to="/" className="mt-3 block text-center text-xs font-bold text-white/50 hover:text-white">Back to Unique One</Link>
        </div>
      </main>
    );
  }

  if (!currentUser) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-16 text-white">
        <div className="mx-auto max-w-lg rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
          <Video className="mx-auto h-12 w-12 text-emerald-300" />
          <h1 className="mt-4 text-2xl font-black">Join Unique Conference</h1>
          {guestSigningIn ? <p className="mt-2 text-sm text-white/60">Verifying your invitation…</p> : <p className="mt-2 text-sm text-white/60">A valid conference invitation is required for guests. No Unique One account is required.</p>}
          {!inviteToken && <Link to="/login" state={{ from: window.location.pathname }} className="mt-6 inline-flex rounded-full bg-emerald-400 px-5 py-3 font-black text-slate-950">Sign in to continue</Link>}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-white/10 bg-slate-950/90 px-3 py-3 backdrop-blur-xl sm:px-5">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300">Unique Conference</p>
          <h1 className="truncate text-base font-black sm:text-lg">{room?.title || 'Online Conference'}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={copyInvite} className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold">{copied ? 'Copied' : 'Invite'}</button>
          <Link to="/" className="rounded-full p-2 text-white/70 hover:bg-white/10" aria-label="Leave conference"><PhoneOff className="h-5 w-5" /></Link>
        </div>
      </header>

      <section className="mx-auto max-w-7xl p-3 pb-28 sm:p-5">
        {error && <div className="mb-3 rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-xs text-amber-100">{error}</div>}
        <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3"><Users className="h-4 w-4 text-emerald-300" /><p className="mt-2 text-lg font-black">{participants.length}</p><p className="text-[10px] text-white/50">Participants</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3"><MonitorUp className="h-4 w-4 text-emerald-300" /><p className="mt-2 text-sm font-black">{sharing ? 'Sharing' : 'Ready'}</p><p className="text-[10px] text-white/50">Presentation</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3"><Hand className="h-4 w-4 text-emerald-300" /><p className="mt-2 text-sm font-black">{hand ? 'Raised' : 'Lowered'}</p><p className="text-[10px] text-white/50">Your hand</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3"><Crown className="h-4 w-4 text-emerald-300" /><p className="mt-2 truncate text-sm font-black">{room?.hostUid === currentUser.uid ? 'Host' : isGuest ? 'Invited guest' : 'Participant'}</p><p className="text-[10px] text-white/50">Role</p></div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="relative aspect-video overflow-hidden rounded-3xl border border-emerald-300/20 bg-black shadow-2xl">
            {stream && <video ref={(node) => { if (node) { node.srcObject = stream; node.muted = true; node.play().catch(() => undefined); } }} autoPlay playsInline className="h-full w-full object-cover" />}
            {!camera && <div className="absolute inset-0 flex items-center justify-center bg-slate-900"><CameraOff className="h-10 w-10 text-white/30" /></div>}
            <div className="absolute bottom-3 left-3 rounded-full bg-black/60 px-3 py-1 text-xs font-bold backdrop-blur">{displayName} {room?.hostUid === currentUser.uid ? '· Host' : ''}</div>
          </div>
          {Object.entries(remoteStreams).map(([uid, remoteStream]) => (
            <div key={uid} className="relative aspect-video overflow-hidden rounded-3xl border border-white/10 bg-black">
              <video ref={(node) => { if (node) { node.srcObject = remoteStream; node.play().catch(() => undefined); } }} autoPlay playsInline className="h-full w-full object-cover" />
              <div className="absolute bottom-3 left-3 rounded-full bg-black/60 px-3 py-1 text-xs font-bold backdrop-blur">{participants.find((item) => item.uid === uid)?.displayName || 'Participant'}</div>
            </div>
          ))}
        </div>
      </section>

      {chatOpen && (
        <aside className="fixed bottom-20 right-3 z-40 flex w-[min(92vw,22rem)] flex-col overflow-hidden rounded-3xl border border-white/10 bg-slate-900/95 shadow-2xl backdrop-blur-xl sm:right-5">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3"><div><p className="text-sm font-black">Conference chat</p><p className="text-[10px] text-white/40">Live room messages</p></div><button onClick={() => setChatOpen(false)} className="text-xs text-white/50">Close</button></div>
          <div className="max-h-72 space-y-2 overflow-y-auto p-3">
            {chatMessages.length === 0 ? <p className="py-8 text-center text-xs text-white/40">No messages yet.</p> : chatMessages.map((message) => <div key={message.id} className={`rounded-2xl px-3 py-2 ${message.uid === currentUser.uid ? 'ml-6 bg-emerald-400/15' : 'mr-6 bg-white/5'}`}><p className="text-[10px] font-bold text-emerald-300">{message.uid === currentUser.uid ? 'You' : message.displayName || 'Participant'}</p><p className="mt-1 break-words text-xs text-white/80">{message.text}</p></div>)}
          </div>
          <form onSubmit={(event) => { event.preventDefault(); sendChat(); }} className="flex gap-2 border-t border-white/10 p-3"><input value={chatText} onChange={(event) => setChatText(event.target.value)} maxLength={1000} placeholder="Write a message…" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-white outline-none" /><button type="submit" className="rounded-xl bg-emerald-400 px-3 py-2 text-xs font-black text-slate-950">Send</button></form>
        </aside>
      )}

      {isHost && participants.some((participant) => participant.uid !== currentUser.uid && participant.handRaised) && (
        <div className="fixed left-3 top-20 z-30 max-w-[calc(100vw-1.5rem)] rounded-2xl border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-xs text-amber-100 shadow-xl sm:left-5"><div className="font-black">Raised hands</div><div className="mt-1 flex flex-wrap gap-2">{participants.filter((participant) => participant.uid !== currentUser.uid && participant.handRaised).map((participant) => <button key={participant.uid} onClick={() => removeParticipant(participant.uid)} className="rounded-full bg-black/20 px-2 py-1">{participant.displayName || 'Participant'} · Remove</button>)}</div></div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-white/10 bg-slate-950/95 px-3 py-3 backdrop-blur-xl">
        <div className="mx-auto flex max-w-xl items-center justify-center gap-2 sm:gap-3">
          <button onClick={toggleMic} className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10" aria-label={mic ? 'Mute microphone' : 'Unmute microphone'}>{mic ? <Mic /> : <MicOff />}</button>
          <button onClick={toggleCamera} className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10" aria-label={camera ? 'Turn camera off' : 'Turn camera on'}>{camera ? <Camera /> : <CameraOff />}</button>
          <button onClick={toggleScreenShare} className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-slate-950" aria-label="Share screen">{sharing ? <ScreenShare /> : <MonitorUp />}</button>
          <button onClick={toggleHand} className={`flex h-12 w-12 items-center justify-center rounded-full ${hand ? 'bg-amber-300 text-slate-950' : 'bg-white/10'}`} aria-label="Raise hand"><Hand /></button>
          <button onClick={() => setChatOpen((value) => !value)} className={`flex h-12 w-12 items-center justify-center rounded-full ${chatOpen ? 'bg-emerald-400 text-slate-950' : 'bg-white/10'}`} aria-label="Open conference chat"><MessageCircle /></button>
          <button onClick={copyInvite} className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10" aria-label="Copy invite link"><Copy /></button>
          <Link to="/" className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500 text-white" aria-label="Leave conference"><PhoneOff /></Link>
        </div>
      </nav>
    </main>
  );
}
