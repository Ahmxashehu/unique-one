import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { User, Shield, Key, Bell, LogOut, Lightbulb, ChevronRight, CheckCircle2 } from 'lucide-react';

export default function SettingsPage() {
  const { currentUser, userData, logout } = useAuth();
  const navigate = useNavigate();
  const isGuest = !currentUser;
  const displayName = userData?.fullName || currentUser?.displayName || 'Guest User';
  const identifier = isGuest
    ? 'Explore UniquePlatform without an account'
    : (userData?.email || currentUser?.email || userData?.uniqueOneId || 'Your UniquePlatform account');
  const initials = isGuest ? 'G' : (displayName.split(/\\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'U');

  const handleSignOut = async () => {
    try {
      await logout();
      navigate('/settings', { replace: true });
    } catch (error) {
      console.error('Unable to sign out:', error);
    }
  };

  return (
    <div className="min-h-full bg-slate-50 px-3 py-4 sm:px-5 sm:py-5">
      <div className="mx-auto w-full max-w-2xl space-y-4">
        <header className="flex items-end justify-between gap-3 px-1">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-600">UniquePlatform</p>
            <h1 className="mt-0.5 text-xl font-black tracking-tight text-slate-950 sm:text-2xl">Settings</h1>
            <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">Your personal control center.</p>
          </div>
        </header>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 p-3.5 sm:p-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-black text-emerald-700 sm:h-12 sm:w-12">{initials}</div>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-sm font-black text-slate-900 sm:text-base">{displayName}</h2>
              <p className="mt-0.5 truncate text-xs text-slate-500">{identifier}</p>
              {!isGuest && userData?.uniqueOneId && <p className="mt-0.5 truncate text-[11px] font-semibold text-emerald-700">Unique ID: {userData.uniqueOneId}</p>}
            </div>
            {currentUser && <Link to="/os/profile" className="shrink-0 rounded-lg border border-slate-200 px-2.5 py-2 text-[11px] font-bold text-slate-700 hover:bg-slate-50 sm:text-xs">View Profile</Link>}
          </div>
          {isGuest ? (
            <div className="border-t border-slate-100 bg-emerald-50/60 px-3.5 py-3 sm:px-4">
              <p className="text-xs leading-5 text-slate-600">You're exploring as a guest. Sign in to save, pay, book, communicate and manage your activity.</p>
              <div className="mt-2.5 grid grid-cols-2 gap-2">
                <Link to="/login" className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-center text-xs font-black text-slate-800">Sign In</Link>
                <Link to="/register" className="rounded-xl bg-slate-950 px-3 py-2.5 text-center text-xs font-black text-white">Create Account</Link>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 border-t border-slate-100 bg-emerald-50/60 px-3.5 py-2.5 text-xs font-semibold text-emerald-800 sm:px-4">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>Signed in to your UniquePlatform account</span>
            </div>
          )}
        </section>

        <section aria-label="Profile and account settings" className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <p className="px-4 pb-1 pt-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Account</p>
          <SettingRow to={currentUser ? "/os/profile" : "/login"} icon={<User className="h-4 w-4 text-emerald-600" />} title="My Profile" description={currentUser ? "Personal details and Unique ID" : "Sign in to manage your profile"} />
          <SettingRow to="/os/notifications" icon={<Bell className="h-4 w-4 text-slate-500" />} title="Notifications" description="Choose the alerts you receive" />
          <p className="px-4 pb-1 pt-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Privacy & security</p>
          <SettingRow to="/os/security" icon={<Shield className="h-4 w-4 text-slate-500" />} title="Privacy & Security" description="Account protection and permissions" />
          <SettingRow to="/os/security" icon={<Key className="h-4 w-4 text-slate-500" />} title="Verification" description="Manage identity checks when required" />
        </section>

        <section className="rounded-2xl border border-emerald-100 bg-white p-3.5 sm:p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50"><Lightbulb className="h-4 w-4 text-emerald-600" /></div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-black text-slate-900">Help shape UniquePlatform</h2>
              <p className="mt-0.5 text-xs leading-4 text-slate-500">Share an idea or suggest an improvement.</p>
            </div>
          </div>
          <Link to="/os/settings" className="mt-3 flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-bold text-slate-800 hover:bg-slate-100"><span>Suggest an improvement</span><ChevronRight className="h-4 w-4 text-slate-400" /></Link>
        </section>

        {currentUser && (
          <button type="button" onClick={() => void handleSignOut()} className="flex w-full items-center gap-3 rounded-2xl border border-red-100 bg-white px-3.5 py-3 text-left text-sm font-bold text-red-600 hover:bg-red-50">
            <LogOut className="h-4 w-4 shrink-0" />
            <span><span className="block">Sign Out</span><span className="mt-0.5 block text-[11px] font-normal text-slate-500">Securely sign out of your account</span></span>
          </button>
        )}
      </div>
    </div>
  );
}

function SettingRow({ to, icon, title, description }: { to: string; icon: React.ReactNode; title: string; description: string }) {
  return (
    <Link to={to} className="flex min-h-[58px] items-center justify-between gap-3 border-b border-slate-100 px-4 py-2.5 last:border-b-0 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-50">{icon}</div>
        <div className="min-w-0"><h3 className="text-xs font-bold text-slate-900 sm:text-sm">{title}</h3><p className="mt-0.5 text-[11px] text-slate-500 sm:text-xs">{description}</p></div>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
    </Link>
  );
}
