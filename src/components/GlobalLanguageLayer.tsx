import { useEffect } from "react";
import { getLanguage, type SupportedLanguage, t } from "../lib/i18n";

type Phrase = string;
const UI: Record<SupportedLanguage, Record<Phrase, string>> = {
  en: {},
  ha: {
    Home:"Gida", Search:"Bincike", AI:"AI", Language:"Harshe", "Light mode":"Yanayin haske", "Dark mode":"Yanayin duhu",
    "Log in":"Shiga", "Sign Up":"Yi rajista", Register:"Yi rajista", Categories:"Rukuni", "Near Me":"Kusa da ni",
    About:"Game da mu", Support:"Tallafi", Close:"Rufe", Cancel:"Soke", Save:"Ajiye", Back:"Koma", Next:"Na gaba",
    Continue:"Ci gaba", Submit:"Tura", Settings:"Saituna", Profile:"Bayani", Messages:"Saƙonni", Orders:"Oda",
    Bookings:"Ajiye wuri", Wishlist:"Abubuwan so", Notifications:"Sanarwa", Logout:"Fita", Send:"Aika", Receive:"Karɓa",
    "Welcome back":"Barka da dawowa", "Create account":"Ƙirƙiri asusu", Loading:"Ana lodawa", Error:"Kuskure", Success:"Nasara",
    "My Account":"Asusuna", "My Profile":"Bayanan martaba", "Personal Information":"Bayanan sirri", "Edit Profile":"Gyara bayanin martaba",
    "Change Password":"Canja kalmar sirri", Password:"Kalmar sirri", Email:"Imel", Phone:"Waya", Name:"Suna", Address:"Adireshi",
    "First name":"Sunan farko", "Last name":"Sunan ƙarshe", Country:"Ƙasa", State:"Jiha", City:"Birni", "Date of birth":"Ranar haihuwa",
    "Forgot password?":"Ka manta kalmar sirri?", "Don't have an account?":"Ba ka da asusu?", "Already have an account?":"Kana da asusu?",
    "Get started":"Fara", "Learn more":"Ƙara koyo", "View all":"Duba duka", More:"Ƙari", Menu:"Menu", Home:"Gida",
    "Your cart":"Kwandonka", Cart:"Kwando", Checkout:"Biya", Payment:"Biya", Wallet:"Walat", Transactions:"Mu'amaloli",
    Products:"Kayayyaki", Product:"Kaya", Services:"Ayyuka", Service:"Aiki", Store:"Shago", Shop:"Sayi", Sell:"Sayar",
    Buy:"Saya", Orders:"Oda", Delivery:"Isarwa", Location:"Wuri", "Near you":"Kusa da kai", Notifications:"Sanarwa",
    "No results":"Babu sakamako", "Try again":"Sake gwadawa", "Something went wrong":"An samu matsala", Retry:"Sake gwadawa",
    "Please wait":"Don Allah jira", "Coming soon":"Nan ba da jimawa ba", "View details":"Duba bayanai", Details:"Bayanai",
    "Search...":"Bincika...", "Search products":"Bincika kayayyaki", "Add to cart":"Ƙara zuwa kwando", "Buy now":"Saya yanzu",
    "Remove":"Cire", Delete:"Share", Update:"Sabunta", Create:"Ƙirƙira", Done:"An gama", Yes:"Eh", No:"A'a"
  },
  fr: {
    Home:"Accueil", Search:"Rechercher", AI:"IA", Language:"Langue", "Light mode":"Mode clair", "Dark mode":"Mode sombre",
    "Log in":"Se connecter", "Sign Up":"S’inscrire", Register:"S’inscrire", Categories:"Catégories", "Near Me":"Près de moi",
    About:"À propos", Support:"Assistance", Close:"Fermer", Cancel:"Annuler", Save:"Enregistrer", Back:"Retour", Next:"Suivant",
    Continue:"Continuer", Submit:"Envoyer", Settings:"Paramètres", Profile:"Profil", Messages:"Messages", Orders:"Commandes",
    Bookings:"Réservations", Wishlist:"Favoris", Notifications:"Notifications", Logout:"Se déconnecter", Send:"Envoyer", Receive:"Recevoir",
    "Welcome back":"Bon retour", "Create account":"Créer un compte", Loading:"Chargement", Error:"Erreur", Success:"Succès",
    "My Account":"Mon compte", "My Profile":"Mon profil", "Personal Information":"Informations personnelles", "Edit Profile":"Modifier le profil",
    "Change Password":"Changer le mot de passe", Password:"Mot de passe", Email:"E-mail", Phone:"Téléphone", Name:"Nom", Address:"Adresse",
    "First name":"Prénom", "Last name":"Nom de famille", Country:"Pays", State:"État", City:"Ville", "Date of birth":"Date de naissance",
    "Forgot password?":"Mot de passe oublié ?", "Don't have an account?":"Vous n’avez pas de compte ?", "Already have an account?":"Vous avez déjà un compte ?",
    "Get started":"Commencer", "Learn more":"En savoir plus", "View all":"Tout voir", More:"Plus", Menu:"Menu", "Your cart":"Votre panier",
    Cart:"Panier", Checkout:"Paiement", Payment:"Paiement", Wallet:"Portefeuille", Transactions:"Transactions", Products:"Produits",
    Product:"Produit", Services:"Services", Service:"Service", Store:"Boutique", Shop:"Boutique", Sell:"Vendre", Buy:"Acheter",
    Delivery:"Livraison", Location:"Emplacement", "Near you":"Près de vous", "No results":"Aucun résultat", "Try again":"Réessayer",
    "Something went wrong":"Une erreur s’est produite", Retry:"Réessayer", "Please wait":"Veuillez patienter", "Coming soon":"Bientôt disponible",
    "View details":"Voir les détails", Details:"Détails", "Search...":"Rechercher...", "Search products":"Rechercher des produits",
    "Add to cart":"Ajouter au panier", "Buy now":"Acheter maintenant", Remove:"Supprimer", Delete:"Supprimer", Update:"Mettre à jour",
    Create:"Créer", Done:"Terminé", Yes:"Oui", No:"Non"
  },
  ig: {
    Home:"Ụlọ", Search:"Chọọ", AI:"AI", Language:"Asụsụ", "Light mode":"Ọnọdụ ọkụ", "Dark mode":"Ọnọdụ ọchịchịrị",
    "Log in":"Banye", "Sign Up":"Debanye aha", Register:"Debanye aha", Categories:"Ụdị", "Near Me":"N’akụkụ m", About:"Banyere",
    Support:"Nkwado", Close:"Mechie", Cancel:"Kagbuo", Save:"Chekwaa", Back:"Laghachi", Next:"Ọzọ", Continue:"Gaa n’ihu",
    Submit:"Zipụ", Settings:"Ntọala", Profile:"Profaịlụ", Messages:"Ozi", Orders:"Iwu", Bookings:"Ndokwa", Wishlist:"Ihe ndị m hụrụ n’anya",
    Notifications:"Ọkwa", Logout:"Pụọ", Send:"Zipụ", Receive:"Nata", "Welcome back":"Nnọọ ọzọ", "Create account":"Mepụta akaụntụ",
    Loading:"Na-ebufe", Error:"Njehie", Success:"Ịga nke ọma", "My Account":"Akaụntụ m", "My Profile":"Profaịlụ m",
    "Personal Information":"Ozi nke onwe", "Edit Profile":"Dezie profaịlụ", Password:"Okwuntughe", Email:"Email", Phone:"Ekwentị",
    Name:"Aha", Address:"Adreesị", Country:"Mba", State:"Steeti", City:"Obodo", "Get started":"Malite", "Learn more":"Mụtakwuo",
    "View all":"Lee ha niile", More:"Ọzọ", Menu:"Nchịkọta", Cart:"Akpa ịzụ ahịa", Checkout:"Kwụọ ụgwọ", Payment:"Ịkwụ ụgwọ",
    Wallet:"Akpa ego", Transactions:"Azụmahịa", Products:"Ngwaahịa", Product:"Ngwaahịa", Services:"Ọrụ", Service:"Ọrụ",
    Store:"Ụlọ ahịa", Shop:"Ụlọ ahịa", Sell:"Ree", Buy:"Zụta", Delivery:"Nnyefe", Location:"Ebe", "Near you":"N’akụkụ gị",
    "No results":"Enweghị nsonaazụ", "Try again":"Nwaa ọzọ", "Please wait":"Biko chere", "Coming soon":"Na-abịa n’oge na-adịghị anya",
    "View details":"Lee nkọwa", Details:"Nkọwa", "Search...":"Chọọ...", "Search products":"Chọọ ngwaahịa", "Add to cart":"Tinye na akpa",
    "Buy now":"Zụta ugbu a", Remove:"Wepụ", Delete:"Hichapụ", Update:"Melite", Create:"Mepụta", Done:"Emechara", Yes:"Ee", No:"Mba"
  },
  yo: {
    Home:"Ilé", Search:"Wa", AI:"AI", Language:"Èdè", "Light mode":"Ipo ìmọ́lẹ̀", "Dark mode":"Ipo òkùnkùn",
    "Log in":"Wọlé", "Sign Up":"Forúkọsílẹ̀", Register:"Forúkọsílẹ̀", Categories:"Àwọn ẹka", "Near Me":"Nítòsí mi",
    About:"Nípa wa", Support:"Ìrànlọ́wọ́", Close:"Pa", Cancel:"Fagilee", Save:"Fipamọ́", Back:"Padà", Next:"Tẹ̀síwájú",
    Continue:"Tẹ̀síwájú", Submit:"Firanṣẹ́", Settings:"Ètò", Profile:"Àkọọ́lẹ̀", Messages:"Àwọn ifiranṣẹ́", Orders:"Àwọn àṣẹ",
    Bookings:"Àwọn ìfipamọ́", Wishlist:"Àwọn ayanfẹ́", Notifications:"Àwọn ìkìlọ̀", Logout:"Jáde", Send:"Firanṣẹ́", Receive:"Gba",
    "Welcome back":"Káàbọ̀ padà", "Create account":"Ṣẹ̀dá àkọọ́lẹ̀", Loading:"Ń gbé", Error:"Àṣìṣe", Success:"Àṣeyọrí",
    "My Account":"Àkọọ́lẹ̀ mi", "My Profile":"Àkọọ́lẹ̀ mi", "Personal Information":"Alaye ti ara ẹni", "Edit Profile":"Ṣàtúnṣe àkọọ́lẹ̀",
    Password:"Ọ̀rọ̀ aṣínà", Email:"Imeeli", Phone:"Fóònù", Name:"Orúkọ", Address:"Àdírẹ́sì", Country:"Orílẹ̀-èdè", State:"Ìpínlẹ̀", City:"Ìlú",
    "Get started":"Bẹ̀rẹ̀", "Learn more":"Kọ́ ẹ̀kọ́ síi", "View all":"Wo gbogbo", More:"Síi", Menu:"Àkójọ", Cart:"Àpò rírà",
    Checkout:"Sanwo", Payment:"Ìsanwó", Wallet:"Àpò owó", Transactions:"Àwọn ìṣòwò", Products:"Àwọn ọjà", Product:"Ọjà",
    Services:"Àwọn iṣẹ́", Service:"Iṣẹ́", Store:"Ilé ìtajà", Shop:"Ilé ìtajà", Sell:"Ta", Buy:"Ra", Delivery:"Ìfijiṣẹ́", Location:"Ibi",
    "Near you":"Nítòsí rẹ", "No results":"Kò sí àbájáde", "Try again":"Gbìyànjú lẹ́ẹ̀kan síi", "Please wait":"Jọ̀wọ́ dúró",
    "Coming soon":"Ó ń bọ̀ láìpẹ́", "View details":"Wo àwọn àlàyé", Details:"Àwọn àlàyé", "Search...":"Wá...", "Search products":"Wá àwọn ọjà",
    "Add to cart":"Fi sínú àpò", "Buy now":"Ra nísinsìnyí", Remove:"Yọ", Delete:"Paarẹ́", Update:"Ṣàfikún", Create:"Ṣẹ̀dá", Done:"Ti parí", Yes:"Bẹ́ẹ̀ni", No:"Rárá"
  },
  pcm: {
    Home:"House", Search:"Find", AI:"AI", Language:"Language", "Light mode":"Light mode", "Dark mode":"Dark mode",
    "Log in":"Login", "Sign Up":"Sign Up", Register:"Register", Categories:"Categories", "Near Me":"Near Me", About:"About", Support:"Support",
    Close:"Close", Cancel:"Cancel", Save:"Save", Back:"Back", Next:"Next", Continue:"Continue", Submit:"Send", Settings:"Settings",
    Profile:"Profile", Messages:"Messages", Orders:"Orders", Bookings:"Bookings", Wishlist:"Wishlist", Notifications:"Notifications", Logout:"Logout",
    Send:"Send", Receive:"Receive", "Welcome back":"Welcome back", "Create account":"Create account", Loading:"E dey load", Error:"Error", Success:"Success",
    "My Account":"My Account", "My Profile":"My Profile", Password:"Password", Email:"Email", Phone:"Phone", Name:"Name", Address:"Address",
    Country:"Country", State:"State", City:"City", "Get started":"Start", "Learn more":"Learn more", "View all":"See all", More:"More", Menu:"Menu",
    Cart:"Cart", Checkout:"Checkout", Payment:"Payment", Wallet:"Wallet", Transactions:"Transactions", Products:"Products", Product:"Product",
    Services:"Services", Service:"Service", Store:"Store", Shop:"Shop", Sell:"Sell", Buy:"Buy", Delivery:"Delivery", Location:"Location",
    "Near you":"Near you", "No results":"No results", "Try again":"Try again", "Please wait":"Abeg wait", "Coming soon":"E dey come soon",
    "View details":"See details", Details:"Details", "Search...":"Find...", "Search products":"Find products", "Add to cart":"Add to cart",
    "Buy now":"Buy now", Remove:"Remove", Delete:"Delete", Update:"Update", Create:"Create", Done:"Done", Yes:"Yes", No:"No"
  }
};

const norm = (v:string) => v.replace(/\s+/g," ").trim();
const reverse = (language:SupportedLanguage) => {
  const out:Record<string,string> = {};
  Object.entries(UI[language] || {}).forEach(([english, translated]) => {
    if (translated && !out[translated]) out[translated] = english;
  });
  return out;
};

function translateText(value:string, language:SupportedLanguage) {
  const map = UI[language] || {};
  const back = reverse(language);
  const key = norm(value);
  const english = back[key] || key;
  const translated = map[english];
  return translated || (language === "en" ? english : value);
}

function apply(root:Node, language:SupportedLanguage) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes:Text[] = [];
  let node:Node|null;
  while ((node = walker.nextNode())) nodes.push(node as Text);

  nodes.forEach(textNode => {
    const parent = textNode.parentElement;
    if (!parent || parent.closest("script,style,noscript,[data-no-translate],[data-i18n]")) return;
    const raw = textNode.nodeValue || "";
    const trimmed = norm(raw);
    if (!trimmed) return;
    const translated = translateText(trimmed, language);
    if (translated !== trimmed) {
      const start = raw.indexOf(trimmed);
      textNode.nodeValue = raw.slice(0,start) + translated + raw.slice(start + trimmed.length);
    }
  });

  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    if (key) el.textContent = t(key, language);
  });

  document.querySelectorAll("input[placeholder],textarea[placeholder],[title],[aria-label],[alt]").forEach(el => {
    ["placeholder","title","aria-label","alt"].forEach(attr => {
      const value = el.getAttribute(attr);
      if (!value) return;
      const translated = translateText(value, language);
      if (translated !== value) el.setAttribute(attr, translated);
    });
  });
}

export default function GlobalLanguageLayer() {
  useEffect(() => {
    let language = getLanguage();
    let scheduled = false;
    const run = (next:SupportedLanguage) => {
      language = next;
      document.documentElement.lang = next;
      document.documentElement.dataset.language = next;
      apply(document.body, next);
    };
    run(language);
    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => { scheduled = false; apply(document.body, language); });
    };
    const observer = new MutationObserver(schedule);
    observer.observe(document.body,{childList:true,subtree:true,characterData:true});
    const onChange = (e:Event) => run((e as CustomEvent<SupportedLanguage>).detail);
    window.addEventListener("unique-language-change",onChange);
    return () => { observer.disconnect(); window.removeEventListener("unique-language-change",onChange); };
  },[]);
  return null;
}
