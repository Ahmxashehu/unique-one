import React, { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import MobileBottomNav from '../components/MobileBottomNav';
import { cn } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';

export default function PublicLayout() {
  const { currentUser } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="flex h-full min-h-0 w-full max-w-[100vw] flex-col bg-slate-50 overflow-hidden relative">
      {/* Public shell: HomePage owns its modern home header; keep navigation only on non-home pages. */}
      {location.pathname !== '/' && (
        <header className="fixed top-0 w-full bg-white/80 backdrop-blur-md z-50 border-b border-slate-100 shrink-0">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">U1</span>
              </div>
              <span className="font-bold text-xl tracking-tight text-slate-900 hidden sm:block">UNIQUE ONE</span>
            </Link>
            <nav className="hidden md:flex gap-6 items-center">
              <Link to="/discover" className="text-sm font-medium text-slate-600 hover:text-slate-900">Discover</Link>
              <Link to="/categories" className="text-sm font-medium text-slate-600 hover:text-slate-900">Categories</Link>
              <Link to="/near-me" className="text-sm font-medium text-slate-600 hover:text-slate-900">Near Me</Link>
              <Link to="/about" className="text-sm font-medium text-slate-600 hover:text-slate-900">About</Link>
              <Link to="/support" className="text-sm font-medium text-slate-600 hover:text-slate-900">Support</Link>
            </nav>
            <div className="flex items-center gap-3">
              {currentUser ? (
                <Link to="/os/dashboard" className="bg-slate-900 text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-slate-800 transition-colors">Dashboard</Link>
              ) : (
                <>
                  <Link to="/login" className="text-sm font-medium text-slate-600 hover:text-slate-900 hidden sm:block">Log in</Link>
                  <Link to="/register" className="bg-slate-900 text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-slate-800 transition-colors">Sign Up</Link>
                </>
              )}
            </div>
          </div>
        </header>
      )}

      {/* Main Content Area */}
      <main className={cn("flex-1 overflow-y-auto pb-16 md:pb-0", location.pathname !== "/" && "pt-16")}>
        <Outlet />
      </main>

      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label="More Unique One">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="absolute inset-x-2 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] max-h-[72dvh] overflow-y-auto overscroll-contain rounded-3xl border border-slate-200 bg-white p-3 shadow-2xl sm:inset-x-3 sm:p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-600">Unique One</p>
                <h2 className="text-lg font-black text-slate-900">More experiences</h2>
              </div>
              <button type="button" onClick={() => setIsMobileMenuOpen(false)} className="rounded-full bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600">Close</button>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              {[
                ['Categories', '/categories'],
                ['Near Me', '/near-me'],
                ['Store', '/store'],
                ['Unique AI', '/ai'],
                ['About', '/about'],
                ['Support', '/support'],
              ].map(([name, path]) => (
                <Link
                  key={path}
                  to={path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs font-bold text-slate-800 active:scale-[0.98] sm:px-4 sm:text-sm"
                >
                  {name}
                </Link>
              ))}
            </div>
            <div className="mt-3">
              {currentUser ? (
                <Link to="/os/dashboard" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-bold text-white">Open UniqueOS</Link>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Link to="/login" onClick={() => setIsMobileMenuOpen(false)} className="rounded-2xl border border-slate-200 px-4 py-3 text-center text-sm font-bold text-slate-700">Log in</Link>
                  <Link to="/register" onClick={() => setIsMobileMenuOpen(false)} className="rounded-2xl bg-slate-950 px-4 py-3 text-center text-sm font-bold text-white">Register</Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      <MobileBottomNav variant="public" onMenu={() => setIsMobileMenuOpen(true)} />
    </div>
  );
}
