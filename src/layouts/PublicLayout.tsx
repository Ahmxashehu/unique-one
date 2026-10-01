import React from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import MobileBottomNav from '../components/MobileBottomNav';
import { cn } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';

export default function PublicLayout() {
  const { currentUser } = useAuth();
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

      <MobileBottomNav variant="public" onMenu={() => {}} />
    </div>
  );
}
