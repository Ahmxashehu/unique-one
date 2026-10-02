import { useEffect } from "react";
import { getLanguage, type SupportedLanguage, t } from "../lib/i18n";

const UI: Record<SupportedLanguage, Record<string,string>> = {
  en:{},
  ha:{"Home":"Gida","Search":"Bincike","Language":"Harshe","Light mode":"Yanayin haske","Dark mode":"Yanayin duhu","Log in":"Shiga","Sign Up":"Yi rajista","Register":"Yi rajista","Categories":"Rukuni","Near Me":"Kusa da ni","About":"Game da mu","Support":"Tallafi","Close":"Rufe","Cancel":"Soke","Save":"Ajiye","Back":"Koma","Next":"Na gaba","Continue":"Ci gaba","Submit":"Tura","Settings":"Saituna","Profile":"Bayani","Messages":"Saƙonni","Orders":"Oda","Bookings":"Ajiye wuri","Wishlist":"Abubuwan so","Notifications":"Sanarwa","Logout":"Fita","Send":"Aika","Receive":"Karɓa","Welcome back":"Barka da dawowa","Create account":"Ƙirƙiri asusu","Loading":"Ana lodawa","Error":"Kuskure","Success":"Nasara"},
  fr:{"Home":"Accueil","Search":"Rechercher","AI":"IA","Language":"Langue","Light mode":"Mode clair","Dark mode":"Mode sombre","Log in":"Se connecter","Sign Up":"S’inscrire","Register":"S’inscrire","Categories":"Catégories","Near Me":"Près de moi","About":"À propos","Support":"Assistance","Close":"Fermer","Cancel":"Annuler","Save":"Enregistrer","Back":"Retour","Next":"Suivant","Continue":"Continuer","Submit":"Envoyer","Settings":"Paramètres","Profile":"Profil","Messages":"Messages","Orders":"Commandes","Bookings":"Réservations","Wishlist":"Favoris","Notifications":"Notifications","Logout":"Se déconnecter","Send":"Envoyer","Receive":"Recevoir","Welcome back":"Bon retour","Create account":"Créer un compte","Loading":"Chargement","Error":"Erreur","Success":"Succès"},
  ig:{"Home":"Ụlọ","Search":"Chọọ","AI":"AI","Language":"Asụsụ","Light mode":"Ọnọdụ ọkụ","Dark mode":"Ọnọdụ ọchịchịrị","Log in":"Banye","Sign Up":"Debanye aha","Register":"Debanye aha","Categories":"Ụdị","Near Me":"N’akụkụ m","About":"Banyere","Support":"Nkwado","Close":"Mechie","Cancel":"Kagbuo","Save":"Chekwaa","Back":"Laghachi","Next":"Ọzọ","Continue":"Gaa n’ihu","Submit":"Zipụ","Settings":"Ntọala","Profile":"Profaịlụ","Messages":"Ozi","Orders":"Iwu","Bookings":"Ndokwa","Wishlist":"Ihe ndị m hụrụ n’anya","Notifications":"Ọkwa","Logout":"Pụọ","Send":"Zipụ","Receive":"Nata","Welcome back":"Nnọọ ọzọ","Create account":"Mepụta akaụntụ","Loading":"Na-ebufe","Error":"Njehie","Success":"Ịga nke ọma"},
  yo:{"Home":"Ilé","Search":"Wa","AI":"AI","Language":"Èdè","Light mode":"Ipo ìmọ́lẹ̀","Dark mode":"Ipo òkùnkùn","Log in":"Wọlé","Sign Up":"Forúkọsílẹ̀","Register":"Forúkọsílẹ̀","Categories":"Àwọn ẹka","Near Me":"Nítòsí mi","About":"Nípa wa","Support":"Ìrànlọ́wọ́","Close":"Pa","Cancel":"Fagilee","Save":"Fipamọ́","Back":"Padà","Next":"Tẹ̀síwájú","Continue":"Tẹ̀síwájú","Submit":"Firanṣẹ́","Settings":"Ètò","Profile":"Àkọọ́lẹ̀","Messages":"Àwọn ifiranṣẹ́","Orders":"Àwọn àṣẹ","Bookings":"Àwọn ìfipamọ́","Wishlist":"Àwọn ayanfẹ́","Notifications":"Àwọn ìkìlọ̀","Logout":"Jáde","Send":"Firanṣẹ́","Receive":"Gba","Welcome back":"Káàbọ̀ padà","Create account":"Ṣẹ̀dá àkọọ́lẹ̀","Loading":"Ń gbé","Error":"Àṣìṣe","Success":"Àṣeyọrí"},
  pcm:{"Home":"House","Search":"Find","AI":"AI","Language":"Language","Light mode":"Light mode","Dark mode":"Dark mode","Log in":"Login","Sign Up":"Sign Up","Register":"Register","Categories":"Categories","Near Me":"Near Me","About":"About","Support":"Support","Close":"Close","Cancel":"Cancel","Save":"Save","Back":"Back","Next":"Next","Continue":"Continue","Submit":"Send","Settings":"Settings","Profile":"Profile","Messages":"Messages","Orders":"Orders","Bookings":"Bookings","Wishlist":"Wishlist","Notifications":"Notifications","Logout":"Logout","Send":"Send","Receive":"Receive","Welcome back":"Welcome back","Create account":"Create account","Loading":"E dey load","Error":"Error","Success":"Success"}
};
const norm=(v:string)=>v.replace(/\s+/g," ").trim();
function apply(root:Node, language:SupportedLanguage){
  const map=UI[language]||{};
  const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT); const nodes:Text[]=[]; let n:Node|null;
  while((n=w.nextNode())) nodes.push(n as Text);
  nodes.forEach(node=>{
    const p=node.parentElement; if(!p||p.closest("script,style,[data-no-translate],[data-i18n]")) return;
    const raw=node.nodeValue||"", key=norm(raw), translated=map[key];
    if(translated&&translated!==key){const i=raw.indexOf(key);node.nodeValue=raw.slice(0,i)+translated+raw.slice(i+key.length);}
  });
  document.querySelectorAll("[data-i18n],input[placeholder],textarea[placeholder],[title],[aria-label]").forEach(el=>{
    const key=el.getAttribute("data-i18n"); if(key&&el.children.length===0) el.textContent=t(key,language);
    ["placeholder","title","aria-label","alt"].forEach(a=>{const v=el.getAttribute(a),tr=v?map[norm(v)]:undefined;if(tr&&tr!==v)el.setAttribute(a,tr);});
  });
}
export default function GlobalLanguageLayer(){
  useEffect(()=>{
    let language=getLanguage();
    const run=(next:SupportedLanguage)=>{language=next;document.documentElement.lang=next;document.documentElement.dataset.language=next;apply(document.body,next);};
    run(language);
    const onChange=(e:Event)=>run((e as CustomEvent<SupportedLanguage>).detail);
    const observer=new MutationObserver(()=>requestAnimationFrame(()=>apply(document.body,language)));
    observer.observe(document.body,{childList:true,subtree:true,characterData:true});
    window.addEventListener("unique-language-change",onChange);
    return()=>{observer.disconnect();window.removeEventListener("unique-language-change",onChange);};
  },[]);
  return null;
}
