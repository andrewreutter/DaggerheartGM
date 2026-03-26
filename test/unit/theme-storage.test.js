import { describe, it, expect, beforeEach } from 'vitest';
import {
  THEME_STORAGE_KEY,
  getStoredTheme,
  applyTheme,
  syncHljsStylesheet,
} from '../../src/client/lib/theme-storage.js';

describe('theme-storage', () => {
  let attrs;
  let hljsLink;

  beforeEach(() => {
    globalThis.window = globalThis;
    attrs = {};
    hljsLink = { href: 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark-dimmed.min.css' };
    globalThis.document = {
      documentElement: {
        setAttribute(name, value) {
          attrs[name] = value;
        },
        getAttribute(name) {
          return attrs[name];
        },
      },
      getElementById(id) {
        return id === 'hljs-theme' ? hljsLink : null;
      },
    };
    const store = {};
    globalThis.localStorage = {
      getItem: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
      setItem: (k, v) => {
        store[k] = String(v);
      },
      removeItem: (k) => {
        delete store[k];
      },
    };
  });

  it('getStoredTheme returns dark when unset or invalid', () => {
    expect(getStoredTheme()).toBe('dark');
    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    expect(getStoredTheme()).toBe('light');
    localStorage.setItem(THEME_STORAGE_KEY, 'nope');
    expect(getStoredTheme()).toBe('dark');
  });

  it('applyTheme sets data-theme and persists storage', () => {
    applyTheme('light');
    expect(attrs['data-theme']).toBe('light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    expect(hljsLink.href).toContain('github.min.css');

    applyTheme('dark');
    expect(attrs['data-theme']).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(hljsLink.href).toContain('github-dark-dimmed');
  });

  it('syncHljsStylesheet updates highlight.js href for light theme', () => {
    syncHljsStylesheet('light');
    expect(hljsLink.href).toContain('github.min.css');
    syncHljsStylesheet('dark');
    expect(hljsLink.href).toContain('github-dark-dimmed');
  });
});
