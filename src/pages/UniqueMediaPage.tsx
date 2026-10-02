import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Cloud, FileText, FolderOpen, Image as ImageIcon, Music2, Pause, Play, Search, Share2, Smartphone, Trash2, Users, Volume2, X } from 'lucide-react';
import { auth, storage } from '../lib/firebase';
import AuthActionGate from '../components/auth/AuthActionGate';
import { getDownloadURL, listAll, ref, uploadBytesResumable } from 'firebase/storage';
import { DeviceMediaItem, formatBytes, getStoredDeviceMediaDirectory, loadPickedDeviceMedia, permanentlyDeleteDeviceMedia, pickDeviceMediaDirectory, rememberDeviceMediaDirectory, scanDeviceMediaDirectory, supportsDeviceDirectoryAccess, supportsPhoneFilePicker, supportsNativeAndroidStorage, requestNativeMediaAccess, loadNativeAndroidMedia, loadNativeSharedMedia, shareNativeMedia } from '../lib/media/deviceMedia';
import { stageMediaForDestination } from '../lib/media/shareBridge';

type MediaKind = 'all' | 'video' | 'audio' | 'image' | 'pdf';
type LocalMedia = DeviceMediaItem;

const kindForFile = (file: File): Exclude<MediaKind, 'all'> | null => {
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('audio/')) return 'audio';
  if (file.type.startsWith('image/')) return 'image';
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) return 'pdf';
  return null;
};

const iconForKind = (kind: Exclude<MediaKind, 'all'>) => {
  if (kind === 'video') return Play;
  if (kind === 'audio') return Music2;
  if (kind === 'image') return ImageIcon;
  return FileText;
};

const uploadFile = (path: string, file: File, onProgress: (value: number) => void) =>
  new Promise<void>((resolve, reject) => {
    const task = uploadBytesResumable(ref(storage, path), file, { contentType: file.type || 'application/octet-stream' });
    task.on('state_changed',
      (snapshot) => onProgress(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)),
      reject,
      () => resolve(),
    );
  });

export default function UniqueMediaPage() {
  const [media, setMedia] = useState<LocalMedia[]>([]);
  const [activeKind, setActiveKind] = useState<MediaKind>('audio');
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [contactSearch, setContactSearch] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [shareMessage, setShareMessage] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [cloudProgress, setCloudProgress] = useState(0);
  const [cloudMessage, setCloudMessage] = useState('');
  const [deviceMessage, setDeviceMessage] = useState('');
  const [player, setPlayer] = useState<LocalMedia | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoAudioMode, setVideoAudioMode] = useState(false);
  const [deleting, setDeleting] = useState<string[]>([]);
  const [nativeOffset, setNativeOffset] = useState(0);
  const [nativeHasMore, setNativeHasMore] = useState(false);
  const [nativeLoadingMore, setNativeLoadingMore] = useState(false);
  const [playerRate, setPlayerRate] = useState(1);
  const [playerFit, setPlayerFit] = useState<'contain' | 'cover'>('contain');
  const [playerFullscreen, setPlayerFullscreen] = useState(false);
  const playerVideoRef = React.useRef<HTMLVideoElement | null>(null);
  const phoneFileInputRef = React.useRef<HTMLInputElement | null>(null);

  const filteredMedia = useMemo(() => {
    const term = search.trim().toLowerCase();
    return media.filter((item) => {
      const matchesKind = activeKind === 'all' || item.kind === activeKind;
      return matchesKind && (!term || item.file.name.toLowerCase().includes(term));
    });
  }, [activeKind, media, search]);

  const loadAuthorizedDeviceMedia = async (handle: any, announce = false) => {
    const result = await scanDeviceMediaDirectory(handle);
    setMedia((current) => {
      const existing = new Set(current.map((item) => item.file.name + ':' + item.file.size));
      return [...result.items.filter((item) => !existing.has(item.file.name + ':' + item.file.size)), ...current];
    });
    if (announce) setDeviceMessage(result.items.length + ' authorized media item' + (result.items.length === 1 ? '' : 's') + ' loaded from ' + result.rootName + '.');
  };

  useEffect(() => {
    let cancelled = false;
    const restoreAuthorizedMedia = async () => {
      if (supportsNativeAndroidStorage()) {
        try {
          setDeviceMessage('Preparing secure phone media access…');
          const granted = await requestNativeMediaAccess();
          if (!granted || cancelled) {
            if (!cancelled) setDeviceMessage('Phone media permission was not granted. You can try again with Connect phone media.');
            return;
          }
          const nativeItems = await loadNativeAndroidMedia(0, 100);
          const sharedItems = await loadNativeSharedMedia();
          const importedCount = nativeItems.length + sharedItems.length;
          if (!cancelled && (nativeItems.length || sharedItems.length)) {
            setMedia((current) => {
              const existing = new Set(current.map((item) => item.file.name + ':' + item.file.size));
              const incoming = [...sharedItems, ...nativeItems];
              return [...incoming.filter((item) => !existing.has(item.file.name + ':' + item.file.size)), ...current];
            });
            setNativeOffset(nativeItems.length);
            setNativeHasMore(nativeItems.length === 100);
            setDeviceMessage(sharedItems.length
              ? sharedItems.length + ' shared file' + (sharedItems.length === 1 ? '' : 's') + ' received from Android and ' + nativeItems.length + ' phone media item' + (nativeItems.length === 1 ? '' : 's') + ' connected.'
              : importedCount + ' phone media item' + (importedCount === 1 ? '' : 's') + ' connected through Android MediaStore.');
          } else if (!cancelled) {
            setDeviceMessage('Phone access is granted, but no supported media was found.');
          }
          return;
        } catch {
          if (!cancelled) setDeviceMessage('Native phone media access could not be completed.');
          return;
        }
      }
      if (!supportsDeviceDirectoryAccess()) {
        setDeviceMessage('Automatic device media access is available in supported browsers. Native Android MediaStore integration will provide deeper phone-wide access.');
        return;
      }
      try {
        const handle = await getStoredDeviceMediaDirectory();
        if (!handle || cancelled) return;
        const permission = await handle.queryPermission?.({ mode: 'read' });
        if (permission !== 'granted' || cancelled) return;
        await loadAuthorizedDeviceMedia(handle);
        if (!cancelled) setDeviceMessage('Your authorized device media is connected automatically.');
      } catch {
        if (!cancelled) setDeviceMessage('Automatic media access is unavailable. Re-authorize the device media folder when needed.');
      }
    };
    void restoreAuthorizedMedia();
    return () => { cancelled = true; };
  }, []);

  const loadMoreNativeMedia = async () => {
    if (!supportsNativeAndroidStorage() || !nativeHasMore || nativeLoadingMore) return;
    try {
      setNativeLoadingMore(true);
      const next = await loadNativeAndroidMedia(nativeOffset, 100);
      setMedia((current) => {
        const existing = new Set(current.map((item) => item.file.name + ':' + item.file.size));
        return [...next.filter((item) => !existing.has(item.file.name + ':' + item.file.size)), ...current];
      });
      setNativeOffset((value) => value + next.length);
      setNativeHasMore(next.length === 100);
      setDeviceMessage(next.length ? next.length + ' more phone media items loaded.' : 'You have reached the end of your phone media library.');
    } catch {
      setDeviceMessage('More phone media could not be loaded.');
    } finally {
      setNativeLoadingMore(false);
    }
  };

  const importFromPhoneStorage = (files: FileList | null) => {
    if (!files?.length) return;
    const picked = loadPickedDeviceMedia(files);
    if (!picked.length) {
      setDeviceMessage('No supported video, audio, image or PDF files were selected.');
      return;
    }
    setMedia((current) => {
      const existing = new Set(current.map((item) => item.file.name + ':' + item.file.size));
      return [...picked.filter((item) => !existing.has(item.file.name + ':' + item.file.size)), ...current];
    });
    setDeviceMessage(picked.length + ' media item' + (picked.length === 1 ? '' : 's') + ' imported from your phone storage.');
  };

  const connectDeviceMedia = async () => {
    if (supportsNativeAndroidStorage()) {
      try {
        setDeviceMessage('Requesting Android media access…');
        const granted = await requestNativeMediaAccess();
        if (!granted) {
          setDeviceMessage('Android media permission was not granted.');
          return;
        }
        const nativeItems = await loadNativeAndroidMedia(0, 100);
        setMedia((current) => {
          const existing = new Set(current.map((item) => item.file.name + ':' + item.file.size));
          return [...nativeItems.filter((item) => !existing.has(item.file.name + ':' + item.file.size)), ...current];
        });
        setNativeOffset(nativeItems.length);
        setNativeHasMore(nativeItems.length === 100);
        setDeviceMessage(nativeItems.length + ' phone media item' + (nativeItems.length === 1 ? '' : 's') + ' loaded directly from Android storage.');
      } catch {
        setDeviceMessage('Android phone media access failed. Check the system permission and try again.');
      }
      return;
    }
    if (!supportsDeviceDirectoryAccess()) {
      if (supportsPhoneFilePicker()) {
        phoneFileInputRef.current?.click();
        return;
      }
      setDeviceMessage('This browser does not expose device-folder or phone file-picker access. Use a supported Android browser or the native Android build for deeper phone-wide access.');
      return;
    }
    try {
      setDeviceMessage('Choose your media folder once. UniqueMedia will remember this authorization and load it automatically on future visits.');
      const result = await pickDeviceMediaDirectory();
      if (!result) return;
      await rememberDeviceMediaDirectory(result.handle);
      await loadAuthorizedDeviceMedia(result.handle, true);
    } catch (error) {
      if ((error as DOMException)?.name !== 'AbortError') setDeviceMessage('Device media access was not completed. Check the permission prompt and try again.');
    }
  };

  const permanentDelete = async (item: LocalMedia) => {
    if (!item.parentHandle || !item.entryName) {
      setDeviceMessage('This item was added through a file picker and cannot be permanently deleted by the web app. Remove it from UniqueMedia instead.');
      return;
    }
    if (!window.confirm('Permanently delete "' + item.file.name + '" from the authorized device folder? This cannot be undone.')) return;
    try {
      setDeleting((current) => [...current, item.id]);
      const deleted = await permanentlyDeleteDeviceMedia(item);
      if (!deleted) {
        setDeviceMessage('Permanent deletion requires write permission for the authorized folder.');
        return;
      }
      removeMedia(item.id);
      setDeviceMessage(item.file.name + ' was permanently deleted from the authorized folder.');
      if (player?.id === item.id) setPlayer(null);
    } catch {
      setDeviceMessage('Permanent deletion failed. The operating system may have denied the delete request.');
    } finally {
      setDeleting((current) => current.filter((id) => id !== item.id));
    }
  };

  const removeMedia = (id: string) => {
    setMedia((current) => {
      const item = current.find((entry) => entry.id === id);
      if (item) URL.revokeObjectURL(item.url);
      return current.filter((entry) => entry.id !== id);
    });
    setSelected((current) => current.filter((value) => value !== id));
  };

  const postImageToStore = async (item: LocalMedia) => {
    if (item.kind !== 'image') {
      setShareMessage('Unique Store product media currently accepts images here. Videos can still be shared through UniqueShare or other apps.');
      return;
    }
    try {
      const id = await stageMediaForDestination(item.file);
      window.location.assign('/os/business/catalog/new-product?media=' + encodeURIComponent(id));
    } catch {
      setShareMessage('The file could not be prepared for Unique Store.');
    }
  };

  const shareFiles = async (items: LocalMedia[]) => {
    if (!items.length) {
      setShareMessage('Select at least one media file first.');
      return;
    }
    try {
      if (supportsNativeAndroidStorage() && shareNativeMedia(items)) {
        setShareMessage(items.length + ' file' + (items.length === 1 ? '' : 's') + ' opened in the Android Share Sheet.');
        return;
      }
      const files = items.map((item) => item.file);
      if (navigator.share && navigator.canShare?.({ files })) {
        await navigator.share({ title: 'UniqueShare', text: 'Shared from UniqueMedia', files });
        setShareMessage(items.length + ' file' + (items.length === 1 ? '' : 's') + ' shared through your device.');
        return;
      }
      const item = items[0];
      const link = document.createElement('a');
      link.href = item.url;
      link.download = item.file.name;
      link.click();
      setShareMessage('This browser cannot share multiple files directly. The selected file was prepared for device sharing.');
    } catch (error) {
      if ((error as DOMException)?.name !== 'AbortError') setShareMessage('Sharing was not completed on this device.');
    }
  };

  const toggleSelected = (id: string) => {
    setSelected((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  };

  const openMedia = (item: LocalMedia) => {
    setPlayer(item);
    setVideoAudioMode(false);
    setIsPlaying(item.kind === 'video' || item.kind === 'audio');
  };

  const toggleVideoAudioMode = () => {
    setVideoAudioMode((current) => !current);
    setIsPlaying(true);
  };

  const backupToCloud = async () => {
    const user = auth.currentUser;
    if (!user) {
      setCloudMessage('Sign in is required for cloud backup. Local UniqueMedia remains free.');
      return;
    }
    if (!media.length) {
      setCloudMessage('Add media before creating a cloud backup.');
      return;
    }
    const backupId = new Date().toISOString().replace(/[:.]/g, '-');
    try {
      setCloudProgress(0);
      setCloudMessage('Creating secure cloud backup…');
      const root = 'media-backups/' + user.uid + '/' + backupId;
      for (let index = 0; index < media.length; index += 1) {
        const item = media[index];
        await uploadFile(root + '/' + item.id + '-' + item.file.name, item.file, (fileProgress) => {
          const overall = Math.round(((index + fileProgress / 100) / media.length) * 100);
          setCloudProgress(overall);
        });
      }
      const manifest = {
        version: 2,
        createdAt: new Date().toISOString(),
        files: media.map((item) => ({ id: item.id, name: item.file.name, type: item.file.type, size: item.file.size, kind: item.kind })),
      };
      const manifestFile = new File([JSON.stringify(manifest)], 'manifest.json', { type: 'application/json' });
      await uploadFile(root + '/manifest.json', manifestFile, () => {});
      setCloudProgress(100);
      setCloudMessage('Contact backup completed.');
    } catch {
      setCloudMessage('Cloud backup failed. Check your connection and try again; local files were not changed.');
    }
  };

  const restoreLatestCloudBackup = async () => {
    const user = auth.currentUser;
    if (!user) {
      setCloudMessage('Sign in is required to restore a cloud backup.');
      return;
    }
    try {
      setCloudMessage('Finding your latest backup…');
      const root = ref(storage, 'media-backups/' + user.uid);
      const backups = await listAll(root);
      if (!backups.prefixes.length) {
        setCloudMessage('No cloud backup was found for this account.');
        return;
      }
      backups.prefixes.sort((a, b) => b.name.localeCompare(a.name));
      const latest = backups.prefixes[0];
      const files = await listAll(latest);
      const restored: LocalMedia[] = [];
      for (const fileRef of files.items) {
        if (fileRef.name === 'manifest.json') continue;
        const url = await getDownloadURL(fileRef);
        const response = await fetch(url);
        const blob = await response.blob();
        const name = fileRef.name.replace(/^[^-]+-/, '') || fileRef.name;
        const file = new File([blob], name, { type: blob.type || 'application/octet-stream' });
        const kind = kindForFile(file);
        if (kind) restored.push({ id: crypto.randomUUID(), file, kind, url: URL.createObjectURL(file) });
      }
      setMedia((current) => [...restored, ...current]);
      setCloudMessage(restored.length + ' backed-up item' + (restored.length === 1 ? '' : 's') + ' restored.');
    } catch {
      setCloudMessage('Restore could not complete. Check Storage access and your connection.');
    }
  };

  const seekPlayer = (seconds: number) => {
    const video = playerVideoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(video.duration || Infinity, video.currentTime + seconds));
  };

  const changePlayerRate = () => {
    const next = playerRate === 0.5 ? 1 : playerRate === 1 ? 1.5 : playerRate === 1.5 ? 2 : 0.5;
    setPlayerRate(next);
    if (playerVideoRef.current) playerVideoRef.current.playbackRate = next;
  };

  const togglePlayerFullscreen = async () => {
    const container = playerVideoRef.current?.closest('[role="dialog"]') as HTMLElement | null;
    if (!container) return;
    try {
      if (!document.fullscreenElement) {
        await container.requestFullscreen?.();
        setPlayerFullscreen(true);
      } else {
        await document.exitFullscreen?.();
        setPlayerFullscreen(false);
      }
    } catch {
      setPlayerFullscreen(Boolean(document.fullscreenElement));
    }
  };

  const pictureInPicture = async () => {
    const video = playerVideoRef.current as (HTMLVideoElement & { requestPictureInPicture?: () => Promise<unknown> }) | null;
    if (!video?.requestPictureInPicture) return;
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture?.();
      else await video.requestPictureInPicture();
    } catch {
      setShareMessage('Picture-in-picture is not available on this device.');
    }
  };

  const categories: Array<[Exclude<MediaKind, 'all'>, string]> = [
    ['audio', 'Music'], ['video', 'Videos'], ['image', 'Images'], ['pdf', 'PDF Reader'],
  ];

  return (
    <main className="min-h-full overflow-y-auto bg-slate-50 pb-24">
      <div className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-8">
        <header className="rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm sm:p-7">
          <input ref={phoneFileInputRef} type="file" multiple accept="video/*,audio/*,image/*,application/pdf" className="hidden" onChange={(event) => { importFromPhoneStorage(event.target.files); event.currentTarget.value = ''; }} />
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">UniquePlatform</p>
              <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950">UniqueMedia</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Your local-first hub for videos, music, images and PDFs.</p>
            </div>
            <div className="flex w-full flex-wrap gap-2 sm:w-auto">
              <button type="button" onClick={() => void connectDeviceMedia()} className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-bold text-white sm:flex-none"><FolderOpen className="h-4 w-4" /> Connect phone</button>
              <Link to="/os/unique-share" className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800 sm:flex-none"><Share2 className="h-4 w-4" /> UniqueShare</Link>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]">
            <label className="flex min-w-0 items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
              <Search className="h-4 w-4 shrink-0 text-slate-400" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search your media" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
            </label>
            <button type="button" onClick={() => setCategoriesOpen((value) => !value)} aria-expanded={categoriesOpen} className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800">
              <FolderOpen className="mr-2 h-4 w-4 text-emerald-600" /> {categoriesOpen ? 'Hide categories' : 'Open UniqueMedia categories'}
            </button>
          </div>

          {categoriesOpen && (
            <nav aria-label="UniqueMedia categories" className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
              {categories.map(([value, label]) => (
                <button key={value} type="button" onClick={() => { setActiveKind(value); setCategoriesOpen(false); }} className={'rounded-2xl px-3 py-3 text-xs font-bold transition ' + (activeKind === value ? 'bg-emerald-600 text-white shadow-sm' : 'border border-slate-200 bg-white text-slate-600 hover:border-emerald-200 hover:bg-emerald-50')}>
                  {label}
                </button>
              ))}
            </nav>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full bg-emerald-50 px-3 py-1.5 font-bold text-emerald-700">{categories.find(([value]) => value === activeKind)?.[1] || 'Music'}</span>
            {selected.length > 0 && <span className="rounded-full bg-slate-950 px-3 py-1.5 font-bold text-white">{selected.length} selected</span>}
          </div>

          <div className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-xs leading-5 text-emerald-900">
            <strong>Device access:</strong> Android permissions are used for phone media. When direct folder access is unavailable, the system file picker is used instead. Authorized access is remembered where supported; nothing is silently uploaded.
          </div>
          {deviceMessage && <p className="mt-3 text-xs font-semibold text-emerald-700">{deviceMessage}</p>}
        </header>

        <section className="mt-5">
          <div className="mb-3 flex items-end justify-between gap-3 px-1">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">Library</p>
              <h2 className="text-xl font-black text-slate-950">Your media</h2>
              <p className="text-xs text-slate-500">Videos, audio, images and PDFs from your connected device.</p>
            </div>
            {selected.length > 0 && <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">{selected.length} selected</span>}
          </div>
          {filteredMedia.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center">
              <Play className="mx-auto h-10 w-10 text-emerald-500" />
              <h2 className="mt-4 text-lg font-black text-slate-900">Your media space is ready</h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">Your authorized device media will appear here automatically. Nothing is silently uploaded to the cloud.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredMedia.map((item) => {
                const Icon = iconForKind(item.kind);
                const isSelected = selected.includes(item.id);
                return (
                  <article key={item.id} className={'overflow-hidden rounded-3xl border bg-white shadow-sm ' + (isSelected ? 'border-emerald-500 ring-2 ring-emerald-100' : 'border-slate-200')}>
                    <button type="button" onClick={() => openMedia(item)} className="block w-full text-left">
                      <div className="flex h-44 items-center justify-center bg-slate-100">
                        {item.kind === 'image' ? <img src={item.url} alt={item.file.name} className="h-full w-full object-cover" /> : item.kind === 'video' ? <video src={item.url} className="h-full w-full object-cover" muted playsInline /> : <Icon className="h-12 w-12 text-emerald-600" />}
                      </div>
                      <div className="p-4"><p className="truncate text-sm font-black text-slate-900">{item.file.name}</p><p className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-400">{item.kind} · {Math.max(1, Math.round(item.file.size / 1024))} KB</p></div>
                    </button>
                    <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
                      <label className="flex items-center gap-2 text-xs font-bold text-slate-500"><input type="checkbox" checked={isSelected} onChange={() => toggleSelected(item.id)} /> Select</label>
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => void shareFiles([item])} className="rounded-full p-2 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600" aria-label={'Share ' + item.file.name}><Share2 className="h-4 w-4" /></button>
                        {item.kind === 'image' && <button type="button" onClick={() => void postImageToStore(item)} className="rounded-full px-2 py-1 text-[10px] font-bold text-emerald-700 hover:bg-emerald-50" title="Use this image in Unique Store">Store</button>}
                        {item.parentHandle ? <button type="button" disabled={deleting.includes(item.id)} onClick={() => void permanentDelete(item)} className="rounded-full p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40" aria-label={"Permanently delete " + item.file.name}><Trash2 className="h-4 w-4" /></button> : <button type="button" onClick={() => removeMedia(item.id)} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-red-500" aria-label="Remove from UniqueMedia"><X className="h-4 w-4" /></button>}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {nativeHasMore && <div className="mt-4 text-center"><button type="button" onClick={() => void loadMoreNativeMedia()} disabled={nativeLoadingMore} className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{nativeLoadingMore ? 'Loading phone media…' : 'Load more phone media'}</button></div>}

        <section className="mt-6">
          <div className="mb-3 px-1">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">Personal data</p>
            <h2 className="text-xl font-black text-slate-950">Contacts</h2>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3"><Users className="h-5 w-5 text-emerald-600" /><div><h3 className="font-black text-slate-900">Contact access</h3><p className="text-xs text-slate-500">Contact search remains permission-controlled by the device.</p></div></div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input value={contactSearch} onChange={(event) => setContactSearch(event.target.value)} placeholder="Search contacts" className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none" />
            <button type="button" onClick={() => setContactMessage(contactSearch.trim() ? 'Ready to search permitted contacts for “' + contactSearch.trim() + '”.' : 'Enter a contact name or number to search.')} className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-bold text-white">Search</button>
          </div>
          {contactMessage && <p className="mt-3 text-xs font-semibold text-emerald-700">{contactMessage}</p>}
          <div className="mt-5 rounded-3xl border border-emerald-100 bg-emerald-50 p-4">
            <div className="flex items-center gap-3"><Cloud className="h-5 w-5 text-emerald-700" /><div><h3 className="font-black text-emerald-950">Contact Backup & Auto-Sync</h3><p className="text-xs text-emerald-900">Register and explicitly enable contact backup to keep your contacts synchronized across your signed-in devices.</p></div></div>
            <AuthActionGate>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => void backupToCloud()} className="rounded-2xl bg-white px-3 py-3 text-sm font-bold text-emerald-900">Back up contacts</button>
                <button type="button" onClick={() => void restoreLatestCloudBackup()} className="rounded-2xl bg-emerald-700 px-3 py-3 text-sm font-bold text-white">Restore contacts</button>
              </div>
            </AuthActionGate>
            {cloudProgress > 0 && <div className="mt-3 h-2 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full bg-emerald-500" style={{ width: cloudProgress + '%' }} /></div>}
            {cloudMessage && <p className="mt-3 text-xs font-semibold text-emerald-700">{cloudMessage}</p>}
            <p className="mt-3 text-[11px] leading-5 text-emerald-800/70">Automatic synchronization should only run after the user enables backup and grants contact permission.</p>
          </div>
          </div>
        </section>

        <section className="mt-6">
          <div className="mb-3 px-1">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">Actions</p>
            <h2 className="text-xl font-black text-slate-950">Sharing</h2>
          </div>
          <div>
          <div className="rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3"><Smartphone className="h-5 w-5 text-emerald-600" /><div><h2 className="font-black text-slate-900">UniqueShare</h2><p className="text-xs text-slate-500">Select one or many files and hand them to your device's secure sharing system.</p></div></div>
            <button type="button" disabled={!selected.length} onClick={() => void shareFiles(media.filter((item) => selected.includes(item.id)))} className="mt-4 w-full rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">Share {selected.length ? selected.length + ' selected' : 'selected media'}</button>
            {shareMessage && <p className="mt-3 text-xs font-semibold text-emerald-700">{shareMessage}</p>}
            <p className="mt-3 text-[11px] leading-5 text-slate-400">This release uses the supported Web Share/File Share capability. A dedicated Unique ID-to-Unique ID transfer channel can be added next without replacing this path.</p>
          </div>

                    </div>
          </div>
        </section>

        <p className="mt-5 text-center text-xs font-semibold text-slate-400">Guest access is free. Login is only required when an action needs protected cloud/user data.</p>
      </div>

      {player && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-3 sm:p-8" role="dialog" aria-modal="true" aria-label="UniqueMedia player">
          <button type="button" onClick={() => setPlayer(null)} className="absolute right-4 top-4 z-10 rounded-full bg-white/10 p-3 text-white backdrop-blur hover:bg-white/20" aria-label="Close player"><X className="h-5 w-5" /></button>
          <div className="flex h-full w-full max-w-6xl flex-col justify-center">
            <div className="mb-3 flex items-center justify-between gap-3 px-1 text-white"><div className="min-w-0"><p className="truncate text-sm font-black">{player.file.name}</p><p className="text-xs text-white/50">{player.kind} · {formatBytes(player.file.size)}</p></div><Volume2 className="h-4 w-4 text-white/70" /></div>
            <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-3xl bg-black">
              {player.kind === 'image' ? <img src={player.url} alt={player.file.name} className={'max-h-full max-w-full rounded-2xl object-' + playerFit} /> : player.kind === 'video' && !videoAudioMode ? <div className="relative flex h-full w-full items-center justify-center"><video ref={playerVideoRef} key={player.id + '-video'} src={player.url} controls autoPlay={isPlaying} playsInline className={'max-h-full max-w-full rounded-2xl object-' + playerFit} style={{ maxHeight: 'calc(100vh - 150px)' }} onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} onLoadedMetadata={(event) => { event.currentTarget.playbackRate = playerRate; }} /></div> : player.kind === 'video' && videoAudioMode ? <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-white/10 p-8 text-white shadow-2xl"><div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-emerald-500/15"><Music2 className="h-12 w-12 text-emerald-400" /></div><p className="mt-6 text-center text-lg font-black">Playing video as audio</p><p className="mt-1 text-center text-xs text-white/50">Keep UniqueMedia in the background while the audio continues when your browser/OS permits background media playback.</p><audio key={player.id + '-audio'} src={player.url} controls autoPlay={isPlaying} className="mt-8 w-full" onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} /></div> : player.kind === 'audio' ? <div className="w-full max-w-2xl rounded-3xl bg-white/10 p-8 text-white"><Music2 className="mx-auto h-20 w-20 text-emerald-400" /><p className="mt-6 text-center text-lg font-black">{player.file.name}</p><audio src={player.url} controls autoPlay={isPlaying} className="mt-8 w-full" onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} /></div> : <div className="text-center text-white"><FileText className="mx-auto h-20 w-20 text-emerald-400" /><p className="mt-4 font-black">{player.file.name}</p></div>}
            </div>
            {(player.kind === 'video' || player.kind === 'audio') && <div className="mt-3 flex flex-wrap items-center justify-center gap-2"><button type="button" onClick={() => setIsPlaying((value) => !value)} className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-black text-black">{isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}{isPlaying ? 'Pause' : 'Play'}</button>{player.kind === 'video' && <><button type="button" onClick={() => seekPlayer(-10)} className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-3 text-sm font-bold text-white backdrop-blur">↶ 10s</button><button type="button" onClick={() => seekPlayer(10)} className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-3 text-sm font-bold text-white backdrop-blur">10s ↷</button><button type="button" onClick={changePlayerRate} className="rounded-full border border-white/20 bg-white/10 px-4 py-3 text-sm font-bold text-white">{playerRate}×</button><button type="button" onClick={() => setPlayerFit(value => value === 'contain' ? 'cover' : 'contain')} className="rounded-full border border-white/20 bg-white/10 px-4 py-3 text-sm font-bold text-white">{playerFit === 'contain' ? 'Fit' : 'Fill'}</button><button type="button" onClick={() => void pictureInPicture()} className="rounded-full border border-white/20 bg-white/10 px-4 py-3 text-sm font-bold text-white">PiP</button><button type="button" onClick={() => void togglePlayerFullscreen()} className="rounded-full border border-white/20 bg-white/10 px-4 py-3 text-sm font-bold text-white">{playerFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</button><button type="button" onClick={toggleVideoAudioMode} className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-5 py-3 text-sm font-bold text-white backdrop-blur hover:bg-white/15">{videoAudioMode ? <Play className="h-4 w-4" /> : <Music2 className="h-4 w-4" />}{videoAudioMode ? 'Return to video' : 'Play as audio'}</button></>}</div>}
          </div>
        </div>
      )}
    </main>
  );
}
