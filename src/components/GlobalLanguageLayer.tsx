import { useEffect } from "react";
import { getLanguage, type SupportedLanguage, t } from "../lib/i18n";

let translationUI: typeof import("../lib/globalTranslations").UI | null = null;

const norm = (v:string) => v.replace(/\s+/g," ").trim();
const reverse = (language:SupportedLanguage) => {
  const out:Record<string,string> = {};
  Object.entries(translationUI?.[language] || {}).forEach(([english, translated]) => {
    if (translated && !out[translated]) out[translated] = english;
  });
  return out;
};
const canonicalEnglish = (value:string) => {
  const key = norm(value);
  for (const language of Object.keys(translationUI || {}) as SupportedLanguage[]) {
    const english = reverse(language)[key];
    if (english) return english;
  }
  return key;
};

function translateText(value:string, language:SupportedLanguage) {
  const english = canonicalEnglish(value);
  const translated = translationUI?.[language]?.[english];
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
      if (next !== "en") {
        void import("../lib/globalTranslations").then((module) => { translationUI = module.UI; apply(document.body, next); });
      }
    };
    run(language);
    let timer: number | null = null;
    const schedule = () => {
      if (language === "en" || scheduled) return;
      scheduled = true;
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        scheduled = false;
        timer = null;
        apply(document.body, language);
      }, 120);
    };
    const observer = new MutationObserver(schedule);
    observer.observe(document.body,{childList:true,subtree:true,characterData:true});
    const onChange = (e:Event) => run((e as CustomEvent<SupportedLanguage>).detail);
    window.addEventListener("unique-language-change",onChange);
    return () => {
      observer.disconnect();
      window.removeEventListener("unique-language-change",onChange);
      if (timer !== null) window.clearTimeout(timer);
    };
  },[]);
  return null;
}
