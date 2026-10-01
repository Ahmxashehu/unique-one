import React, { useEffect, useState } from 'react';
import { Search as SearchIcon, Filter, Sparkles } from 'lucide-react';

const SEARCH_PLACEHOLDERS = [
  'Search businesses, products, services…',
  'Search people, places, and opportunities…',
  'Search across Unique One…',
  'What are you looking for today?'
];

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [placeholderIndex, setPlaceholderIndex] = useState(0);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setPlaceholderIndex((current) => (current + 1) % SEARCH_PLACEHOLDERS.length);
    }, 2500);

    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 space-y-8">
      <style>{`
        @keyframes globalSearchPlaceholder {
          0% { opacity: 0; transform: translateY(5px); }
          18%, 82% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-5px); }
        }
        @keyframes globalSearchGlow {
          0%, 100% { opacity: .35; transform: scale(.92); }
          50% { opacity: .75; transform: scale(1.08); }
        }
        @keyframes globalSearchShine {
          0% { transform: translateX(-140%); opacity: 0; }
          35% { opacity: .7; }
          70%, 100% { transform: translateX(320%); opacity: 0; }
        }
      `}</style>

      <div className="max-w-3xl mx-auto text-center space-y-6">
        <div className="flex items-center justify-center gap-3">
          <span className="relative flex h-11 w-11 items-center justify-center rounded-full bg-slate-950 text-[12px] font-black text-emerald-300 shadow-[0_0_20px_rgba(52,211,153,.28)]">
            U1
            <span className="absolute inset-0 rounded-full border border-emerald-300/45" />
            <span
              className="absolute -inset-2 rounded-full bg-emerald-300/15 blur-md"
              style={{ animation: 'globalSearchGlow 2.4s ease-in-out infinite' }}
              aria-hidden="true"
            />
          </span>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Global Search
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex min-w-0 flex-1 overflow-hidden rounded-[26px] border border-slate-200 bg-slate-50/90 p-1.5 shadow-[0_8px_30px_rgba(15,23,42,.07)] transition-all focus-within:border-emerald-300 focus-within:bg-white focus-within:shadow-[0_8px_32px_rgba(16,185,129,.12)]">
            <span
              className="pointer-events-none absolute inset-y-0 left-0 w-1/3 -translate-x-full bg-gradient-to-r from-transparent via-emerald-200/35 to-transparent"
              style={{ animation: 'globalSearchShine 3.8s ease-in-out infinite' }}
              aria-hidden="true"
            />
            <SearchIcon className="relative ml-3 mt-3 h-5 w-5 shrink-0 text-emerald-600" />
            <div className="relative min-w-0 flex-1">
              {!query && (
                <span
                  key={placeholderIndex}
                  className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 truncate px-3 text-left text-base text-slate-400 sm:text-lg"
                  style={{ animation: 'globalSearchPlaceholder 700ms cubic-bezier(.22,1,.36,1) both' }}
                >
                  {SEARCH_PLACEHOLDERS[placeholderIndex]}
                </span>
              )}
              <input
                type="text"
                autoFocus
                aria-label="Global Search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="relative w-full bg-transparent px-3 py-3 text-base text-slate-800 outline-none placeholder:text-transparent sm:py-3.5 sm:text-lg"
              />
            </div>
          </div>
          <button
            type="button"
            aria-label="Open search filters"
            className="shrink-0 rounded-2xl border border-slate-200 bg-white p-4 text-slate-600 shadow-sm transition-all hover:-translate-y-0.5 hover:border-emerald-200 hover:text-emerald-700 hover:shadow-md"
          >
            <Filter className="h-6 w-6" />
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto">
        <div className="rounded-[24px] border border-slate-200 bg-white p-10 text-center shadow-sm sm:p-12">
          <div className="relative mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-50">
            <span
              className="absolute -inset-2 rounded-full bg-emerald-300/15 blur-xl"
              style={{ animation: 'globalSearchGlow 2.4s ease-in-out infinite' }}
              aria-hidden="true"
            />
            <Sparkles className="relative h-7 w-7 text-emerald-500" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900">Start typing to search</h3>
          <p className="mt-1 text-slate-500">
            Find people, businesses, products, services, places, and opportunities across Unique One.
          </p>
        </div>
      </div>
    </div>
  );
}
