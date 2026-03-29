import { buildLibraryAllSearchParams } from './library-all-api-params.js';
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

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
export let supabaseStorageBase = null;
export let devAgentQueueEnabled = false;
export let conceptAiEnabled = false;
try {
  const res = await fetch('/api/config', { headers: apiHeaders() });
  const json = await res.json();
  firebaseConfig = json.firebaseConfig;
  imageGenEnabled = !!json.imageGenEnabled;
  supabaseStorageBase = json.supabaseStorageBase || null;
  devAgentQueueEnabled = !!json.devAgentQueueEnabled;
  conceptAiEnabled = !!json.conceptAiEnabled;
} catch(e) {
  console.error('Failed to fetch /api/config:', e);
}

/** Re-fetch from server (e.g. after changing `.env` + restart) — module-level `devAgentQueueEnabled` only updates on full page load. */
export async function fetchDevAgentQueueEnabled() {
  try {
    const res = await fetch('/api/config', { headers: apiHeaders() });
    if (!res.ok) return false;
    const json = await res.json();
    return !!json.devAgentQueueEnabled;
  } catch {
    return false;
  }
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

/** V2 feature module source (read-only). `relativePath` e.g. `classes/Bard.js` under `src/features-v2/`. */
export const fetchFeatureSource = async (relativePath) => {
  const token = await getAuthToken();
  if (!token) throw new Error('Not signed in');
  const params = new URLSearchParams({ path: relativePath });
  const res = await fetch(`/api/features-v2/source?${params}`, {
    headers: apiHeaders({ Authorization: `Bearer ${token}` }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
};

/** Dev agent queue (admin + DEV_AGENT_QUEUE_ENABLED). Returns `{ issues }` or `{ issues: [], disabled: true }` when API is off. */
export const fetchDevAgentIssues = async (relativePath) => {
  const token = await getAuthToken();
  if (!token) throw new Error('Not signed in');
  const params = new URLSearchParams();
  if (relativePath) params.set('path', relativePath);
  const res = await fetch(`/api/dev-agent/issues?${params}`, {
    headers: apiHeaders({ Authorization: `Bearer ${token}` }),
  });
  if (res.status === 404) return { issues: [], disabled: true };
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
};

/** Enqueue a dev-agent GitHub Issue for the given V2 feature path. */
export const postDevAgentQueue = async ({ path, kind, message }) => {
  const token = await getAuthToken();
  if (!token) throw new Error('Not signed in');
  const res = await fetch('/api/dev-agent/queue', {
    method: 'POST',
    headers: apiHeaders({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }),
    body: JSON.stringify({ path, kind, message }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
};

/**
 * OCR a cropped page region; returns readable-text flag and raw OCR string.
 * @param {Blob} imageBlob
 * @param {{ signal?: AbortSignal }} [options] — pass `signal` to cancel in-flight requests (e.g. superseded crop OCR).
 */
export const postPageLayoutRegionOcr = async (imageBlob, options = {}) => {
  const { signal } = options;
  const token = await getAuthToken();
  if (!token) throw new Error('Not signed in');
  const fd = new FormData();
  fd.append('image', imageBlob, 'region.png');
  const res = await fetch('/api/import/page-layout-region-ocr', {
    method: 'POST',
    headers: apiHeaders({ Authorization: `Bearer ${token}` }),
    body: fd,
    signal,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
};

/** @deprecated Use {@link postPageLayoutRegionOcr} */
export const postPageLayoutRegionHasText = async (imageBlob) => postPageLayoutRegionOcr(imageBlob);

/**
 * Parse plaintext for encounter import (same result shape as encounter-drop, without image OCR).
 * @param {string} text
 * @param {'adversary'|'environment'|'note'} kind
 */
export const postEncounterParseText = async (text, kind) => {
  const token = await getAuthToken();
  if (!token) throw new Error('Not signed in');
  const res = await fetch('/api/import/encounter-parse-text', {
    method: 'POST',
    headers: apiHeaders({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }),
    body: JSON.stringify({ text, kind }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
};

/**
 * Encounter panel image drop: OCR + regex parse for adversary/environment, or raw OCR text for notes.
 * @param {File|Blob} file
 * @param {'adversary'|'environment'|'note'} kind
 */
export const postEncounterDropImport = async (file, kind) => {
  const token = await getAuthToken();
  if (!token) throw new Error('Not signed in');
  const fd = new FormData();
  fd.append('image', file);
  fd.append('kind', kind);
  const res = await fetch('/api/import/encounter-drop', {
    method: 'POST',
    headers: apiHeaders({ Authorization: `Bearer ${token}` }),
    body: fd,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
};

/**
 * Load a paginated page of items for a single collection.
 * Returns { items, totalCount, dbCount }
 */
export const loadCollection = async (collection, { includeMine = true, includeSrd = false, includePublic = false, includeHod = false, search = '', tier = null, tiers = [], type = null, types = [], extraTypes = [], includeScaledUp = false, sort = 'popularity', offset = 0, limit = 20, id = null } = {}) => {
  const token = await getAuthToken();
  if (!token) throw new Error('Not signed in');
  const params = new URLSearchParams({ offset: String(offset), limit: String(limit) });
  if (!includeMine) params.set('includeMine', '0');
  if (includeSrd) params.set('includeSrd', '1');
  if (includePublic) params.set('includePublic', '1');
  if (includeHod) params.set('includeHod', '1');
  if (search) params.set('search', search);
  if (collection === 'features' && id) params.set('id', id);
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
  if (Array.isArray(extraTypes) && extraTypes.length > 0) {
    extraTypes.forEach(t => params.append('type2', t));
  }
  if (collection === 'features' && Array.isArray(types) && types.length > 0) {
    types.forEach(t => params.append('featScope', t));
  }
  if (includeScaledUp) params.set('includeScaledUp', '1');
  if (sort) params.set('sort', sort);
  const res = await fetch(`/api/data/${collection}?${params}`, {
    headers: apiHeaders({ Authorization: `Bearer ${token}` }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

export { buildLibraryAllSearchParams };

/**
 * Merged Library “All” tab — all SRD unified collections; each item includes `_collection`.
 */
export const loadLibraryAll = async (opts = {}) => {
  const token = await getAuthToken();
  if (!token) throw new Error('Not signed in');
  const params = buildLibraryAllSearchParams(opts);
  const res = await fetch(`/api/data/library-all?${params}`, {
    headers: apiHeaders({ Authorization: `Bearer ${token}` }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

/**
 * Per-collection counts for Library nav (same filters as `loadLibraryAll`; COUNT-only on the server).
 */
export const loadLibraryAllCounts = async (opts = {}) => {
  const token = await getAuthToken();
  if (!token) throw new Error('Not signed in');
  const params = buildLibraryAllSearchParams({ ...opts, offset: 0, limit: 20 });
  const res = await fetch(`/api/data/library-all-counts?${params}`, {
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
/**
 * Load table state. When tableId is provided, returns that single table's state (for the current view).
 * When omitted, returns all tables owned by the user (for list/myTables).
 */
export const loadTableState = async (tableId = null) => {
  const token = await getAuthToken();
  if (!token) throw new Error('Not signed in');
  const url = tableId ? `/api/data/table_state?tableId=${encodeURIComponent(tableId)}` : '/api/data/table_state';
  const res = await fetch(url, {
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

// Stable client ID used to tag outgoing dice rolls for SSE dedup (skip own rolls on receive).
export const CLIENT_ID = crypto.randomUUID();

/**
 * Normalize a roll from the server so callers can use attackerId/targetId.
 * Adds attackerId/targetId from _attackerInstanceId/_selectedTargetInstanceId when not already set.
 */
export function normalizeRoll(roll) {
  if (!roll || typeof roll !== 'object') return roll;
  return {
    ...roll,
    attackerId: roll.attackerId ?? roll._attackerInstanceId,
    targetId: roll.targetId ?? roll._selectedTargetInstanceId,
  };
}

/**
 * Roll dice server-side. Returns full roll data including subItems.
 * tableId — pass for player rolls (routes to /api/room/:tableId/roll); omit (null) for GM (routes to /api/room/my/roll).
 * rollMeta may use attackerId/targetId; they are sent as _attackerInstanceId/_selectedTargetInstanceId.
 * rollMeta.silent — if true, server returns roll data without persisting (no banner).
 */
export const postRoll = async (rollText, displayName, tableId = null, rollMeta = {}) => {
  const token = await getAuthToken();
  if (!token) throw new Error('Not signed in');
  const url = tableId ? `/api/room/${tableId}/roll` : '/api/room/my/roll';
  const { attackerId, targetId, ...rest } = rollMeta;
  const body = {
    rollText,
    displayName,
    _clientId: CLIENT_ID,
    ...rest,
    _attackerInstanceId: rest._attackerInstanceId ?? attackerId,
    _selectedTargetInstanceId: rest._selectedTargetInstanceId ?? targetId,
    ...(tableId != null ? { tableId } : {}),
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: apiHeaders({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body.error || `HTTP ${res.status}`);
    if (body.playBlocked) err.playBlocked = body.playBlocked;
    err.status = res.status;
    throw err;
  }
  return normalizeRoll(await res.json());
};

/**
 * Roll dice server-side without creating a banner (silent roll). Use for rest-move dice etc.
 * rollText — e.g. " [1d4]" (bracket expression). Returns same shape as postRoll; total is the numeric value.
 */
export const postRollSilent = async (rollText, displayName = '', tableId = null) => {
  const rollData = await postRoll(rollText, displayName, tableId, { silent: true });
  const value = typeof rollData.total === 'number' ? rollData.total : parseInt(rollData.subItems?.[0]?.result, 10) || 0;
  return { ...rollData, value };
};

/** Returns `{ isAdmin, isQa, preferences?: { hideAiUi } }` for the currently signed-in user. */
export const fetchMe = async () => {
  const token = await getAuthToken();
  if (!token) throw new Error('Not signed in');
  const res = await fetch('/api/me', {
    headers: apiHeaders({ Authorization: `Bearer ${token}` }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

/** Persist user preferences (server JSON merge). */
export const putUserPreferences = async (body) => {
  const token = await getAuthToken();
  if (!token) throw new Error('Not signed in');
  const res = await fetch('/api/me/preferences', {
    method: 'PUT',
    headers: apiHeaders({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  });
  const errBody = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(errBody.error || `HTTP ${res.status}`);
  return errBody;
};

/** Loads `docs/feature-authoring-guide.md` from the server at request time. Returns `{ markdown }`. */
export const fetchFeatureAuthoringGuide = async () => {
  const token = await getAuthToken();
  if (!token) throw new Error('Not signed in');
  const res = await fetch('/api/docs/feature-authoring-guide', {
    headers: apiHeaders({ Authorization: `Bearer ${token}` }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

/**
 * Sync a character from Daggerstack.com.
 * Returns { character } with all resolved stats.
 */
export const syncDaggerstackCharacter = async (url, email, password) => {
  const token = await getAuthToken();
  if (!token) throw new Error('Not signed in');
  const res = await fetch('/api/daggerstack/sync', {
    method: 'POST',
    headers: apiHeaders({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }),
    body: JSON.stringify({ url, email, password }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  return body;
};

/**
 * LLM level-1 character draft from a concept. Pass `signal` to cancel (AbortController).
 * @param {string} concept
 * @param {{ signal?: AbortSignal }} [options]
 * @returns {Promise<{ patch: object, justification: string, warnings: string[] }>}
 */
export const postCharacterAiBuild = async (concept, options = {}) => {
  const { signal } = options;
  const token = await getAuthToken();
  if (!token) throw new Error('Not signed in');
  const res = await fetch('/api/character-ai-build', {
    method: 'POST',
    headers: apiHeaders({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }),
    body: JSON.stringify({ concept }),
    signal,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  return body;
};

/**
 * LLM adversary draft from a concept.
 * @param {string} concept
 * @param {{ signal?: AbortSignal, tier: number, role: string }} [options]
 * @returns {Promise<{ patch: object, justification: string, warnings: string[] }>}
 */
export const postAdversaryAiBuild = async (concept, options = {}) => {
  const { signal, tier, role } = options;
  const token = await getAuthToken();
  if (!token) throw new Error('Not signed in');
  const res = await fetch('/api/adversary-ai-build', {
    method: 'POST',
    headers: apiHeaders({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }),
    body: JSON.stringify({ concept, tier, role }),
    signal,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  return body;
};

/**
 * LLM environment draft from a concept.
 * @param {string} concept
 * @param {{ signal?: AbortSignal, tier: number, type: string }} [options]
 * @returns {Promise<{ patch: object, justification: string, warnings: string[] }>}
 */
export const postEnvironmentAiBuild = async (concept, options = {}) => {
  const { signal, tier, type } = options;
  const token = await getAuthToken();
  if (!token) throw new Error('Not signed in');
  const res = await fetch('/api/environment-ai-build', {
    method: 'POST',
    headers: apiHeaders({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }),
    body: JSON.stringify({ concept, tier, type }),
    signal,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  return body;
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

/** Returns [{ tableId, gmUid, gmName, tableName }] for all tables the current user is invited to. */
export const fetchMyRooms = async () => {
  const token = await getAuthToken();
  if (!token) throw new Error('Not signed in');
  const res = await fetch('/api/my-rooms', {
    headers: apiHeaders({ Authorization: `Bearer ${token}` }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

/** Returns [{ id, name }] for all tables the current user owns. */
export const fetchMyTables = async () => {
  const token = await getAuthToken();
  if (!token) throw new Error('Not signed in');
  const res = await fetch('/api/my-tables', {
    headers: apiHeaders({ Authorization: `Bearer ${token}` }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

/** Create a new table. Returns { id, name }. */
export const createTable = async (name = 'New Table') => {
  const token = await getAuthToken();
  if (!token) throw new Error('Not signed in');
  const res = await fetch('/api/my-tables', {
    method: 'POST',
    headers: apiHeaders({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }),
    body: JSON.stringify({ name: String(name).trim() || 'New Table' }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
};

/** Player: send a runtime update for an assigned character. tableId identifies the table. */
export const postCharacterUpdate = async (tableId, instanceId, updates) => {
  const token = await getAuthToken();
  if (!token) throw new Error('Not signed in');
  const res = await fetch(`/api/room/${tableId}/character-update`, {
    method: 'POST',
    headers: apiHeaders({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }),
    body: JSON.stringify({ instanceId, updates }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body.error || `HTTP ${res.status}`);
    if (body.playBlocked) err.playBlocked = body.playBlocked;
    throw err;
  }
  return res.json();
};

/**
 * Player: activate a V2 cross-sheet card chip (e.g. Bard Rally clear stress on this character’s sheet).
 * Server recomputes mutations from chipKey — same effect as GM `postTableOp` + action banners.
 */
export const postV2CrossSheetChip = async (tableId, body) => {
  const token = await getAuthToken();
  if (!token) throw new Error('Not signed in');
  const res = await fetch(`/api/room/${tableId}/v2-cross-sheet-chip`, {
    method: 'POST',
    headers: apiHeaders({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.error || `HTTP ${res.status}`);
  }
  return res.json();
};

/**
 * Player: apply a V2 review banner chip (same engine as GM `handleV2ReviewChip`).
 * Body: { viewerInstanceId, bannerId, activationKey, selectOpts? }.
 */
export const postPlayerV2ReviewChip = async (tableId, body) => {
  const token = await getAuthToken();
  if (!token) throw new Error('Not signed in');
  const res = await fetch(`/api/room/${tableId}/v2-review-chip`, {
    method: 'POST',
    headers: apiHeaders({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.error || `HTTP ${res.status}`);
  }
  return res.json();
};

/** Player: add a new character to the table (auto-assigned to self). */
export const postAddCharacter = async (tableId, charData) => {
  const token = await getAuthToken();
  if (!token) throw new Error('Not signed in');
  const res = await fetch(`/api/room/${tableId}/add-character`, {
    method: 'POST',
    headers: apiHeaders({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }),
    body: JSON.stringify(charData),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

/**
 * Broadcast a pre-roll intent banner to the GM.
 * chips must be plain serializable objects (no functions) — strip onUse etc. before calling.
 * Intent shape: { characterName, characterInstanceId, rollText, chips }
 */
export const postPlayerIntent = async (tableId, intent) => {
  const token = await getAuthToken();
  if (!token) return;
  fetch(`/api/room/${tableId}/intent`, {
    method: 'POST',
    headers: apiHeaders({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }),
    body: JSON.stringify(intent),
  }).catch(() => {});
};

/** Clear the pending pre-roll intent (call after Proceed or Cancel). */
export const clearPlayerIntent = async (tableId) => {
  const token = await getAuthToken();
  if (!token) return;
  fetch(`/api/room/${tableId}/intent`, {
    method: 'DELETE',
    headers: apiHeaders({ Authorization: `Bearer ${token}` }),
  }).catch(() => {});
};

/** GM: broadcast a table operation to all room clients (best-effort, fire-and-forget). */
/**
 * Broadcast an action notification banner to all room clients via SSE.
 * tableId: null = GM mode (POST /api/room/my/action), string = player mode (POST /api/room/:tableId/action).
 * Best-effort — errors are swallowed.
 */
/**
 * Broadcast a map click “ping” (ripple + name) to all GM and player clients via SSE (`map_ping`).
 * Coordinates are in map feet on the active map. Not persisted.
 */
/** @returns {Promise<{ ok?: boolean, ping?: object }|null>} */
export const postMapPing = async (tableId, { xFt, yFt, mapId }, isGm) => {
  const token = await getAuthToken();
  if (!token || tableId == null) return null;
  const url = isGm ? '/api/room/my/map-ping' : `/api/room/${encodeURIComponent(tableId)}/map-ping`;
  const body = isGm ? { tableId, xFt, yFt, mapId } : { xFt, yFt, mapId };
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: apiHeaders({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }),
      body: JSON.stringify(body),
    });
    return resp.ok ? resp.json() : null;
  } catch {
    return null;
  }
};

/** Ephemeral scribble stroke segment — SSE `map_scribble` to all room clients (not persisted). */
export const postMapScribble = async (tableId, payload, isGm) => {
  const token = await getAuthToken();
  if (!token || tableId == null) return null;
  const url = isGm ? '/api/room/my/map-scribble' : `/api/room/${encodeURIComponent(tableId)}/map-scribble`;
  const body = isGm ? { tableId, ...payload } : payload;
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: apiHeaders({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }),
      body: JSON.stringify(body),
    });
    return resp.ok ? resp.json() : null;
  } catch {
    return null;
  }
};

/**
 * GM: upload a map image file to storage (Supabase) or receive a data URL fallback.
 * Field name must be `file` (multer). Returns `{ url }`.
 */
export const postMapImageFile = async (file) => {
  const token = await getAuthToken();
  if (!token) throw new Error('Not signed in');
  const form = new FormData();
  form.append('file', file);
  const res = await fetch('/api/room/my/map-image', {
    method: 'POST',
    headers: apiHeaders({ Authorization: `Bearer ${token}` }),
    body: form,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  return body;
};

export const postActionNotification = async (notification, tableId = null, opts = {}) => {
  const token = await getAuthToken();
  if (!token) return null;
  const url = tableId ? `/api/room/${tableId}/action` : '/api/room/my/action';
  try {
    const body = { ...notification, _clientId: CLIENT_ID };
    if (tableId != null && url === '/api/room/my/action') body.tableId = tableId;
    if (opts.bypassPrepGate) body.bypassPrepGate = true;
    const resp = await fetch(url, {
      method: 'POST',
      headers: apiHeaders({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }),
      body: JSON.stringify(body),
    });
    return resp.ok ? resp.json() : null;
  } catch { return null; }
};

/**
 * Send a table operation to the server. The server applies the op to the DB
 * and notifies all connected clients via the table_state subscription channel.
 * tableId defaults to the primary table (caller's uid) when omitted.
 * Fire-and-forget — errors are swallowed.
 */
export const postTableOp = async (op, tableId = null) => {
  const token = await getAuthToken();
  if (!token) return;
  const body = { ...op, _clientId: CLIENT_ID };
  if (tableId != null) body.tableId = tableId;
  try {
    await fetch('/api/room/my/op', {
      method: 'POST',
      headers: apiHeaders({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }),
      body: JSON.stringify(body),
    });
  } catch { /* best-effort */ }
};

/**
 * GM: apply a table op and await success. Throws on HTTP error; `err.playBlocked` may be set for prep/pause gates.
 */
export const postTableOpAwait = async (op, tableId = null) => {
  const token = await getAuthToken();
  if (!token) {
    const err = new Error('Not signed in');
    err.code = 'NO_AUTH';
    throw err;
  }
  const body = { ...op, _clientId: CLIENT_ID };
  if (tableId != null) body.tableId = tableId;
  const res = await fetch('/api/room/my/op', {
    method: 'POST',
    headers: apiHeaders({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }),
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `HTTP ${res.status}`);
    if (data.playBlocked) err.playBlocked = data.playBlocked;
    err.status = res.status;
    throw err;
  }
  return data;
};

/**
 * GM: acknowledge or cancel a banner in the server-authoritative queue.
 * action: 'acknowledge' | 'cancel'
 * options: { wingsOfLightD8?: true } — when acknowledge and wingsOfLightD8, server deducts Hope, rolls d8, returns wingsOfLightD8Result.
 * Returns the response JSON when options are passed (so caller can read wingsOfLightD8Result); otherwise best-effort, errors swallowed.
 */
export const postBannerAck = async (bannerId, action, options = {}) => {
  const token = await getAuthToken();
  if (!token) return;
  try {
    const res = await fetch('/api/room/my/banner-ack', {
      method: 'POST',
      headers: apiHeaders({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }),
      body: JSON.stringify({ bannerId, action, tableId: options.tableId, ...options }),
    });
    return res.ok ? res.json() : undefined;
  } catch { return undefined; }
};

/**
 * GM: reroll only the Hope die (Feline Instincts). Sends current roll data; server returns new roll.
 * Cost (2 Hope) is applied by the client before calling this. Do not pass _felineInstinctsHopeCost.
 */
export const postRerollHopeDie = async (roll, tableId = null) => {
  const token = await getAuthToken();
  if (!token) throw new Error('Not signed in');
  const preserved = {};
  for (const k of Object.keys(roll)) {
    if (k.startsWith('_') || k === 'tags') preserved[k] = roll[k];
  }
  const res = await fetch('/api/room/my/reroll-hope-die', {
    method: 'POST',
    headers: apiHeaders({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }),
    body: JSON.stringify({
      rollText: roll.rollText,
      displayName: roll.rollUser || roll.characterName || roll.displayName || '',
      previousSubItems: roll.subItems,
      ...preserved,
      ...(tableId != null ? { tableId } : {}),
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
};

/**
 * Stub: when Dedicated (Orderborne) upgrades Hope die to d20, call this so the server can optionally
 * track or validate. Replace with a real endpoint when needed; until then, no-op.
 */
export const postHopeDieUpgrade = async (_rollMeta) => Promise.resolve();

/**
 * Player: toggle ancestry feature reroll request on a banner (set or clear _felineRerollRequestedBy).
 * tableId identifies the table. Returns { ok: true, requested: boolean } on success, or undefined on failure.
 */
export const postBannerGenericRerollRequest = async (tableId, bannerId) => {
  const token = await getAuthToken();
  if (!token) return;
  try {
    const res = await fetch(`/api/room/${tableId}/banner-feline-reroll-request`, {
      method: 'POST',
      headers: apiHeaders({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }),
      body: JSON.stringify({ bannerId }),
    });
    return res.ok ? res.json() : undefined;
  } catch { return undefined; }
};

/** @deprecated Use postBannerGenericRerollRequest (same implementation). */
export const postBannerFelineRerollRequest = postBannerGenericRerollRequest;

/** Generic alias (ancestry feature IoC system). */
export const postBannerFeatureRequest = postBannerGenericRerollRequest;

/**
 * GM: reroll Hope and Fear dice only (Ranger's Focus). Focus is cleared by the client before calling.
 */
export const postRerollDualityDice = async (roll, tableId = null) => {
  const token = await getAuthToken();
  if (!token) throw new Error('Not signed in');
  const preserved = {};
  for (const k of Object.keys(roll)) {
    if (k.startsWith('_') || k === 'tags') preserved[k] = roll[k];
  }
  const res = await fetch('/api/room/my/reroll-duality-dice', {
    method: 'POST',
    headers: apiHeaders({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }),
    body: JSON.stringify({
      rollText: roll.rollText,
      displayName: roll.rollUser || roll.characterName || roll.displayName || '',
      previousSubItems: roll.subItems,
      ...preserved,
      ...(tableId != null ? { tableId } : {}),
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
};

/**
 * GM or player in room: set _chipResolved[stateKey] = 'ack' | 'reject' for an ancestry chip (onChipAck/onChipReject).
 * Returns { ok: true } on success.
 */
export const postBannerChipResolve = async (tableId, { bannerId, stateKey, action, extraPatch }) => {
  const token = await getAuthToken();
  if (!token) throw new Error('Not signed in');
  const res = await fetch(`/api/room/${tableId}/banner-chip-resolve`, {
    method: 'POST',
    headers: apiHeaders({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }),
    body: JSON.stringify({ bannerId, stateKey, action, extraPatch }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
};

/**
 * GM: add extra damage to current roll (e.g. Faun Kick). Cancels original banner and returns new roll data.
 * Body: { bannerId, extraDamage, extraDamageLabel?, narration?, suppressAncestryFeature? }.
 * When suppressAncestryFeature is set (e.g. 'Kick'), only that feature's chip is hidden on the new banner.
 * Returns { roll } with _rollDbId.
 */
export const postBannerAddDamage = async (bannerId, { extraDamage, extraDamageLabel, narration, suppressAncestryFeature, tableId = null }) => {
  const token = await getAuthToken();
  if (!token) throw new Error('Not signed in');
  const body = { bannerId, extraDamage, extraDamageLabel: extraDamageLabel || 'Kick', narration };
  if (suppressAncestryFeature != null) body.suppressAncestryFeature = suppressAncestryFeature;
  if (tableId != null) body.tableId = tableId;
  const res = await fetch('/api/room/my/banner-add-damage', {
    method: 'POST',
    headers: apiHeaders({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  const data = await res.json();
  return data.roll;
};

/**
 * GM: V2 action-pool bonus die (e.g. Wordsmith Heart of a Poet). Patches pending banner sub-items and total in place.
 * Hope/Stress costs are applied client-side before this call.
 */
export const postBannerActionAddDie = async (bannerId, { die, name, tableId = null }) => {
  const token = await getAuthToken();
  if (!token) throw new Error('Not signed in');
  const body = { bannerId, die, name: name ?? 'Bonus', tableId: tableId || undefined };
  const res = await fetch('/api/room/my/banner-action-add-die', {
    method: 'POST',
    headers: apiHeaders({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.error || `HTTP ${res.status}`);
  }
  return res.json();
};

/**
 * GM: V2 action-pool static bonus (e.g. Seraph Prayer Die face). Patches pending banner sub-items and total in place; no die roll.
 */
export const postBannerActionAddStatic = async (bannerId, { value, name, tableId = null }) => {
  const token = await getAuthToken();
  if (!token) throw new Error('Not signed in');
  const body = { bannerId, value, name: name ?? 'Bonus', tableId: tableId || undefined };
  const res = await fetch('/api/room/my/banner-action-add-static', {
    method: 'POST',
    headers: apiHeaders({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.error || `HTTP ${res.status}`);
  }
  return res.json();
};

/**
 * GM: reroll one duality die (e.g. Feline Instincts roll.reroll('Hope')). Cancels original banner and returns new roll data.
 * Body: { bannerId, dieType: 'Hope'|'Fear', suppressAncestryFeature? }. New banner has that die rerolled, others preset; only that chip is hidden.
 * Returns { roll } with _rollDbId.
 */
export const postBannerRerollDie = async (bannerId, { dieType, suppressAncestryFeature, tableId = null }) => {
  const token = await getAuthToken();
  if (!token) throw new Error('Not signed in');
  const body = { bannerId, dieType };
  if (suppressAncestryFeature != null) body.suppressAncestryFeature = suppressAncestryFeature;
  if (tableId != null) body.tableId = tableId;
  const res = await fetch('/api/room/my/banner-reroll-die', {
    method: 'POST',
    headers: apiHeaders({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  const data = await res.json();
  return data.roll;
};

/**
 * Player: toggle Ranger's Focus reroll request on a banner (set or clear _rangerFocusRerollRequestedBy).
 * Returns { ok: true, requested: boolean } on success, or undefined on failure.
 */
export const postBannerRangerFocusRerollRequest = async (tableId, bannerId) => {
  const token = await getAuthToken();
  if (!token) return;
  try {
    const res = await fetch(`/api/room/${tableId}/banner-ranger-focus-reroll-request`, {
      method: 'POST',
      headers: apiHeaders({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }),
      body: JSON.stringify({ bannerId }),
    });
    return res.ok ? res.json() : undefined;
  } catch { return undefined; }
};

/**
 * GM: Wings of Light — spend 1 Hope and roll 1d8, patch banner with _wingsOfLightAddD8 and _wingsOfLightD8Result.
 * Returns { ok: true, d8Result: number } on success.
 */
export const postBannerWingsD8 = async (bannerId, tableId = null) => {
  const token = await getAuthToken();
  if (!token) return;
  try {
    const res = await fetch('/api/room/my/banner-wings-d8', {
      method: 'POST',
      headers: apiHeaders({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }),
      body: JSON.stringify({ bannerId, tableId }),
    });
    return res.ok ? res.json() : undefined;
  } catch { return undefined; }
};

/**
 * Player: Wings of Light — toggle _wingsOfLightAddD8 on a banner (shared state; no Hope spend or roll).
 * Returns { ok: true, value: boolean } on success.
 */
export const postBannerWingsD8Toggle = async (tableId, bannerId, value) => {
  const token = await getAuthToken();
  if (!token) return;
  try {
    const res = await fetch(`/api/room/${tableId}/banner-wings-d8-toggle`, {
      method: 'POST',
      headers: apiHeaders({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }),
      body: JSON.stringify({ bannerId, value }),
    });
    return res.ok ? res.json() : undefined;
  } catch { return undefined; }
};

/**
 * GM or player: toggle Hold Them Off (3 Hope, select up to 3 targets) on a banner.
 * Syncs _holdThemOffActive to the roll; all clients receive updated banner via subscription.
 * Returns { ok: true, active: boolean } on success.
 */
export const postBannerHoldThemOff = async (tableId, bannerId, active) => {
  const token = await getAuthToken();
  if (!token) return;
  try {
    const res = await fetch(`/api/room/${tableId}/banner-hold-them-off`, {
      method: 'POST',
      headers: apiHeaders({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }),
      body: JSON.stringify({ bannerId, active }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `HTTP ${res.status}`);
    }
    return res.json();
  } catch (err) {
    console.error('Hold Them Off toggle failed:', err);
    return undefined;
  }
};

/**
 * GM or player: set multi-target selection on a pending banner (synced across clients).
 * patch: { selectedTargetInstanceIds?: string[], useArmorByTargetId?: Record<string, boolean> }
 */
export const postBannerTargets = async (tableId, bannerId, patch = {}) => {
  const token = await getAuthToken();
  if (!token) return;
  try {
    const res = await fetch(`/api/room/${tableId}/banner-targets`, {
      method: 'POST',
      headers: apiHeaders({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }),
      body: JSON.stringify({ bannerId, ...patch }),
    });
    if (!res.ok) return;
    return res.json();
  } catch { return undefined; }
};

/**
 * GM or player: set the Make a Scene target adversary on a pending banner.
 * Patches _selectedTargetInstanceId; all clients receive an updated banners snapshot.
 */
export const postBannerMakeASceneTarget = async (tableId, bannerId, instanceId) => {
  const token = await getAuthToken();
  if (!token) return;
  try {
    const res = await fetch(`/api/room/${tableId}/banner-make-a-scene-target`, {
      method: 'POST',
      headers: apiHeaders({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }),
      body: JSON.stringify({ bannerId, instanceId }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `HTTP ${res.status}`);
    }
    return res.json();
  } catch (err) {
    console.error('Make a Scene target set failed:', err);
    return undefined;
  }
};

/**
 * Player: cancel own pending banner (only if GM has not acked/cancelled yet).
 * tableId identifies the table. Fails if the banner was not initiated by the current user.
 */
export const postBannerCancel = async (tableId, bannerId) => {
  const token = await getAuthToken();
  if (!token) return;
  try {
    await fetch(`/api/room/${tableId}/banner-cancel`, {
      method: 'POST',
      headers: apiHeaders({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }),
      body: JSON.stringify({ bannerId }),
    });
  } catch { /* best-effort */ }
};

/**
 * Set Life Support banner target selection; syncs to all room clients.
 * tableId identifies the table (GM or player).
 * selectedInstanceId: null to clear the selection.
 */
export const postLifeSupportSelect = async (tableId, rollDbId, selectedInstanceId) => {
  if (!tableId) return;
  const token = await getAuthToken();
  if (!token) return;
  try {
    await fetch(`/api/room/${tableId}/life-support-select`, {
      method: 'POST',
      headers: apiHeaders({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }),
      body: JSON.stringify({ _rollDbId: rollDbId, selectedLifeSupportTargetInstanceId: selectedInstanceId ?? null }),
    });
  } catch { /* best-effort */ }
};

/**
 * Set rest banner move selection for a character; syncs to all room clients.
 * tableId identifies the table. GM can set any character; player can set only their assigned character.
 * Optional: targetInstanceId (for canTargetAlly moves), rollResult ({ dice, value }).
 */
export const postRestMoveSelect = async (tableId, rollDbId, instanceId, slot, moveId, options = {}) => {
  if (!tableId) return;
  const token = await getAuthToken();
  if (!token) return;
  const body = { rollDbId, instanceId, slot, moveId: moveId ?? null };
  if (options.targetInstanceId !== undefined) body.targetInstanceId = options.targetInstanceId;
  if (options.rollResult !== undefined) body.rollResult = options.rollResult;
  try {
    await fetch(`/api/room/${tableId}/rest-move-select`, {
      method: 'POST',
      headers: apiHeaders({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }),
      body: JSON.stringify(body),
    });
  } catch { /* best-effort */ }
};

/** GM: broadcast dice acknowledgement (pulses + element updates) to all players. */
export const postDiceAck = async (ackData) => {
  const token = await getAuthToken();
  if (!token) throw new Error('Not signed in');
  const res = await fetch('/api/room/my/dice-ack', {
    method: 'POST',
    headers: apiHeaders({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }),
    body: JSON.stringify(ackData),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

/**
 * Request the Google contacts.readonly scope via a popup.
 * Should only be called in response to a user gesture (click).
 * Returns the OAuth access token string, or null if the user cancelled.
 */
export const requestGoogleContactsAccess = async () => {
  try {
    const provider = new GoogleAuthProvider();
    provider.addScope('https://www.googleapis.com/auth/contacts.readonly');
    const currentUser = auth?.currentUser;
    if (currentUser?.email) {
      provider.setCustomParameters({ login_hint: currentUser.email });
    }
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    return credential?.accessToken ?? null;
  } catch (err) {
    if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
      return null;
    }
    console.error('requestGoogleContactsAccess failed:', err);
    return null;
  }
};

/**
 * Search the authenticated user's Google contacts using the People API.
 * Returns [{ name, email }] — up to 8 results. Returns [] on any error.
 * accessToken — obtained from requestGoogleContactsAccess()
 */
export const searchGoogleContacts = async (query, accessToken) => {
  if (!query?.trim() || !accessToken) return [];
  try {
    const params = new URLSearchParams({
      query: query.trim(),
      readMask: 'names,emailAddresses',
      pageSize: '8',
    });
    const res = await fetch(
      `https://people.googleapis.com/v1/people:searchContacts?${params}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) return [];
    const json = await res.json();
    const results = [];
    for (const { person } of (json.results || [])) {
      const emails = person.emailAddresses || [];
      if (!emails.length) continue;
      const name = person.names?.[0]?.displayName || '';
      for (const { value } of emails) {
        if (value) results.push({ name, email: value });
      }
    }
    return results;
  } catch {
    return [];
  }
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

