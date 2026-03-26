/** @typedef {'dark' | 'light'} DhTheme */

export const THEME_STORAGE_KEY = 'dh_theme';

const HLJS_DARK = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark-dimmed.min.css';
const HLJS_LIGHT = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css';

/**
 * @returns {DhTheme}
 */
export function getStoredTheme() {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return 'dark';
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    return v === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

/**
 * @param {DhTheme} theme
 */
export function syncHljsStylesheet(theme) {
  if (typeof document === 'undefined') return;
  const link = document.getElementById('hljs-theme');
  if (!link || typeof link.href !== 'string') return;
  const href = theme === 'light' ? HLJS_LIGHT : HLJS_DARK;
  if (link.href !== href) link.href = href;
}

/**
 * @param {DhTheme} theme
 */
export function applyTheme(theme) {
  const t = theme === 'light' ? 'light' : 'dark';
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', t);
  }
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(THEME_STORAGE_KEY, t);
    }
  } catch {
    /* ignore quota / private mode */
  }
  syncHljsStylesheet(t);
}

/**
 * Applies stored theme + hljs (for use after load if pre-paint script already set data-theme).
 */
export function initThemeFromStorage() {
  const t = getStoredTheme();
  applyTheme(t);
}
