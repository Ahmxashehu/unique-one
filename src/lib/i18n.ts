export type SupportedLanguage = 'en' | 'ha' | 'fr' | 'ig' | 'yo' | 'pcm';

export const SUPPORTED_LANGUAGES: { code: SupportedLanguage; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'ha', label: 'Hausa' },
  { code: 'fr', label: 'Français' },
  { code: 'ig', label: 'Igbo' },
  { code: 'yo', label: 'Yorùbá' },
  { code: 'pcm', label: 'Nigerian Pidgin' },
];

const translations: Record<SupportedLanguage, Record<string, string>> = {
  en: {
    language: 'Language', lightMode: 'Light mode', darkMode: 'Dark mode',
    activeEdge: 'Active Edge', categories: 'Categories', nearMe: 'Near Me', about: 'About', support: 'Support',
    dashboard: 'Dashboard', login: 'Log in', signUp: 'Sign Up', moreExperiences: 'More experiences',
    close: 'Close', openUniqueOS: 'Open UniqueOS', register: 'Register',
  },
  ha: {
    language: 'Harshe', lightMode: 'Yanayin haske', darkMode: 'Yanayin duhu',
    activeEdge: 'Sabbin abubuwa', categories: 'Rukuni', nearMe: 'Kusa da ni', about: 'Game da mu', support: 'Tallafi',
    dashboard: 'Dashboard', login: 'Shiga', signUp: 'Yi rajista', moreExperiences: 'Ƙarin ayyuka',
    close: 'Rufe', openUniqueOS: 'Buɗe UniqueOS', register: 'Yi rajista',
  },
  fr: {
    language: 'Langue', lightMode: 'Mode clair', darkMode: 'Mode sombre',
    activeEdge: 'À la une', categories: 'Catégories', nearMe: 'Près de moi', about: 'À propos', support: 'Assistance',
    dashboard: 'Tableau de bord', login: 'Se connecter', signUp: 'S’inscrire', moreExperiences: 'Plus d’expériences',
    close: 'Fermer', openUniqueOS: 'Ouvrir UniqueOS', register: 'S’inscrire',
  },
  ig: {
    language: 'Asụsụ', lightMode: 'Ọnọdụ ọkụ', darkMode: 'Ọnọdụ ọchịchịrị',
    activeEdge: 'Ihe ọhụrụ', categories: 'Ụdị', nearMe: 'N’akụkụ m', about: 'Banyere', support: 'Nkwado',
    dashboard: 'Dashboard', login: 'Banye', signUp: 'Debanye aha', moreExperiences: 'Ahụmịhe ndị ọzọ',
    close: 'Mechie', openUniqueOS: 'Mepee UniqueOS', register: 'Debanye aha',
  },
  yo: {
    language: 'Èdè', lightMode: 'Ipo ìmọ́lẹ̀', darkMode: 'Ipo òkùnkùn',
    activeEdge: 'Àwọn tuntun', categories: 'Àwọn ẹka', nearMe: 'Nítòsí mi', about: 'Nípa wa', support: 'Ìrànlọ́wọ́',
    dashboard: 'Pẹpẹ iṣakoso', login: 'Wọlé', signUp: 'Forúkọsílẹ̀', moreExperiences: 'Àwọn ìrírí míì',
    close: 'Pa', openUniqueOS: 'Ṣí UniqueOS', register: 'Forúkọsílẹ̀',
  },
  pcm: {
    language: 'Language', lightMode: 'Light mode', darkMode: 'Dark mode',
    activeEdge: 'New things', categories: 'Categories', nearMe: 'Near Me', about: 'About', support: 'Support',
    dashboard: 'Dashboard', login: 'Log in', signUp: 'Sign Up', moreExperiences: 'More experiences',
    close: 'Close', openUniqueOS: 'Open UniqueOS', register: 'Register',
  },
};

export function getLanguage(): SupportedLanguage {
  if (typeof window === 'undefined') return 'en';
  const saved = window.localStorage.getItem('unique-one-language') as SupportedLanguage | null;
  return saved && translations[saved] ? saved : 'en';
}

export function t(key: string, language: SupportedLanguage = getLanguage()): string {
  return translations[language]?.[key] ?? translations.en[key] ?? key;
}

export function setLanguage(language: SupportedLanguage) {
  if (typeof window === 'undefined') return;
  // English remains the default; this setting is a user preference persisted across the app.
  window.localStorage.setItem('unique-one-language', language);
  document.documentElement.lang = language;
  document.documentElement.dataset.language = language;
  window.dispatchEvent(new CustomEvent('unique-language-change', { detail: language }));

  // Reload once so every React route/component initializes from the same saved preference.
  // This avoids individual pages retaining stale English state after a language switch.
  window.setTimeout(() => window.location.reload(), 0);
}
