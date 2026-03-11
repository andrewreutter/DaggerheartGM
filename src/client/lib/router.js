import { useState, useEffect, useCallback } from 'react';

const VALID_TABS = new Set(['adversaries', 'environments', 'scenes', 'adventures', 'characters']);
const VALID_COLLECTIONS = new Set(['adversaries', 'environments', 'scenes', 'adventures', 'characters']);

/**
 * Parses a pathname into a structured route descriptor.
 *
 * Supported patterns:
 *   /                              -> { view: 'home' }
 *   /library/:tab                  -> { view: 'library', tab, itemId: null }
 *   /library/:tab/new              -> { view: 'library', tab, itemId: 'new' }
 *   /library/:tab/:id              -> { view: 'library', tab, itemId }
 *   /gm-table                      -> { view: 'gm-table', modalCollection, modalItemId }
 *   /gm-table/:collection/:id      -> { view: 'gm-table', modalCollection, modalItemId }
 *
 * Note: /library/:tab/:id/edit is no longer a route — item editing is now
 * handled entirely within the ItemDetailModal overlay.
 */
export function parseRoute(pathname) {
  const parts = pathname.replace(/^\//, '').split('/').filter(Boolean);

  if (parts.length === 0 || parts[0] === '') {
    return { view: 'home', tab: null, itemId: null };
  }

  if (parts[0] === 'gm-table') {
    // Legacy: /gm-table/:collection/:id — collection names never look like Firebase UIDs
    if (VALID_COLLECTIONS.has(parts[1])) {
      return { view: 'gm-table', gmUid: null, tab: null, modalCollection: parts[1], modalItemId: parts[2] || null };
    }
    // Current: /gm-table/:gmUid[/:collection/:id]
    const gmUid = parts[1] || null;
    const modalCollection = VALID_COLLECTIONS.has(parts[2]) ? parts[2] : null;
    const modalItemId = modalCollection && parts[3] ? parts[3] : null;
    return { view: 'gm-table', gmUid, tab: null, modalCollection, modalItemId };
  }

  if (parts[0] === 'library') {
    const tab = VALID_TABS.has(parts[1]) ? parts[1] : 'adversaries';
    // Accept /library/:tab/:id or /library/:tab/:id/edit (redirect edit → modal)
    const itemId = parts[2] || null;
    return { view: 'library', tab, itemId };
  }

  return { view: 'home', tab: null, itemId: null };
}

/**
 * Lightweight router hook backed by the History API.
 * Returns { route, navigate } where:
 *   route   — the parsed route for window.location.pathname
 *   navigate(to, opts) — pushes or replaces a history entry and updates route
 */
export function useRouter() {
  const [path, setPath] = useState(() => window.location.pathname);

  useEffect(() => {
    const onPopState = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = useCallback((to, { replace = false } = {}) => {
    if (replace) {
      window.history.replaceState(null, '', to);
    } else {
      window.history.pushState(null, '', to);
    }
    setPath(to);
  }, []);

  return { route: parseRoute(path), navigate };
}
