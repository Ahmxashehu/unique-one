import React, { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { 
  Users, Building2, Package, Inbox, BarChart3, 
  ShieldCheck, Activity, Settings, LogOut 
} from 'lucide-react';
import { cn } from '../lib/utils';
import MobileBottomNav from '../components/MobileBottomNav';

export default function AdminLayout() {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const adminNav = [
    { name: 'Users', path: '/admin/users', icon: Users },
    { name: 'Businesses', path: '/admin/businesses', icon: Building2 },
    { name: 'Products', path: '/admin/products', icon: Package },
    { name: 'Requests', path: '/admin/requests', icon: Inbox },
    { name: 'Reports', path: '/admin/reports', icon: BarChart3 },
    { name: 'Verification', path: '/admin/verification', icon: ShieldCheck },
    { name: 'Transactions', path: '/admin/transactions', icon: Activity },
    { name: 'System Settings', path: '/admin/settings', icon: Settings },
  ];

  return (
    <div className="flex h-full bg-slate-100 overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 bg-slate-900 text-slate-300 border-r border-slate-800 shrink-0">
        <div className="h-16 flex items-center px-6 border-b border-slate-800 shrink-0">
          <div className="font-bold text-xl tracking-tight text-white flex items-center gap-2">
            <div className="w-8 h-8 bg-white/10 rounded flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
            </div>
            OS Admin
          </div>
        </div>
        
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {adminNav.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname.includes(item.path);
            return (
              <Link
                key={item.name}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-slate-800 text-white"
                    : "hover:bg-slate-800/50 hover:text-white"
                )}
              >
                <Icon className={cn("w-5 h-5", isActive ? "text-emerald-400" : "text-slate-400")} />
                {item.name}
              </Link>
            );
          })}
        </nav>
        
        <div className="p-4 border-t border-slate-800 shrink-0">
          <Link to="/" className="flex items-center gap-3 px-3 py-2 text-sm text-slate-400 hover:text-white transition-colors">
            <LogOut className="w-5 h-5" />
            Exit Admin Portal
          </Link>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Mobile Header */}
        {isMobileMenuOpen && (
          <div className="lg:hidden fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label="Admin navigation">
            <button type="button" aria-label="Close admin menu" className="absolute inset-0 bg-slate-950/60" onClick={() => setIsMobileMenuOpen(false)} />
            <div className="absolute inset-y-0 left-0 w-[86%] max-w-sm overflow-y-auto bg-slate-900 p-4 text-slate-200 shadow-2xl">
              <div className="mb-5 flex items-center justify-between">
                <div className="font-bold text-lg flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-emerald-400" /> OS Admin</div>
                <button type="button" onClick={() => setIsMobileMenuOpen(false)} className="rounded-xl bg-white/10 px-3 py-2 text-xs font-bold">Close</button>
              </div>
              <nav className="space-y-1">
                {adminNav.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname.includes(item.path);
                  return (
                    <Link key={item.name} to={item.path} onClick={() => setIsMobileMenuOpen(false)} className={cn("flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium", isActive ? "bg-slate-800 text-white" : "hover:bg-slate-800/60")}>
                      <Icon className={cn("h-5 w-5", isActive ? "text-emerald-400" : "text-slate-400")} />
                      {item.name}
                    </Link>
                  );
                })}
              </nav>
            </div>
          </div>
        )}
        <header className="lg:hidden h-14 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4 shrink-0 text-white">
          <button type="button" onClick={() => setIsMobileMenuOpen(true)} aria-label="Open admin menu" className="rounded-xl p-2 text-slate-300">
            <span className="text-xl leading-none">☰</span>
          </button>
          <div className="font-bold text-lg flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            OS Admin
          </div>
          <Link to="/" aria-label="Exit admin portal" className="rounded-xl p-2 text-slate-300">
            <LogOut className="w-5 h-5" />
          </Link>
        </header>

        <main className="mobile-scroll-padding flex-1 min-h-0 overflow-y-auto p-4 md:p-8 pb-20 lg:pb-8">
          <div className="mx-auto max-w-6xl h-full">
            <Outlet />
          </div>
        </main>
        <MobileBottomNav variant="public" onMenu={() => setIsMobileMenuOpen(true)} />
      </div>
    </div>
  );
}
