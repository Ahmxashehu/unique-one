import React, { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Store, Wallet, Calendar, Bell, Settings,
  Briefcase, ShoppingCart, Users, FileText, HeartHandshake,
  User, MessageSquare, Heart, ClipboardList, Globe, Shield,
  Building2, Activity, PlusCircle, Menu, X, LogOut, Sparkles, GraduationCap, Plane, Landmark, Search, ArrowRight, Image, Video
} from 'lucide-react';
import { cn } from '../lib/utils';
import MobileBottomNav from '../components/MobileBottomNav';
import { useAuth } from '../contexts/AuthContext';
import AppearanceControls from '../components/AppearanceControls';
import AppErrorBoundary from '../components/AppErrorBoundary';

export default function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { userData, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Shared account navigation plus the same UniquePlatform experience catalog used by mobile.
  const userNav = [
    { name: 'Dashboard', path: '/os/dashboard', icon: LayoutDashboard },
    { name: 'Profile', path: '/os/profile', icon: User },
    { name: 'Messages', path: '/os/messages', icon: MessageSquare },
    { name: 'Orders', path: '/os/orders', icon: ShoppingCart },
    { name: 'Bookings', path: '/os/bookings', icon: Calendar },
    { name: 'Wishlist', path: '/os/wishlist', icon: Heart },
    { name: 'My Requests', path: '/os/requests', icon: ClipboardList },
  ];

  const platformNav = [
    { name: 'UniquePay', path: '/os/pay', icon: Wallet },
    { name: 'Unique Store', path: '/store', icon: ShoppingCart },
    { name: 'Communication', path: '/os/messages', icon: MessageSquare },
    { name: 'Unique AI', path: '/os/ai', icon: Sparkles },
    { name: 'UniqueMedia', path: '/media', icon: Image },
    { name: 'Online Conference', path: '/conference', icon: Video },
    { name: 'Restaurant', path: '/restaurant', icon: Store },
    { name: 'Hotels & Events', path: '/hotels-events', icon: Calendar },
    { name: 'Flights', path: '/flights', icon: Plane },
    { name: 'School & Education', path: '/education-hub', icon: GraduationCap },
    { name: 'Retail & Shopping', path: '/store', icon: ShoppingCart },
    { name: 'Professional Services', path: '/search?category=Professional%20Services', icon: Briefcase },
    { name: 'Transportation', path: '/search?category=Transportation', icon: Plane },
    { name: 'Real Estate', path: '/search?category=Real%20Estate', icon: Building2 },
    { name: 'Technology', path: '/search?category=Technology', icon: Globe },
    { name: 'Health & Wellness', path: '/health-wellness', icon: Activity },
    { name: 'Food & Dining', path: '/restaurant', icon: Store },
    { name: 'Global Search', path: '/search', icon: Search },
    { name: 'Near Me', path: '/near-me', icon: Globe },
    { name: 'Jobs', path: '/jobs', icon: Briefcase },
    { name: 'Contributions', path: '/os/contributions', icon: HeartHandshake },
    { name: 'Education', path: '/os/education', icon: GraduationCap },
    { name: 'Travel', path: '/os/travel', icon: Plane },
  ];

  const businessNav = [
    { name: 'Dashboard', path: '/os/business/dashboard', icon: LayoutDashboard },
    { name: 'Catalog', path: '/os/business/catalog', icon: PlusCircle },
    { name: 'Orders', path: '/os/business/orders', icon: ShoppingCart },
    { name: 'Inventory', path: '/os/business/inventory', icon: Briefcase },
    { name: 'Customers', path: '/os/business/customers', icon: Users },
    { name: 'Suppliers', path: '/os/business/suppliers', icon: Users },
    { name: 'Invoices', path: '/os/business/invoices', icon: FileText },
    { name: 'Finance', path: '/os/business/finance', icon: Wallet },
    { name: 'Reports', path: '/os/business/reports', icon: Activity },
    { name: 'Staff & Teams', path: '/os/business/staff', icon: Users },
    { name: 'Branches', path: '/os/business/branches', icon: Building2 },
    { name: 'Activity Logs', path: '/os/business/activity', icon: ClipboardList },
    { name: 'Settings', path: '/os/business/settings', icon: Settings },
  ];

  const systemNav = [
    { name: 'Notifications', path: '/os/notifications', icon: Bell },
    { name: 'Language', path: '/os/language', icon: Globe },
    { name: 'Security', path: '/os/security', icon: Shield },
    { name: 'Settings', path: '/os/settings', icon: Settings },
  ];

  const hasBusinessAccess = Boolean(
    userData?.roles?.some((role) =>
      ['business_owner', 'seller', 'service_provider', 'staff_member', 'administrator'].includes(role)
    )
  );

  const businessMenu = hasBusinessAccess
    ? businessNav
    : [{ name: 'Register Business', path: '/os/business/register', icon: Building2 }];

  const mobilePrimaryPaths = new Set(['/os/dashboard', '/store', '/os/pay', '/os/orders']);
  const mobileUserNav = userNav.filter((item) => !mobilePrimaryPaths.has(item.path));
  const mobileBusinessNav = businessMenu.filter((item) => !mobilePrimaryPaths.has(item.path));

  const renderNavItems = (items: any[], isMobile = false) => (
    <div className="space-y-1">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = location.pathname === item.path;
        return (
          <Link
            key={item.name}
            to={item.path}
            onClick={() => isMobile && setIsMobileMenuOpen(false)}
            className={cn(
              'flex items-center gap-3 px-3 py-3 md:py-2 rounded-lg text-sm font-medium transition-colors touch-manipulation',
              isActive
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            )}
          >
            <Icon className={cn('w-5 h-5', isActive ? 'text-slate-200' : 'text-slate-400')} />
            {item.name}
          </Link>
        );
      })}
    </div>
  );

  return (
    <div className="flex h-full bg-slate-50 overflow-hidden w-full max-w-[100vw]">
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-[100] isolate" role="dialog" aria-modal="true" aria-label="More UniquePlatform">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 h-full w-full bg-slate-950/45 backdrop-blur-sm"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="absolute inset-x-2 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] max-h-[72dvh] overflow-y-auto overscroll-contain rounded-3xl border border-slate-200 bg-white p-3 shadow-2xl sm:inset-x-3 sm:p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-600">UniquePlatform</p>
                <h2 className="text-lg font-black text-slate-900">More experiences</h2>
              </div>
              <button type="button" onClick={() => setIsMobileMenuOpen(false)} className="rounded-full bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600">Close</button>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              {[
                ['UniquePay', '/os/pay', Wallet],
                ['Unique Store', '/store', ShoppingCart],
                ['Communication', '/os/messages', MessageSquare],
                ['Unique AI', '/os/ai', Sparkles],
                ['UniqueMedia', '/media', Image],
                ['Online Conference', '/conference', Video],
                ['Restaurant', '/restaurant', Store],
                ['Hotels & Events', '/hotels-events', Calendar],
                ['Flights', '/flights', Plane],
                ['School & Education', '/education-hub', GraduationCap],
                ['Retail & Shopping', '/store', ShoppingCart],
                ['Professional Services', '/search?category=Professional%20Services', Briefcase],
                ['Transportation', '/search?category=Transportation', Plane],
                ['Real Estate', '/search?category=Real%20Estate', Building2],
                ['Technology', '/search?category=Technology', Globe],
                ['Health & Wellness', '/health-wellness', Activity],
                ['Food & Dining', '/restaurant', Store],
                ['Global Search', '/search', Search],
                ['Near Me', '/near-me', Globe],
                ['Jobs', '/jobs', Briefcase],
                ['Contributions', '/os/contributions', HeartHandshake],
                ['Education', '/os/education', GraduationCap],
                ['Travel', '/os/travel', Plane],
              ].map(([name, path, Icon]) => {
                const ExperienceIcon = Icon as React.ComponentType<{ className?: string }>;
                return (
                  <Link key={String(path) + String(name)} to={String(path)} onClick={() => setIsMobileMenuOpen(false)} className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs font-bold text-slate-800 active:scale-[0.98] transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800 sm:px-4 sm:py-3.5 sm:text-sm">
                    <span className="flex items-center gap-2">
                      <ExperienceIcon className="h-4 w-4 shrink-0 text-emerald-600" />
                      <span className="truncate">{String(name)}</span>
                    </span>
                  </Link>
                );
              })}
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
              <Link to="/os/settings" onClick={() => setIsMobileMenuOpen(false)} className="flex min-w-0 items-center justify-center rounded-2xl border border-slate-200 bg-white px-3 py-3 text-xs font-bold text-slate-800 active:scale-[0.98] transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800 sm:px-4 sm:py-3.5 sm:text-sm">
                Settings
              </Link>
            </div>
          </div>
        </div>
      )}
      <aside className="hidden lg:flex flex-col w-64 bg-white border-r border-slate-200 shrink-0 h-full overflow-y-auto">
        <div className="h-16 flex items-center px-6 border-b border-slate-100 shrink-0 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2"><div className="font-black text-xl tracking-tight text-slate-900">UniquePlatform</div><span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.65)]" /></div>
        </div>
        <nav className="flex-1 py-4 px-3">
          <div className="mb-6">
            <p className="px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">My Account</p>
            {renderNavItems(userNav)}
          </div>
          <div className="mb-6">
            <p className="px-3 text-xs font-semibold text-emerald-600 uppercase tracking-wider mb-2">UniquePlatform</p>
            {renderNavItems(platformNav)}
          </div>
          <div className="mb-6">
            <p className="px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              {hasBusinessAccess ? 'Business Tools' : 'Business'}
            </p>
            {renderNavItems(businessMenu)}
          </div>
          <div>
            <p className="px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">System</p>
            {renderNavItems(systemNav)}
          </div>
        </nav>

        <div className="p-4 border-t border-slate-200 shrink-0 bg-white sticky bottom-0 z-10 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-indigo-100 flex shrink-0 items-center justify-center text-indigo-700 font-bold uppercase">
              {userData?.fullName?.charAt(0) || 'U'}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">{userData?.fullName || 'User Account'}</p>
              <p className="text-xs text-slate-500 truncate">{userData?.uniqueOneId || 'user@unique.one'}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-red-600 transition-colors">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </aside>

      <Link
        to="/admin/login"
        aria-label="Authorized access"
        title="Authorized access"
        className="fixed bottom-3 left-3 z-[90] hidden md:flex h-7 w-7 items-center justify-center rounded-full border border-slate-200/70 bg-white/55 text-slate-300 shadow-sm backdrop-blur-sm transition-all duration-200 hover:h-8 hover:w-8 hover:border-emerald-300 hover:bg-white hover:text-emerald-600 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
      >
        <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.25} />
        <span className="sr-only">Authorized access</span>
      </Link>

      <div className="flex-1 flex flex-col h-full min-w-0 w-full overflow-hidden">
        <main className="mobile-scroll-padding flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 pt-4 lg:p-8 w-full pb-20 lg:pb-8">
          <div className="mx-auto max-w-5xl h-full w-full">
            <AppErrorBoundary>
              <Outlet />
            </AppErrorBoundary>
          </div>
        </main>

        <MobileBottomNav variant="app" onMenu={() => setIsMobileMenuOpen(true)} />
      </div>
    </div>
  );
}
