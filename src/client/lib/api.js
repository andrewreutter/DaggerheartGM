import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

let firebaseConfig;
try {
  const res = await fetch('/api/config');
  const json = await res.json();
  firebaseConfig = json.firebaseConfig;
} catch(e) {
  console.error('Failed to fetch /api/config:', e);
}

let app, auth;
try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
} catch (e) {
  console.error('Firebase initialization failed:', e);
}

export { auth };

export const getAuthToken = async () => {
  const currentUser = auth?.currentUser;
  if (!currentUser) return null;
  return currentUser.getIdToken();
};

/**
 * Load a paginated page of items for a single collection.
 * Returns { items, totalCount, dbCount }
 */
export const loadCollection = async (collection, { includeMine = true, includeSrd = false, includePublic = false, includeHod = false, includeFcg = false, search = '', tier = null, type = null, offset = 0, limit = 20 } = {}) => {
  const token = await getAuthToken();
  if (!token) throw new Error('Not signed in');
  const params = new URLSearchParams({ offset: String(offset), limit: String(limit) });
  if (!includeMine) params.set('includeMine', '0');
  if (includeSrd) params.set('includeSrd', '1');
  if (includePublic) params.set('includePublic', '1');
  if (includeHod) params.set('includeHod', '1');
  if (includeFcg) params.set('includeFcg', '1');
  if (search) params.set('search', search);
  if (tier != null) params.set('tier', String(tier));
  if (type) params.set('type', type);
  const res = await fetch(`/api/data/${collection}?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

/**
 * Load the table_state collection (single record, no pagination).
 */
export const loadTableState = async () => {
  const token = await getAuthToken();
  if (!token) throw new Error('Not signed in');
  const res = await fetch('/api/data/table_state', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.items || [];
};

/**
 * Resolve items by IDs across collections (for scene/group expansion).
 * Pass adopt: true to auto-clone any non-own adversaries/environments into the user's library
 * and increment popularity counts on their sources.
 * @param {{ adversaries?, environments?, scenes? }} idMap
 * @param {{ adopt?: boolean }} opts
 * @returns {{ adversaries, environments, scenes }}
 */
export const resolveItems = async (idMap, { adopt = false } = {}) => {
  const token = await getAuthToken();
  if (!token) throw new Error('Not signed in');
  const res = await fetch('/api/data/resolve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ ...idMap, adopt }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

/**
 * Fetch full HoD Foundry detail for items with missing tier data, warming the mirror cache.
 * Fire-and-forget friendly — returns {} on any failure.
 * @param {string} collection - 'adversaries' | 'environments'
 * @param {object[]} items - list items with _source='hod' and _hodPostId set
 * @returns {Record<string, object>} map of id -> enriched item data
 */
export const enrichItems = async (collection, items) => {
  const token = await getAuthToken();
  if (!token) return {};
  const stubs = items.map(i => ({ id: i.id, _source: i._source, _hodPostId: i._hodPostId, _hodLink: i._hodLink }));
  try {
    const res = await fetch(`/api/data/${collection}/enrich`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ items: stubs }),
    });
    if (!res.ok) return {};
    const data = await res.json();
    return data.enriched || {};
  } catch {
    return {};
  }
};

/**
 * Enrich a single HoD item, returning the full detail or the original item on failure.
 */
export const enrichSingleItem = async (collection, item) => {
  const enriched = await enrichItems(collection, [item]);
  return enriched[item.id] || item;
};

/**
 * Ensure a mirror row exists for an external item so it can be resolved by ID later.
 * Fire-and-forget — callers don't need to await.
 */
export const ensureMirror = async (collection, item) => {
  const token = await getAuthToken();
  if (!token) return;
  try {
    await fetch(`/api/data/${collection}/mirror`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ item }),
    });
  } catch { /* best-effort */ }
};

/**
 * Clone an item into the user's library.
 * play=false: always create a new copy (explicit Clone button).
 * play=true: find-or-reuse an existing auto-clone (Add to Table on non-own item).
 * Returns the user's owned clone.
 */
export const cloneItemToLibrary = async (collectionName, source, { play = false } = {}) => {
  const token = await getAuthToken();
  if (!token) throw new Error('Not signed in');
  const res = await fetch(`/api/data/${collectionName}/clone`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ source, play }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.item;
};

/**
 * Record a play of an own item (adds it to the GM Table).
 * Increments play_count on the item.
 */
export const recordPlay = async (collectionName, itemId) => {
  const token = await getAuthToken();
  if (!token) return;
  const res = await fetch(`/api/data/${collectionName}/play`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ itemId }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
};

/**
 * Search FCG for items (used by Feature Library independent toggle).
 * @returns {{ adversaries, environments }}
 */
export const loadFcgSearch = async ({ search = '', tier } = {}) => {
  const token = await getAuthToken();
  if (!token) throw new Error('Not signed in');
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (tier) params.set('tier', String(tier));
  const res = await fetch(`/api/fcg-search?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

export const saveItem = async (collectionName, item) => {
  const token = await getAuthToken();
  if (!token) return null;
  const res = await fetch(`/api/data/${collectionName}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(item),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

export const deleteItem = async (collectionName, id) => {
  const token = await getAuthToken();
  if (!token) return;
  const res = await fetch(`/api/data/${collectionName}/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
};

export const fetchRolzRoomLog = async (roomName) => {
  const token = await getAuthToken();
  if (!token) throw new Error('Not signed in');
  const res = await fetch(`/api/rolz-roomlog?room=${encodeURIComponent(roomName)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
};

export const postRolzRoll = async (room, text, rolzUsername, rolzPassword, from = 'DaggerheartGM') => {
  const token = await getAuthToken();
  if (!token) throw new Error('Not signed in');
  const res = await fetch('/api/rolz-post', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ room, text, from, rolzUsername, rolzPassword }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
};
