import { useState, useEffect, useCallback } from 'react';
import { SRD_UNIFIED_COLLECTIONS } from './library-filter-config.js';

const VALID_TABS = new Set([...SRD_UNIFIED_COLLECTIONS, 'scenes', 'adventures', 'characters']);
const VALID_COLLECTIONS = new Set([...SRD_UNIFIED_COLLECTIONS, 'scenes', 'adventures', 'characters']);

/** Default tab when URL is `/library` or `/library/` without a segment (and invalid tab names). */
export const DEFAULT_LIBRARY_TAB = 'characters';

/**
 * If pathname is a legacy `/gm-table/...` URL, returns the canonical `/table/...` path.
 * When `userUid` is required (bare `/gm-table` or `/gm-table/:collection/:id` without owner in path),
 * pass the signed-in user's Firebase uid; otherwise returns null and the caller should retry after auth.
 */
export function legacyGmTableToCanonical(pathname, userUid = null) {
  const parts = pathname.replace(/^\//, '').split('/').filter(Boolean);
  if (parts[0] !== 'gm-table') return null;

  if (parts.length === 1) {
    if (!userUid) return null;
    return `/table/${userUid}`;
  }

  if (VALID_COLLECTIONS.has(parts[1])) {
    if (!userUid) return null;
    const col = parts[1];
    const id = parts[2] || '';
    return id ? `/table/${userUid}/${col}/${id}` : null;
  }

  const gmUid = parts[1] || null;
  let tableId = gmUid;
  let collectionOffset = 2;
  if (parts[2] && !VALID_COLLECTIONS.has(parts[2])) {
    tableId = parts[2];
    collectionOffset = 3;
  }
  const modalCollection = VALID_COLLECTIONS.has(parts[collectionOffset]) ? parts[collectionOffset] : null;
  const modalItemId = modalCollection && parts[collectionOffset + 1] ? parts[collectionOffset + 1] : null;
  let out = `/table/${tableId}`;
  if (modalCollection && modalItemId) out += `/${modalCollection}/${modalItemId}`;
  return out;
}

function parseGmTableParts(parts) {
  if (VALID_COLLECTIONS.has(parts[1])) {
    return {
      tableId: null,
      modalCollection: parts[1],
      modalItemId: parts[2] || null,
    };
  }
  const gmUid = parts[1] || null;
  let tableId = gmUid;
  let collectionOffset = 2;
  if (parts[2] && !VALID_COLLECTIONS.has(parts[2])) {
    tableId = parts[2];
    collectionOffset = 3;
  }
  const modalCollection = VALID_COLLECTIONS.has(parts[collectionOffset]) ? parts[collectionOffset] : null;
  const modalItemId = modalCollection && parts[collectionOffset + 1] ? parts[collectionOffset + 1] : null;
  return { tableId, modalCollection, modalItemId };
}

/**
 * Parses a pathname into a structured route descriptor.
 *
 * Supported patterns:
 *   /                              -> { view: 'home' }
 *   /library                        -> { view: 'library', tab: DEFAULT_LIBRARY_TAB, itemId: null }
 *   /library/:tab                  -> { view: 'library', tab, itemId: null }
 *   /library/:tab/new              -> { view: 'library', tab, itemId: 'new' }
 *   /library/:tab/:id              -> { view: 'library', tab, itemId }
 *   /table/:tableId                -> { view: 'table', tableId }
 *   /table/:tableId/:collection/:id -> table + modal deep-link
 *   /gm-table/...                  -> legacy (prefer legacyGmTableToCanonical + redirect)
 *
 * Note: /library/:tab/:id/edit is no longer a route — item editing is now
 * handled entirely within the ItemDetailModal overlay.
 */
export function parseRoute(pathname) {
  const parts = pathname.replace(/^\//, '').split('/').filter(Boolean);

  if (parts.length === 0 || parts[0] === '') {
    return { view: 'home', tab: null, itemId: null };
  }

  if (parts[0] === 'table') {
    const tableId = parts[1] || null;
    const modalCollection = VALID_COLLECTIONS.has(parts[2]) ? parts[2] : null;
    const modalItemId = modalCollection && parts[3] ? parts[3] : null;
    return { view: 'table', tableId, tab: null, modalCollection, modalItemId };
  }

  if (parts[0] === 'gm-table') {
    const { tableId, modalCollection, modalItemId } = parseGmTableParts(parts);
    return { view: 'table', tableId, tab: null, modalCollection, modalItemId };
  }

  if (parts[0] === 'library') {
    const tab = VALID_TABS.has(parts[1]) ? parts[1] : DEFAULT_LIBRARY_TAB;
    const itemId = parts[2] || null;
    return { view: 'library', tab, itemId };
  }

  return { view: 'home', tab: null, itemId: null };
}

function getInitialPathname() {
  const p = window.location.pathname;
  const canon = legacyGmTableToCanonical(p, null);
  if (canon && canon !== p) {
    window.history.replaceState(null, '', canon);
    return canon;
  }
  return p;
}

/**
 * Lightweight router hook backed by the History API.
 * Returns { route, navigate } where:
 *   route   — the parsed route for window.location.pathname
 *   navigate(to, opts) — pushes or replaces a history entry and updates route
 */
export function useRouter() {
  const [path, setPath] = useState(() => getInitialPathname());

  useEffect(() => {
    const onPopState = () => {
      const next = window.location.pathname;
      const canon = legacyGmTableToCanonical(next, null);
      if (canon && canon !== next) {
        window.history.replaceState(null, '', canon);
        setPath(canon);
      } else {
        setPath(next);
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    const canon = legacyGmTableToCanonical(path, null);
    if (canon && canon !== path) {
      window.history.replaceState(null, '', canon);
      setPath(canon);
    }
  }, [path]);

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
