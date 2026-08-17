import { useState, useEffect, useCallback } from 'react';
import { SRD_UNIFIED_COLLECTIONS } from './library-filter-config.js';

const VALID_TABS = new Set(['assistant', 'all', ...SRD_UNIFIED_COLLECTIONS, 'maps', 'scenes', 'adventures']);
const VALID_COLLECTIONS = new Set([...SRD_UNIFIED_COLLECTIONS, 'maps', 'scenes', 'adventures']);
/** Table deep-link modals only — includes encounter notes (not a library tab) and characters (table-only, no library tab). */
const TABLE_MODAL_COLLECTIONS = new Set([...VALID_COLLECTIONS, 'notes', 'characters']);

/** Default tab when URL is `/library` or `/library/` without a segment (and invalid tab names). */
export const DEFAULT_LIBRARY_TAB = 'all';

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

  // Legacy shortcut: /gm-table/:collection/:id — collection is at index 1
  // Check VALID_COLLECTIONS (library tabs) OR characters (table-only modal collection)
  if (VALID_COLLECTIONS.has(parts[1]) || parts[1] === 'characters') {
    if (!userUid) return null;
    const col = parts[1];
    const id = parts[2] || '';
    return id ? `/table/${userUid}/${col}/${id}` : null;
  }

  const gmUid = parts[1] || null;
  let tableId = gmUid;
  let collectionOffset = 2;
  if (parts[2] && !TABLE_MODAL_COLLECTIONS.has(parts[2])) {
    tableId = parts[2];
    collectionOffset = 3;
  }
  const modalCollection = TABLE_MODAL_COLLECTIONS.has(parts[collectionOffset]) ? parts[collectionOffset] : null;
  const modalItemId = modalCollection && parts[collectionOffset + 1] ? parts[collectionOffset + 1] : null;
  let out = `/table/${tableId}`;
  if (modalCollection && modalItemId) out += `/${modalCollection}/${modalItemId}`;
  return out;
}

function parseGmTableParts(parts) {
  if (VALID_COLLECTIONS.has(parts[1]) || parts[1] === 'characters') {
    return {
      tableId: null,
      modalCollection: parts[1],
      modalItemId: parts[2] || null,
    };
  }
  const gmUid = parts[1] || null;
  let tableId = gmUid;
  let collectionOffset = 2;
  if (parts[2] && !TABLE_MODAL_COLLECTIONS.has(parts[2])) {
    tableId = parts[2];
    collectionOffset = 3;
  }
  const modalCollection = TABLE_MODAL_COLLECTIONS.has(parts[collectionOffset]) ? parts[collectionOffset] : null;
  const modalItemId = modalCollection && parts[collectionOffset + 1] ? parts[collectionOffset + 1] : null;
  return { tableId, modalCollection, modalItemId };
}

/** Pathname without ?query (for route segment parsing). */
export function pathnameOnly(fullPath) {
  if (fullPath == null || fullPath === '') return '';
  const q = fullPath.indexOf('?');
  return q >= 0 ? fullPath.slice(0, q) : fullPath;
}

/**
 * Parses a pathname into a structured route descriptor.
 *
 * Supported patterns:
 *   /                              -> { view: 'home', authMode, returnTo }
 *   /?authMode=signin|signup&returnTo=…  -> home with optional auth query params
 *   /library                        -> { view: 'library', tab: DEFAULT_LIBRARY_TAB (all), itemId: null }
 *   /library/:tab                  -> { view: 'library', tab, itemId: null }
 *   /library/:tab/new              -> { view: 'library', tab, itemId: 'new' }
 *   /library/all/new?c=:collection — merged All tab: new item type via `libraryNewCollection`
 *   /library/:tab/:id              -> { view: 'library', tab, itemId }
 *   /admin/ai-usage                -> { view: 'adminAiUsage' } (admin-only UI)
 *   /admin/bug-reports             -> { view: 'adminBugReports' } (admin-only UI)
 *   /table/:tableId                -> { view: 'table', tableId }
 *   /table/:tableId/:collection/:id -> table + modal deep-link
 *   /join/:token                   -> { view: 'join', token }
 *   /gm-table/...                  -> legacy (prefer legacyGmTableToCanonical + redirect)
 *
 * Note: /library/:tab/:id/edit is no longer a route — item editing is now
 * handled entirely within the ItemDetailModal overlay.
 *
 * @param {string} pathWithOptionalQuery — `location.pathname` or pathname + optional `?…` (as stored by `navigate`)
 */
export function parseRoute(pathWithOptionalQuery) {
  const full = pathWithOptionalQuery || '';
  const qIdx = full.indexOf('?');
  const pathname = qIdx >= 0 ? full.slice(0, qIdx) : full;
  const embeddedSearch = qIdx >= 0 ? full.slice(qIdx + 1) : '';
  const searchParams =
    embeddedSearch !== ''
      ? new URLSearchParams(embeddedSearch)
      : typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search.slice(1))
        : new URLSearchParams();

  const parts = pathname.replace(/^\//, '').split('/').filter(Boolean);

  if (parts.length === 0 || parts[0] === '') {
    return homeRoute(searchParams);
  }

  if (parts[0] === 'admin' && parts[1] === 'ai-usage') {
    return { view: 'adminAiUsage', tab: null, itemId: null, librarySemantic: null, librarySearchQuery: null };
  }

  if (parts[0] === 'admin' && parts[1] === 'bug-reports') {
    return { view: 'adminBugReports', tab: null, itemId: null, librarySemantic: null, librarySearchQuery: null };
  }

  if (parts[0] === 'join' && parts[1]) {
    return { view: 'join', token: parts[1] };
  }

  if (parts[0] === 'table') {
    const tableId = parts[1] || null;
    const modalCollection = TABLE_MODAL_COLLECTIONS.has(parts[2]) ? parts[2] : null;
    const modalItemId = modalCollection && parts[3] ? parts[3] : null;
    return { view: 'table', tableId, tab: null, modalCollection, modalItemId, librarySemantic: null, librarySearchQuery: null };
  }

  if (parts[0] === 'gm-table') {
    const { tableId, modalCollection, modalItemId } = parseGmTableParts(parts);
    return { view: 'table', tableId, tab: null, modalCollection, modalItemId, librarySemantic: null, librarySearchQuery: null };
  }

  if (parts[0] === 'library') {
    const tab = VALID_TABS.has(parts[1]) ? parts[1] : DEFAULT_LIBRARY_TAB;
    const itemId = parts[2] || null;
    const cParam = searchParams.get('c');
    const librarySemantic = searchParams.get('semantic');
    const librarySearchQuery = searchParams.get('search');
    const libraryNewCollection =
      tab === 'all' && itemId === 'new' && cParam && VALID_COLLECTIONS.has(cParam) ? cParam : null;
    return { view: 'library', tab, itemId, libraryNewCollection, librarySemantic, librarySearchQuery };
  }

  return homeRoute(searchParams);
}

function homeRoute(searchParams) {
  const authModeRaw = searchParams.get('authMode');
  const authMode = authModeRaw === 'signin' || authModeRaw === 'signup' ? authModeRaw : null;
  const returnTo = searchParams.get('returnTo');
  return {
    view: 'home',
    tab: null,
    itemId: null,
    librarySemantic: null,
    librarySearchQuery: null,
    authMode,
    returnTo,
  };
}

function getInitialPath() {
  const p = window.location.pathname;
  const search = window.location.search || '';
  const canon = legacyGmTableToCanonical(p, null);
  if (canon && canon !== p) {
    window.history.replaceState(null, '', canon + search);
    return canon + search;
  }
  return p + search;
}

/**
 * Lightweight router hook backed by the History API.
 * Returns { route, navigate } where:
 *   route   — the parsed route for window.location.pathname
 *   navigate(to, opts) — pushes or replaces a history entry and updates route
 */
export function useRouter() {
  const [path, setPath] = useState(() => getInitialPath());

  useEffect(() => {
    const onPopState = () => {
      const nextPath = window.location.pathname;
      const search = window.location.search || '';
      const next = nextPath + search;
      const canon = legacyGmTableToCanonical(nextPath, null);
      if (canon && canon !== nextPath) {
        window.history.replaceState(null, '', canon + search);
        setPath(canon + search);
      } else {
        setPath(next);
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    const pathOnly = pathnameOnly(path);
    const canon = legacyGmTableToCanonical(pathOnly, null);
    if (canon && canon !== pathOnly) {
      const search = path.includes('?') ? path.slice(path.indexOf('?')) : window.location.search || '';
      window.history.replaceState(null, '', canon + search);
      setPath(canon + search);
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

/**
 * Returns true when a click event should be handled as an in-app SPA navigation
 * (plain left-click, no modifier keys). Returns false for Cmd/Ctrl/Shift/Alt-click,
 * middle-click, and right-click so the browser can open the link in a new tab/window.
 */
export function shouldHandleSpaNavClick(e) {
  return !(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0);
}
