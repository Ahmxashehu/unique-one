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
        const handle = await getStoredDeviceMediaDirectory();        if (!handle || cancelled) return;
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

  return (
    <main className="min-h-full overflow-y-auto bg-slate-50 pb-24">
      <div className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-8">
        <header className="relative rounded-3xl border border-emerald-100 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex w-full items-center justify-center gap-3">
            <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="Open UniqueMedia" className="group inline-flex items-center justify-center gap-3 rounded-full border border-emerald-200 bg-emerald-50 px-6 py-3 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-100 active:scale-[0.98]">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-600 text-white shadow-md ring-4 ring-emerald-100 transition group-hover:scale-105">
                <ImageIcon className="h-6 w-6" />
              </span>
              <span className="text-xl font-black tracking-tight text-slate-950">UniqueMedia</span>
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <button type="button" onClick={() => void connectDeviceMedia()} className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-bold text-white"><FolderOpen className="h-4 w-4" /> Connect phone</button>
            <Link to="/os/unique-share" className="inline-flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800"><Share2 className="h-4 w-4" /> UniqueShare</Link>
          </div>
        </header>

        <section className="mt-4 rounded-3xl border border-slate-200 bg-white p-3 shadow-sm">
          <nav aria-label="UniqueMedia categories" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {categories.map(([value, label]) => {
              const Icon = iconForKind(value);
              return (
                <button key={value} type="button" onClick={() => setActiveKind(value)} className={'flex items-center justify-center gap-2 rounded-2xl px-4 py-4 text-sm font-black transition ' + (activeKind === value ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-50 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700')}>
                  <Icon className="h-5 w-5" /> {label}
                </button>
              );
            })}
          </nav>
        </section>

        <section className="mt-5">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">Media library</p>
              <h2 className="text-2xl font-black text-slate-950">{categories.find(([value]) => value === activeKind)?.[1]}</h2>
              <p className="text-sm text-slate-500">{filteredMedia.length} item{filteredMedia.length === 1 ? '' : 's'} available on this device.</p>
            </div>
            <label className="flex min-w-[220px] items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-3 shadow-sm">
              <Search className="h-4 w-4 shrink-0 text-slate-400" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={'Search ' + (categories.find(([value]) => value === activeKind)?.[1] || 'media').toLowerCase()} className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
            </label>
          </div>

          {deviceMessage && <p className="mb-3 rounded-2xl bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-800">{deviceMessage}</p>}

          {filteredMedia.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center">
              <FolderOpen className="mx-auto h-12 w-12 text-emerald-500" />
              <h3 className="mt-4 text-lg font-black text-slate-900">No {categories.find(([value]) => value === activeKind)?.[1].toLowerCase()} found</h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">Connect your phone to load this category. Your files stay on the device unless you explicitly use a protected cloud action.</p>
              <button type="button" onClick={() => void connectDeviceMedia()} className="mt-5 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white">Connect phone media</button>
            </div>
          ) : (
            <>
              {activeKind === 'image' && (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">                  {filteredMedia.map((item) => {
                    const isSelected = selected.includes(item.id);
                    return (
                      <article key={item.id} className={'group overflow-hidden rounded-2xl border bg-white shadow-sm ' + (isSelected ? 'border-emerald-500 ring-2 ring-emerald-100' : 'border-slate-200')}>
                        <button type="button" onClick={() => openMedia(item)} className="relative block aspect-square w-full overflow-hidden bg-slate-100">
                          <img src={item.url} alt={item.file.name} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
                          <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-1 text-[10px] font-bold text-white">{formatBytes(item.file.size)}</span>
                        </button>
                        <div className="flex items-center justify-between gap-2 p-2">
                          <p className="min-w-0 flex-1 truncate text-xs font-bold text-slate-800">{item.file.name}</p>
                          <button type="button" onClick={() => void shareFiles([item])} className="rounded-full p-2 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600" aria-label={'Share ' + item.file.name}><Share2 className="h-4 w-4" /></button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}

              {activeKind === 'video' && (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredMedia.map((item) => (
                    <article key={item.id} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                      <button type="button" onClick={() => openMedia(item)} className="block w-full text-left">
                        <div className="relative aspect-video bg-slate-950"><video src={item.url} muted playsInline preload="metadata" className="h-full w-full object-cover" /><span className="absolute bottom-3 left-3 rounded-full bg-black/70 px-3 py-1 text-xs font-bold text-white"><Play className="mr-1 inline h-3 w-3" /> Video</span></div>
                        <div className="p-4"><p className="truncate text-sm font-black text-slate-900">{item.file.name}</p><p className="mt-1 text-xs text-slate-400">{formatBytes(item.file.size)}</p></div>
                      </button>
                    </article>
                  ))}
                </div>
              )}

              {activeKind === 'audio' && (
                <div className="space-y-2">
                  {filteredMedia.map((item, index) => (
                    <article key={item.id} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                      <button type="button" onClick={() => openMedia(item)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><Music2 className="h-6 w-6" /></span>
                        <span className="min-w-0"><span className="block truncate text-sm font-black text-slate-900">{item.file.name}</span><span className="text-xs text-slate-400">Track {index + 1} · {formatBytes(item.file.size)}</span></span>
                      </button>
                      <button type="button" onClick={() => void shareFiles([item])} className="rounded-full p-2 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600" aria-label={'Share ' + item.file.name}><Share2 className="h-4 w-4" /></button>
                    </article>
                  ))}
                </div>
              )}

              {activeKind === 'pdf' && (
                <div className="space-y-2">
                  {filteredMedia.map((item) => (
                    <article key={item.id} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <button type="button" onClick={() => openMedia(item)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600"><FileText className="h-6 w-6" /></span>
                        <span className="min-w-0"><span className="block truncate text-sm font-black text-slate-900">{item.file.name}</span><span className="text-xs text-slate-400">PDF · {formatBytes(item.file.size)}</span></span>
                      </button>
                      <button type="button" onClick={() => openMedia(item)} className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-bold text-white">Open</button>
                    </article>
                  ))}
                </div>
              )}
            </>
          )}
        </section>

        {nativeHasMore && <div className="mt-5 text-center"><button type="button" onClick={() => void loadMoreNativeMedia()} disabled={nativeLoadingMore} className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{nativeLoadingMore ? 'Loading…' : 'Load more'}</button></div>}
      </div>

      {player && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-3 sm:p-8" role="dialog" aria-modal="true" aria-label="UniqueMedia player">
          <button type="button" onClick={() => setPlayer(null)} className="absolute right-4 top-4 z-10 rounded-full bg-white/10 p-3 text-white backdrop-blur hover:bg-white/20" aria-label="Close player"><X className="h-5 w-5" /></button>
          <div className="flex h-full w-full max-w-6xl flex-col justify-center">
            <div className="mb-3 flex items-center justify-between gap-3 px-1 text-white"><div className="min-w-0"><p className="truncate text-sm font-black">{player.file.name}</p><p className="text-xs text-white/50">{player.kind} · {formatBytes(player.file.size)}</p></div><Volume2 className="h-4 w-4 text-white/70" /></div>
            <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-3xl bg-black">
              {player.kind === 'image' ? <img src={player.url} alt={player.file.name} className={'max-h-full max-w-full rounded-2xl object-' + playerFit} /> : player.kind === 'video' && !videoAudioMode ? <div className="relative flex h-full w-full items-center justify-center"><video ref={playerVideoRef} key={player.id + '-video'} src={player.url} controls autoPlay={isPlaying} playsInline className={'max-h-full max-w-full rounded-2xl object-' + playerFit} style={{ maxHeight: 'calc(100vh - 150px)' }} onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} onLoadedMetadata={(event) => { event.currentTarget.playbackRate = playerRate; }} /></div> : player.kind === 'video' && videoAudioMode ? <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-white/10 p-8 text-white"><div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-emerald-500/15"><Music2 className="h-12 w-12 text-emerald-400" /></div><p className="mt-6 text-center text-lg font-black">Playing video as audio</p><audio key={player.id + '-audio'} src={player.url} controls autoPlay={isPlaying} className="mt-8 w-full" onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} /></div> : player.kind === 'audio' ? <div className="w-full max-w-2xl rounded-3xl bg-white/10 p-8 text-white"><Music2 className="mx-auto h-20 w-20 text-emerald-400" /><p className="mt-6 text-center text-lg font-black">{player.file.name}</p><audio src={player.url} controls autoPlay={isPlaying} className="mt-8 w-full" onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} /></div> : <div className="w-full max-w-4xl overflow-hidden rounded-2xl bg-white"><iframe title={player.file.name} src={player.url} className="h-[75vh] w-full" /></div>}
            </div>
            {(player.kind === 'video' || player.kind === 'audio') && <div className="mt-3 flex flex-wrap items-center justify-center gap-2"><button type="button" onClick={() => setIsPlaying((value) => !value)} className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-black text-black">{isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}{isPlaying ? 'Pause' : 'Play'}</button>{player.kind === 'video' && <><button type="button" onClick={() => seekPlayer(-10)} className="rounded-full border border-white/20 bg-white/10 px-4 py-3 text-sm font-bold text-white">↶ 10s</button><button type="button" onClick={() => seekPlayer(10)} className="rounded-full border border-white/20 bg-white/10 px-4 py-3 text-sm font-bold text-white">10s ↷</button><button type="button" onClick={changePlayerRate} className="rounded-full border border-white/20 bg-white/10 px-4 py-3 text-sm font-bold text-white">{playerRate}×</button><button type="button" onClick={() => setPlayerFit(value => value === 'contain' ? 'cover' : 'contain')} className="rounded-full border border-white/20 bg-white/10 px-4 py-3 text-sm font-bold text-white">{playerFit === 'contain' ? 'Fit' : 'Fill'}</button><button type="button" onClick={() => void pictureInPicture()} className="rounded-full border border-white/20 bg-white/10 px-4 py-3 text-sm font-bold text-white">PiP</button><button type="button" onClick={() => void togglePlayerFullscreen()} className="rounded-full border border-white/20 bg-white/10 px-4 py-3 text-sm font-bold text-white">{playerFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</button><button type="button" onClick={toggleVideoAudioMode} className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-5 py-3 text-sm font-bold text-white">{videoAudioMode ? <Play className="h-4 w-4" /> : <Music2 className="h-4 w-4" />}{videoAudioMode ? 'Return to video' : 'Play as audio'}</button></>}</div>}
          </div>
        </div>
      )}
    </main>
  );
}