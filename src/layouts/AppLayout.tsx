import React, { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, Store, Wallet, Calendar, Bell, Settings, 
  Briefcase, ShoppingCart, Users, FileText, Receipt,
  User, MessageSquare, Heart, ClipboardList, Globe, Shield, 
  Building2, Store as StoreIcon, Activity, PlusCircle, Menu, X, LogOut
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';

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

  const mobileNav = [
    { name: 'Dashboard', path: '/os/dashboard', icon: LayoutDashboard },
    { name: 'Store', path: '/store', icon: Store },
    { name: 'Pay', path: '/os/pay', icon: Wallet },
    { name: 'Orders', path: '/os/orders', icon: ShoppingCart },
    { name: 'Menu', path: '#', icon: Menu, action: () => setIsMobileMenuOpen(true) },
  ];

  const renderNavItems = (items: any[], isMobile: boolean = false) => (
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
              "flex items-center gap-3 px-3 py-3 md:py-2 rounded-lg text-sm font-medium transition-colors touch-manipulation",
              isActive
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            )}
          >
            <Icon className={cn("w-5 h-5", isActive ? "text-slate-200" : "text-slate-400")} />
            {item.name}
          </Link>
        );
      })}
    </div>
  );

  return (
    <div className="flex h-full bg-slate-50 overflow-hidden w-full max-w-[100vw]">
      {/* Mobile Menu Overlay */}
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
                {renderNavItems(userNav, true)}
              </div>
              <div className="mb-6">
                <p className="px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Business Tools</p>
                {renderNavItems(businessNav, true)}
              </div>
              <div>
                <p className="px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">System</p>
                {renderNavItems(systemNav, true)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Desktop Sidebar */}
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
            <p className="px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Business Tools</p>
            {renderNavItems(businessNav)}
          </div>
          <div>
            <p className="px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">System</p>
            {renderNavItems(systemNav)}
          </div>
        </nav>
        
        {/* User Profile Mini */}
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

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full min-w-0 w-full overflow-hidden">
        {/* Mobile Header */}
        <header className="md:hidden h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 shrink-0 w-full">
          <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 -ml-2 text-slate-600 touch-manipulation">
            <Menu className="w-6 h-6" />
          </button>
          <div className="font-bold text-lg text-slate-900">UniqueOS</div>
          <div className="flex items-center gap-2">
            <button className="text-slate-600 p-1 touch-manipulation">
              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center uppercase">
                <span className="text-sm font-medium text-slate-700">{userData?.fullName?.charAt(0) || 'U'}</span>
              </div>
            </button>
            <button onClick={handleLogout} className="p-1 text-slate-400 hover:text-red-600 touch-manipulation">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-8 w-full pb-20 md:pb-8">
          <div className="mx-auto max-w-5xl h-full w-full">
            <Outlet />
          </div>
        </main>

        {/* Mobile Bottom Navigation */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-slate-200 flex items-center justify-around px-2 pb-safe z-40 w-full">
          {mobileNav.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname.includes(item.path) && item.path !== '#';
            if (item.action) {
              return (
                <button
                  key={item.name}
                  onClick={item.action}
                  className="flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors text-slate-500 hover:text-slate-900 touch-manipulation"
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-[10px] font-medium">{item.name}</span>
                </button>
              );
            }
            return (
              <Link
                key={item.name}
                to={item.path}
                className={cn(
                  "flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors touch-manipulation",
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
    </div>
  );
}
