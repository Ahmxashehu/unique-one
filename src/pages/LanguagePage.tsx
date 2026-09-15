import React from 'react';
import { Globe, Check } from 'lucide-react';

export default function LanguagePage() {
  const languages = [
    { code: 'en', name: 'English', region: 'Global', active: true },
    { code: 'fr', name: 'Français', region: 'Afrique de l\'Ouest', active: false },
    { code: 'ha', name: 'Hausa', region: 'Nigeria', active: false },
    { code: 'yo', name: 'Yoruba', region: 'Nigeria', active: false },
    { code: 'ig', name: 'Igbo', region: 'Nigeria', active: false },
  ];

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Language Preferences</h1>
        <p className="text-sm text-slate-500 mt-1">Choose your preferred language for the UniqueOS interface.</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        {languages.map((lang, idx) => (
          <div 
            key={lang.code} 
            className={`flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 transition-colors ${idx !== languages.length - 1 ? 'border-b border-slate-100' : ''}`}
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center">
                <Globe className="w-5 h-5 text-slate-500" />
              </div>
              <div>
                <p className="font-medium text-slate-900">{lang.name}</p>
                <p className="text-xs text-slate-500">{lang.region}</p>
              </div>
            </div>
            {lang.active && (
              <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center">
                <Check className="w-4 h-4 text-emerald-600" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
