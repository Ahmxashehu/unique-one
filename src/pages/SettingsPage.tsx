import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { User, Shield, Key, Bell, LogOut, Lightbulb, ChevronRight } from 'lucide-react';

export default function SettingsPage() {
  const { currentUser, userData, logout } = useAuth();
  const navigate = useNavigate();
  const isGuest = !currentUser;
  const displayName = userData?.fullName || currentUser?.displayName || 'Guest User';
  const identifier = isGuest
    ? 'Explore UniquePlatform without an account'
    : (userData?.email || currentUser?.email || userData?.uniqueOneId || 'Your UniquePlatform account');
  const initials = isGuest ? 'G' : (displayName.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'U');

  const handleSignOut = async () => {
    try {
      await logout();
      navigate('/settings', { replace: true });
    } catch (error) {
      console.error('Unable to sign out:', error);
    }
  };

  return (
    <div className="min-h-full bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-3xl space-y-5">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-600">UniquePlatform</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950">Settings</h1>
          <p className="mt-1 text-sm text-slate-500">Your personal control center.</p>
        </div>
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-4 border-b border-slate-100 p-5 sm:p-6">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-lg font-black text-emerald-700">{initials}</div>
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-lg font-black text-slate-900">{displayName}</h3>
              <p className="truncate text-sm text-slate-500">{identifier}</p>
            </div>
            {currentUser && <Link to="/os/profile" className="shrink-0 rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700">View Profile</Link>}
          </div>
          {isGuest ? (
            <div className="bg-gradient-to-br from-emerald-50 via-white to-slate-50 p-5 sm:p-6">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-white p-2.5 shadow-sm"><User className="h-5 w-5 text-emerald-600" /></div>
                <div><h2 className="text-base font-black text-slate-900">You're exploring as a guest</h2><p className="mt-1 text-sm leading-5 text-slate-600">Keep exploring freely. Sign in or create your UniquePlatform account when you are ready to save, pay, book, communicate, post, or manage your activity.</p></div>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-2">
                <Link to="/login" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-center text-sm font-black text-slate-800">Sign In</Link>
                <Link to="/register" className="rounded-2xl bg-slate-950 px-4 py-3 text-center text-sm font-black text-white">Create Account</Link>
              </div>
            </div>
          ) : (
            <div className="bg-gradient-to-br from-emerald-50 via-white to-slate-50 p-5 sm:p-6">
              <p className="text-sm font-bold text-emerald-700">Your UniquePlatform account is ready</p>
              <p className="mt-1 text-sm text-slate-600">Manage your identity, payments, activity and connected experiences from UniquePlatform.</p>
            </div>
          )}
        </div>
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
          <SettingRow to={currentUser ? "/os/profile" : "/login"} icon={<User className="h-5 w-5 text-emerald-600" />} title="My Profile" description={currentUser ? "Identity, personal details and Unique ID" : "Sign in to view and manage your profile"} />
          <SettingRow to="/os/notifications" icon={<Bell className="h-5 w-5 text-slate-400" />} title="Notifications" description="Choose the alerts you want to receive" />
          <SettingRow to="/os/security" icon={<Shield className="h-5 w-5 text-slate-400" />} title="Privacy & Security" description="Control account security and permissions" />
          <SettingRow to="/os/security" icon={<Key className="h-5 w-5 text-slate-400" />} title="Verification" description="Manage identity verification when required" />
        </div>
        <div className="rounded-3xl border border-emerald-100 bg-emerald-50/70 p-5">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-white p-2.5 shadow-sm"><Lightbulb className="h-5 w-5 text-emerald-600" /></div>
            <div className="min-w-0 flex-1"><h2 className="text-sm font-black text-slate-900">Help shape UniquePlatform</h2><p className="mt-1 text-sm text-slate-600">Have an idea, missing service or better way to do something? Send us your suggestion.</p></div>
          </div>
          <Link to="/os/settings" className="mt-4 flex w-full items-center justify-between rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-left text-sm font-black text-slate-800"><span>Suggest an improvement</span><ChevronRight className="h-4 w-4 text-slate-400" /></Link>
        </div>
        {currentUser && (
          <button type="button" onClick={() => void handleSignOut()} className="flex w-full items-center gap-3 rounded-2xl border border-red-100 bg-white px-4 py-4 text-left font-bold text-red-600 hover:bg-red-50">
            <LogOut className="h-5 w-5" />
            <span><span className="block">Sign Out</span><span className="mt-0.5 block text-xs font-normal text-slate-500">Securely sign out of your UniquePlatform account</span></span>
          </button>
        )}
      </div>
    </div>
  );
}

function SettingRow({ to, icon, title, description }: { to: string; icon: React.ReactNode; title: string; description: string }) {
  return (
    <Link to={to} className="flex items-center justify-between gap-3 border-b border-slate-100 p-4 last:border-b-0 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500 sm:px-6">
      <div className="flex min-w-0 items-center gap-4">{icon}<div className="min-w-0"><h4 className="text-sm font-bold text-slate-900">{title}</h4><p className="text-xs text-slate-500">{description}</p></div></div>
      <ChevronRight className="h-5 w-5 shrink-0 text-slate-300" />
    </Link>
  );
}