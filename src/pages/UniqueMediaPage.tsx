import React, { useMemo, useState } from 'react';
import { Cloud, FileText, FolderOpen, Image as ImageIcon, Music2, Pause, Play, Search, Share2, Smartphone, Trash2, Upload, Users, Volume2, X } from 'lucide-react';
import { auth, storage } from '../lib/firebase';
import AuthActionGate from '../components/auth/AuthActionGate';
import { getDownloadURL, listAll, ref, uploadBytesResumable } from 'firebase/storage';
import { DeviceMediaItem, formatBytes, permanentlyDeleteDeviceMedia, pickDeviceMediaDirectory, supportsDeviceDirectoryAccess } from '../lib/media/deviceMedia';

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
  const [activeKind, setActiveKind] = useState<MediaKind>('all');
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
  const [storageInfo, setStorageInfo] = useState<{ usage: number; quota: number } | null>(null);
  const [deleting, setDeleting] = useState<string[]>([]);

  const filteredMedia = useMemo(() => {
    const term = search.trim().toLowerCase();
    return media.filter((item) => {
      const matchesKind = activeKind === 'all' || item.kind === activeKind;
      return matchesKind && (!term || item.file.name.toLowerCase().includes(term));
    });
  }, [activeKind, media, search]);

  const addFiles = (files: FileList | null) => {
    if (!files?.length) return;
    const next: LocalMedia[] = [];
    Array.from(files).forEach((file) => {
      const kind = kindForFile(file);
      if (kind) next.push({ id: crypto.randomUUID(), file, kind, url: URL.createObjectURL(file) });
    });
    if (next.length) setMedia((current) => [...next, ...current]);
  };



  const connectDeviceMedia = async () => {
    if (!supportsDeviceDirectoryAccess()) {
      setDeviceMessage('This browser does not expose direct device-folder access. Use Add media or the native Android build for deeper MediaStore integration.');
      return;
    }
    try {
      setDeviceMessage('Choose a phone media folder. UniqueMedia will scan only the folder you authorize.');
      const result = await pickDeviceMediaDirectory();
      if (!result) return;
      setMedia((current) => {
        const existing = new Set(current.map((item) => item.file.name + ':' + item.file.size));
        return [...result.items.filter((item) => !existing.has(item.file.name + ':' + item.file.size)), ...current];
      });
      setDeviceMessage(result.items.length + ' authorized media item' + (result.items.length === 1 ? '' : 's') + ' loaded from ' + result.rootName + '.');
    } catch (error) {
      if ((error as DOMException)?.name !== 'AbortError') setDeviceMessage('Device media access was not completed. Check the permission prompt and try again.');
    }
  };

  const refreshStorageInfo = async () => {
    try {
      if (!navigator.storage?.estimate) {
        setDeviceMessage('Storage statistics are not exposed by this browser.');
        return;
      }
      const estimate = await navigator.storage.estimate();
      setStorageInfo({ usage: estimate.usage || 0, quota: estimate.quota || 0 });
      setDeviceMessage('Browser storage information refreshed. Phone-wide storage requires the native Android build.');
    } catch {
      setDeviceMessage('Storage information could not be read on this device.');
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

  const shareFiles = async (items: LocalMedia[]) => {
    if (!items.length) {
      setShareMessage('Select at least one media file first.');
      return;
    }
    try {
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
    setIsPlaying(item.kind === 'video' || item.kind === 'audio');
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
      setCloudMessage('Cloud backup complete. Your media bytes and manifest are stored in your protected UniqueMedia backup.');
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
      setCloudMessage(restored.length + ' media file' + (restored.length === 1 ? '' : 's') + ' restored from your latest cloud backup.');
    } catch {
      setCloudMessage('Restore could not complete. Check Storage access and your connection.');
    }
  };

  const categories: Array<[MediaKind, string]> = [
    ['all', 'All'], ['video', 'Videos'], ['audio', 'Music & Audio'], ['image', 'Images'], ['pdf', 'PDF Reader'],
  ];

  return (
    <main className="min-h-full overflow-y-auto bg-slate-50 pb-24">
      <div className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-8">
        <header className="rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Unique One</p>
              <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950">UniqueMedia</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">A free media workspace for videos, music, images and PDFs. Local media stays on this device until you explicitly share or back it up.</p>
            </div>
            <div className="flex flex-wrap gap-2"><button type="button" onClick={() => void connectDeviceMedia()} className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-bold text-white"><FolderOpen className="h-4 w-4" /> Connect device media</button><label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white">
              <Upload className="h-4 w-4" /> Add media
              <input type="file" multiple accept="video/*,audio/*,image/*,application/pdf" className="hidden" onChange={(event) => { addFiles(event.target.files); event.currentTarget.value = ''; }} />
            </label></div>
          <div className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-xs leading-5 text-emerald-900"><strong>Permission control:</strong> UniqueMedia only reads folders you explicitly authorize. Supported browsers can request write access for permanent deletion. Full phone-wide Android MediaStore access belongs in the native build.</div>
          {deviceMessage && <p className="mt-3 text-xs font-semibold text-emerald-700">{deviceMessage}</p>}
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <label className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
              <Search className="h-4 w-4 shrink-0 text-slate-400" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search your local media" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
            </label>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {categories.map(([value, label]) => <button key={value} type="button" onClick={() => setActiveKind(value)} className={'shrink-0 rounded-full px-4 py-2 text-xs font-bold ' + (activeKind === value ? 'bg-emerald-600 text-white' : 'border border-slate-200 bg-white text-slate-600')}>{label}</button>)}
            </div>
          </div>
        </header>

        <section className="mt-5 grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:col-span-2">
            <div className="flex items-center justify-between gap-3"><div><h2 className="font-black text-slate-900">Phone Storage Manager</h2><p className="text-xs text-slate-500">Storage statistics exposed by this app/browser.</p></div><button type="button" onClick={() => void refreshStorageInfo()} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold">Refresh</button></div>
            <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: (storageInfo?.quota ? Math.min(100, Math.round(((storageInfo.usage || 0) / storageInfo.quota) * 100)) : 0) + '%' }} /></div>
            <div className="mt-2 flex justify-between text-xs font-bold text-slate-500"><span>{storageInfo ? formatBytes(storageInfo.usage) + ' used' : 'Storage not measured'}</span><span>{storageInfo ? formatBytes(storageInfo.quota) + ' app quota' : 'Tap refresh'}</span></div>
          </div>
          <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-5"><Smartphone className="h-6 w-6 text-emerald-700" /><h2 className="mt-3 font-black text-emerald-950">Manage space</h2><p className="mt-2 text-xs leading-5 text-emerald-900">Review media, preview it, share it, or permanently delete items from folders where you granted write permission.</p></div>
        </section>

        <section className="mt-5">
          {filteredMedia.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center">
              <Play className="mx-auto h-10 w-10 text-emerald-500" />
              <h2 className="mt-4 text-lg font-black text-slate-900">Your media space is ready</h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">Add local videos, audio, images or PDFs. Nothing is uploaded automatically.</p>
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
                        {item.parentHandle ? <button type="button" disabled={deleting.includes(item.id)} onClick={() => void permanentDelete(item)} className="rounded-full p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40" aria-label={"Permanently delete " + item.file.name}><Trash2 className="h-4 w-4" /></button> : <button type="button" onClick={() => removeMedia(item.id)} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-red-500" aria-label="Remove from UniqueMedia"><X className="h-4 w-4" /></button>}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="mt-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3"><Users className="h-5 w-5 text-emerald-600" /><div><h2 className="font-black text-slate-900">Contacts</h2><p className="text-xs text-slate-500">Contact search remains permission-controlled by the device.</p></div></div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input value={contactSearch} onChange={(event) => setContactSearch(event.target.value)} placeholder="Search contacts" className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none" />
            <button type="button" onClick={() => setContactMessage(contactSearch.trim() ? 'Ready to search permitted contacts for “' + contactSearch.trim() + '”.' : 'Enter a contact name or number to search.')} className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-bold text-white">Search</button>
          </div>
          {contactMessage && <p className="mt-3 text-xs font-semibold text-emerald-700">{contactMessage}</p>}
        </section>

        <section className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3"><Smartphone className="h-5 w-5 text-emerald-600" /><div><h2 className="font-black text-slate-900">UniqueShare</h2><p className="text-xs text-slate-500">Select one or many files and hand them to your device's secure sharing system.</p></div></div>
            <button type="button" disabled={!selected.length} onClick={() => void shareFiles(media.filter((item) => selected.includes(item.id)))} className="mt-4 w-full rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">Share {selected.length ? selected.length + ' selected' : 'selected media'}</button>
            {shareMessage && <p className="mt-3 text-xs font-semibold text-emerald-700">{shareMessage}</p>}
            <p className="mt-3 text-[11px] leading-5 text-slate-400">This release uses the supported Web Share/File Share capability. A dedicated Unique ID-to-Unique ID transfer channel can be added next without replacing this path.</p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3"><Cloud className="h-5 w-5 text-emerald-600" /><div><h2 className="font-black text-slate-900">Cloud Backup & Restore</h2><p className="text-xs text-slate-500">Real media-byte backup to your protected Firebase Storage space.</p></div></div>
            <AuthActionGate>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => void backupToCloud()} className="rounded-2xl border border-slate-200 px-3 py-3 text-sm font-bold text-slate-800">Backup</button>
                <button type="button" onClick={() => void restoreLatestCloudBackup()} className="rounded-2xl bg-slate-950 px-3 py-3 text-sm font-bold text-white">Restore latest</button>
              </div>
            </AuthActionGate>
            {cloudProgress > 0 && <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: cloudProgress + '%' }} /></div>}
            {cloudMessage && <p className="mt-3 text-xs font-semibold text-emerald-700">{cloudMessage}</p>}
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
              {player.kind === 'image' ? <img src={player.url} alt={player.file.name} className="max-h-full max-w-full object-contain" /> : player.kind === 'video' ? <video src={player.url} controls autoPlay={isPlaying} playsInline className="max-h-full max-w-full rounded-2xl" onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} /> : player.kind === 'audio' ? <div className="w-full max-w-2xl rounded-3xl bg-white/10 p-8 text-white"><Music2 className="mx-auto h-20 w-20 text-emerald-400" /><p className="mt-6 text-center text-lg font-black">{player.file.name}</p><audio src={player.url} controls autoPlay={isPlaying} className="mt-8 w-full" /></div> : <div className="text-center text-white"><FileText className="mx-auto h-20 w-20 text-emerald-400" /><p className="mt-4 font-black">{player.file.name}</p></div>}
            </div>
            {(player.kind === 'video' || player.kind === 'audio') && <div className="mt-3 flex items-center justify-center"><button type="button" onClick={() => setIsPlaying((value) => !value)} className="rounded-full bg-white px-5 py-3 text-sm font-black text-black">{isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}</button></div>}
          </div>
        </div>
      )}
    </main>
  );
}
