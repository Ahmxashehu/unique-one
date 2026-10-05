import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Bell,
  Building2,
  Clock3,
  MapPin,
  Bookmark,
  Compass,
  Heart,
  MessageCircle,
  Play,
  Search,
  Share2,
  ShoppingBag,
  Sparkles,
  Store as StoreIcon,
  TrendingUp,
  Users,
  Zap,
  Video,
  WalletCards,
  Briefcase as BriefcaseIcon,
} from 'lucide-react';
import { collection, limit, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Product } from '../lib/os/types';

type EdgeMode = 'for-you' | 'following' | 'discover';

type EdgeService = { id: string; ownerUid?: string; providerName?: string; title?: string; category?: string; description?: string; price?: number; currency?: string; durationHours?: number; status?: string };

function formatPrice(product: Product) {
  const symbol = product.currency === 'NGN' ? '₦' : '$';
  return `${symbol}${Number(product.price).toLocaleString()}`;
}

export default function HomePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [jobs, setJobs] = useState<Array<{ id: string; title?: string; companyName?: string; location?: string; description?: string; category?: string }>>([]);
  const [contributions, setContributions] = useState<Array<{ id: string; title?: string; description?: string; category?: string; location?: string }>>([]);
  const [businesses, setBusinesses] = useState<Array<{ id: string; name?: string; businessName?: string; description?: string; ownerUid?: string; category?: string; status?: string; verificationStatus?: string }>>([]);
  const [services, setServices] = useState<EdgeService[]>([]);
  const [mode] = useState<EdgeMode>('for-you');
  const [loading, setLoading] = useState(true);
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState('');
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [activeMainPoster, setActiveMainPoster] = useState(0);
  const [smartNotificationIndex, setSmartNotificationIndex] = useState(0);
  const [smartNow, setSmartNow] = useState(() => new Date());
  const [smartLocation, setSmartLocation] = useState('Abuja, FCT');

  const experiencePosters = [
    ['Restaurant', '/restaurant'],
    ['Hotels & Events', '/hotels-events'],
    ['Flights', '/travel'],
    ['School', '/education'],
    ['Retail & Shopping', '/categories'],
    ['Professional Services', '/categories'],
    ['Transportation', '/categories'],
    ['Real Estate', '/categories'],
    ['Technology', '/categories'],
    ['Unique Health & Wellness', '/health-wellness'],
    ['Food & Dining', '/categories'],
    ['Global Search', '/search'],
    ['Near Me', '/near-me'],
    ['Unique Jobs & Services', '/os/jobs'],
    ['Contributions', '/os/contributions'],
    ['Education', '/os/education'],
    ['Unique Travel', '/os/travel'],
  ];

  const promotionalPosters = [
    {
      eyebrow: 'UNIQUE ONE',
      title: 'Everything happening around you, in one Unique experience.',
            action: 'Explore Unique',
      href: '/discover',
      icon: Compass,
      tone: 'from-emerald-500 via-emerald-400 to-teal-300',
    },
    {
      eyebrow: 'UNIQUE STORE',
      title: 'Discover products and services made for your world.',
            action: 'Open Unique Store',
      href: '/store',
      icon: ShoppingBag,
      tone: 'from-emerald-950 via-slate-950 to-emerald-700',
    },
    {
      eyebrow: 'UNIQUE AI',
      title: 'Meet the AI that understands your Unique world.',
            action: 'Try Unique AI',
      href: '/ai',
      icon: Sparkles,
      tone: 'from-emerald-700 via-teal-700 to-slate-900',
    },
    {
      eyebrow: 'ACTIVE EDGE',
      title: 'See what is happening now.',
            action: 'Open Active Edge',
      href: '#active-edge',
      icon: Zap,
      tone: 'from-slate-950 via-emerald-950 to-emerald-700',
    },
  ];

  const mainPosterSlides = [
    ...promotionalPosters.map((poster) => ({
      type: 'promo' as const,
      key: `promo-${poster.eyebrow}`,
      title: poster.title,
      href: poster.href,
      action: poster.action,
      icon: poster.icon,
      tone: poster.tone,
      eyebrow: poster.eyebrow,
    })),
    ...experiencePosters.map(([label, href]) => ({
      type: 'experience' as const,
      key: `experience-${label}`,
      title: label,
      href,
      action: 'Open experience',
      icon: Compass,
      tone: 'from-slate-950 via-emerald-950 to-emerald-800',
      eyebrow: 'Professional experience',
    })),
  ];

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveMainPoster((current) => (current + 1) % mainPosterSlides.length);
    }, 10000);

    return () => window.clearInterval(timer);
  }, [mainPosterSlides.length]);

  useEffect(() => {
    const timer = window.setInterval(() => setSmartNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      () => {
        // Keep the user-facing location readable rather than exposing raw GPS coordinates.
        setSmartLocation('Abuja, FCT');
      },
      () => setSmartLocation('Abuja, FCT'),
      { enableHighAccuracy: false, maximumAge: 300000, timeout: 5000 },
    );
  }, []);

  const smartNotifications = [
    { label: 'ORDER', text: 'Your order is moving to the next step.', href: '/os/orders' },
    { label: 'MESSAGE', text: 'You have a new message waiting.', href: '/os/messages' },
    { label: 'STOCK', text: 'A saved product has a new stock update.', href: '/store' },
    { label: 'UPDATE', text: 'You have a new Unique update.', href: '/os/notifications' },
  ];

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSmartNotificationIndex((current) => (current + 1) % smartNotifications.length);
    }, 4200);

    return () => window.clearInterval(timer);
  }, [smartNotifications.length]);

  useEffect(() => {
    let cancelled = false;
    const productsQuery = query(
      collection(db, 'products'),
      where('status', '==', 'published'),
      limit(18),
    );

    setLoading(true);

    const unsubscribe = onSnapshot(
      productsQuery,
      (snapshot) => {
        if (cancelled) return;
        const realProducts = snapshot.docs
          .map((productDoc) => ({ ...(productDoc.data() as Product), id: productDoc.id }))
          .filter(
            (product) =>
              product.name &&
              Number.isFinite(Number(product.price)) &&
              Number(product.quantity) > 0,
          );
        setProducts(realProducts);
        setLoading(false);
      },
      (error) => {
        console.error('Unique home feed could not load:', error);
        if (!cancelled) {
          setProducts([]);
          setLoading(false);
        }
      },
    );

    const jobsQuery = query(
      collection(db, 'jobs'),
      where('status', '==', 'published'),
      limit(8),
    );
    const unsubscribeJobs = onSnapshot(
      jobsQuery,
      (snapshot) => {
        if (!cancelled) {
          setJobs(snapshot.docs.map((item) => ({ id: item.id, ...(item.data() as Omit<(typeof jobs)[number], 'id'>) })));
        }
      },
      (error) => console.error('Unique jobs feed could not load:', error),
    );

    const businessesQuery = query(
      collection(db, 'businesses'),
      limit(12),
    );
    const unsubscribeBusinesses = onSnapshot(
      businessesQuery,
      (snapshot) => {
        if (!cancelled) {
          setBusinesses(
            snapshot.docs
              .map((item) => ({
                id: item.id,
                ...(item.data() as {
                  name?: string;
                  businessName?: string;
                  description?: string;
                  ownerUid?: string;
                  category?: string;
                  status?: string;
                  verificationStatus?: string;
                }),
              }))
              .filter((business) => business.businessName || business.name),
          );
        }
      },
      (error) => console.error('Unique business feed could not load:', error),
    );


    const servicesQuery = query(
      collection(db, 'services'),
      where('status', '==', 'published'),
      limit(10),
    );
    const unsubscribeServices = onSnapshot(
      servicesQuery,
      (snapshot) => {
        if (!cancelled) {
          setServices(snapshot.docs.map((item) => ({ id: item.id, ...(item.data() as Omit<EdgeService, 'id'>) })));
        }
      },
      (error) => console.error('Unique services feed could not load:', error),
    );

    const contributionsQuery = query(
      collection(db, 'contributionRequests'),
      where('status', '==', 'published'),
      limit(8),
    );
    const unsubscribeContributions = onSnapshot(
      contributionsQuery,
      (snapshot) => {
        if (!cancelled) {
          setContributions(snapshot.docs.map((item) => ({ id: item.id, ...(item.data() as Omit<(typeof contributions)[number], 'id'>) })));
        }
      },
      (error) => console.error('Unique contribution feed could not load:', error),
    );

    return () => {
      cancelled = true;
      unsubscribe();
      unsubscribeJobs();
      unsubscribeContributions();
      unsubscribeBusinesses();
      unsubscribeServices();
    };  }, []);

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return products;

    return products.filter((product) =>
      [product.name, product.description, product.category]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    );
  }, [products, search]);

  const edgeProducts = useMemo(() => {
    const source = filteredProducts.filter((product) => {
      if (mode !== 'following') return true;
      return followingIds.includes(String(product.sellerId || ''));
    });

    if (mode === 'discover') {
      return source.slice(0, 12);
    }

    if (mode === 'for-you') {
      return [...source].sort((a, b) => {
        const aScore = (liked[a.id] ? 5 : 0) + (saved[a.id] ? 4 : 0) + (a.category ? 1 : 0);
        const bScore = (liked[b.id] ? 5 : 0) + (saved[b.id] ? 4 : 0) + (b.category ? 1 : 0);
        return bScore - aScore;
      }).slice(0, 8);
    }

    return source.slice(0, 8);
  }, [filteredProducts, mode, followingIds, liked, saved]);

  const filteredJobs = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return jobs;
    return jobs.filter((job) =>
      [job.title, job.companyName, job.location, job.description, job.category]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    );
  }, [jobs, search]);

  const filteredContributions = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return contributions;
    return contributions.filter((item) =>
      [item.title, item.description, item.location, item.category]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    );
  }, [contributions, search]);

  const filteredBusinesses = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return businesses;
    return businesses.filter((business) =>
      [business.name, business.businessName, business.description, business.category]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    );
  }, [businesses, search]);


  const filteredServices = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return services;
    return services.filter((service) =>
      [service.title, service.providerName, service.category, service.description]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    );
  }, [services, search]);

  const shareProduct = async (product: Product) => {
    const url = window.location.origin + `/store/product/${product.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: product.name, text: product.description || product.name, url });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
      }
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') console.error('Product share failed:', error);
    }
  };

  return (
    <main className="min-h-screen min-w-0 overflow-x-hidden bg-[#f7f9f8] text-slate-950">
      <style>{`
        @keyframes uniqueMediaVertical {
          0%, 12% { transform: translateY(110%); opacity: 0; }
          22%, 72% { transform: translateY(0); opacity: 1; }
          84%, 100% { transform: translateY(-110%); opacity: 0; }
        }
        @keyframes uniqueSearchGlow {
          0%, 100% { opacity: .48; transform: scale(.985); }
          50% { opacity: .9; transform: scale(1.012); }
        }
        @keyframes uniqueSearchSmoke {
          0%, 100% { transform: translate3d(-2%, 0, 0) scale(1); opacity: .32; }
          50% { transform: translate3d(2%, -1px, 0) scale(1.035); opacity: .58; }
        }
      `}</style>
      {/* Sticky discovery header */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
        <div className="pointer-events-none relative h-10 overflow-hidden border-b border-slate-100/90 bg-slate-50/80 px-2" aria-label="Smart location date and time">
          <div className="absolute bottom-1.5 left-2 flex max-w-[calc(100vw-4rem)] items-center overflow-hidden rounded-full border border-emerald-200/80 bg-white/98 px-1.5 py-1 text-[10px] font-bold shadow-[0_2px_12px_rgba(16,185,129,0.14)] backdrop-blur-xl sm:left-3 sm:text-[10px]">
            <div className="flex min-w-0 items-center gap-1 px-1.5 text-emerald-700" aria-label="Current location">
              <MapPin className="h-2.5 w-2.5 shrink-0" />
              <span className="max-w-[108px] truncate sm:max-w-[160px]">{smartLocation}</span>
            </div>
            <span className="h-3.5 w-px shrink-0 bg-slate-200" aria-hidden="true" />
            <div className="shrink-0 px-1.5 text-slate-600" aria-label="Current date">
              <span>{smartNow.toLocaleDateString("en-NG", { day: "2-digit", month: "short", year: "numeric", timeZone: "Africa/Lagos" })}</span>
            </div>
            <span className="h-3.5 w-px shrink-0 bg-slate-200" aria-hidden="true" />
            <div className="flex shrink-0 items-center gap-1 px-1.5 font-black tracking-[0.04em] text-slate-700" aria-label="Live time">
              <Clock3 className="h-2.5 w-2.5 text-emerald-600" />
              <span>{smartNow.toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" })}</span>
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" title="Live" />
            </div>
          </div>
        </div>
        <div className="mx-auto flex min-w-0 max-w-7xl items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-6 sm:py-3 lg:px-8">
          <Link to="/os" className="flex shrink-0 items-center gap-2 font-black tracking-tight">
            <span className="hidden sm:block">UNIQUE</span>
          </Link>

          <div className="unique-search-shell relative min-w-0 flex-1">
            <span className="pointer-events-none absolute -inset-1 rounded-full bg-emerald-300/25 blur-md" aria-hidden="true" />
            <span className="pointer-events-none absolute -inset-[2px] rounded-full border border-emerald-300/40 bg-gradient-to-r from-emerald-300/10 via-white/30 to-teal-300/10 blur-[1px]" style={{ animation: 'uniqueSearchGlow 3.8s ease-in-out infinite' }} aria-hidden="true" />
            <span className="pointer-events-none absolute -inset-2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(16,185,129,0.20),transparent_68%)] blur-lg" style={{ animation: 'uniqueSearchSmoke 5s ease-in-out infinite' }} aria-hidden="true" />
            <div className="relative flex h-10 items-center overflow-hidden rounded-full border border-emerald-200/80 bg-white/95 shadow-[0_0_18px_rgba(16,185,129,0.16)] backdrop-blur-xl transition-all focus-within:border-emerald-400 focus-within:shadow-[0_0_24px_rgba(16,185,129,0.28)]">
              <Search className="pointer-events-none absolute left-3 h-4 w-4 text-emerald-600" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search Unique..."
                className="h-full w-full bg-transparent pl-10 pr-4 text-sm font-medium text-slate-800 outline-none placeholder:text-slate-400"
                aria-label="Search Unique"
              />
            </div>
          </div>

          <Link
            to="/ai"
            aria-label="Open Unique AI"
            className="group relative hidden h-10 shrink-0 translate-y-1 items-center gap-1.5 rounded-full border border-emerald-200/80 bg-white/90 px-2.5 text-emerald-800 shadow-[0_0_16px_rgba(16,185,129,0.18)] backdrop-blur-xl transition hover:scale-[1.04] hover:border-emerald-300 hover:shadow-[0_0_22px_rgba(16,185,129,0.3)] sm:inline-flex"
          >
            <span className="absolute -inset-1 rounded-full bg-emerald-300/20 blur-md" aria-hidden="true" />
            <span className="relative flex h-8 w-8 items-center justify-center" aria-hidden="true">
              <span className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-emerald-400 border-r-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.65)]" style={{ animationDuration: '2.4s' }} />
              <span className="absolute inset-[-2px] animate-pulse rounded-full bg-emerald-400/15 blur-md" />
              <span className="relative z-10 flex h-7 w-7 items-center justify-center rounded-full border border-white/90 bg-white text-[10px] font-black tracking-[-0.08em] text-emerald-700 shadow-sm">
                U1
              </span>
            </span>
            <span className="relative text-[11px] font-black tracking-tight">Unique AI</span>
          </Link>
          <Link
            to="/os/notifications"
            className="hidden h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white sm:flex"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
          </Link>
        </div>
      </header>

      <div className="mx-auto min-w-0 max-w-7xl px-3 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-4 sm:px-6 sm:pb-20 sm:pt-5 lg:px-8">
        {/* Main experience poster: every promotional and professional experience is one 10-second sliding list. */}
        <section aria-label="Unique main experience posters" className="relative mt-4 overflow-hidden rounded-2xl bg-slate-950 text-white shadow-sm sm:mt-6 sm:rounded-3xl">
          <div className="relative min-h-[235px] sm:min-h-[285px] lg:min-h-[315px]">
            {mainPosterSlides.map((slide, index) => {
              const SlideIcon = slide.icon;
              const isActive = index === activeMainPoster;
              const isPromo = slide.type === 'promo';

              return (
                <div
                  key={slide.key}
                  aria-hidden={!isActive}
                  className={`absolute inset-0 transition-all duration-700 ease-out ${isActive ? 'translate-x-0 opacity-100' : 'pointer-events-none translate-x-8 opacity-0'}`}
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${slide.tone}`} />
                  <div className="absolute -right-20 -top-20 h-52 w-52 rounded-full bg-white/10 blur-2xl sm:-right-24 sm:-top-24 sm:h-72 sm:w-72" />
                  <div className="relative flex min-h-[235px] flex-col justify-between p-3.5 sm:min-h-[285px] sm:p-6 lg:min-h-[315px] lg:p-7">
                    <div className="flex items-start justify-between gap-3">
                      <div className="inline-flex min-w-0 items-center gap-1.5 rounded-full border border-white/20 bg-black/10 px-2.5 py-1.5 text-[10px] font-black tracking-[0.1em] backdrop-blur">
                        <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-emerald-200" />
                        <span className="truncate">{slide.eyebrow}</span>
                      </div>
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white/10 backdrop-blur sm:h-12 sm:w-12 sm:rounded-2xl">
                        <SlideIcon className="h-4 w-4 sm:h-6 sm:w-6" />
                      </div>
                    </div>

                    <div className="max-w-3xl">
                                            <h1 className="text-xl font-black leading-[1.08] tracking-tight sm:text-3xl lg:text-4xl">{slide.title}</h1>
                                            <div className="mt-3 flex flex-wrap gap-2">
                        <Link to={slide.href.startsWith('#') ? '/discover' : slide.href} className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-[11px] font-black text-slate-950 shadow-lg transition hover:scale-[1.03]">
                          {slide.action} <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => setActiveMainPoster((current) => (current + 1) % mainPosterSlides.length)}
                          className="rounded-full border border-white/25 bg-white/10 px-3.5 py-2 text-[11px] font-bold backdrop-blur transition hover:bg-white/20"
                        >
                          Next
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <div className="flex max-w-[72%] items-center gap-1 overflow-hidden">
                        {mainPosterSlides.map((_, dotIndex) => (
                          <button
                            key={dotIndex}
                            type="button"
                            onClick={() => setActiveMainPoster(dotIndex)}
                            aria-label={`Show main poster ${dotIndex + 1}`}
                            className={`h-1.5 shrink-0 rounded-full transition-all ${dotIndex === activeMainPoster ? 'w-7 bg-emerald-200' : 'w-1.5 bg-white/35'}`}
                          />
                        ))}
                      </div>

                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Core Unique experiences: restored as a permanent four-option strip below the professional poster. */}
        <section aria-label="Core Unique experiences" className="mt-4 sm:mt-5">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
            {[
              { label: 'UniquePay', description: 'Pay & transfer', href: '/os/pay', icon: WalletCards },
              { label: 'Unique Store', description: 'Buy & discover', href: '/store', icon: ShoppingBag },
              { label: 'Communication', description: 'Connect & chat', href: '/os/messages', icon: MessageCircle },
    { label: 'Online Conference', description: 'Meet & connect', href: '/conference', icon: Video },
            ].map(({ label, description, href, icon: Icon }) => (
              <Link
                key={label}
                to={href}
                className="group flex min-w-0 items-center gap-2.5 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md sm:gap-3 sm:rounded-3xl sm:p-4"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 transition group-hover:bg-emerald-100 sm:h-11 sm:w-11 sm:rounded-2xl">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-xs font-black text-slate-900 sm:text-sm">{label}</span>
                  <span className="mt-0.5 block truncate text-[10px] font-medium text-slate-500 sm:text-xs">{description}</span>
                </span>
              </Link>
            ))}
          </div>
        </section>
        {/* Active Edge: social stream + discovery collection */}
        <section id="active-edge" className="mt-8">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                  <Zap className="h-5 w-5" />
                </span>
                <h2 className="text-2xl font-black tracking-tight">Active Edge</h2>
              </div>
              <p className="mt-2 text-sm text-slate-500">
              </p>
            </div>
            <Link to="/discover" className="text-sm font-bold text-emerald-700">
              View full Discover →
            </Link>
          </div>

          {/* Compact notifications bar with a smart mini-screen for brief rotating updates. */}
          <div className="mb-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" aria-label="Latest notifications">
            <div className="flex min-w-0 items-center gap-2 p-2 sm:gap-2.5 sm:p-2.5">
              <Link
                to="/os/notifications"
                className="flex shrink-0 items-center gap-1.5 rounded-xl bg-slate-950 px-2.5 py-2 text-[10px] font-black uppercase tracking-[0.08em] text-white sm:px-3 sm:text-[11px]"
              >
                <Bell className="h-3.5 w-3.5" />
                Updates
              </Link>

              <Link
                to={smartNotifications[smartNotificationIndex].href}
                className="relative min-w-0 flex-1 overflow-hidden rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-white shadow-inner transition hover:border-emerald-500 sm:px-3.5"
                aria-live="polite"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="relative flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-400/20">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[8px] font-black tracking-[0.18em] text-emerald-300">{smartNotifications[smartNotificationIndex].label}</span>
                      <span className="text-[8px] font-semibold text-slate-500">SMART SCREEN</span>
                    </div>
                    <p key={smartNotificationIndex} className="mt-0.5 truncate text-[11px] font-semibold text-slate-100 sm:text-xs">{smartNotifications[smartNotificationIndex].text}</p>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                </div>
              </Link>

              <div className="hidden shrink-0 items-center gap-1 sm:flex">
                <Link to="/os/orders" aria-label="Order tracking" className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100"><ShoppingBag className="h-3.5 w-3.5" /></Link>
                <Link to="/os/messages" aria-label="New messages" className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100"><MessageCircle className="h-3.5 w-3.5" /></Link>
                <Link to="/store" aria-label="Stock updates" className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100"><TrendingUp className="h-3.5 w-3.5" /></Link>
              </div>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="space-y-5">
              {loading ? (
                <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center">
                  <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-emerald-500" />
                  <p className="mt-4 text-sm text-slate-500">Building your Unique experience...</p>
                </div>
              ) : edgeProducts.length === 0 ? (
                <div className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm sm:rounded-3xl sm:p-5">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
                      <Play className="h-5 w-5" />
                      <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-600">Your media</p>
                      <h3 className="mt-0.5 truncate text-lg font-black tracking-tight text-slate-950 sm:text-xl">UniqueMedia</h3>
                      <p className="mt-0.5 truncate text-xs text-slate-500 sm:text-sm">Audio, videos, images &amp; PDFs</p>
                    </div>
                    <Link to="/media" className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-2 text-xs font-black text-white transition hover:bg-emerald-700">
                      Open <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>


                  <div className="mt-3 flex items-center gap-1.5 border-t border-slate-100 pt-3 text-[10px] font-semibold text-slate-500 sm:text-xs">
                    <span>Private by default</span>
                    <span aria-hidden="true">·</span>
                    <span className="truncate">Local media stays on your device</span>
                    <ArrowRight className="ml-auto h-3.5 w-3.5 shrink-0 text-slate-400" />
                  </div>
                </div>
              ) : (
                <>
                  {edgeProducts.map((product) => (
                  <article
                    key={product.id}
                    className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
                  >
                    <div className="flex items-center justify-between px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                          <StoreIcon className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-sm font-bold">Unique seller</p>
                          <p className="text-xs text-slate-400">
                            {product.category?.replace('_', ' ') || 'Product'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            const sellerId = String(product.sellerId || '');
                            if (sellerId) {
                              setFollowingIds((current) =>
                                current.includes(sellerId)
                                  ? current.filter((id) => id !== sellerId)
                                  : [...current, sellerId],
                              );
                            }
                          }}
                          className="rounded-full px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-50"
                        >
                          {followingIds.includes(String(product.sellerId || '')) ? 'Following' : 'Follow'}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setSaved((current) => ({ ...current, [product.id]: !current[product.id] }))
                          }
                        aria-label={saved[product.id] ? 'Unsave' : 'Save'}
                        className="rounded-full p-2 hover:bg-slate-100"
                      >
                          <Bookmark className={`h-5 w-5 ${saved[product.id] ? 'fill-current text-emerald-600' : 'text-slate-500'}`} />
                        </button>
                      </div>
                    </div>

                    <Link to={`/store/product/${product.id}`} className="block">
                      <div className="aspect-[16/8] bg-slate-100">
                        {product.images?.length ? (
                          <img
                            src={product.images[0]}
                            alt={product.name}
                            loading="lazy"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-slate-300">
                            <ShoppingBag className="h-10 w-10" />
                          </div>
                        )}
                      </div>
                    </Link>

                    <div className="p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="font-bold">{product.name}</h3>
                          <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-500">                            {product.description || 'Published by a Unique seller.'}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-black text-emerald-700">
                          {formatPrice(product)}
                        </span>
                      </div>

                      <div className="mt-5 rounded-2xl bg-slate-50 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Take action</p>
                          <span className="text-xs font-medium text-slate-400">Live product</span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Link to={`/store/product/${product.id}`} className="rounded-full bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700">Buy now</Link>
                          <Link to={`/store/product/${product.id}`} className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100">View details</Link>
                          <Link to={`/os/messages/new?product=${product.id}&seller=${product.sellerId}`} className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100">Ask seller</Link>
                        </div>
                      </div>

                      <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              setLiked((current) => ({ ...current, [product.id]: !current[product.id] }))
                            }
                            className="flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-50"
                          >
                            <Heart className={`h-4 w-4 ${liked[product.id] ? 'fill-current text-rose-500' : ''}`} />
                            Like
                          </button>
                          <Link
                            to={`/os/messages/new?product=${product.id}&seller=${product.sellerId}`}
                            className="flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-50"
                          >
                            <MessageCircle className="h-4 w-4" /> Discuss
                          </Link>
                          <button
                            type="button"
                            onClick={() => void shareProduct(product)}
                            className="flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-50"
                          >
                            <Share2 className="h-4 w-4" /> Share
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <Link
                            to={`/store/product/${product.id}`}
                            className="rounded-full border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                          >
                            View
                          </Link>
                          <Link
                            to={`/store/product/${product.id}`}
                            className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700"
                          >
                            Buy
                          </Link>
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
                  {mode !== 'following' && filteredBusinesses.slice(0, mode === 'discover' ? 4 : 2).map((business) => (
                    <article key={`business-${business.id}`} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700"><StoreIcon className="h-5 w-5" /></div>
                          <div>
                            <span className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-700">Business</span>
                            <h3 className="mt-1 font-black">{business.businessName || business.name}</h3>
                            <p className="text-xs text-slate-500">{business.category || 'Business & services'}</p>
                          </div>
                        </div>
                        {(business.verificationStatus === 'verified' || business.status === 'verified') && (
                          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">Verified</span>
                        )}
                      </div>
                      {business.description && <p className="mt-4 line-clamp-3 text-sm leading-6 text-slate-500">{business.description}</p>}
                      <div className="mt-5 flex flex-wrap gap-2">
                        {business.ownerUid && <Link to={`/store/seller/${business.ownerUid}`} className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-bold text-white">Visit business</Link>}
                        {business.ownerUid && <Link to={`/os/messages/new?user=${business.ownerUid}`} className="rounded-full border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700">Message</Link>}
                        <Link to="/discover" className="rounded-full border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700">Discover services</Link>
                      </div>
                    </article>
                  ))}
                  {mode !== 'following' && filteredJobs.slice(0, mode === 'discover' ? 4 : 2).map((job) => (
                    <article key={`job-${job.id}`} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-bold text-violet-700">Opportunity</span>
                          <h3 className="mt-3 text-lg font-black">{job.title || 'Open opportunity'}</h3>
                          <p className="mt-1 text-sm font-semibold text-slate-700">{job.companyName || 'Unique organization'}</p>
                          <p className="mt-1 text-sm text-slate-500">{job.location || 'Location available in Unique'}</p>
                        </div>
                        <TrendingUp className="h-5 w-5 text-violet-500" />
                      </div>
                      {job.description && <p className="mt-4 line-clamp-3 text-sm leading-6 text-slate-500">{job.description}</p>}
                      <div className="mt-5 flex flex-wrap gap-2">
                        <Link to="/os/jobs" className="rounded-full bg-slate-950 px-4 py-2 text-xs font-bold text-white">Apply / Explore</Link>
                        <button type="button" onClick={() => navigator.share?.({ title: job.title || 'Unique opportunity', text: job.description || job.title || '' })} className="rounded-full border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700">Share</button>
                      </div>
                    </article>
                  ))}

                  {mode !== 'following' && filteredServices.slice(0, mode === 'discover' ? 4 : 2).map((service) => (
                    <article key={`service-${service.id}`} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">Service</span>
                          <h3 className="mt-3 text-lg font-black">{service.title || 'Unique service'}</h3>
                          <p className="mt-1 text-sm font-semibold text-slate-700">{service.providerName || 'Unique provider'}</p>
                          <p className="mt-1 text-xs text-slate-500">{service.category || 'Professional Services'}</p>
                        </div>
                        <BriefcaseIcon className="h-5 w-5 text-emerald-600" />
                      </div>
                      {service.description && <p className="mt-4 line-clamp-3 text-sm leading-6 text-slate-500">{service.description}</p>}
                      <div className="mt-4 flex items-center justify-between">
                        <span className="font-black text-emerald-700">{service.currency === 'NGN' ? '₦' : '$'}{Number(service.price || 0).toLocaleString()}</span>
                        <span className="text-xs text-slate-500">{service.durationHours || 0}h</span>
                      </div>
                      <div className="mt-5 flex flex-wrap gap-2">
                        {service.ownerUid && <Link to={`/os/messages/new?user=${service.ownerUid}`} className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-bold text-white">Ask provider</Link>}
                        <Link to="/os/services" className="rounded-full border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700">View services</Link>
                      </div>
                    </article>
                  ))}

                  {mode === 'discover' && filteredContributions.slice(0, 4).map((item) => (
                    <article key={`contribution-${item.id}`} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-50 text-amber-700"><Users className="h-5 w-5" /></span>
                        <div>
                          <span className="text-xs font-bold uppercase tracking-[0.12em] text-amber-700">Community request</span>
                          <h3 className="mt-1 font-black">{item.title || 'A Unique community request'}</h3>
                        </div>
                      </div>
                      {item.description && <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-500">{item.description}</p>}
                      <div className="mt-5 flex flex-wrap gap-2">
                        <Link to="/os/contributions" className="rounded-full bg-amber-600 px-4 py-2 text-xs font-bold text-white">View request</Link>
                        <Link to="/os/contributions" className="rounded-full border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700">Offer help</Link>
                      </div>
                    </article>
                  ))}
                </>
              )}
            </div>

            <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
              <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm sm:rounded-3xl sm:p-5">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 sm:h-10 sm:w-10 sm:rounded-2xl"><Building2 className="h-5 w-5" /></span>
                  <div className="min-w-0 flex-1">
                    <h3 className="break-words text-sm font-black sm:text-base">Unique Business Hub</h3>

                  </div>
                </div>
                <details className="group mt-3">
                  <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-2 rounded-xl bg-emerald-600 px-3 py-2.5 text-xs font-bold text-white transition hover:bg-emerald-700 sm:rounded-2xl sm:px-4 sm:text-sm">
                    <span className="min-w-0 break-words">Open Business Hub categories</span>
                    <ArrowRight className="h-4 w-4 shrink-0 rotate-90 transition-transform group-open:-rotate-90" />
                  </summary>
                  <div className="mt-3 space-y-3">
                    <div>
                      <p className="mb-2 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-700 sm:text-xs">Start & verify</p>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {[
                          ['Register your Business', '/os/business/register', 'Create your business profile.'],
                          ['NIN / BVN Validation', '/os/pay/verification', 'Identity and account verification.'],
                          ['NIN Modification', '/os/pay/verification', 'Open the verification centre for available guidance.'],
                          ['CAC Registration', '/os/business/register', 'Start business registration and provide CAC details.'],
                        ].map(([label, href, description]) => (
                          <Link key={label} to={href} className="flex min-w-0 items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5 transition hover:border-emerald-300 hover:bg-emerald-50 sm:rounded-2xl sm:p-3">
                            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white text-emerald-700"><Building2 className="h-4 w-4" /></span>
                            <span className="min-w-0"><span className="block break-words text-xs font-bold text-slate-800">{label}</span><span className="mt-1 block text-[10px] leading-4 text-slate-500 sm:text-[11px]">{description}</span></span>
                          </Link>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="mb-2 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-700 sm:text-xs">Run & grow your business</p>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          ['Business Dashboard', '/os/business/dashboard'],
                          ['Pros Near Me', '/discover?mode=services'],
                        ].map(([label, href]) => (
                          <Link key={label} to={href} className="flex min-w-0 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-bold text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50 sm:rounded-2xl sm:p-3">
                            <ArrowRight className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                            <span className="min-w-0 break-words">{label}</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  </div>
                </details>
                <div className="mt-3 overflow-hidden rounded-xl bg-emerald-50 px-2 py-2 sm:rounded-full sm:px-3 sm:py-1.5"><p className="animate-[bounce_2.4s_ease-in-out_infinite] text-center text-[10px] leading-4 font-bold text-emerald-700 sm:whitespace-nowrap sm:text-xs sm:leading-normal">Some identity, NIN modification and CAC services require an authorized external provider; the links open the relevant existing platform areas.</p></div>
              </div>
              
              <div className="min-w-0 rounded-2xl border border-emerald-100 bg-emerald-50 p-3.5 sm:rounded-3xl sm:p-5">
                <div className="flex min-w-0 items-start gap-2 font-black text-emerald-900">
                  <Sparkles className="mt-0.5 h-5 w-5 shrink-0" />
                  <span className="min-w-0 break-words text-sm leading-5 sm:text-base">One platform, many experiences</span>
                </div>
                <div className="mt-3 grid min-w-0 grid-cols-1 gap-2 text-[11px] font-semibold text-emerald-900 sm:mt-4 sm:text-xs">
                  <Link to="/os" className="rounded-2xl bg-white/80 p-3">UniqueCycle/Aju</Link>
                </div>
              </div>
            </aside>
          </div>        </section>
      </div>
    </main>
  );
}