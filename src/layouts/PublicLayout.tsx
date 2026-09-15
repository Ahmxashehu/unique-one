import React from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { Home, Compass, Search, MapPin, Grid, Menu } from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';

export default function PublicLayout() {
  const { currentUser } = useAuth();
  const location = useLocation();

  const bottomNav = [
    { name: 'Home', path: '/', icon: Home },
    { name: 'Discover', path: '/discover', icon: Compass },
    { name: 'Search', path: '/search', icon: Search },
    { name: 'Near Me', path: '/near-me', icon: MapPin },
  ];

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden relative">
      {/* Desktop Header */}
      <header className="fixed top-0 w-full bg-white/80 backdrop-blur-md z-50 border-b border-slate-100 shrink-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">U1</span>
            </div>
            <span className="font-bold text-xl tracking-tight text-slate-900 hidden sm:block">UNIQUE ONE 🇳🇬</span>
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
              <Link to="/os/dashboard" className="bg-slate-900 text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-slate-800 transition-colors">
                Dashboard
              </Link>
            ) : (
              <>
                <Link to="/login" className="text-sm font-medium text-slate-600 hover:text-slate-900 hidden sm:block">Log in</Link>
                <Link to="/register" className="bg-slate-900 text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-slate-800 transition-colors">
                  Sign Up
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto pt-16 pb-16 md:pb-0">
        <Outlet />
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 w-full h-16 bg-white border-t border-slate-200 flex items-center justify-around px-2 pb-safe z-50">
        {bottomNav.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.name}
              to={item.path}
              className={cn(
                "flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors",
                isActive ? "text-slate-900" : "text-slate-500 hover:text-slate-900"
              )}
            >
              <Icon className={cn("w-5 h-5", isActive ? "fill-slate-900 text-slate-900" : "")} />
              <span className="text-[10px] font-medium">{item.name}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
