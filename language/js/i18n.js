// language/js/i18n.js (pure relative-path edition)
(function () {
  'use strict';
  const BASE = (typeof window !== 'undefined' && window.LANG_BASE) || './language';
  const SOURCES = { zh: `${BASE}/lang/zh.json`, en: `${BASE}/lang/en.json` };
  const deepGet = (obj, path) => path.split('.').reduce((o, k) => (o && o[k] != null ? o[k] : undefined), obj);
  const normalize = (val) => {
    const raw = String(val || '').trim().toLowerCase();
    const alias = { '繁體中文': 'zh', '中文': 'zh', 'zh-tw': 'zh', 'zh_hant': 'zh', 'english': 'en', 'en-us': 'en', 'en_gb': 'en' };
    if (alias[raw]) return alias[raw];
    if (raw.startsWith('zh')) return 'zh';
    if (raw.startsWith('en')) return 'en';
    return raw || 'en';
  };
  let currentLang = 'en';
  let dict = {};
  const cache = Object.create(null);
  const t = (key, vars) => {
    const raw = deepGet(dict, key);
    const val = raw == null ? key : String(raw);
    if (!vars) return val;
    return val.replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : ''));
  };
  const applyTranslations = (root = document) => {
    if (!root) return;
    root.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.getAttribute('data-i18n')); });
    root.querySelectorAll('[data-i18n-placeholder]').forEach(el => { el.setAttribute('placeholder', t(el.getAttribute('data-i18n-placeholder'))); });
    root.querySelectorAll('[data-i18n-title]').forEach(el => { el.setAttribute('title', t(el.getAttribute('data-i18n-title'))); });
    root.querySelectorAll('[data-i18n-value]').forEach(el => { el.setAttribute('value', t(el.getAttribute('data-i18n-value'))); });
    root.querySelectorAll('[data-i18n-html]').forEach(el => { el.innerHTML = t(el.getAttribute('data-i18n-html')); });
    const switcher = root.querySelector('#langSwitcher') || document.getElementById('langSwitcher');
    if (switcher) switcher.value = currentLang;
  };
  const setHtmlLangAttr = (lang) => { document.documentElement.setAttribute('lang', lang === 'zh' ? 'zh-Hant' : 'en'); };
  const loadLang = async (newLang) => {
    const lang = normalize(newLang);
    currentLang = lang;
    try {
      if (!cache[lang]) {
        const res = await fetch(SOURCES[lang], { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
        cache[lang] = await res.json();
      }
      dict = cache[lang] || {};
      localStorage.setItem('lang', lang);
      setHtmlLangAttr(lang);
      applyTranslations(document);
    } catch (err) {
      console.error(`[i18n] Failed to load dictionary for "${lang}":`, err);
      dict = {};
      applyTranslations(document);
    }
  };
  const attachSwitcher = () => {
    const switcher = document.getElementById('langSwitcher');
    if (!switcher) return;
    switcher.value = currentLang;
    switcher.addEventListener('change', (e) => { loadLang(normalize(e.target.value)); });
  };
  const init = async () => {
    const saved = normalize(localStorage.getItem('lang'));
    const preferred = saved || ((navigator.language || navigator.userLanguage || '').toLowerCase().startsWith('zh') ? 'zh' : 'en');
    await loadLang(preferred);
    attachSwitcher();
  };
  window.I18N = { init, loadLang, t, applyTranslations, attachSwitcher, get lang() { return currentLang; } };
  document.addEventListener('DOMContentLoaded', () => window.I18N.init());
})();