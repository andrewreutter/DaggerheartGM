import { useState, useEffect, useCallback } from 'react';

const VALID_TABS = new Set(['adversaries', 'environments', 'groups', 'scenes', 'adventures']);

/**
 * Parses a pathname into a structured route descriptor.
 *
 * Supported patterns:
 *   /                        -> { view: 'home' }
 *   /library/:tab            -> { view: 'library', tab, itemId: null, action: null }
 *   /library/:tab/new        -> { view: 'library', tab, itemId: 'new', action: null }
 *   /library/:tab/:id        -> { view: 'library', tab, itemId, action: null }
 *   /library/:tab/:id/edit   -> { view: 'library', tab, itemId, action: 'edit' }
 *   /gm-table                -> { view: 'gm-table' }
 */
export function parseRoute(pathname) {
  const parts = pathname.replace(/^\//, '').split('/').filter(Boolean);

  if (parts.length === 0 || parts[0] === '') {
    return { view: 'home', tab: null, itemId: null, action: null };
  }

  if (parts[0] === 'gm-table') {
    return { view: 'gm-table', tab: null, itemId: null, action: null };
  }

  if (parts[0] === 'library') {
    const tab = VALID_TABS.has(parts[1]) ? parts[1] : 'adversaries';
    const itemId = parts[2] || null;
    const action = parts[3] === 'edit' ? 'edit' : null;
    return { view: 'library', tab, itemId, action };
  }

  return { view: 'home', tab: null, itemId: null, action: null };
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
