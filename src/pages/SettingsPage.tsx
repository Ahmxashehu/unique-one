import React from 'react';
import { User, Shield, Key, Bell, LogOut } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500 mt-1">Manage your UniqueOS account preferences.</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xl shrink-0">
            U
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">User Account</h3>
            <p className="text-slate-500">user@unique.one</p>
          </div>
          <button className="ml-auto px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors">
            Edit Profile
          </button>
        </div>

        <div className="divide-y divide-slate-100">
          <SettingRow 
            icon={<Shield className="w-5 h-5 text-slate-400" />}
            title="Account Security"
            description="Manage passwords and 2FA"
          />
          <SettingRow 
            icon={<Key className="w-5 h-5 text-slate-400" />}
            title="Permissions & Verification"
            description="NIN verification and document upload placeholders"
          />
          <SettingRow 
            icon={<Bell className="w-5 h-5 text-slate-400" />}
            title="Notification Preferences"
            description="Email, push, and SMS alerts"
          />
        </div>
      </div>

      <button className="flex items-center gap-2 text-red-600 font-medium px-4 py-3 hover:bg-red-50 rounded-lg transition-colors w-full sm:w-auto">
        <LogOut className="w-5 h-5" />
        Sign Out of UniqueOS
      </button>
    </div>
  );
}

function SettingRow({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="p-4 sm:px-6 flex items-center justify-between hover:bg-slate-50 cursor-pointer transition-colors">
      <div className="flex items-center gap-4">
        {icon}
        <div>
          <h4 className="text-sm font-medium text-slate-900">{title}</h4>
          <p className="text-xs text-slate-500">{description}</p>
        </div>
      </div>
      <svg className="w-5 h-5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </div>
  );
}
