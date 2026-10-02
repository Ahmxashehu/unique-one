import { useEffect } from "react";
import { getLanguage, type SupportedLanguage } from "../lib/i18n";

const UI_TRANSLATIONS: Record<SupportedLanguage, Record<string, string>> = {
  en: {},
  ha: {
    "Home": "Gida", "Search": "Bincike", "AI": "AI", "Language": "Harshe",
    "Light mode": "Yanayin haske", "Dark mode": "Yanayin duhu", "Log in": "Shiga",
    "Sign Up": "Yi rajista", "Register": "Yi rajista", "Dashboard": "Dashboard",
    "Categories": "Rukuni", "Near Me": "Kusa da ni", "About": "Game da mu",
    "Support": "Tallafi", "Close": "Rufe", "Cancel": "Soke", "Save": "Ajiye",
    "Back": "Koma", "Next": "Na gaba", "Continue": "Ci gaba", "Submit": "Tura",
    "Settings": "Saituna", "Profile": "Bayani", "Messages": "Saƙonni",
    "Orders": "Oda", "Bookings": "Ajiye wuri", "Wishlist": "Abubuwan so",
    "Notifications": "Sanarwa", "Logout": "Fita", "Send": "Aika", "Receive": "Karɓa",
  },
  fr: {
    "Home": "Accueil", "Search": "Rechercher", "AI": "IA", "Language": "Langue",
    "Light mode": "Mode clair", "Dark mode": "Mode sombre", "Log in": "Se connecter",
    "Sign Up": "S’inscrire", "Register": "S’inscrire", "Dashboard": "Tableau de bord",
    "Categories": "Catégories", "Near Me": "Près de moi", "About": "À propos",
    "Support": "Assistance", "Close": "Fermer", "Cancel": "Annuler", "Save": "Enregistrer",
    "Back": "Retour", "Next": "Suivant", "Continue": "Continuer", "Submit": "Envoyer",
    "Settings": "Paramètres", "Profile": "Profil", "Messages": "Messages",
    "Orders": "Commandes", "Bookings": "Réservations", "Wishlist": "Favoris",
    "Notifications": "Notifications", "Logout": "Se déconnecter", "Send": "Envoyer", "Receive": "Recevoir",
  },
  ig: {
    "Home": "Ụlọ", "Search": "Chọọ", "AI": "AI", "Language": "Asụsụ",
    "Light mode": "Ọnọdụ ọkụ", "Dark mode": "Ọnọdụ ọchịchịrị", "Log in": "Banye",
    "Sign Up": "Debanye aha", "Register": "Debanye aha", "Dashboard": "Dashboard",
    "Categories": "Ụdị", "Near Me": "N’akụkụ m", "About": "Banyere",
    "Support": "Nkwado", "Close": "Mechie", "Cancel": "Kagbuo", "Save": "Chekwaa",
    "Back": "Laghachi", "Next": "Ọzọ", "Continue": "Gaa n’ihu", "Submit": "Zipụ",
    "Settings": "Ntọala", "Profile": "Profaịlụ", "Messages": "Ozi",
    "Orders": "Iwu", "Bookings": "Ndokwa", "Wishlist": "Ihe ndị m hụrụ n’anya",
    "Notifications": "Ọkwa", "Logout": "Pụọ", "Send": "Zipụ", "Receive": "Nata",
  },
  yo: {
    "Home": "Ilé", "Search": "Wa", "AI": "AI", "Language": "Èdè",
    "Light mode": "Ipo ìmọ́lẹ̀", "Dark mode": "Ipo òkùnkùn", "Log in": "Wọlé",
    "Sign Up": "Forúkọsílẹ̀", "Register": "Forúkọsílẹ̀", "Dashboard": "Pẹpẹ iṣakoso",
    "Categories": "Àwọn ẹka", "Near Me": "Nítòsí mi", "About": "Nípa wa",
    "Support": "Ìrànlọ́wọ́", "Close": "Pa", "Cancel": "Fagilee", "Save": "Fipamọ́",
    "Back": "Padà", "Next": "Tẹ̀síwájú", "Continue": "Tẹ̀síwájú", "Submit": "Firanṣẹ́",
    "Settings": "Ètò", "Profile": "Àkọọ́lẹ̀", "Messages": "Àwọn ifiranṣẹ́",
    "Orders": "Àwọn àṣẹ", "Bookings": "Àwọn ìfipamọ́", "Wishlist": "Àwọn ayanfẹ́",
    "Notifications": "Àwọn ìkìlọ̀", "Logout": "Jáde", "Send": "Firanṣẹ́", "Receive": "Gba",
  },
  pcm: {
    "Home": "House", "Search": "Find", "AI": "AI", "Language": "Language",
    "Light mode": "Light mode", "Dark mode": "Dark mode", "Log in": "Login",
    "Sign Up": "Sign Up", "Register": "Register", "Dashboard": "Dashboard",
    "Categories": "Categories", "Near Me": "Near Me", "About": "About",
    "Support": "Support", "Close": "Close", "Cancel": "Cancel", "Save": "Save",
    "Back": "Back", "Next": "Next", "Continue": "Continue", "Submit": "Send",
    "Settings": "Settings", "Profile": "Profile", "Messages": "Messages",
    "Orders": "Orders", "Bookings": "Bookings", "Wishlist": "Wishlist",
    "Notifications": "Notifications", "Logout": "Logout", "Send": "Send", "Receive": "Receive",
  },
};

function translateNode(root: Node, language: SupportedLanguage) {
  const map = UI_TRANSLATIONS[language] ?? {};
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) nodes.push(node as Text);
  nodes.forEach((text) => {
    const value = text.nodeValue ?? "";
    const trimmed = value.trim();
    if (!trimmed || text.parentElement?.closest("script,style,[data-no-translate]")) return;
    const translated = map[trimmed];
    if (!translated || translated === trimmed) return;
    const start = value.indexOf(trimmed);
    text.nodeValue = value.slice(0, start) + translated + value.slice(start + trimmed.length);
  });
}

export default function GlobalLanguageLayer() {
  useEffect(() => {
    let language = getLanguage();

    const apply = (next: SupportedLanguage) => {
      language = next;
      document.documentElement.lang = next;
      document.documentElement.dataset.language = next;
      translateNode(document.body, next);
    };

    apply(language);

    const onChange = (event: Event) => {
      const next = (event as CustomEvent<SupportedLanguage>).detail;
      apply(next);
      window.setTimeout(() => translateNode(document.body, next), 0);
    };

    const observer = new MutationObserver(() => translateNode(document.body, language));
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("unique-language-change", onChange);

    return () => {
      observer.disconnect();
      window.removeEventListener("unique-language-change", onChange);
    };
  }, []);

  return null;
}
