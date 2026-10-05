import React, { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import MobileBottomNav from '../components/MobileBottomNav';
import { cn } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import AppearanceControls from '../components/AppearanceControls';
import { getLanguage, t, type SupportedLanguage } from '../lib/i18n';
import { Settings, GraduationCap, Sparkles } from 'lucide-react';

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

  return (
    <div className="flex h-full min-h-0 w-full max-w-[100vw] flex-col bg-slate-50 overflow-hidden relative">
      <AppearanceControls />
      {location.pathname !== '/' && (
        <header className="fixed top-0 w-full bg-white/80 backdrop-blur-md z-50 border-b border-slate-100 shrink-0">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <Link to="/" className="group flex min-w-0 items-center" aria-label="UniquePlatform">
              <span className="unique-platform-wordmark truncate text-[1.05rem] font-extrabold tracking-[-0.035em] text-slate-950 sm:text-xl">
                UniquePlatform
              </span>
            </Link>
            <nav className="hidden md:flex gap-6 items-center">
              <Link to="/discover" className="text-sm font-medium text-slate-600 hover:text-slate-900">{t('activeEdge', language)}</Link>
              <Link to="/categories" className="text-sm font-medium text-slate-600 hover:text-slate-900">{t('categories', language)}</Link>
              <Link to="/near-me" className="text-sm font-medium text-slate-600 hover:text-slate-900">{t('nearMe', language)}</Link>
              <Link to="/about" className="text-sm font-medium text-slate-600 hover:text-slate-900">{t('about', language)}</Link>
              <Link to="/support" className="text-sm font-medium text-slate-600 hover:text-slate-900">{t('support', language)}</Link>
            </nav>
            <div className="flex items-center gap-2">
              <Link to="/settings" aria-label="Open settings" title="Settings" className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white/80 text-slate-700 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700">
                <Settings className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </header>
      )}

      <main className={cn("flex-1 overflow-y-auto pb-16 md:pb-0", location.pathname !== "/" && "pt-16")}>
        <Outlet />
      </main>

      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label="More UniquePlatform">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />
          <div className="absolute inset-x-2 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] max-h-[72dvh] overflow-y-auto overscroll-contain rounded-3xl border border-slate-200 bg-white p-3 shadow-2xl sm:inset-x-3 sm:p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-600">UniquePlatform</p>
                <h2 className="text-lg font-black text-slate-900">{t('moreExperiences', language)}</h2>
              </div>
              <button type="button" onClick={() => setIsMobileMenuOpen(false)} className="rounded-full bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600">{t('close', language)}</button>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              {[
                ['Restaurant', '/restaurant'],
                ['Hotels & Events', '/hotels-events'],
                ['Flights', '/flights'],
                ['Unique Jobs & Services', '/jobs'],
                ['Unique Travel', '/os/travel'],
                ['Unique Health & Wellness', '/health-wellness'],
              ].map(([name, path]) => (
                <Link key={path + name} to={path} onClick={() => setIsMobileMenuOpen(false)} className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs font-bold text-slate-800 active:scale-[0.98] transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800 sm:px-4 sm:py-3.5 sm:text-sm">
                  {name}
                </Link>
              ))}
            </div>
            <div className="mt-2">
              <Link to="/education-hub" onClick={() => setIsMobileMenuOpen(false)} className="group relative flex min-h-[76px] items-center overflow-hidden rounded-2xl border border-emerald-300/40 bg-gradient-to-br from-slate-950 via-emerald-950 to-slate-900 px-3 py-3 text-white shadow-[0_0_24px_rgba(16,185,129,0.16)] transition active:scale-[0.98]">
                <span className="absolute -right-8 -top-8 h-20 w-20 rounded-full bg-emerald-400/20 blur-2xl animate-pulse" />
                <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-300/30 bg-emerald-400/10"><GraduationCap className="h-5 w-5 text-emerald-300" /></span>
                <span className="relative ml-3 min-w-0 flex-1"><span className="block text-[9px] font-black uppercase tracking-[0.14em] text-emerald-300">Special experience</span><span className="mt-0.5 block text-sm font-black">UniqueEducationHub</span><span className="block text-[10px] text-slate-300">Learn • Teach • Contribute • Grow</span></span>
                <Sparkles className="relative h-4 w-4 shrink-0 text-emerald-300" />
              </Link>
            </div>
            <div className="mt-6 border-t-2 border-slate-100 pt-6">
              <Link to="/settings" onClick={() => setIsMobileMenuOpen(false)} className="flex min-w-0 items-center justify-center rounded-2xl border border-slate-200 bg-white px-3 py-3 text-xs font-bold text-slate-800 active:scale-[0.98] transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800 sm:px-4 sm:py-3.5 sm:text-sm">
                Settings
              </Link>
            </div>
            {currentUser && (
              <div className="mt-3">
                <Link to="/os/dashboard" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-bold text-white">{t('openUniqueOS', language)}</Link>
              </div>
            )}
          </div>
        </div>
      )}
      <MobileBottomNav variant="public" onMenu={() => setIsMobileMenuOpen(true)} />
    </div>
  );
}
