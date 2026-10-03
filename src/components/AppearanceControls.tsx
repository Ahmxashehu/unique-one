import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Languages, Moon, Sun } from 'lucide-react';
import { getLanguage, setLanguage, SUPPORTED_LANGUAGES, t, type SupportedLanguage } from '../lib/i18n';

export default function AppearanceControls() {
  const [dark, setDark] = useState(false);
  const [language, setSelectedLanguage] = useState<SupportedLanguage>('en');
  const [languageOpen, setLanguageOpen] = useState(false);
  const languageMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedTheme = localStorage.getItem('unique-one-theme');
    const savedLanguage = getLanguage();
    const initialDark = savedTheme === 'dark';
    setDark(initialDark);
    setSelectedLanguage(savedLanguage);
    document.documentElement.classList.toggle('unique-dark', initialDark);
    document.documentElement.dataset.language = savedLanguage;
    document.documentElement.style.colorScheme = initialDark ? 'dark' : 'light';
  }, []);

  useEffect(() => {
    if (!languageOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!languageMenuRef.current?.contains(event.target as Node)) setLanguageOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setLanguageOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [languageOpen]);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    localStorage.setItem('unique-one-theme', next ? 'dark' : 'light');
    document.documentElement.classList.toggle('unique-dark', next);
    document.documentElement.style.colorScheme = next ? 'dark' : 'light';
  };

  const changeLanguage = (code: string) => {
    setSelectedLanguage(code as SupportedLanguage);
    setLanguage(code as SupportedLanguage);
    setLanguageOpen(false);
  };

  const currentLanguage = SUPPORTED_LANGUAGES.find((item) => item.code === language) || SUPPORTED_LANGUAGES[0];

  return (
    <>
      <div className="fixed right-3 top-9 z-[80] flex items-center gap-1.5 rounded-full border border-white/70 bg-white/90 p-1 shadow-lg shadow-slate-900/5 backdrop-blur-xl transition-all unique-appearance-controls sm:right-4 sm:top-9">
      <div className="relative flex h-9 w-9 shrink-0 items-center justify-center" aria-hidden="true">
        <span className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-emerald-400 border-r-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.65)]" style={{ animationDuration: '2.4s' }} />
        <span className="absolute inset-[-2px] animate-pulse rounded-full bg-emerald-400/15 blur-md" />
        <span className="relative z-10 flex h-7 w-7 items-center justify-center rounded-full border border-white/90 bg-white text-[11px] font-black tracking-[-0.08em] text-emerald-700 shadow-sm">
          U1
        </span>
      </div>
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={dark ? t('lightMode', language) : t('darkMode', language)}
        title={dark ? t('lightMode', language) : t('darkMode', language)}
        className="group flex h-9 w-9 items-center justify-center rounded-full text-slate-600 transition hover:bg-emerald-50 hover:text-emerald-700 active:scale-95"
      >
        {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>

      <div ref={languageMenuRef} className="relative">
        <button
          type="button"
          onClick={() => setLanguageOpen((open) => !open)}
          aria-expanded={languageOpen}
          aria-haspopup="listbox"
          aria-label={t('language', language)}
          title={t('language', language)}
          className="flex h-9 items-center gap-1.5 rounded-full px-2.5 text-xs font-bold text-slate-700 transition hover:bg-emerald-50 hover:text-emerald-700 active:scale-95"
        >
          <Languages className="h-4 w-4" />
          <span className="hidden sm:inline">{currentLanguage.code.toUpperCase()}</span>
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${languageOpen ? 'rotate-180' : ''}`} />
        </button>

        {languageOpen && (
          <div
            role="listbox"
            aria-label={t('language', language)}
            className="absolute right-0 top-11 w-48 overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 shadow-2xl shadow-slate-900/15"
          >
            <div className="px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
              Language
            </div>
            {SUPPORTED_LANGUAGES.map((item) => (
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
    </>
  );
}
