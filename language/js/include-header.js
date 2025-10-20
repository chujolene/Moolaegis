// language/js/include-header.js (pure relative-path edition)
(async function loadHeader(){
  const placeholder = document.querySelector('[data-include="header"]');
  if (!placeholder) return;
  try {
    const BASE = (typeof window !== 'undefined' && window.LANG_BASE) || './language';
    const res = await fetch(`${BASE}/partials/language.html`, { cache: 'no-store' });
    const html = await res.text();
    placeholder.innerHTML = html;
    if (window.I18N) {
      window.I18N.attachSwitcher();
      window.I18N.applyTranslations(placeholder);
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        if (window.I18N) {
          window.I18N.attachSwitcher();
          window.I18N.applyTranslations(placeholder);
        }
      });
    }
  } catch (err) {
    console.error('Failed to load header:', err);
  }
})();