import React, { useMemo, useState } from 'react';
import { Cloud, Download, FileText, Image as ImageIcon, Music2, Play, Search, Share2, Smartphone, Upload, Users, X } from 'lucide-react';
import { auth, storage } from '../lib/firebase';
import AuthActionGate from '../components/auth/AuthActionGate';
import { getDownloadURL, listAll, ref, uploadBytesResumable } from 'firebase/storage';

type MediaKind = 'all' | 'video' | 'audio' | 'image' | 'pdf';
type LocalMedia = { id: string; file: File; kind: Exclude<MediaKind, 'all'>; url: string };

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
    window.open(item.url, '_blank', 'noopener,noreferrer');
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
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-bold text-white">
              <Upload className="h-4 w-4" /> Add media
              <input type="file" multiple accept="video/*,audio/*,image/*,application/pdf" className="hidden" onChange={(event) => { addFiles(event.target.files); event.currentTarget.value = ''; }} />
            </label>
          </div>
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
                        <button type="button" onClick={() => removeMedia(item.id)} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-red-500" aria-label="Remove from UniqueMedia"><X className="h-4 w-4" /></button>
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
    </main>
  );
}
