export type SupportedLanguage = 'en' | 'ha' | 'fr' | 'ig' | 'yo' | 'pcm';

export const SUPPORTED_LANGUAGES: { code: SupportedLanguage; label: string }[] = [
  { code: 'en', label: 'English' }, { code: 'ha', label: 'Hausa' }, { code: 'fr', label: 'Français' },
  { code: 'ig', label: 'Igbo' }, { code: 'yo', label: 'Yorùbá' }, { code: 'pcm', label: 'Nigerian Pidgin' },
];

type TranslationKey =
  | 'language' | 'lightMode' | 'darkMode' | 'activeEdge' | 'categories' | 'nearMe' | 'about' | 'support'
  | 'dashboard' | 'login' | 'signUp' | 'moreExperiences' | 'close' | 'openUniqueOS' | 'register'
  | 'home' | 'search' | 'ai' | 'settings' | 'profile' | 'messages' | 'orders' | 'bookings' | 'wishlist'
  | 'notifications' | 'logout' | 'send' | 'receive' | 'cancel' | 'save' | 'back' | 'next' | 'continue'
  | 'submit' | 'welcomeBack' | 'createAccount' | 'loading' | 'error' | 'success' | 'account' | 'store'
  | 'pay' | 'media' | 'share' | 'business' | 'payments' | 'cart' | 'favorites' | 'help' | 'confirm'
  | 'delete' | 'edit' | 'done' | 'retry' | 'viewAll' | 'seeMore' | 'noResults' | 'tryAgain';

const translations: Record<SupportedLanguage, Record<TranslationKey, string>> = {
  en: {
    language:'Language', lightMode:'Light mode', darkMode:'Dark mode', activeEdge:'Active Edge', categories:'Categories',
    nearMe:'Near Me', about:'About', support:'Support', dashboard:'Dashboard', login:'Log in', signUp:'Sign Up',
    moreExperiences:'More experiences', close:'Close', openUniqueOS:'Open UniqueOS', register:'Register',
    home:'Home', search:'Search', ai:'AI', settings:'Settings', profile:'Profile', messages:'Messages',
    orders:'Orders', bookings:'Bookings', wishlist:'Wishlist', notifications:'Notifications', logout:'Log out',
    send:'Send', receive:'Receive', cancel:'Cancel', save:'Save', back:'Back', next:'Next', continue:'Continue',
    submit:'Submit', welcomeBack:'Welcome back', createAccount:'Create account', loading:'Loading',
    error:'Error', success:'Success', account:'Account', store:'Store', pay:'Pay', media:'Media', share:'Share',
    business:'Business', payments:'Payments', cart:'Cart', favorites:'Favorites', help:'Help', confirm:'Confirm',
    delete:'Delete', edit:'Edit', done:'Done', retry:'Retry', viewAll:'View all', seeMore:'See more',
    noResults:'No results found', tryAgain:'Try again',
  },
  ha: {
    language:'Harshe', lightMode:'Yanayin haske', darkMode:'Yanayin duhu', activeEdge:'Sabbin abubuwa', categories:'Rukuni',
    nearMe:'Kusa da ni', about:'Game da mu', support:'Tallafi', dashboard:'Dashboard', login:'Shiga', signUp:'Yi rajista',
    moreExperiences:'Ƙarin ayyuka', close:'Rufe', openUniqueOS:'Buɗe UniqueOS', register:'Yi rajista',
    home:'Gida', search:'Bincika', ai:'AI', settings:'Saituna', profile:'Bayani na', messages:'Saƙonni',
    orders:'Umarni', bookings:'Ajiyar wuri', wishlist:'Abubuwan so', notifications:'Sanarwa', logout:'Fita',
    send:'Aika', receive:'Karɓa', cancel:'Soke', save:'Ajiye', back:'Koma', next:'Na gaba', continue:'Ci gaba',
    submit:'Tura', welcomeBack:'Barka da dawowa', createAccount:'Ƙirƙiri asusu', loading:'Ana lodawa',
    error:'Kuskure', success:'An yi nasara', account:'Asusu', store:'Shago', pay:'Biya', media:'Kafofin watsa labarai',
    share:'Raba', business:'Kasuwanci', payments:'Biyan kuɗi', cart:'Keken siyayya', favorites:'Abubuwan da aka fi so',
    help:'Taimako', confirm:'Tabbatar', delete:'Share', edit:'Gyara', done:'An gama', retry:'Sake gwadawa',
    viewAll:'Duba duka', seeMore:'Duba ƙari', noResults:'Ba a sami sakamako ba', tryAgain:'Sake gwadawa',
  },
  fr: {
    language:'Langue', lightMode:'Mode clair', darkMode:'Mode sombre', activeEdge:'À la une', categories:'Catégories',
    nearMe:'Près de moi', about:'À propos', support:'Assistance', dashboard:'Tableau de bord', login:'Se connecter',
    signUp:'S’inscrire', moreExperiences:'Plus d’expériences', close:'Fermer', openUniqueOS:'Ouvrir UniqueOS', register:'S’inscrire',
    home:'Accueil', search:'Rechercher', ai:'IA', settings:'Paramètres', profile:'Profil', messages:'Messages',
    orders:'Commandes', bookings:'Réservations', wishlist:'Liste de souhaits', notifications:'Notifications', logout:'Se déconnecter',
    send:'Envoyer', receive:'Recevoir', cancel:'Annuler', save:'Enregistrer', back:'Retour', next:'Suivant', continue:'Continuer',
    submit:'Envoyer', welcomeBack:'Bon retour', createAccount:'Créer un compte', loading:'Chargement',
    error:'Erreur', success:'Réussite', account:'Compte', store:'Boutique', pay:'Payer', media:'Médias', share:'Partager',
    business:'Entreprise', payments:'Paiements', cart:'Panier', favorites:'Favoris', help:'Aide', confirm:'Confirmer',
    delete:'Supprimer', edit:'Modifier', done:'Terminé', retry:'Réessayer', viewAll:'Tout voir', seeMore:'Voir plus',
    noResults:'Aucun résultat', tryAgain:'Réessayer',
  },
  ig: {
    language:'Asụsụ', lightMode:'Ọnọdụ ọkụ', darkMode:'Ọnọdụ ọchịchịrị', activeEdge:'Ihe ọhụrụ', categories:'Ụdị',
    nearMe:'N’akụkụ m', about:'Banyere', support:'Nkwado', dashboard:'Dashboard', login:'Banye', signUp:'Debanye aha',
    moreExperiences:'Ahụmịhe ndị ọzọ', close:'Mechie', openUniqueOS:'Mepee UniqueOS', register:'Debanye aha',
    home:'Ụlọ', search:'Chọọ', ai:'AI', settings:'Ntọala', profile:'Profaịlụ', messages:'Ozi',
    orders:'Iwu', bookings:'Ndokwa', wishlist:'Ihe ndị masịrị', notifications:'Ọkwa', logout:'Pụọ',
    send:'Zipu', receive:'Nata', cancel:'Kagbuo', save:'Chekwaa', back:'Laghachi', next:'Ọzọ', continue:'Gaa n’ihu',
    submit:'Zipu', welcomeBack:'Nnọọ ọzọ', createAccount:'Mepụta akaụntụ', loading:'Na-ebugo',
    error:'Njehie', success:'Ihe ịga nke ọma', account:'Akaụntụ', store:'Ụlọ ahịa', pay:'Kwụọ', media:'Mgbasa ozi',
    share:'Kekọrịta', business:'Azụmahịa', payments:'Ịkwụ ụgwọ', cart:'Akpa ịzụ ahịa', favorites:'Ihe ndị kacha amasị',
    help:'Enyemaka', confirm:'Kwenye', delete:'Hichapụ', edit:'Dezie', done:'Emechara', retry:'Nwaa ọzọ',
    viewAll:'Lee ha niile', seeMore:'Lee ndị ọzọ', noResults:'Enweghị nsonaazụ', tryAgain:'Nwaa ọzọ',
  },
  yo: {
    language:'Èdè', lightMode:'Ipo ìmọ́lẹ̀', darkMode:'Ipo òkùnkùn', activeEdge:'Àwọn tuntun', categories:'Àwọn ẹka',
    nearMe:'Nítòsí mi', about:'Nípa wa', support:'Ìrànlọ́wọ́', dashboard:'Pẹpẹ iṣakoso', login:'Wọlé',
    signUp:'Forúkọsílẹ̀', moreExperiences:'Àwọn ìrírí míì', close:'Pa', openUniqueOS:'Ṣí UniqueOS', register:'Forúkọsílẹ̀',
    home:'Ilé', search:'Wá', ai:'AI', settings:'Ètò', profile:'Àkọsílẹ̀', messages:'Àwọn ifiranṣẹ',
    orders:'Àwọn àṣẹ', bookings:'Àwọn ìfipamọ́', wishlist:'Àwọn ohun tí mo fẹ́', notifications:'Àwọn ìfitónilétí', logout:'Jáde',
    send:'Firanṣẹ́', receive:'Gba', cancel:'Fagilé', save:'Fipamọ́', back:'Padà', next:'Tókàn', continue:'Tẹ̀síwájú',
    submit:'Firanṣẹ́', welcomeBack:'Káàbọ̀ padà', createAccount:'Ṣẹ̀dá àkọọ́lẹ̀', loading:'Ń gbee',
    error:'Àṣìṣe', success:'Àṣeyọrí', account:'Àkọọlẹ̀', store:'Ilé ìtajà', pay:'San', media:'Àwọn media',
    share:'Pín', business:'Iṣòwò', payments:'Àwọn ìsanwó', cart:'Kẹ̀kẹ́ ìtajà', favorites:'Àwọn ayanfẹ́',
    help:'Ìrànlọ́wọ́', confirm:'Jẹ́rìísí', delete:'Paarẹ́', edit:'Ṣàtúnṣe', done:'Parí', retry:'Gbìyànjú lẹ́ẹ̀kansi',
    viewAll:'Wo gbogbo rẹ̀', seeMore:'Wo síi', noResults:'Ko sí àbájáde', tryAgain:'Gbìyànjú lẹ́ẹ̀kansi',
  },
  pcm: {
    language:'Language', lightMode:'Light mode', darkMode:'Dark mode', activeEdge:'New things', categories:'Categories',
    nearMe:'Near Me', about:'About', support:'Support', dashboard:'Dashboard', login:'Log in', signUp:'Sign Up',
    moreExperiences:'More experiences', close:'Close', openUniqueOS:'Open UniqueOS', register:'Register',
    home:'Home', search:'Search', ai:'AI', settings:'Settings', profile:'Profile', messages:'Messages',
    orders:'Orders', bookings:'Bookings', wishlist:'Wishlist', notifications:'Notifications', logout:'Log out',
    send:'Send', receive:'Receive', cancel:'Cancel', save:'Save', back:'Back', next:'Next', continue:'Continue',
    submit:'Submit', welcomeBack:'Welcome back', createAccount:'Create account', loading:'Loading',
    error:'Error', success:'Success', account:'Account', store:'Store', pay:'Pay', media:'Media', share:'Share',
    business:'Business', payments:'Payments', cart:'Cart', favorites:'Favorites', help:'Help', confirm:'Confirm',
    delete:'Delete', edit:'Edit', done:'Done', retry:'Try am again', viewAll:'See all', seeMore:'See more',
    noResults:'No result', tryAgain:'Try am again',
  },
};

export function getLanguage(): SupportedLanguage {
  if (typeof window === 'undefined') return 'en';
  const saved = window.localStorage.getItem('unique-one-language') as SupportedLanguage | null;
  return saved && translations[saved] ? saved : 'en';
}

export function t(key: string, language: SupportedLanguage = getLanguage()): string {
  return translations[language]?.[key as TranslationKey] ?? translations.en[key as TranslationKey] ?? key;
}

export function setLanguage(language: SupportedLanguage) {
  if (typeof window === 'undefined' || !translations[language]) return;
  window.localStorage.setItem('unique-one-language', language);
  document.documentElement.lang = language;
  document.documentElement.dataset.language = language;
  window.dispatchEvent(new CustomEvent('unique-language-change', { detail: language }));
}
