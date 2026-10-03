import React, { useEffect, useState } from 'react';
import {
  Search as SearchIcon,
  Filter,
  Sparkles,
  ShoppingBasket,
  Shirt,
  Smartphone,
  Hammer,
  Wrench,
  Utensils,
  Truck,
  Sprout,
  GraduationCap,
  HeartPulse,
  Home,
  BriefcaseBusiness,
  CalendarDays,
  Lightbulb,
  ArrowUpRight
} from 'lucide-react';

const SEARCH_PLACEHOLDERS = [
  'Search businesses, products, services…',
  'Search people, places, and opportunities…',
  'Search across Unique One…',
  'What are you looking for today?'
];

const DISCOVERY_ITEMS = [
  { label: 'Groceries & food', detail: 'Foodstuffs, drinks, fresh produce', icon: ShoppingBasket, query: 'Groceries and food' },
  { label: 'Fashion', detail: 'Clothing, shoes, bags, accessories', icon: Shirt, query: 'Fashion and clothing' },
  { label: 'Phones & electronics', detail: 'Phones, gadgets, accessories', icon: Smartphone, query: 'Phones and electronics' },
  { label: 'Building materials', detail: 'Cement, blocks, paint, fittings', icon: Hammer, query: 'Building materials and cement' },
  { label: 'Repairs & installation', detail: 'Plumbing, electrical, appliance repair', icon: Wrench, query: 'Repair and installation services' },
  { label: 'Food & catering', detail: 'Restaurants, cooks, event catering', icon: Utensils, query: 'Food and catering services' },
  { label: 'Delivery & transport', detail: 'Dispatch, moving, rides, logistics', icon: Truck, query: 'Delivery and transport services' },
  { label: 'Agriculture', detail: 'Seeds, fertilizer, farm tools, produce', icon: Sprout, query: 'Agricultural products and services' },
  { label: 'Learning & tutoring', detail: 'Lessons, training, professional skills', icon: GraduationCap, query: 'Learning and tutoring' },
  { label: 'Health & wellbeing', detail: 'Wellness services and care providers', icon: HeartPulse, query: 'Health and wellbeing services' },
  { label: 'Home & property', detail: 'Rentals, cleaning, home services', icon: Home, query: 'Home and property services' },
  { label: 'Business services', detail: 'Printing, consulting, accounting, IT', icon: BriefcaseBusiness, query: 'Business services' },
  { label: 'Events & experiences', detail: 'Venues, decorators, photographers', icon: CalendarDays, query: 'Events and experiences' }
];

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [suggestion, setSuggestion] = useState('');
  const [submittedSuggestion, setSubmittedSuggestion] = useState('');

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setPlaceholderIndex((current) => (current + 1) % SEARCH_PLACEHOLDERS.length);
    }, 2500);

    return () => window.clearInterval(intervalId);
  }, []);

  const explore = (value: string) => {
    setQuery(value);
    setSubmittedSuggestion('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSuggestion = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedSuggestion = suggestion.trim();
    if (!trimmedSuggestion) return;
    setSubmittedSuggestion(trimmedSuggestion);
    setQuery(trimmedSuggestion);
    setSuggestion('');
  };

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
        @keyframes globalSearchSmoke {
          0%, 100% { transform: translate3d(-2%, 0, 0) scale(1); opacity: .28; }
          50% { transform: translate3d(2%, -1px, 0) scale(1.035); opacity: .55; }
        }
      `}</style>

      <div className="max-w-3xl mx-auto text-center space-y-6">
        <div className="relative mx-auto flex h-14 w-14 translate-y-1 items-center justify-center sm:h-16 sm:w-16" aria-hidden="true">
          <span className="absolute -inset-2 rounded-full bg-emerald-300/20 blur-xl" style={{ animation: 'globalSearchGlow 2.8s ease-in-out infinite' }} />
          <span className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-emerald-400 border-r-emerald-300 shadow-[0_0_14px_rgba(16,185,129,0.65)]" style={{ animationDuration: '2.4s' }} />
          <span className="absolute inset-[-2px] animate-pulse rounded-full bg-emerald-400/15 blur-md" />
          <span className="relative z-10 flex h-12 w-12 items-center justify-center rounded-full border border-white/90 bg-white text-[11px] font-black tracking-[-0.08em] text-emerald-700 shadow-sm sm:h-14 sm:w-14 sm:text-xs">U1</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Global Search
        </h1>

        <div className="flex items-center gap-2">
          <div className="relative flex min-w-0 flex-1 overflow-visible rounded-[26px]">
            <span className="pointer-events-none absolute -inset-1 rounded-[30px] bg-emerald-300/20 blur-md" aria-hidden="true" />
            <span className="pointer-events-none absolute -inset-[2px] rounded-[28px] border border-emerald-300/40 bg-gradient-to-r from-emerald-300/10 via-white/30 to-teal-300/10 blur-[1px]" style={{ animation: 'globalSearchGlow 3.8s ease-in-out infinite' }} aria-hidden="true" />
            <span className="pointer-events-none absolute -inset-2 rounded-[32px] bg-[radial-gradient(ellipse_at_center,rgba(16,185,129,0.20),transparent_68%)] blur-lg" style={{ animation: 'globalSearchSmoke 5s ease-in-out infinite' }} aria-hidden="true" />
            <div className="relative flex min-w-0 flex-1 overflow-hidden rounded-[26px] border border-emerald-200/80 bg-white/95 p-1.5 shadow-[0_0_18px_rgba(16,185,129,0.16)] backdrop-blur-xl transition-all focus-within:border-emerald-400 focus-within:bg-white focus-within:shadow-[0_0_28px_rgba(16,185,129,0.28)]">
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
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && query.trim()) {
                    setSubmittedSuggestion('');
                  }
                }}
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

      <section className="space-y-5" aria-labelledby="discover-heading">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-700">Explore Unique One</p>
            <h2 id="discover-heading" className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              What are you looking for?
            </h2>
            <p className="mt-1 text-sm text-slate-500 sm:text-base">
              Discover popular items and services, or choose a category to search.
            </p>
          </div>
          <button
            type="button"
            onClick={() => { setQuery(''); setSubmittedSuggestion(''); }}
            className="self-start text-sm font-semibold text-emerald-700 transition hover:text-emerald-800 sm:self-auto"
          >
            Browse all categories
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {DISCOVERY_ITEMS.map(({ label, detail, icon: Icon, query: categoryQuery }) => (
            <button
              key={label}
              type="button"
              onClick={() => explore(categoryQuery)}
              className="group flex min-h-[150px] flex-col items-start rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md sm:min-h-[166px] sm:p-5"
            >
              <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 transition-colors group-hover:bg-emerald-100">
                <Icon className="h-5 w-5" />
              </span>
              <span className="flex w-full items-center justify-between gap-1 text-sm font-semibold text-slate-900 sm:text-base">
                {label}
                <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:text-emerald-600" />
              </span>
              <span className="mt-1 text-xs leading-relaxed text-slate-500 sm:text-sm">{detail}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
        <div className="rounded-3xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-white p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-emerald-700 shadow-sm ring-1 ring-emerald-100">
              <Lightbulb className="h-6 w-6" />
            </span>
            <div>
              <h3 className="text-lg font-bold text-slate-900 sm:text-xl">Can’t find what you need?</h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">
                Suggest an item or service you’d like to discover on Unique One.
              </p>
            </div>
          </div>
          <form onSubmit={handleSuggestion} className="mt-5 flex flex-col gap-3 sm:flex-row">
            <input
              aria-label="Suggest an item or service"
              value={suggestion}
              onChange={(e) => setSuggestion(e.target.value)}
              placeholder="e.g. solar panel installation, local honey…"
              className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
              maxLength={120}
            />
            <button
              type="submit"
              disabled={!suggestion.trim()}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-45"
            >
              Suggest it <ArrowUpRight className="h-4 w-4" />
            </button>
          </form>
          {submittedSuggestion && (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-white px-4 py-3 text-sm text-slate-700" role="status">
              <p className="font-semibold text-emerald-800">Suggestion added to this search</p>
              <p className="mt-1">“{submittedSuggestion}” is ready to explore above. It hasn’t been sent to the platform team.</p>
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Popular ideas</p>
          <h3 className="mt-2 text-lg font-bold text-slate-900">Try searching for</h3>
          <div className="mt-4 flex flex-wrap gap-2">
            {['Rice & cooking oil', 'Cement & blocks', 'Phone repairs', 'Laundry', 'Solar installation', 'Event halls', 'Farm produce', 'Home cleaning'].map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => explore(item)}
                className="rounded-full border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-700 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800"
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      </section>

      {query && (
        <div className="max-w-3xl mx-auto rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm sm:p-7">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
            <SearchIcon className="h-5 w-5 text-emerald-700" />
          </div>
          <h3 className="font-semibold text-slate-900">Ready to explore “{query}”</h3>
          <p className="mt-1 text-sm text-slate-500">
            This category selection is ready. Live results will appear here when Global Search is connected to platform listings.
          </p>
          <button
            type="button"
            onClick={() => setQuery('')}
            className="mt-4 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Clear search
          </button>
        </div>
      )}
    </div>
  );
}
