import React, { useMemo, useState } from 'react';
import { FileText, Image as ImageIcon, Music2, Play, Search, Users, Upload, X, Share2, Cloud, Download, Smartphone } from 'lucide-react';
import { AuthActionGate } from '../components/auth/AuthActionGate';

type MediaKind = 'all' | 'video' | 'audio' | 'image' | 'pdf';

type LocalMedia = {
  id: string;
  file: File;
  kind: Exclude<MediaKind, 'all'>;
  url: string;
};

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

export default function UniqueMediaPage() {
  const [media, setMedia] = useState<LocalMedia[]>([]);
  const [activeKind, setActiveKind] = useState<MediaKind>('all');
  const [search, setSearch] = useState('');
  const [contactSearch, setContactSearch] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [shareMessage, setShareMessage] = useState('');

  const filteredMedia = useMemo(() => {
    const term = search.trim().toLowerCase();
    return media.filter((item) => {
      const matchesKind = activeKind === 'all' || item.kind === activeKind;
      const matchesSearch = !term || item.file.name.toLowerCase().includes(term);
      return matchesKind && matchesSearch;
    });
  }, [activeKind, media, search]);

  const addFiles = (files: FileList | null) => {
    if (!files?.length) return;
    const next: LocalMedia[] = [];
    Array.from(files).forEach((file) => {
      const kind = kindForFile(file);
      if (!kind) return;
      next.push({ id: crypto.randomUUID(), file, kind, url: URL.createObjectURL(file) });
    });
    if (next.length) setMedia((current) => [...next, ...current]);
  };

  const removeMedia = (id: string) => {
    setMedia((current) => {
      const item = current.find((entry) => entry.id === id);
      if (item) URL.revokeObjectURL(item.url);
      return current.filter((entry) => entry.id !== id);
    });
  };

  const shareMedia = async (item: LocalMedia) => {
    try {
      if (navigator.share && navigator.canShare?.({ files: [item.file] })) {
        await navigator.share({ title: item.file.name, files: [item.file] });
        setShareMessage('Ready to share from your device.');
        return;
      }
      const link = document.createElement('a');
      link.href = item.url;
      link.download = item.file.name;
      link.click();
      setShareMessage('Downloaded for sharing. Your device can send it over Wi‑Fi, hotspot or another available sharing method.');
    } catch (error) {
      if ((error as DOMException)?.name !== 'AbortError') setShareMessage('This device or browser does not support direct file sharing here.');
    }
  };

  const openMedia = (item: LocalMedia) => {
    if (item.kind === 'pdf') {
      window.open(item.url, '_blank', 'noopener,noreferrer');
      return;
    }
    if (item.kind === 'image' || item.kind === 'video' || item.kind === 'audio') {
      window.open(item.url, '_blank', 'noopener,noreferrer');
    }
  };

  const categories: Array<[MediaKind, string]> = [
    ['all', 'All'],
    ['video', 'Videos'],
    ['audio', 'Music & Audio'],
    ['image', 'Images'],
    ['pdf', 'PDF Reader'],
  ];

  return (
    <main className="min-h-full overflow-y-auto bg-slate-50 pb-24">
      <div className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-8">
        <header className="rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Unique One</p>
              <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950">UniqueMedia</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                Your free, offline-first media space for local videos, music, images and PDFs.
                Your device files stay on your device unless you explicitly choose to share them elsewhere.
              </p>
            </div>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800">
              <Upload className="h-4 w-4" />
              Add media
              <input
                type="file"
                multiple
                accept="video/*,audio/*,image/*,application/pdf"
                className="hidden"
                onChange={(event) => {
                  addFiles(event.target.files);
                  event.currentTarget.value = '';
                }}
              />
            </label>
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <label className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
              <Search className="h-4 w-4 shrink-0 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search your local media"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none"
              />
            </label>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {categories.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setActiveKind(value)}
                  className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold transition ${activeKind === value ? 'bg-emerald-600 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:border-emerald-300'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </header>

        <section className="mt-5">
          {filteredMedia.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center">
              <Play className="mx-auto h-10 w-10 text-emerald-500" />
              <h2 className="mt-4 text-lg font-black text-slate-900">Your media space is ready</h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                Add local videos, audio, images or PDFs. Nothing is uploaded by this page.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredMedia.map((item) => {
                const Icon = iconForKind(item.kind);
                return (
                  <article key={item.id} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                    <button type="button" onClick={() => openMedia(item)} className="block w-full text-left">
                      <div className="flex h-44 items-center justify-center bg-slate-100">
                        {item.kind === 'image' ? (
                          <img src={item.url} alt={item.file.name} className="h-full w-full object-cover" />
                        ) : item.kind === 'video' ? (
                          <video src={item.url} className="h-full w-full object-cover" muted playsInline />
                        ) : (
                          <Icon className="h-12 w-12 text-emerald-600" />
                        )}
                      </div>
                      <div className="p-4">
                        <p className="truncate text-sm font-black text-slate-900">{item.file.name}</p>
                        <p className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-400">{item.kind}</p>
                      </div>
                    </button>
                    <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
                      <span className="text-xs text-slate-400">{Math.max(1, Math.round(item.file.size / 1024))} KB</span>
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => shareMedia(item)} className="rounded-full p-2 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600" aria-label={`Share ${item.file.name}`}>
                          <Share2 className="h-4 w-4" />
                        </button>
                      <button type="button" onClick={() => removeMedia(item.id)} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-red-500" aria-label="Remove from UniqueMedia">
                        <X className="h-4 w-4" />
                      </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="mt-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-emerald-600" />
            <div>
              <h2 className="font-black text-slate-900">Contacts</h2>
              <p className="text-xs text-slate-500">A free local contact-search entry point; device contact access remains permission-controlled.</p>
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input
              value={contactSearch}
              onChange={(event) => setContactSearch(event.target.value)}
              placeholder="Search contacts"
              className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-emerald-400"
            />
            <button
              type="button"
              onClick={() => setContactMessage(contactSearch.trim() ? `Ready to search your permitted contacts for “${contactSearch.trim()}”.` : 'Enter a contact name or number to search.')}
              className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-bold text-white"
            >
              Search
            </button>
          </div>
          {contactMessage && <p className="mt-3 text-xs font-semibold text-emerald-700">{contactMessage}</p>}
        </section>

        <p className="mt-5 text-center text-xs font-semibold text-slate-400">
          Guest access is free. UniqueMedia does not require Unique One login to browse or use local media.
        </p>
      </div>
    </main>
  );
}
