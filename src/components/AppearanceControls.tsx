import React, { useEffect, useState } from 'react';
import { Check, ChevronDown, Languages, Moon, Sun } from 'lucide-react';

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'ha', label: 'Hausa' },
  { code: 'fr', label: 'Français' },
  { code: 'ig', label: 'Igbo' },
  { code: 'yo', label: 'Yorùbá' },
  { code: 'pcm', label: 'Nigerian Pidgin' },
] as const;

export default function AppearanceControls() {
  const [dark, setDark] = useState(false);
  const [language, setLanguage] = useState('en');
  const [languageOpen, setLanguageOpen] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem('unique-one-theme');
    const savedLanguage = localStorage.getItem('unique-one-language');
    const initialDark = savedTheme === 'dark';
    setDark(initialDark);
    setLanguage(savedLanguage || 'en');
    document.documentElement.classList.toggle('unique-dark', initialDark);
    document.documentElement.dataset.language = savedLanguage || 'en';
    document.documentElement.style.colorScheme = initialDark ? 'dark' : 'light';
  }, []);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    localStorage.setItem('unique-one-theme', next ? 'dark' : 'light');
    document.documentElement.classList.toggle('unique-dark', next);
    document.documentElement.style.colorScheme = next ? 'dark' : 'light';
  };

  const changeLanguage = (code: string) => {
    setLanguage(code);
    localStorage.setItem('unique-one-language', code);
    document.documentElement.dataset.language = code;
    setLanguageOpen(false);
  };

  const currentLanguage = LANGUAGES.find((item) => item.code === language) || LANGUAGES[0];

  return (
    <div className="fixed right-3 top-3 z-[80] flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-white/90 p-1 shadow-lg shadow-slate-900/5 backdrop-blur-xl transition-all unique-appearance-controls">
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
        title={dark ? 'Light mode' : 'Dark mode'}
        className="group flex h-9 w-9 items-center justify-center rounded-full text-slate-600 transition hover:bg-emerald-50 hover:text-emerald-700 active:scale-95"
      >
        {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>

      <div className="relative">
        <button
          type="button"
          onClick={() => setLanguageOpen((open) => !open)}
          aria-expanded={languageOpen}
          aria-haspopup="listbox"
          aria-label="Change language"
          title="Language"
          className="flex h-9 items-center gap-1.5 rounded-full px-2.5 text-xs font-bold text-slate-700 transition hover:bg-emerald-50 hover:text-emerald-700 active:scale-95"
        >
          <Languages className="h-4 w-4" />
          <span className="hidden sm:inline">{currentLanguage.code.toUpperCase()}</span>
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${languageOpen ? 'rotate-180' : ''}`} />
        </button>

        {languageOpen && (
          <div
            role="listbox"
            aria-label="Select language"
            className="absolute right-0 top-11 w-48 overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 shadow-2xl shadow-slate-900/15"
          >
            <div className="px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
              Language
            </div>
            {LANGUAGES.map((item) => (
              <button
                key={item.code}
                type="button"
                role="option"
                aria-selected={language === item.code}
                onClick={() => changeLanguage(item.code)}
                className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-xs font-semibold text-slate-700 transition hover:bg-emerald-50 hover:text-emerald-800"
              >
                <span>{item.label}</span>
                {language === item.code && <Check className="h-4 w-4 text-emerald-600" />}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
