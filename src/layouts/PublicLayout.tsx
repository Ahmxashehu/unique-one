import React, { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import MobileBottomNav from '../components/MobileBottomNav';
import { cn } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { getLanguage, t, type SupportedLanguage } from '../lib/i18n';
import {
  GraduationCap, Sparkles, Store, Calendar, Plane, ShoppingCart, Briefcase,
  Globe, Activity, Search, HeartHandshake, Wallet, MessageSquare, Video, Image
} from 'lucide-react';

const platformExperiences = [
  ['UniquePay', '/os/pay', Wallet], ['Unique Store', '/store', ShoppingCart],
  ['Communication', '/os/messages', MessageSquare], ['Unique AI', '/os/ai', Sparkles],
  ['UniqueMedia', '/media', Image], ['Online Conference', '/conference', Video],
  ['Restaurant', '/restaurant', Store], ['Hotels & Events', '/hotels-events', Calendar],
  ['Flights', '/flights', Plane], ['Health & Wellness', '/health-wellness', Activity],
  ['Global Search', '/search', Search], ['Near Me', '/near-me', Globe],
  ['Jobs', '/jobs', Briefcase], ['Contributions', '/os/contributions', HeartHandshake],
  ['Travel', '/os/travel', Plane],
] as const;

export default function PublicLayout() {
  const { currentUser } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const [language, setLanguage] = useState<SupportedLanguage>(getLanguage());
  React.useEffect(() => {
    const handleLanguageChange = (event: Event) => setLanguage((event as CustomEvent<SupportedLanguage>).detail);
    window.addEventListener('unique-language-change', handleLanguageChange);
    return () => window.removeEventListener('unique-language-change', handleLanguageChange);
  }, []);
  const hasHeader = location.pathname !== '/';

  return (
    <div className="relative flex h-full min-h-0 w-full max-w-[100vw] flex-col overflow-hidden bg-slate-50">
      {hasHeader && (
        <header className="fixed top-0 z-50 w-full shrink-0 border-b border-slate-100 bg-white/95 shadow-sm backdrop-blur-md">
          <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-3 sm:px-6 lg:px-8">
            <Link to="/" className="group flex min-w-0 items-center" aria-label="UniquePlatform">
              <span className="unique-platform-wordmark truncate text-[1.05rem] font-extrabold tracking-[-0.035em] text-slate-950 sm:text-xl">UniquePlatform</span>
            </Link>
            <div className="flex-1" aria-hidden="true" />
          </div>
        </header>
      )}
      <main className={cn('min-h-0 flex-1 overflow-y-auto pb-16', hasHeader && 'pt-16')}><Outlet /></main>
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[100] isolate" role="dialog" aria-modal="true" aria-label="More UniquePlatform">
          <button type="button" aria-label="Close menu" className="absolute inset-0 h-full w-full bg-slate-950/45 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />
          <div className="absolute inset-x-2 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] max-h-[72dvh] overflow-y-auto overscroll-contain rounded-3xl border border-slate-200 bg-white p-3 shadow-2xl sm:inset-x-3 sm:p-4 md:inset-x-auto md:left-1/2 md:w-[min(760px,calc(100vw-2rem))] md:-translate-x-1/2">
            <div className="mb-3 flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-600">UniquePlatform</p><h2 className="text-lg font-black text-slate-900">{t('moreExperiences', language)}</h2></div><button type="button" onClick={() => setIsMobileMenuOpen(false)} className="rounded-full bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600">{t('close', language)}</button></div>
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              {platformExperiences.map(([name, path, Icon]) => (
                <Link key={path + name} to={path} onClick={() => setIsMobileMenuOpen(false)} className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs font-bold text-slate-800 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800 active:scale-[0.98] sm:px-4 sm:py-3.5 sm:text-sm"><span className="flex items-center gap-2"><Icon className="h-4 w-4 shrink-0 text-emerald-600" /><span className="truncate">{name}</span></span></Link>
              ))}
            </div>
            <div className="mt-2"><Link to="/education-hub" onClick={() => setIsMobileMenuOpen(false)} className="group relative flex min-h-[76px] items-center overflow-hidden rounded-2xl border border-emerald-300/40 bg-gradient-to-br from-slate-950 via-emerald-950 to-slate-900 px-3 py-3 text-white shadow-[0_0_24px_rgba(16,185,129,0.16)] transition active:scale-[0.98]"><span className="absolute -right-8 -top-8 h-20 w-20 animate-pulse rounded-full bg-emerald-400/20 blur-2xl" /><span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-300/30 bg-emerald-400/10"><GraduationCap className="h-5 w-5 text-emerald-300" /></span><span className="relative ml-3 min-w-0 flex-1"><span className="block text-[9px] font-black uppercase tracking-[0.14em] text-emerald-300">Special experience</span><span className="mt-0.5 block text-sm font-black">UniqueEducationHub</span><span className="block text-[10px] text-slate-300">Learn • Teach • Contribute • Grow</span></span><Sparkles className="relative h-4 w-4 shrink-0 text-emerald-300" /></Link></div>
            <div className="mt-6 border-t-2 border-slate-100 pt-6"><Link to="/settings" onClick={() => setIsMobileMenuOpen(false)} className="flex min-w-0 items-center justify-center rounded-2xl border border-slate-200 bg-white px-3 py-3 text-xs font-bold text-slate-800 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800 active:scale-[0.98] sm:px-4 sm:py-3.5 sm:text-sm">Settings</Link></div>
          </div>
        </div>
      )}
      <MobileBottomNav variant="public" onMenu={() => setIsMobileMenuOpen(true)} />
      <Link to="/admin/login" aria-label="Super Admin access" title="Super Admin access" className="group fixed bottom-2 left-2 z-[70] hidden h-5 w-5 items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/60 md:flex"><span aria-hidden="true" className="h-2 w-2 rounded-full bg-red-600 shadow-[0_0_5px_rgba(220,38,38,0.35)] transition group-hover:scale-125 group-hover:bg-red-700" /></Link>
    </div>
  );
}
