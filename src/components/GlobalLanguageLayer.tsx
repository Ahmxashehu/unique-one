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
    "Get started":"Fara", "Learn more":"Ƙara koyo", "View all":"Duba duka", More:"Ƙari", Menu:"Menu", "Your cart":"Kwandonka",
    Cart:"Kwando", Checkout:"Biya", Payment:"Biya", Wallet:"Walat", Transactions:"Mu'amaloli", Products:"Kayayyaki", Product:"Kaya",
    Services:"Ayyuka", Service:"Aiki", Store:"Shago", Shop:"Sayi", Sell:"Sayar", Buy:"Saya", Delivery:"Isarwa", Location:"Wuri",
    "Near you":"Kusa da kai", "No results":"Babu sakamako", "Try again":"Sake gwadawa", "Something went wrong":"An samu matsala",
    Retry:"Sake gwadawa", "Please wait":"Don Allah jira", "Coming soon":"Nan ba da jimawa ba", "View details":"Duba bayanai",
    Details:"Bayanai", "Search...":"Bincika...", "Search products":"Bincika kayayyaki", "Add to cart":"Ƙara zuwa kwando",
    "Buy now":"Saya yanzu", Remove:"Cire", Delete:"Share", Update:"Sabunta", Create:"Ƙirƙira", Done:"An gama", Yes:"Eh", No:"A'a",
    Restaurant:"Gidan abinci", Hotel:"Otal", Flights:"Jirage", School:"Makaranta", Transportation:"Sufuri", "Real Estate":"Gidaje",
    "Global Search":"Bincike na duniya", Jobs:"Ayyuka", Contributions:"Gudummawa", Education:"Ilimi", Travel:"Tafiya",
    "Open UniqueOS":"Buɗe UniqueOS", "More experiences":"Ƙarin ayyuka",
    "Refresh":"Sabunta", "View":"Duba", "Edit":"Gyara", "Open":"Buɗe", "Apply":"Aika", "Post a job":"Sanya aiki", "All categories":"Duk rukuni", "No published jobs found":"Ba a sami ayyukan da aka wallafa ba", "Copy link":"Kwafi mahaɗi", "Reshare to chat":"Sake rabawa zuwa hira", "Message Seller":"Tura saƙo ga mai sayarwa", "Open Store":"Buɗe shago", "Connect phone media":"Haɗa kafofin wayar", "Open UniqueShare":"Buɗe UniqueShare", "Backup":"Ajiye madadin", "Restore latest":"Mayar da na baya-bayan nan", "Institution":"Cibiyar", "Course":"Darasi", "Enroll":"Yi rajista", "Add Customer":"Ƙara abokin ciniki", "Invite Member":"Gayyaci memba", "Upload Documents":"Loda takardu", "Go to Dashboard":"Je zuwa Dashboard", "Change Login PIN":"Canja PIN na shiga", "Save Draft":"Ajiye daftari", "Send Request":"Aika buƙata", "Create Another Request":"Ƙirƙiri wata buƙata", "Search messages":"Bincika saƙonni", "Voice calls coming soon":"Kiran murya zai zo nan ba da jimawa ba", "Enable biometric security":"Kunna tsaron biometric", "Setting up…":"Ana saitawa…", "Publishing...":"Ana wallafawa...", "Publish Service":"Wallafa sabis", "All Invoices":"Duk rasit", "Drafts":"Daftari", "Connect":"Haɗa", "Employer not specified":"Ba a bayyana ma'aikaci ba"
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
    Create:"Créer", Done:"Terminé", Yes:"Oui", No:"Non", Restaurant:"Restaurant", Hotel:"Hôtel", Flights:"Vols", School:"École",
    Transportation:"Transport", "Real Estate":"Immobilier", "Global Search":"Recherche globale", Jobs:"Emplois", Contributions:"Contributions",
    Education:"Éducation", Travel:"Voyage", "Open UniqueOS":"Ouvrir UniqueOS", "More experiences":"Plus d’expériences"
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
    "Buy now":"Zụta ugbu a", Remove:"Wepụ", Delete:"Hichapụ", Update:"Melite", Create:"Mepụta", Done:"Emechara", Yes:"Ee", No:"Mba",
    Restaurant:"Ụlọ oriri", Hotel:"Ụlọ nkwari akụ", Flights:"Ụgbọ elu", School:"Ụlọ akwụkwọ", Transportation:"Ụgbọ njem",
    "Real Estate":"Ala na ụlọ", "Global Search":"Ọchụchọ zuru ụwa", Jobs:"Ọrụ", Contributions:"Onyinye", Education:"Agụmakwụkwọ",
    Travel:"Njem", "Open UniqueOS":"Mepee UniqueOS", "More experiences":"Ahụmịhe ndị ọzọ"
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
    "Add to cart":"Fi sínú àpò", "Buy now":"Ra nísinsìnyí", Remove:"Yọ", Delete:"Paarẹ́", Update:"Ṣàfikún", Create:"Ṣẹ̀dá", Done:"Ti parí", Yes:"Bẹ́ẹ̀ni", No:"Rárá",
    Restaurant:"Ilé ìjẹun", Hotel:"Hotẹẹli", Flights:"Àwọn ọkọ̀ òfuurufú", School:"Ilé ẹ̀kọ́", Transportation:"Ìrìnàjò", "Real Estate":"Ohun-ìní ilẹ̀",
    "Global Search":"Ìwádìí àgbáyé", Jobs:"Àwọn iṣẹ́", Contributions:"Àwọn àfikún", Education:"Ẹ̀kọ́", Travel:"Ìrìnàjò", "Open UniqueOS":"Ṣí UniqueOS", "More experiences":"Àwọn ìrírí míì"
  },
  pcm: {
    Home:"House", Search:"Find", AI:"AI", Language:"Language", "Light mode":"Light mode", "Dark mode":"Dark mode",
    "Log in":"Login", "Sign Up":"Sign Up", Register:"Register", Categories:"Categories", "Near Me":"Near Me", About:"About", Support:"Support",
    Close:"Close", Cancel:"Cancel", Save:"Save", Back:"Back", Next:"Next", Continue:"Continue", Submit:"Send", Settings:"Settings",
    Profile:"Profile", Messages:"Messages", Orders:"Orders", Bookings:"Bookings", Wishlist:"Wishlist", Notifications:"Notifications", Logout:"Logout",
    Send:"Send", Receive:"Receive", "Welcome back":"Welcome back", "Create account":"Create account", Loading:"E dey load", Error:"Error", Success:"Error",
    "My Account":"My Account", "My Profile":"My Profile", Password:"Password", Email:"Email", Phone:"Phone", Name:"Name", Address:"Address",
    Country:"Country", State:"State", City:"City", "Get started":"Start", "Learn more":"Learn more", "View all":"See all", More:"More", Menu:"Menu",
    Cart:"Cart", Checkout:"Checkout", Payment:"Payment", Wallet:"Wallet", Transactions:"Transactions", Products:"Products", Product:"Product",
    Services:"Services", Service:"Service", Store:"Store", Shop:"Shop", Sell:"Sell", Buy:"Buy", Delivery:"Delivery", Location:"Location",
    "Near you":"Near you", "No results":"No results", "Try again":"Try again", "Please wait":"Abeg wait", "Coming soon":"E dey come soon",
    "View details":"See details", Details:"Details", "Search...":"Find...", "Search products":"Find products", "Add to cart":"Add to cart",
    "Buy now":"Buy now", Remove:"Remove", Delete:"Delete", Update:"Update", Create:"Create", Done:"Done", Yes:"Yes", No:"No",
    Restaurant:"Chop place", Hotel:"Hotel", Flights:"Flights", School:"School", Transportation:"Transport", "Real Estate":"Land and house",
    "Global Search":"Search everywhere", Jobs:"Work", Contributions:"Contributions", Education:"Education", Travel:"Travel",
    "Open UniqueOS":"Open UniqueOS", "More experiences":"More experiences",
    "Refresh":"Refresh", "View":"See", "Edit":"Edit", "Open":"Open", "Apply":"Apply", "Post a job":"Post job", "All categories":"All categories", "No published jobs found":"No jobs wey dem publish", "Copy link":"Copy link", "Reshare to chat":"Share again for chat", "Message Seller":"Message seller", "Open Store":"Open Store", "Connect phone media":"Connect phone media", "Open UniqueShare":"Open UniqueShare", "Backup":"Backup", "Restore latest":"Restore latest", "Institution":"Institution", "Course":"Course", "Enroll":"Register", "Add Customer":"Add customer", "Invite Member":"Invite member", "Upload Documents":"Upload documents", "Go to Dashboard":"Go to Dashboard", "Change Login PIN":"Change login PIN", "Save Draft":"Save draft", "Send Request":"Send request", "Search messages":"Find messages", "Voice calls coming soon":"Voice call dey come soon", "Enable biometric security":"Turn on biometric security", "Setting up…":"E dey set up…", "Publishing...":"E dey publish...", "Publish Service":"Publish service", "All Invoices":"All invoices", "Drafts":"Drafts", "Connect":"Connect", "Employer not specified":"Employer no dey specified"
  }
};


// Expanded platform action vocabulary. These phrases are shared by many feature pages,
// so they are translated here even when a page has not yet migrated to data-i18n keys.
const EXTRA: Record<SupportedLanguage, Record<string,string>> = {
  en: {},
  ha: {
    "Refresh":"Sabunta", "View":"Duba", "Apply":"Nema", "Post a job":"Sanya aikin yi", "All categories":"Dukkan rukuni",
    "Connect phone media":"Haɗa kafofin wayar", "Open UniqueShare":"Buɗe UniqueShare", "Backup":"Ajiye kwafi", "Restore latest":"Maido na baya-bayan nan",
    "Search jobs, employers, skills or locations...":"Bincika ayyuka, ma'aikata, ƙwarewa ko wurare...", "No published jobs found":"Ba a sami ayyukan da aka wallafa ba",
    "Create Another Request":"Ƙirƙiri wata buƙata", "Save Draft":"Ajiye daftari", "Send Request":"Tura buƙata", "Change Login PIN":"Canja PIN na shiga",
    "Updating...":"Ana sabuntawa...", "Message Seller":"Tura saƙo ga mai sayarwa", "Go to Dashboard":"Je zuwa Dashboard", "Open Store":"Buɗe Shago",
    "Institution":"Cibiyar ilimi", "Course":"Darasi", "Enroll":"Yi rajista", "Invite Member":"Gayyaci memba", "Upload Documents":"Loda takardu",
    "Search messages":"Bincika saƙonni", "Voice calls coming soon":"Kiran murya zai zo nan ba da jimawa ba", "Reshare to chat":"Sake rabawa zuwa hira", "Copy link":"Kwafi hanyar haɗi",
    "Remove":"Cire", "Publishing...":"Ana wallafawa...", "Publish Service":"Wallafa aiki", "Enable biometric security":"Kunna tsaron biometric",
    "Allow media access":"Bada damar kafofin watsa labarai", "Next":"Na gaba", "Previous":"Na baya", "Close menu":"Rufe menu", "More UniquePlatform":"Ƙarin UniquePlatform", "Add Customer":"Ƙara abokin ciniki", "Back to History":"Koma tarihin", "Print / Save PDF":"Buga / Ajiye PDF", "Video calls coming soon":"Kiran bidiyo zai zo nan ba da jimawa ba", "Unmute conversation":"Cire shiru na hira", "Mute conversation":"Yi shiru na hira", "Search messages...":"Bincika saƙonni..."
  },
  fr: {
    "Refresh":"Actualiser", "View":"Voir", "Apply":"Postuler", "Post a job":"Publier une offre", "All categories":"Toutes les catégories",
    "Connect phone media":"Connecter les médias du téléphone", "Open UniqueShare":"Ouvrir UniqueShare", "Backup":"Sauvegarder", "Restore latest":"Restaurer la dernière sauvegarde",
    "Search jobs, employers, skills or locations...":"Rechercher des emplois, employeurs, compétences ou lieux...", "No published jobs found":"Aucune offre publiée trouvée",
    "Create Another Request":"Créer une autre demande", "Save Draft":"Enregistrer le brouillon", "Send Request":"Envoyer la demande", "Change Login PIN":"Modifier le PIN de connexion",
    "Updating...":"Mise à jour...", "Message Seller":"Contacter le vendeur", "Go to Dashboard":"Aller au tableau de bord", "Open Store":"Ouvrir la boutique",
    "Institution":"Établissement", "Course":"Cours", "Enroll":"S’inscrire", "Invite Member":"Inviter un membre", "Upload Documents":"Téléverser les documents",
    "Search messages":"Rechercher des messages", "Voice calls coming soon":"Appels vocaux bientôt disponibles", "Reshare to chat":"Partager dans le chat", "Copy link":"Copier le lien",
    "Remove":"Supprimer", "Publishing...":"Publication...", "Publish Service":"Publier le service", "Enable biometric security":"Activer la sécurité biométrique",
    "Allow media access":"Autoriser l’accès aux médias", "Previous":"Précédent", "Close menu":"Fermer le menu", "More UniquePlatform":"Plus de UniquePlatform", "Add Customer":"Ajouter un client", "Back to History":"Retour à l’historique", "Print / Save PDF":"Imprimer / Enregistrer en PDF", "Video calls coming soon":"Appels vidéo bientôt disponibles", "Unmute conversation":"Réactiver le son de la conversation", "Mute conversation":"Mettre la conversation en sourdine", "Search messages...":"Rechercher des messages..."
  },
  ig: {
    "Refresh":"Melite", "View":"Lee", "Apply":"Tinye akwụkwọ", "Post a job":"Bipute ọrụ", "All categories":"Ụdị niile",
    "Connect phone media":"Jikọọ mgbasa ozi ekwentị", "Open UniqueShare":"Mepee UniqueShare", "Backup":"Chekwaa ndabere", "Restore latest":"Weghachi nke kacha ọhụrụ",
    "Search jobs, employers, skills or locations...":"Chọọ ọrụ, ndị were ọrụ, nka ma ọ bụ ebe...", "No published jobs found":"Enweghị ọrụ e bipụtara",
    "Create Another Request":"Mepụta arịrịọ ọzọ", "Save Draft":"Chekwaa akwụkwọ nwa oge", "Send Request":"Zipu arịrịọ", "Change Login PIN":"Gbanwee PIN nbanye",
    "Updating...":"Na-emelite...", "Message Seller":"Zitere onye na-ere ahịa ozi", "Go to Dashboard":"Gaa na Dashboard", "Open Store":"Mepee Ụlọ ahịa",
    "Institution":"Ụlọ akwụkwọ", "Course":"Nkuzi", "Enroll":"Debanye aha", "Invite Member":"Kpọọ onye otu", "Upload Documents":"Bulite akwụkwọ",
    "Search messages":"Chọọ ozi", "Voice calls coming soon":"Oku olu ga-abịa n'oge na-adịghị anya", "Reshare to chat":"Kesaa ọzọ na nkata", "Copy link":"Detuo njikọ",
    "Publishing...":"Na-ebipụta...", "Publish Service":"Bipụta ọrụ", "Enable biometric security":"Kpoo nchekwa biometric", "Allow media access":"Kwe ka mgbasa ozi nweta ohere",
    "Previous":"Nke gara aga", "Close menu":"Mechie nchịkọta", "More UniquePlatform":"Ọzọ UniquePlatform", "Add Customer":"Tinye onye ahịa", "Back to History":"Laghachi na akụkọ", "Print / Save PDF":"Bipụta / Chekwaa PDF", "Video calls coming soon":"Oku vidiyo ga-abịa n’oge na-adịghị anya", "Unmute conversation":"Wepụ ogbi na nkata", "Mute conversation":"Mee ka nkata daa ogbi", "Search messages...":"Chọọ ozi..."
  },
  yo: {
    "Refresh":"Túnṣe", "View":"Wo", "Apply":"Waye", "Post a job":"Fi iṣẹ́ sílẹ̀", "All categories":"Gbogbo ẹ̀ka",
    "Connect phone media":"So media fóònù pọ̀", "Open UniqueShare":"Ṣí UniqueShare", "Backup":"Ṣe àfipamọ́", "Restore latest":"Mú èyí tuntun padà",
    "Search jobs, employers, skills or locations...":"Wá iṣẹ́, àwọn agbanisíṣẹ́, ọgbọ́n tàbí ibi...", "No published jobs found":"A kò rí iṣẹ́ tí a tẹ̀ jáde",
    "Create Another Request":"Ṣẹ̀dá ìbéèrè mìíràn", "Save Draft":"Fipamọ́ àkọsílẹ̀", "Send Request":"Firanṣẹ́ ìbéèrè", "Change Login PIN":"Yí PIN ìwọlé padà",
    "Updating...":"Ń túnṣe...", "Message Seller":"Fi ifiranṣẹ́ ránṣẹ́ sí olùtajà", "Go to Dashboard":"Lọ sí pẹpẹ iṣakoso", "Open Store":"Ṣí ilé ìtajà",
    "Institution":"Ilé ẹ̀kọ́", "Course":"Ẹ̀kọ́", "Enroll":"Forúkọsílẹ̀", "Invite Member":"Pe ọmọ ẹgbẹ́", "Upload Documents":"Gbé àwọn ìwé sókè",
    "Search messages":"Wá àwọn ifiranṣẹ́", "Voice calls coming soon":"Àwọn ìpè ohùn ń bọ̀ láìpẹ́", "Reshare to chat":"Pín sí iwiregbe", "Copy link":"Da ọna asopọ̀ kọ",
    "Publishing...":"Ń tẹ̀ jáde...", "Publish Service":"Tẹ iṣẹ́ jáde", "Enable biometric security":"Mú ààbò biometric ṣiṣẹ́", "Allow media access":"Gba àyè sí media",
    "Previous":"Tẹ́lẹ̀", "Close menu":"Pa àkójọ", "More UniquePlatform":"Àwọn míì UniquePlatform", "Add Customer":"Fi oníbàárà kún", "Back to History":"Padà sí ìtàn", "Print / Save PDF":"Tẹ̀wé / Fipamọ́ PDF", "Video calls coming soon":"Àwọn ìpè fídíò ń bọ̀ láìpẹ́", "Unmute conversation":"Mú ohùn iwiregbe padà", "Mute conversation":"Dákẹ́ iwiregbe", "Search messages...":"Wá àwọn ifiranṣẹ́..."
  },
  pcm: {
    "Refresh":"Refresh", "View":"See", "Apply":"Apply", "Post a job":"Post job", "All categories":"All categories",
    "Connect phone media":"Connect phone media", "Open UniqueShare":"Open UniqueShare", "Backup":"Backup", "Restore latest":"Restore latest",
    "Search jobs, employers, skills or locations...":"Find jobs, employers, skills or places...", "No published jobs found":"No published job dey",
    "Create Another Request":"Create another request", "Save Draft":"Save draft", "Send Request":"Send request", "Change Login PIN":"Change login PIN",
    "Updating...":"E dey update...", "Message Seller":"Message seller", "Go to Dashboard":"Go dashboard", "Open Store":"Open Store",
    "Institution":"School", "Course":"Course", "Enroll":"Register", "Invite Member":"Invite member", "Upload Documents":"Upload documents",
    "Search messages":"Find messages", "Voice calls coming soon":"Voice call dey come soon", "Reshare to chat":"Share am for chat", "Copy link":"Copy link",
    "Publishing...":"E dey publish...", "Publish Service":"Publish service", "Enable biometric security":"Turn on biometric security", "Allow media access":"Allow media access",
    "Previous":"Previous", "Close menu":"Close menu", "More UniquePlatform":"More UniquePlatform", "Add Customer":"Add customer", "Back to History":"Back to history", "Print / Save PDF":"Print / Save PDF", "Video calls coming soon":"Video call dey come soon", "Unmute conversation":"Unmute chat", "Mute conversation":"Mute chat", "Search messages...":"Find messages..."
  }
};
Object.entries(EXTRA).forEach(([language, values]) => Object.assign(UI[language as SupportedLanguage], values));

const norm = (v:string) => v.replace(/\s+/g," ").trim();
const reverse = (language:SupportedLanguage) => {
  const out:Record<string,string> = {};
  Object.entries(UI[language] || {}).forEach(([english, translated]) => {
    if (translated && !out[translated]) out[translated] = english;
  });
  return out;
};
const canonicalEnglish = (value:string) => {
  const key = norm(value);
  for (const language of Object.keys(UI) as SupportedLanguage[]) {
    const english = reverse(language)[key];
    if (english) return english;
  }
  return key;
};

function translateText(value:string, language:SupportedLanguage) {
  const english = canonicalEnglish(value);
  const translated = UI[language]?.[english];
  if (translated) return translated;
  return language === "en" ? english : value;
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
