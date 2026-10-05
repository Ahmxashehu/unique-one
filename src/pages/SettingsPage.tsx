import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { User, Shield, Key, Bell, LogOut, ChevronRight, GraduationCap, Sparkles } from 'lucide-react';

export default function SettingsPage() {
  const { currentUser, userData, logout } = useAuth();
  const isGuest = !currentUser;
  const displayName = userData?.fullName || currentUser?.displayName || 'Guest User';
  const identifier = userData?.uniqueOneId || currentUser?.email || 'Explore Unique One without an account';
  const initials = isGuest ? 'G' : (displayName.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'U');

  return (
    <div className="min-h-full bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-3xl space-y-5">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-600">Unique One</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950">Settings</h1>
          <p className="mt-1 text-sm text-slate-500">Your personal control center.</p>
        </div>
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-4 border-b border-slate-100 p-5 sm:p-6">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-lg font-black text-emerald-700">{initials}</div>
            <div className="min-w-0">
              <h3 className="truncate text-lg font-black text-slate-900">{displayName}</h3>
              <p className="truncate text-sm text-slate-500">{identifier}</p>
            </div>
            {currentUser && <Link to="/os/profile" className="ml-auto shrink-0 rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700">Profile</Link>}
          </div>
          {isGuest ? (
            <div className="bg-gradient-to-br from-emerald-50 via-white to-slate-50 p-5 sm:p-6">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-white p-2.5 shadow-sm"><User className="h-5 w-5 text-emerald-600" /></div>
                <div><h2 className="text-base font-black text-slate-900">You're exploring as a guest</h2><p className="mt-1 text-sm leading-5 text-slate-600">Keep exploring freely. Sign in or create your Unique One account only when you are ready to save, pay, book, communicate, post, or manage your activity.</p></div>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-2">
                <Link to="/login" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-center text-sm font-black text-slate-800">Sign In</Link>
                <Link to="/register" className="rounded-2xl bg-slate-950 px-4 py-3 text-center text-sm font-black text-white">Create Account</Link>
              </div>
            </div>
          ) : (
            <div className="bg-gradient-to-br from-emerald-50 via-white to-slate-50 p-5 sm:p-6">
              <p className="text-sm font-bold text-emerald-700">Your UniqueOS is ready</p>
              <p className="mt-1 text-sm text-slate-600">Manage your identity, payments, activity and connected experiences from UniqueOS.</p>
              <Link to="/os/dashboard" className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white">Open UniqueOS <ChevronRight className="h-4 w-4" /></Link>
            </div>
          )}
        </div>
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
          <SettingRow icon={<User className="h-5 w-5 text-emerald-600" />} title="My Profile" description="Identity, personal details and Unique ID" />
          <SettingRow icon={<Bell className="h-5 w-5 text-slate-400" />} title="Notifications" description="Choose the alerts you want to receive" />
          <SettingRow icon={<Shield className="h-5 w-5 text-slate-400" />} title="Privacy & Security" description="Control account security and permissions" />
          <SettingRow icon={<Key className="h-5 w-5 text-slate-400" />} title="Verification" description="Manage identity verification when required" />
        </div>
        <Link to="/education-hub" className="group relative block overflow-hidden rounded-3xl border border-emerald-300/30 bg-gradient-to-br from-slate-950 via-emerald-950 to-slate-900 p-5 text-white shadow-[0_0_28px_rgba(16,185,129,0.14)]">
          <span className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-emerald-400/20 blur-2xl transition group-hover:bg-emerald-300/30" />
          <span className="absolute inset-0 rounded-3xl border border-emerald-300/10 animate-pulse" />
          <div className="relative flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-emerald-300/30 bg-emerald-400/10 shadow-[0_0_24px_rgba(52,211,153,0.22)]"><GraduationCap className="h-6 w-6 text-emerald-300" /></div>
            <div className="min-w-0 flex-1"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300">New experience</p><h2 className="mt-1 text-base font-black">UniqueEducationHub</h2><p className="mt-1 text-xs leading-5 text-slate-300">Learn • Teach • Contribute • Grow</p></div>
            <div className="rounded-xl bg-white/10 p-2 transition group-hover:translate-x-0.5"><ChevronRight className="h-5 w-5 text-emerald-300" /></div>
          </div>
        </Link>
        {currentUser && <button onClick={() => void logout()} className="flex items-center gap-2 rounded-2xl px-4 py-3 font-bold text-red-600 hover:bg-red-50"><LogOut className="h-5 w-5" /> Sign Out of UniqueOS</button>}
      </div>
    </div>
  );
}

function SettingRow({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return <div className="flex items-center justify-between border-b border-slate-100 p-4 last:border-b-0 sm:px-6"><div className="flex items-center gap-4">{icon}<div><h4 className="text-sm font-bold text-slate-900">{title}</h4><p className="text-xs text-slate-500">{description}</p></div></div><ChevronRight className="h-5 w-5 text-slate-300" /></div>;
}