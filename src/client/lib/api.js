import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

/** Headers to add when running behind ngrok (bypasses browser warning interstitial). */
function apiHeaders(extra = {}) {
  const h = { ...extra };
  if (typeof window !== 'undefined' && window.location?.hostname?.includes('ngrok')) {
    h['ngrok-skip-browser-warning'] = 'true';
  }
  return h;
}

let firebaseConfig;
export let imageGenEnabled = false;
try {
  const res = await fetch('/api/config', { headers: apiHeaders() });
  const json = await res.json();
  firebaseConfig = json.firebaseConfig;
  imageGenEnabled = !!json.imageGenEnabled;
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
export const loadCollection = async (collection, { includeMine = true, includeSrd = false, includePublic = false, includeHod = false, includeFcg = false, search = '', tier = null, tiers = [], type = null, types = [], includeScaledUp = false, sort = 'popularity', offset = 0, limit = 20 } = {}) => {
  const token = await getAuthToken();
  if (!token) throw new Error('Not signed in');
  const params = new URLSearchParams({ offset: String(offset), limit: String(limit) });
  if (!includeMine) params.set('includeMine', '0');
  if (includeSrd) params.set('includeSrd', '1');
  if (includePublic) params.set('includePublic', '1');
  if (includeHod) params.set('includeHod', '1');
  if (includeFcg) params.set('includeFcg', '1');
  if (search) params.set('search', search);
  if (Array.isArray(tiers) && tiers.length > 0) {
    tiers.forEach(t => params.append('tier', String(t)));
  } else if (tier != null) {
    params.set('tier', String(tier));
  }
  if (Array.isArray(types) && types.length > 0) {
    types.forEach(t => params.append('type', t));
  } else if (type) {
    params.set('type', type);
  }
  if (includeScaledUp) params.set('includeScaledUp', '1');
  if (sort) params.set('sort', sort);
  const res = await fetch(`/api/data/${collection}?${params}`, {
    headers: apiHeaders({ Authorization: `Bearer ${token}` }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

/**
 * Load a collection with streaming. Batches arrive as they complete.
 * @param {string} collection
 * @param {object} opts - Same as loadCollection
 * @param {{ onBatch: (data: { source, items?, dbCount?, totalCount? }) => void, onEnrichment?: (data: { mirrorMap }) => void, onDone: (data: { totalCount, nextOffset }) => void, onSources?: (data: { sources: string[] }) => void, onProbative?: (data: { source: string, totalCount?: number }) => void }} handlers
 */
export const loadCollectionStream = async (collection, opts, { onBatch, onEnrichment, onDone, onSources, onProbative }) => {
  const token = await getAuthToken();
  if (!token) throw new Error('Not signed in');
  const params = new URLSearchParams({ offset: String(opts.offset ?? 0), limit: String(opts.limit ?? 20), stream: '1' });
  if (!opts.includeMine) params.set('includeMine', '0');
  if (opts.includeSrd) params.set('includeSrd', '1');
  if (opts.includePublic) params.set('includePublic', '1');
  if (opts.includeHod) params.set('includeHod', '1');
  if (opts.includeFcg) params.set('includeFcg', '1');
  if (opts.search) params.set('search', opts.search);
  if (Array.isArray(opts.tiers) && opts.tiers.length > 0) {
    opts.tiers.forEach(t => params.append('tier', String(t)));
  } else if (opts.tier != null) {
    params.set('tier', String(opts.tier));
  }
  if (Array.isArray(opts.types) && opts.types.length > 0) {
    opts.types.forEach(t => params.append('type', t));
  } else if (opts.type) {
    params.set('type', opts.type);
  }
  if (opts.includeScaledUp) params.set('includeScaledUp', '1');

  const res = await fetch(`/api/data/${collection}?${params}`, {
    headers: apiHeaders({ Authorization: `Bearer ${token}` }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let currentEvent = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith('event: ')) {
        currentEvent = line.slice(7).trim();
      } else if (line.startsWith('data: ') && currentEvent) {
        try {
          const data = JSON.parse(line.slice(6));
          if (currentEvent === 'batch') onBatch(data);
          else if (currentEvent === 'enrichment' && onEnrichment) onEnrichment(data);
          else if (currentEvent === 'done') onDone(data);
          else if (currentEvent === 'sources' && onSources) onSources(data);
          else if (currentEvent === 'probative' && onProbative) onProbative(data);
        } catch {}
        currentEvent = null;
      }
    }
  }
};

/**
 * Load the table_state collection (single record, no pagination).
 */
export const loadTableState = async () => {
  const token = await getAuthToken();
  if (!token) throw new Error('Not signed in');
  const res = await fetch('/api/data/table_state', {
    headers: apiHeaders({ Authorization: `Bearer ${token}` }),
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
    headers: apiHeaders({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }),
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
      headers: apiHeaders({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }),
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
      headers: apiHeaders({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }),
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
  // For owned items, strip images so we don't send huge base64 payloads; server fetches full data from DB.
  const isOwn = !source?._source || source._source === 'own';
  const payload = isOwn ? stripImageFields(JSON.parse(JSON.stringify(source))) : source;
  const res = await fetch(`/api/data/${collectionName}/clone`, {
    method: 'POST',
    headers: apiHeaders({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }),
    body: JSON.stringify({ source: payload, play }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.item;
};

/**
 * Record a play of an own item (adds it to the Game Table).
 * Increments play_count on the item.
 */
export const recordPlay = async (collectionName, itemId) => {
  const token = await getAuthToken();
  if (!token) return;
  const res = await fetch(`/api/data/${collectionName}/play`, {
    method: 'POST',
    headers: apiHeaders({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }),
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
    headers: apiHeaders({ Authorization: `Bearer ${token}` }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

const GZIP_THRESHOLD = 100 * 1024; // compress payloads > 100KB
async function maybeCompressBody(bodyStr) {
  if (bodyStr.length < GZIP_THRESHOLD) return { body: bodyStr, encoding: null };
  if (typeof CompressionStream === 'undefined') return { body: bodyStr, encoding: null };
  try {
    const stream = new Blob([new TextEncoder().encode(bodyStr)]).stream()
      .pipeThrough(new CompressionStream('gzip'));
    const chunks = [];
    for await (const c of stream) chunks.push(c);
    const blob = new Blob(chunks);
    return { body: await blob.arrayBuffer(), encoding: 'gzip' };
  } catch {
    return { body: bodyStr, encoding: null };
  }
}

/**
 * Recursively strip imageUrl and _additionalImages from an object.
 * Used before PUT to avoid sending large base64 payloads; server merges to preserve images.
 */
export function stripImageFields(obj) {
  if (obj == null) return obj;
  if (Array.isArray(obj)) {
    return obj.map(stripImageFields);
  }
  if (typeof obj !== 'object') return obj;
  const out = { ...obj };
  delete out.imageUrl;
  delete out._additionalImages;
  for (const key of Object.keys(out)) {
    if (out[key] != null && typeof out[key] === 'object') {
      out[key] = stripImageFields(out[key]);
    }
  }
  return out;
}

/**
 * Save image fields via the dedicated endpoint. Use when images change (AI generate, import).
 * path: optional JSON path for nested updates, e.g. "adversaries.2.data" for inline copy in scene.
 */
export const saveImage = async (collectionName, id, imageUrl, { _additionalImages, path } = {}) => {
  const token = await getAuthToken();
  if (!token || !id) return null;
  const body = { imageUrl };
  if (_additionalImages !== undefined) body._additionalImages = _additionalImages;
  if (path) body.path = path;
  const res = await fetch(`/api/data/${collectionName}/${id}/image`, {
    method: 'PUT',
    headers: apiHeaders({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

export const saveItem = async (collectionName, item) => {
  const token = await getAuthToken();
  if (!token) return null;
  let payload = item;
  if (item?.id) {
    payload = stripImageFields(JSON.parse(JSON.stringify(item)));
  }
  const bodyStr = JSON.stringify(payload);
  const { body, encoding } = await maybeCompressBody(bodyStr);
  const headers = apiHeaders({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` });
  if (encoding) headers['Content-Encoding'] = 'gzip';
  let res;
  try {
    res = await fetch(`/api/data/${collectionName}`, {
      method: 'PUT',
      headers,
      body,
    });
  } catch (fetchErr) {
    throw fetchErr;
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

export const saveMirrorItem = async (collectionName, item) => {
  const token = await getAuthToken();
  if (!token) return null;
  const res = await fetch(`/api/admin/mirror/${collectionName}`, {
    method: 'PUT',
    headers: apiHeaders({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }),
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
    headers: apiHeaders({ Authorization: `Bearer ${token}` }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
};

export const fetchRolzRoomLog = async (roomName) => {
  const token = await getAuthToken();
  if (!token) throw new Error('Not signed in');
  const res = await fetch(`/api/rolz-roomlog?room=${encodeURIComponent(roomName)}`, {
    headers: apiHeaders({ Authorization: `Bearer ${token}` }),
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
    headers: apiHeaders({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }),
    body: JSON.stringify({ room, text, from, rolzUsername, rolzPassword }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
};

/** Returns { isAdmin } for the currently signed-in user. */
export const fetchMe = async () => {
  const token = await getAuthToken();
  if (!token) throw new Error('Not signed in');
  const res = await fetch('/api/me', {
    headers: apiHeaders({ Authorization: `Bearer ${token}` }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

/**
 * Generate an image from a text prompt via the Hugging Face Inference API.
 * Returns { imageUrl } where imageUrl is a base64 data URL.
 */
export const generateImage = async (prompt) => {
  const token = await getAuthToken();
  if (!token) throw new Error('Not signed in');
  const res = await fetch('/api/generate-image', {
    method: 'POST',
    headers: apiHeaders({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }),
    body: JSON.stringify({ prompt }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
};

/**
 * Edit an existing image using a natural language instruction.
 * image — base64 data URL of the current image
 * Returns { imageUrl } where imageUrl is a base64 data URL.
 */
export const editImage = async (image, prompt) => {
  const token = await getAuthToken();
  if (!token) throw new Error('Not signed in');
  const res = await fetch('/api/edit-image', {
    method: 'POST',
    headers: apiHeaders({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }),
    body: JSON.stringify({ image, prompt }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
};

