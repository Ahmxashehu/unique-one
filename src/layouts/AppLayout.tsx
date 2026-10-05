import React, { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Store, Wallet, Calendar, Bell, Settings,
  Briefcase, ShoppingCart, Users, FileText, HeartHandshake,
  User, MessageSquare, Heart, ClipboardList, Globe, Shield,
  Building2, Activity, PlusCircle, Menu, X, LogOut, Sparkles, GraduationCap, Plane, Landmark
} from 'lucide-react';
import { cn } from '../lib/utils';
import MobileBottomNav from '../components/MobileBottomNav';
import { useAuth } from '../contexts/AuthContext';
import AppearanceControls from '../components/AppearanceControls';

export default function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { userData, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const userNav = [
    { name: 'Dashboard', path: '/os/dashboard', icon: LayoutDashboard },
    { name: 'Profile', path: '/os/profile', icon: User },
    { name: 'Messages', path: '/os/messages', icon: MessageSquare },
    { name: 'Orders', path: '/os/orders', icon: ShoppingCart },
    { name: 'Bookings', path: '/os/bookings', icon: Calendar },
    { name: 'Wishlist', path: '/os/wishlist', icon: Heart },
    { name: 'My Requests', path: '/os/requests', icon: ClipboardList },
    { name: 'UniquePay', path: '/os/pay', icon: Wallet },
    { name: 'Cycle Ajo', path: '/os/pay/ajo', icon: HeartHandshake },
    { name: 'Verification Center', path: '/os/pay/verification', icon: Shield },
    { name: 'Unique AI', path: '/os/ai', icon: Sparkles },
    { name: 'Master Vision', path: '/os/master-vision', icon: Landmark },
    { name: 'Jobs', path: '/os/jobs', icon: Briefcase },
    { name: 'Contributions', path: '/os/contributions', icon: HeartHandshake },
    { name: 'Education', path: '/os/education', icon: GraduationCap },
    { name: 'Unique Travel', path: '/os/travel', icon: Plane },
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
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-slate-900/50 transition-opacity" onClick={() => setIsMobileMenuOpen(false)} />
          <div className="relative flex w-4/5 max-w-sm flex-col bg-white shadow-xl overflow-y-auto">
            <div className="flex items-center justify-between px-4 h-14 border-b border-slate-100 shrink-0">
              <span className="font-bold text-lg text-slate-900">UniqueOS</span>
              <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 -mr-2 text-slate-500 touch-manipulation">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-1 px-4 py-6 overflow-y-auto">
              <div className="mb-6">
                <p className="px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">User Account</p>
                {renderNavItems(mobileUserNav, true)}
              </div>
              <div className="mb-6">
                <p className="px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  {hasBusinessAccess ? 'Business Tools' : 'Business'}
                </p>
                {renderNavItems(mobileBusinessNav, true)}
              </div>
              <div>
                <p className="px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">System</p>
                {renderNavItems(systemNav, true)}
              </div>
            </div>
          </div>
        </div>
      )}

      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-slate-200 shrink-0 h-full overflow-y-auto">
        <div className="h-16 flex items-center px-6 border-b border-slate-100 shrink-0 sticky top-0 bg-white z-10">
          <div className="font-bold text-xl tracking-tight text-slate-900">UniqueOS</div>
        </div>
        <nav className="flex-1 py-4 px-3">
          <div className="mb-6">
            <p className="px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">User Account</p>
            {renderNavItems(userNav)}
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

      <div className="flex-1 flex flex-col h-full min-w-0 w-full overflow-hidden">
        <main className="mobile-scroll-padding flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 pt-4 md:p-8 w-full pb-20 md:pb-8">
          <div className="mx-auto max-w-5xl h-full w-full">
            <Outlet />
          </div>
        </main>

        <MobileBottomNav variant="app" onMenu={() => setIsMobileMenuOpen(true)} />
 </div>
    </div>
  );
}
