import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, Check, ChevronDown, Copy, Heart, ImagePlus, Loader2, MessageCircle,
  MoreHorizontal, Plus, Send, Settings2, Share2, Sparkles, X, Building2, GraduationCap
} from 'lucide-react';
import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs, limit, onSnapshot,
  orderBy, query, serverTimestamp, setDoc, where
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';

type ActorType = 'user' | 'business' | 'institution';
type Audience = 'public' | 'followers';

type EdgePost = {
  id: string;
  authorUid: string;
  actorType: ActorType;
  actorId?: string;
  authorName: string;
  authorPhotoUrl?: string;
  actorName: string;
  actorPhotoUrl?: string;
  text: string;
  createdAt?: any;
  status: 'published' | 'draft';
  audience: Audience;
  allowComments: boolean;
  allowReshare: boolean;
  likeCount?: number;
  commentCount?: number;
  actionLabel?: 'pay' | 'visit' | 'chat';
  actionUrl?: string;
};

type CommentItem = { id: string; authorName: string; authorPhotoUrl?: string; text: string; createdAt?: any };

const toMillis = (value: any) => {
  if (!value) return 0;
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (value?.seconds) return Number(value.seconds) * 1000;
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatDate = (value: any) => {
  const ms = toMillis(value);
  if (!ms) return 'Just now';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(ms));
};

const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase()).join('') || 'U';

export default function DiscoverPage() {
  const { currentUser } = useAuth();
  const [posts, setPosts] = useState<EdgePost[]>([]);
  const [loading, setLoading] = useState(true);
  const [postText, setPostText] = useState('');
  const [composerOpen, setComposerOpen] = useState(false);
  const [posting, setPosting] = useState(false);
  const [actorType, setActorType] = useState<ActorType>('user');
  const [actorOptions, setActorOptions] = useState<Array<{ id: string; name: string; photoUrl?: string; actionLabel?: 'pay' | 'visit' | 'chat'; actionUrl?: string }>>([]);
  const [selectedActorId, setSelectedActorId] = useState('');
  const [audience, setAudience] = useState<Audience>('public');
  const [allowComments, setAllowComments] = useState(true);
  const [allowReshare, setAllowReshare] = useState(true);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [likers, setLikers] = useState<Record<string, string[]>>({});
  const [comments, setComments] = useState<Record<string, CommentItem[]>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [commentOpen, setCommentOpen] = useState<Record<string, boolean>>({});
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    const postsQuery = query(collection(db, 'edgePosts'), where('status', '==', 'published'), limit(50));
    const unsubscribe = onSnapshot(postsQuery, snapshot => {
      const next = snapshot.docs
        .map(item => ({ id: item.id, ...(item.data() as Omit<EdgePost, 'id'>) }))
        .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
      setPosts(next);
      setLoading(false);
    }, err => {
      console.error('Active Edge feed failed:', err);
      setError('Active Edge could not load right now.');
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;
    const loadActors = async () => {
      const [userSnap, businessSnap, institutionSnap] = await Promise.all([
        getDoc(doc(db, 'users', currentUser.uid)),
        getDocs(query(collection(db, 'businesses'), where('ownerUid', '==', currentUser.uid), limit(10))),
        getDocs(query(collection(db, 'educationInstitutions'), where('ownerUid', '==', currentUser.uid), limit(10))),
      ]);
      if (cancelled) return;
      const userData = userSnap.exists() ? userSnap.data() : {};
      const personalName = String(userData.fullName || [userData.firstName, userData.lastName].filter(Boolean).join(' ') || currentUser.displayName || 'Unique user');
      const personalPhoto = String(userData.profilePhotoUrl || currentUser.photoURL || '');
      setActorOptions([
        { id: currentUser.uid, name: personalName, photoUrl: personalPhoto },
        ...businessSnap.docs.map(item => {
          const data = item.data() as any;
          return { id: item.id, name: String(data.businessName || data.name || 'Business'), photoUrl: String(data.logoUrl || data.profilePhotoUrl || ''), actionLabel: 'pay' as const, actionUrl: '/os/pay' };
        }),
        ...institutionSnap.docs.map(item => {
          const data = item.data() as any;
          return { id: item.id, name: String(data.name || 'Institution'), photoUrl: String(data.logoUrl || data.profilePhotoUrl || ''), actionLabel: 'visit' as const, actionUrl: '/education' };
        }),
      ]);
    };
    void loadActors().catch(err => console.error('Active Edge actors failed:', err));
    return () => { cancelled = true; };
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    const loadPreferences = async () => {
      const snap = await getDoc(doc(db, 'edgePreferences', currentUser.uid));
      if (!snap.exists()) return;
      const data = snap.data();
      setAudience(data.defaultAudience === 'followers' ? 'followers' : 'public');
      setAllowComments(data.allowComments !== false);
      setAllowReshare(data.allowReshare !== false);
    };
    void loadPreferences().catch(err => console.error('Active Edge preferences failed:', err));
  }, [currentUser]);

  useEffect(() => {
    if (actorOptions.length && !selectedActorId) setSelectedActorId(actorOptions[0].id);
  }, [actorOptions, selectedActorId]);

  const selectedActor = useMemo(() => actorOptions.find(item => item.id === selectedActorId) || actorOptions[0], [actorOptions, selectedActorId]);

  const createPost = async () => {
    if (!currentUser) {
      setError('Sign in to post an update.');
      return;
    }
    const text = postText.trim();
    if (!text || text.length > 5000 || !selectedActor) return;
    setPosting(true);
    setError('');
    try {
      const actorIsUser = actorType === 'user';
      const actor = actorIsUser ? actorOptions[0] : selectedActor;
      if (!actor) throw new Error('Choose a posting identity.');
      await addDoc(collection(db, 'edgePosts'), {
        authorUid: currentUser.uid,
        actorType,
        actorId: actor.id,
        authorName: actorOptions[0]?.name || 'Unique user',
        authorPhotoUrl: actorOptions[0]?.photoUrl || '',
        actorName: actor.name,
        actorPhotoUrl: actor.photoUrl || '',
        text,
        status: 'published',
        audience,
        allowComments,
        allowReshare,
        actionLabel: actor.actionLabel || (actorType === 'business' ? 'pay' : actorType === 'institution' ? 'visit' : 'chat'),
        actionUrl: actor.actionUrl || '',
        createdAt: serverTimestamp(),
      });
      setPostText('');
      setComposerOpen(false);
    } catch (err) {
      console.error('Active Edge post failed:', err);
      setError(err instanceof Error ? err.message : 'Could not publish your update.');
    } finally {
      setPosting(false);
    }
  };

  const toggleLike = async (post: EdgePost) => {
    if (!currentUser) { setError('Sign in to like posts.'); return; }
    const likeRef = doc(db, 'edgePosts', post.id, 'likes', currentUser.uid);
    const next = !liked[post.id];
    setLiked(current => ({ ...current, [post.id]: next }));
    try {
      if (next) {
        const userSnap = await getDoc(doc(db, 'users', currentUser.uid));
        const userData = userSnap.exists() ? userSnap.data() : {};
        await setDoc(likeRef, { uid: currentUser.uid, name: String(userData.fullName || currentUser.displayName || 'Unique user'), createdAt: serverTimestamp() });
      } else {
        await deleteDoc(likeRef);
      }
      const snap = await getDocs(query(collection(db, 'edgePosts', post.id, 'likes'), limit(6)));
      setLikers(current => ({ ...current, [post.id]: snap.docs.map(item => String(item.data().name || item.data().uid || 'Unique user')) }));
    } catch (err) {
      setLiked(current => ({ ...current, [post.id]: !next }));
      console.error('Active Edge like failed:', err);
    }
  };

  const loadComments = async (postId: string) => {
    const snap = await getDocs(query(collection(db, 'edgePosts', postId, 'comments'), orderBy('createdAt', 'desc'), limit(5)));
    setComments(current => ({ ...current, [postId]: snap.docs.map(item => ({ id: item.id, ...(item.data() as Omit<CommentItem, 'id'>) })) }));
  };

  const addComment = async (post: EdgePost) => {
    if (!currentUser || !post.allowComments) return;
    const text = (commentDrafts[post.id] || '').trim();
    if (!text) return;
    const userSnap = await getDoc(doc(db, 'users', currentUser.uid));
    const userData = userSnap.exists() ? userSnap.data() : {};
    const authorName = String(userData.fullName || currentUser.displayName || 'Unique user');
    const authorPhotoUrl = String(userData.profilePhotoUrl || currentUser.photoURL || '');
    await addDoc(collection(db, 'edgePosts', post.id, 'comments'), { authorUid: currentUser.uid, authorName, authorPhotoUrl, text, createdAt: serverTimestamp() });
    setCommentDrafts(current => ({ ...current, [post.id]: '' }));
    await loadComments(post.id);
  };

  const savePreferences = async () => {
    if (!currentUser) return;
    await setDoc(doc(db, 'edgePreferences', currentUser.uid), { defaultAudience: audience, allowComments, allowReshare, updatedAt: serverTimestamp() }, { merge: true });
    setPreferencesOpen(false);
  };

  const copyLink = async (postId: string) => {
    await navigator.clipboard?.writeText(window.location.origin + '/discover#post-' + postId);
  };

  const reshareToChat = (post: EdgePost) => {
    const shareUrl = window.location.origin + '/discover#post-' + post.id;
    if (navigator.share) void navigator.share({ title: post.actorName, text: post.text, url: shareUrl });
    else void navigator.clipboard?.writeText(shareUrl);
  };

  return (
    <main className="min-h-screen bg-[#f5f7f6] text-slate-950">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-3 py-3 sm:px-6">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600">Unique One</p>
            <h1 className="text-xl font-black tracking-tight sm:text-2xl">Active Edge</h1>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setPreferencesOpen(true)} className="flex h-10 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 shadow-sm"><Settings2 className="h-4 w-4" /><span className="hidden sm:inline">Preferences</span></button>
            <button type="button" onClick={() => setComposerOpen(true)} className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg transition hover:scale-105" aria-label="Create update"><Plus className="h-5 w-5" /></button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-3 pb-16 pt-4 sm:px-6 sm:pt-6">
        {error && <div className="mb-4 flex items-start justify-between gap-3 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700"><span>{error}</span><button type="button" onClick={() => setError('')}><X className="h-4 w-4" /></button></div>}

        <section className="mb-5 rounded-3xl border border-emerald-100 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-emerald-50 font-black text-emerald-700">
              {selectedActor?.photoUrl ? <img src={selectedActor.photoUrl} alt="" className="h-full w-full object-cover" /> : initials(selectedActor?.name || 'Unique')}
            </div>
            <button type="button" onClick={() => setComposerOpen(true)} className="flex-1 rounded-full bg-slate-100 px-4 py-3 text-left text-sm text-slate-500 transition hover:bg-slate-200">Share an update with Unique One...</button>
            <button type="button" onClick={() => setComposerOpen(true)} className="rounded-full bg-emerald-50 p-3 text-emerald-700" aria-label="Add post"><Plus className="h-5 w-5" /></button>
          </div>
        </section>

        <div className="mb-5 flex items-center justify-between">
          <div><p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-600">Live stream</p><h2 className="mt-1 text-lg font-black">Most recent updates</h2></div>
          <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-500 shadow-sm">{posts.length} visible</span>
        </div>

        {loading ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-emerald-500" /><p className="mt-3 text-sm text-slate-500">Loading the latest updates...</p></div>
        ) : posts.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center"><Sparkles className="mx-auto h-9 w-9 text-emerald-500" /><h2 className="mt-3 text-lg font-black">Your Active Edge starts here.</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">Users, business owners and institutions can publish real updates here. The newest published update will appear first.</p><button type="button" onClick={() => setComposerOpen(true)} className="mt-5 inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-bold text-white"><Plus className="h-4 w-4" /> Create the first update</button></div>
        ) : (
          <div className="space-y-5">
            {posts.map(post => (
              <article id={'post-' + post.id} key={post.id} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-start justify-between gap-3 p-4 sm:p-5">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-emerald-50 font-black text-emerald-700">
                      {post.actorPhotoUrl ? <img src={post.actorPhotoUrl} alt="" className="h-full w-full object-cover" /> : initials(post.actorName)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2"><h3 className="truncate text-sm font-black">{post.actorName}</h3>{post.actorType !== 'user' && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-700">{post.actorType}</span>}</div>
                      <p className="text-xs text-slate-400">{formatDate(post.createdAt)} · {post.audience === 'public' ? 'Public' : 'Followers'}</p>
                    </div>
                  </div>
                  <button type="button" className="rounded-full p-2 text-slate-400 hover:bg-slate-100" aria-label="More options"><MoreHorizontal className="h-5 w-5" /></button>
                </div>

                <div className="px-4 pb-4 sm:px-5 sm:pb-5"><p className="whitespace-pre-wrap break-words text-[15px] leading-7 text-slate-800">{post.text}</p></div>

                {(post.actorType === 'business' || post.actorType === 'institution') && (
                  <div className="mx-4 mb-4 rounded-2xl bg-slate-50 p-3 sm:mx-5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-600">{post.actorType === 'business' ? <Building2 className="h-4 w-4 text-emerald-600" /> : <GraduationCap className="h-4 w-4 text-emerald-600" />}{post.actorType === 'business' ? 'Business update' : 'Institution update'}</div>
                      {post.actionLabel === 'pay' && <Link to={post.actionUrl || '/os/pay'} className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-black text-white">Pay</Link>}
                      {post.actionLabel === 'visit' && <Link to={post.actionUrl || '/education'} className="rounded-full bg-slate-950 px-4 py-2 text-xs font-black text-white">Visit</Link>}
                    </div>
                  </div>
                )}

                <div className="border-t border-slate-100 px-4 py-3 sm:px-5">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                    <span>{likers[post.id]?.length || post.likeCount || 0} likes</span><span>{comments[post.id]?.length || post.commentCount || 0} comments</span>
                  </div>
                  {likers[post.id]?.length ? <div className="mt-2 text-xs text-slate-500">Liked by <span className="font-bold text-slate-700">{likers[post.id].slice(0, 3).join(', ')}</span></div> : null}
                  <div className="mt-2 flex flex-wrap gap-1">
                    <button type="button" onClick={() => void toggleLike(post)} className="flex items-center gap-2 rounded-full px-3 py-2 text-xs font-bold hover:bg-slate-50"><Heart className={'h-4 w-4 ' + (liked[post.id] ? 'fill-current text-rose-500' : '')} /> Like</button>
                    {post.allowComments && <button type="button" onClick={() => { setCommentOpen(current => ({ ...current, [post.id]: !current[post.id] })); if (!comments[post.id]) void loadComments(post.id); }} className="flex items-center gap-2 rounded-full px-3 py-2 text-xs font-bold hover:bg-slate-50"><MessageCircle className="h-4 w-4" /> Comment</button>}
                    {post.actorType === 'user' && post.allowReshare && <button type="button" onClick={() => reshareToChat(post)} className="flex items-center gap-2 rounded-full px-3 py-2 text-xs font-bold hover:bg-slate-50"><Share2 className="h-4 w-4" /> Reshare to chat</button>}
                    {post.actorType === 'user' && <button type="button" onClick={() => void copyLink(post.id)} className="flex items-center gap-2 rounded-full px-3 py-2 text-xs font-bold hover:bg-slate-50"><Copy className="h-4 w-4" /> Copy link</button>}
                  </div>
                  {commentOpen[post.id] && post.allowComments && (
                    <div className="mt-3 space-y-3 rounded-2xl bg-slate-50 p-3">
                      {(comments[post.id] || []).map(comment => <div key={comment.id} className="flex gap-2"><div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white text-[10px] font-black text-emerald-700">{comment.authorPhotoUrl ? <img src={comment.authorPhotoUrl} alt="" className="h-full w-full object-cover" /> : initials(comment.authorName)}</div><div className="rounded-2xl bg-white px-3 py-2"><p className="text-xs font-bold">{comment.authorName}</p><p className="text-xs leading-5 text-slate-600">{comment.text}</p><p className="mt-1 text-[10px] text-slate-400">{formatDate(comment.createdAt)}</p></div></div>)}
                      {currentUser && <div className="flex gap-2"><input value={commentDrafts[post.id] || ''} onChange={event => setCommentDrafts(current => ({ ...current, [post.id]: event.target.value }))} onKeyDown={event => { if (event.key === 'Enter') void addComment(post); }} placeholder="Write a comment..." className="min-w-0 flex-1 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-xs outline-none focus:border-emerald-400" /><button type="button" onClick={() => void addComment(post)} className="rounded-full bg-emerald-600 p-2.5 text-white"><Send className="h-4 w-4" /></button></div>}
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {composerOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-4">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-6">
            <div className="flex items-center justify-between"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-600">Create</p><h2 className="text-xl font-black">Post an update</h2></div><button type="button" onClick={() => setComposerOpen(false)} className="rounded-full p-2 hover:bg-slate-100"><X className="h-5 w-5" /></button></div>
            <div className="mt-5 flex flex-wrap gap-2">
              {(['user','business','institution'] as ActorType[]).filter(type => type === 'user' || actorOptions.some(option => type === 'business' ? option.id !== currentUser?.uid && option.actionLabel === 'pay' : option.id !== currentUser?.uid && option.actionLabel === 'visit')).map(type => (
                <button key={type} type="button" onClick={() => { setActorType(type); const option = type === 'user' ? actorOptions[0] : actorOptions.find(item => type === 'business' ? item.actionLabel === 'pay' : item.actionLabel === 'visit'); if (option) setSelectedActorId(option.id); }} className={'rounded-full px-4 py-2 text-xs font-bold ' + (actorType === type ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600')}>{type === 'user' ? 'Personal' : type === 'business' ? 'Business' : 'Institution'}</button>
              ))}
            </div>
            {actorType !== 'user' && <select value={selectedActorId} onChange={event => setSelectedActorId(event.target.value)} className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm">{actorOptions.filter(option => actorType === 'business' ? option.actionLabel === 'pay' : option.actionLabel === 'visit').map(option => <option key={option.id} value={option.id}>{option.name}</option>)}</select>}
            <textarea value={postText} onChange={event => setPostText(event.target.value)} maxLength={5000} rows={7} placeholder="Share an update, announcement, experience, idea or useful information..." className="mt-4 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 outline-none focus:border-emerald-400 focus:bg-white" />
            <div className="mt-2 flex items-center justify-between text-xs text-slate-400"><span>{postText.length}/5000</span><span className="inline-flex items-center gap-1"><ImagePlus className="h-4 w-4" /> Media upload coming through the existing storage pipeline</span></div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <label className="text-xs font-bold text-slate-600">Audience<select value={audience} onChange={event => setAudience(event.target.value as Audience)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal"><option value="public">Public</option><option value="followers">Followers</option></select></label>
              <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-3 text-xs font-bold"><input type="checkbox" checked={allowComments} onChange={event => setAllowComments(event.target.checked)} /> Comments</label>
              <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-3 text-xs font-bold"><input type="checkbox" checked={allowReshare} onChange={event => setAllowReshare(event.target.checked)} /> Resharing</label>
            </div>
            <button type="button" disabled={posting || !postText.trim() || !currentUser} onClick={() => void createPost()} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3.5 text-sm font-black text-white disabled:opacity-50">{posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Publish update</button>
          </div>
        </div>
      )}

      {preferencesOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-4">
          <div className="w-full max-w-lg rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-6">
            <div className="flex items-center justify-between"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-600">Creator controls</p><h2 className="text-xl font-black">Active Edge preferences</h2></div><button type="button" onClick={() => setPreferencesOpen(false)} className="rounded-full p-2 hover:bg-slate-100"><X className="h-5 w-5" /></button></div>
            <div className="mt-5 space-y-3">
              <div className="rounded-2xl border border-slate-200 p-4"><p className="text-sm font-bold">Default audience</p><p className="mt-1 text-xs text-slate-500">Choose the default visibility for new updates.</p><div className="mt-3 flex gap-2"><button type="button" onClick={() => setAudience('public')} className={'rounded-full px-4 py-2 text-xs font-bold ' + (audience === 'public' ? 'bg-emerald-600 text-white' : 'bg-slate-100')}>Public</button><button type="button" onClick={() => setAudience('followers')} className={'rounded-full px-4 py-2 text-xs font-bold ' + (audience === 'followers' ? 'bg-emerald-600 text-white' : 'bg-slate-100')}>Followers</button></div></div>
              <label className="flex items-center justify-between rounded-2xl border border-slate-200 p-4"><span><span className="block text-sm font-bold">Allow comments</span><span className="text-xs text-slate-500">Let people respond to your updates.</span></span><input type="checkbox" checked={allowComments} onChange={event => setAllowComments(event.target.checked)} /></label>
              <label className="flex items-center justify-between rounded-2xl border border-slate-200 p-4"><span><span className="block text-sm font-bold">Allow resharing</span><span className="text-xs text-slate-500">Let personal posts be reshared.</span></span><input type="checkbox" checked={allowReshare} onChange={event => setAllowReshare(event.target.checked)} /></label>
            </div>
            <button type="button" onClick={() => void savePreferences()} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3.5 text-sm font-black text-white"><Check className="h-4 w-4" /> Save preferences</button>
          </div>
        </div>
      )}
    </main>
  );
}
