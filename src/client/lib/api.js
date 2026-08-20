import { buildLibraryAllSearchParams } from './library-all-api-params.js';
import { withImageUploadBusy } from './image-upload-busy.js';
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
export let supabaseStorageBase = null;
export let devAgentQueueEnabled = false;
export let conceptAiEnabled = false;
/** Process build id from the first `/api/config` fetch (`null` if missing / fetch failed). */
export let appBuildId = null;
try {
  const res = await fetch('/api/config', { headers: apiHeaders() });
  const json = await res.json();
  firebaseConfig = json.firebaseConfig;
  imageGenEnabled = !!json.imageGenEnabled;
  supabaseStorageBase = json.supabaseStorageBase || null;
  devAgentQueueEnabled = !!json.devAgentQueueEnabled;
  conceptAiEnabled = !!json.conceptAiEnabled;
  appBuildId = typeof json.buildId === 'string' && json.buildId.trim() ? json.buildId.trim() : null;
} catch(e) {
  console.error('Failed to fetch /api/config:', e);
}

/** Later `/api/config` `buildId` for deploy detection. Returns `null` when missing or the request fails. */
export async function fetchAppConfigBuildId() {
  try {
    const res = await fetch('/api/config', { headers: apiHeaders() });
    if (!res.ok) return null;
    const json = await res.json();
    const id = typeof json.buildId === 'string' ? json.buildId.trim() : '';
    return id || null;
  } catch {
    return null;
  }
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
export const loadCollection = async (collection, { includeMine = true, includeSrd = false, includePublic = false, search = '', semantic = '', tier = null, tiers = [], type = null, types = [], extraTypes = [], includeScaledUp = false, sort = 'popularity', offset = 0, limit = 20, id = null } = {}) => {
  const token = await getAuthToken();
  const params = new URLSearchParams({ offset: String(offset), limit: String(limit) });
  if (!includeMine) params.set('includeMine', '0');
  if (includeSrd) params.set('includeSrd', '1');
  if (includePublic) params.set('includePublic', '1');
  if (search) params.set('search', search);
  if (semantic) params.set('semantic', semantic);
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
    headers: apiHeaders(token ? { Authorization: `Bearer ${token}` } : {}),
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
  const params = buildLibraryAllSearchParams(opts);
  const res = await fetch(`/api/data/library-all?${params}`, {
    headers: apiHeaders(token ? { Authorization: `Bearer ${token}` } : {}),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

/**
 * Per-collection counts for Library nav (same filters as `loadLibraryAll`; COUNT-only on the server).
 */
export const loadLibraryAllCounts = async (opts = {}) => {
  const token = await getAuthToken();
  const params = buildLibraryAllSearchParams({ ...opts, offset: 0, limit: 20 });
  const res = await fetch(`/api/data/library-all-counts?${params}`, {
    headers: apiHeaders(token ? { Authorization: `Bearer ${token}` } : {}),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

export const postLibraryAiAnswer = async ({ question, scope = null, browseState = null } = {}) => {
  const token = await getAuthToken();
  if (!token) throw new Error('Not signed in');
  const res = await fetch('/api/library-ai-answer', {
    method: 'POST',
    headers: apiHeaders({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }),
    body: JSON.stringify({ question, scope, browseState }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
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
  if (!tableId && !token) throw new Error('Not signed in');
  const url = tableId ? `/api/data/table_state?tableId=${encodeURIComponent(tableId)}` : '/api/data/table_state';
  const res = await fetch(url, {
    headers: apiHeaders(token ? { Authorization: `Bearer ${token}` } : {}),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.items || [];
};

/**
 * Resolve items by IDs across collections.
 * Pass adopt: true to auto-clone any non-own adversaries/environments into the user's library
 * and increment popularity counts on their sources. Scene ids resolve to self-contained
 * scene rows (no nested adversary/environment id expansion).
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
 * tableId: required for characters (canonical write path).
 */
export const saveImage = async (collectionName, id, imageUrl, { _additionalImages, path, tableId } = {}) => {
  const token = await getAuthToken();
  if (!token || !id) return null;
  const bodyObj = { imageUrl };
  if (_additionalImages !== undefined) bodyObj._additionalImages = _additionalImages;
  if (path) bodyObj.path = path;
  if (tableId) bodyObj.tableId = tableId;
  // Pasted/AI-generated images are frequently multi-MB base64 data: URLs — the single largest
  // payloads this app sends. Compress like saveItem() does; uncompressed multi-MB JSON bodies are
  // far more likely to hit a proxy/host body-size limit or time out on a real network (production)
  // than on localhost, where this previously went unnoticed.
  const bodyStr = JSON.stringify(bodyObj);
  const { body, encoding } = await maybeCompressBody(bodyStr);
  const headers = apiHeaders({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` });
  if (encoding) headers['Content-Encoding'] = 'gzip';
  const res = await fetch(`/api/data/${collectionName}/${id}/image`, {
    method: 'PUT',
    headers,
    body,
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

export const deleteItem = async (collectionName, id, { tableId } = {}) => {
  const token = await getAuthToken();
  if (!token) return;
  const url = collectionName === 'characters' && tableId
    ? `/api/data/${collectionName}/${id}?tableId=${encodeURIComponent(tableId)}`
    : `/api/data/${collectionName}/${id}`;
  const res = await fetch(url, {
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
    if (body.spotlightBlocked) err.spotlightBlocked = true;
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

/** Returns `{ isAdmin, isQa, preferences?: { hideAiUi, libraryCardDimensions, bugReportColumns } }` for the currently signed-in user. */
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
 * Admin: aggregated LLM / image usage (no prompts). Query: `from`, `to` (YYYY-MM-DD UTC), optional `builder`.
 * @param {{ from?: string, to?: string, builder?: string }} [query]
 */
export const fetchAdminAiUsage = async (query = {}) => {
  const token = await getAuthToken();
  if (!token) throw new Error('Not signed in');
  const params = new URLSearchParams();
  if (query.from) params.set('from', query.from);
  if (query.to) params.set('to', query.to);
  if (query.builder) params.set('builder', query.builder);
  const qs = params.toString();
  const res = await fetch(`/api/admin/ai-usage${qs ? `?${qs}` : ''}`, {
    headers: apiHeaders({ Authorization: `Bearer ${token}` }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  return body;
};

/**
 * Admin: paginated list of bug reports (newest-first).
 * @param {{ limit?: number, offset?: number, status?: string }} [query]
 */
export const fetchAdminBugReports = async (query = {}) => {
  const token = await getAuthToken();
  if (!token) throw new Error('Not signed in');
  const params = new URLSearchParams();
  if (query.limit != null) params.set('limit', String(query.limit));
  if (query.offset != null) params.set('offset', String(query.offset));
  if (query.status) params.set('status', query.status);
  const qs = params.toString();
  const res = await fetch(`/api/admin/bug-reports${qs ? `?${qs}` : ''}`, {
    headers: apiHeaders({ Authorization: `Bearer ${token}` }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  return body;
};

/** Admin: create a manual problem report on a status column. */
export const postAdminBugReportCreate = async (notes, status) => {
  const token = await getAuthToken();
  if (!token) throw new Error('Not signed in');
  const res = await fetch('/api/admin/bug-reports', {
    method: 'POST',
    headers: apiHeaders({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }),
    body: JSON.stringify({ notes, status }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  return body;
};

/** Moves a bug report to a different status (any configured column slug) — one click, any column to any column. */
export const postAdminBugReportStatus = async (id, status) => {
  const token = await getAuthToken();
  if (!token) throw new Error('Not signed in');
  const res = await fetch(`/api/admin/bug-reports/${id}`, {
    method: 'PATCH',
    headers: apiHeaders({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }),
    body: JSON.stringify({ status }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  return body;
};

/** Updates the admin notes on a bug report. Pass an empty string to clear notes. */
export const postAdminBugReportNotes = async (id, notes) => {
  const token = await getAuthToken();
  if (!token) throw new Error('Not signed in');
  const res = await fetch(`/api/admin/bug-reports/${id}`, {
    method: 'PATCH',
    headers: apiHeaders({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }),
    body: JSON.stringify({ notes }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  return body;
};

/** Persist user preferences (server JSON merge). Body may include `hideAiUi`, `libraryCardDimensions`, and/or `bugReportColumns`. */
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
 * LLM character draft from a concept (levels 1–10). Pass `signal` to cancel (AbortController).
 * @param {string} concept
 * @param {{ signal?: AbortSignal, targetLevel?: number }} [options] — targetLevel 1–10 (default 1)
 * @returns {Promise<{
 *   mode?: 'single'|'choice',
 *   patch?: object,
 *   justification?: string,
 *   warnings?: string[],
 *   candidates?: Array<{ key: string, label: string, reason: string, patch: object, warnings?: string[] }>,
 *   overlapDiagnostics?: object,
 *   rankingRationale?: Array<{ abilityId: string, name: string, domain?: string, level?: number, reason: string }>,
 * }>}
 */
export const postCharacterAiBuild = async (concept, options = {}) => {
  const { signal, targetLevel } = options;
  const token = await getAuthToken();
  if (!token) throw new Error('Not signed in');
  const payload = { concept };
  if (targetLevel != null && targetLevel !== '') {
    const t = Math.round(Number(targetLevel));
    if (Number.isFinite(t) && t >= 1 && t <= 10) payload.targetLevel = t;
  }
  const res = await fetch('/api/character-ai-build', {
    method: 'POST',
    headers: apiHeaders({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }),
    body: JSON.stringify(payload),
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
 * LLM encounter plan: library ids + optional synthetic fallbacks.
 * @param {string} concept
 * @param {{
 *   signal?: AbortSignal,
 *   partySize: number,
 *   partyTier: number,
 *   remainingBattlePoints: number,
 *   includePublic: boolean,
 *   hasEnvironmentOnTable: boolean,
 *   tableAdversarySummary: { role: string, tier: number, count: number, name?: string }[],
 *   step?: 'plan' | 'finish' | 'full',
 *   encounterPlan?: object,
 * }} options
 */
export const postEncounterAiBuild = async (concept, options = {}) => {
  const {
    signal,
    partySize,
    partyTier,
    remainingBattlePoints,
    includePublic,
    hasEnvironmentOnTable,
    tableAdversarySummary,
    step,
    encounterPlan,
  } = options;
  const token = await getAuthToken();
  if (!token) throw new Error('Not signed in');
  const res = await fetch('/api/encounter-ai-build', {
    method: 'POST',
    headers: apiHeaders({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }),
    body: JSON.stringify({
      concept,
      partySize,
      partyTier,
      remainingBattlePoints,
      includePublic,
      hasEnvironmentOnTable,
      tableAdversarySummary,
      ...(step ? { step } : {}),
      ...(encounterPlan && typeof encounterPlan === 'object' ? { encounterPlan } : {}),
    }),
    signal,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  return body;
};

/**
 * Generate an image from a text prompt via the server (x.ai Grok Imagine).
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

/** Returns [{ tableId, gmUid, gmName, tableName, previewUrl, characterNames, characterCount, updatedAt? }] for all tables the current user is invited to. */
export const fetchMyRooms = async () => {
  const token = await getAuthToken();
  if (!token) throw new Error('Not signed in');
  const res = await fetch('/api/my-rooms', {
    headers: apiHeaders({ Authorization: `Bearer ${token}` }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

/** Returns [{ id, name, gmName, previewUrl, characterNames, characterCount, updatedAt? }] for all tables the current user owns. */
export const fetchMyTables = async () => {
  const token = await getAuthToken();
  if (!token) throw new Error('Not signed in');
  const res = await fetch('/api/my-tables', {
    headers: apiHeaders({ Authorization: `Bearer ${token}` }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

/** Homepage Public column (anonymous OK). Returns [{ id, name, gmName, previewUrl, characterNames, characterCount }]. */
export const fetchPublicTables = async ({ search = '' } = {}) => {
  const token = await getAuthToken();
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  const qs = params.toString();
  const res = await fetch(`/api/public-tables${qs ? `?${qs}` : ''}`, {
    headers: apiHeaders(token ? { Authorization: `Bearer ${token}` } : {}),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

/** Spectator names currently watching a table. Returns `{ attendees: [{ displayName }] }`. */
export const fetchTableAudience = async (tableId) => {
  const token = await getAuthToken();
  const res = await fetch(`/api/room/${encodeURIComponent(tableId)}/audience`, {
    headers: apiHeaders(token ? { Authorization: `Bearer ${token}` } : {}),
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

/** GM: generate (or rotate) a reusable table invite token. Returns `{ token, createdAt }`. */
export const postGenerateInviteLink = async (tableId) => {
  const token = await getAuthToken();
  if (!token) throw new Error('Not signed in');
  const res = await fetch('/api/room/my/invite-link', {
    method: 'POST',
    headers: apiHeaders({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }),
    body: JSON.stringify({ tableId }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
};

/** GM: revoke the active invite token. Returns `{ ok: true }`. */
export const postRevokeInviteLink = async (tableId) => {
  const token = await getAuthToken();
  if (!token) throw new Error('Not signed in');
  const qs = tableId != null ? `?tableId=${encodeURIComponent(tableId)}` : '';
  const res = await fetch(`/api/room/my/invite-link${qs}`, {
    method: 'DELETE',
    headers: apiHeaders({ Authorization: `Bearer ${token}` }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
};

/** Authenticated user: redeem a join token. Returns `{ tableId }`. */
export const postJoinInviteToken = async (inviteToken) => {
  const token = await getAuthToken();
  if (!token) throw new Error('Not signed in');
  const res = await fetch(`/api/join/${encodeURIComponent(inviteToken)}`, {
    method: 'POST',
    headers: apiHeaders({ Authorization: `Bearer ${token}` }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
};

/** Invited player: leave a table. Returns `{ ok: true }`. */
export const postLeaveTable = async (tableId) => {
  const token = await getAuthToken();
  if (!token) throw new Error('Not signed in');
  const res = await fetch(`/api/room/${tableId}/leave`, {
    method: 'POST',
    headers: apiHeaders({ Authorization: `Bearer ${token}` }),
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
 * Player: activate a V2 owned card chip on the assigned character (Guide / hover sheet).
 * Server recomputes mutations and applies full multi-instance `update-elements` — same as GM
 * `postTableOp` (ally/adversary patches are not dropped).
 * Body: { ownerInstanceId, featureName, chipName, selectOpts?, passedFeatureKey?, preferShapePlacement? }.
 */
export const postV2OwnedCardChip = async (tableId, body) => {
  const token = await getAuthToken();
  if (!token) throw new Error('Not signed in');
  const res = await fetch(`/api/room/${tableId}/v2-owned-card-chip`, {
    method: 'POST',
    headers: apiHeaders({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    const err = new Error(errBody.error || `HTTP ${res.status}`);
    if (errBody.deferToBannerAck) {
      err.deferToBannerAck = true;
      err.engineChipName = errBody.engineChipName;
      err.deferredToggleNextIsOn = errBody.deferredToggleNextIsOn;
    }
    throw err;
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
 * Create / replace the shared pre-roll intent session (GM or player).
 * chips / pending must be plain serializable objects (no functions).
 */
export const postTableIntent = async (tableId, intent) => {
  const token = await getAuthToken();
  if (!token || !tableId) return;
  fetch(`/api/room/${tableId}/intent`, {
    method: 'POST',
    headers: apiHeaders({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }),
    body: JSON.stringify(intent),
  }).catch(() => {});
};

/** @deprecated use postTableIntent */
export const postPlayerIntent = postTableIntent;

/** Merge selection fields (both roles) and DC draft (GM only) into the pending intent. */
export const patchTableIntent = async (tableId, patch) => {
  const token = await getAuthToken();
  if (!token || !tableId) return;
  fetch(`/api/room/${tableId}/intent`, {
    method: 'PATCH',
    headers: apiHeaders({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }),
    body: JSON.stringify(patch),
  }).catch(() => {});
};

/**
 * Compare-and-swap clear of the pending intent. Returns `{ ok, conflict }` so Proceed
 * can abort when the other party already proceeded or cancelled (HTTP 409).
 */
export const clearTableIntent = async (tableId, intentId, { keepTagTeamBanners = false } = {}) => {
  const token = await getAuthToken();
  if (!token || !tableId) return { ok: false };
  try {
    const qs = intentId != null && intentId !== ''
      ? `?intentId=${encodeURIComponent(intentId)}`
      : '';
    const res = await fetch(`/api/room/${tableId}/intent${qs}`, {
      method: 'DELETE',
      headers: apiHeaders({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }),
      body: JSON.stringify({ intentId, keepTagTeamBanners: keepTagTeamBanners === true }),
    });
    if (res.status === 409) return { ok: false, conflict: true };
    if (!res.ok) return { ok: false };
    return { ok: true };
  } catch {
    return { ok: false };
  }
};

/** @deprecated use clearTableIntent */
export const clearPlayerIntent = clearTableIntent;

/**
 * Observer / GM Help an Ally write — merges only that helper row.
 * Does not PATCH the rest of the intent (would clobber chips).
 */
export const postTableIntentHelp = async (tableId, { intentId, instanceId, active, label }) => {
  const token = await getAuthToken();
  if (!token || !tableId) return;
  fetch(`/api/room/${tableId}/intent/help`, {
    method: 'POST',
    headers: apiHeaders({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }),
    body: JSON.stringify({ intentId, instanceId, active, label }),
  }).catch(() => {});
};

/**
 * Dedicated Group roll write — toggle / setTrait / skip. Does not PATCH the rest
 * of the intent (would clobber chips / concurrent helper writes).
 */
export const postTableIntentGroup = async (tableId, { intentId, action, instanceId, trait, active }) => {
  const token = await getAuthToken();
  if (!token || !tableId) return;
  fetch(`/api/room/${tableId}/intent/group`, {
    method: 'POST',
    headers: apiHeaders({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }),
    body: JSON.stringify({ intentId, action, instanceId, trait, active }),
  }).catch(() => {});
};

/**
 * Dedicated Tag Team write — toggle / setPartner / setTrait. Does not PATCH the rest
 * of the intent (would clobber chips / concurrent helper writes).
 */
export const postTableIntentTagTeam = async (tableId, { intentId, action, instanceId, trait, active }) => {
  const token = await getAuthToken();
  if (!token || !tableId) return;
  fetch(`/api/room/${tableId}/intent/tag-team`, {
    method: 'POST',
    headers: apiHeaders({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }),
    body: JSON.stringify({ intentId, action, instanceId, trait, active }),
  }).catch(() => {});
};

/** Choose which Tag Team Duality applies; cancels the discarded banner. */
export const postBannerTagTeamChoose = async (tableId, { intentId, chosenRollDbId }) => {
  const token = await getAuthToken();
  if (!token || !tableId) return { ok: false };
  try {
    const res = await fetch(`/api/room/${tableId}/banner-tag-team-choose`, {
      method: 'POST',
      headers: apiHeaders({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }),
      body: JSON.stringify({ intentId, chosenRollDbId }),
    });
    if (!res.ok) return { ok: false };
    return { ok: true, ...(await res.json().catch(() => ({}))) };
  } catch {
    return { ok: false };
  }
};

/** GM: lock or unlock the difficulty for a pending intent (`finalized` defaults true). */
export const postFinalizeIntentDifficulty = async (tableId, { intentId, difficulty, finalized = true }) => {
  const token = await getAuthToken();
  if (!token) return;
  fetch(`/api/room/${tableId}/intent/difficulty`, {
    method: 'POST',
    headers: apiHeaders({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }),
    body: JSON.stringify({ intentId, difficulty, finalized }),
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

function runImageUpload(opts, run) {
  return opts?.silent ? run() : withImageUploadBusy(run);
}

/**
 * Upload an item image (character portrait, adversary art, etc.) to Supabase Storage or
 * receive a data URL fallback when Storage is not configured. Field name must be `file`
 * (multer). Returns `{ url }`. Pass `{ silent: true }` to skip the full-screen upload spinner
 * (background overlay hosting).
 */
export const postImageUpload = async (file, opts) => runImageUpload(opts, async () => {
  const token = await getAuthToken();
  if (!token) throw new Error('Not signed in');
  const form = new FormData();
  form.append('file', file);
  const res = await fetch('/api/images/upload', {
    method: 'POST',
    headers: apiHeaders({ Authorization: `Bearer ${token}` }),
    body: form,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  return body;
});

/**
 * GM: upload a map image file to storage (Supabase) or receive a data URL fallback.
 * Field name must be `file` (multer). Returns `{ url }`. Pass `{ silent: true }` to skip
 * the full-screen upload spinner (background overlay hosting).
 */
export const postMapImageFile = async (file, opts) => runImageUpload(opts, async () => {
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
});

/** Player: upload a map/overlay image for a table the user is invited to. Returns `{ url }`. */
export const postMapImageFileForTable = async (tableId, file, opts) => runImageUpload(opts, async () => {
  const token = await getAuthToken();
  if (!token) throw new Error('Not signed in');
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`/api/room/${encodeURIComponent(tableId)}/map-image`, {
    method: 'POST',
    headers: apiHeaders({ Authorization: `Bearer ${token}` }),
    body: form,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  return body;
});

/** Player (or GM): add/update/remove a mapImage element on the table via the player-safe route. */
export const postMapImageObject = async (tableId, payload) => {
  const token = await getAuthToken();
  if (!token) throw new Error('Not signed in');
  const res = await fetch(`/api/room/${encodeURIComponent(tableId)}/map-image-object`, {
    method: 'POST',
    headers: apiHeaders({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
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
    if (data.tableNotLive) {
      err.tableNotLive = true;
      err.tableNotLiveReason = data.reason ?? null;
      err.trialEndsAt = data.trialEndsAt ?? null;
      err.paidThroughAt = data.paidThroughAt ?? null;
    }
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
 * GM: persist `setRollOutcome` and/or consumed chip activation key onto the shared banner
 * so every client sees the updated Hope/Fear state and the chip shows as consumed.
 * Calls `POST /api/room/my/banner-v2-review-meta`.
 *
 * @param {{ bannerId: number, outcome?: string, consumedActivationKey?: string, tableId?: string }} opts
 */
export const postBannerV2ReviewMeta = async ({ bannerId, outcome, consumedActivationKey, tableId } = {}) => {
  const token = await getAuthToken();
  if (!token) return;
  try {
    const res = await fetch('/api/room/my/banner-v2-review-meta', {
      method: 'POST',
      headers: apiHeaders({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }),
      body: JSON.stringify({ bannerId, outcome, consumedActivationKey, tableId }),
    });
    if (!res.ok) return;
    return res.json();
  } catch { return undefined; }
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
 * Fetch billing status for a table (trial / active pass / expired).
 * Returns { isLive, reason, trialEndsAt, paidThroughAt }.
 * Requester must be the table owner or an invited player.
 */
export const fetchTableBillingStatus = async (tableId) => {
  const token = await getAuthToken();
  if (!token) throw new Error('Not signed in');
  const res = await fetch(`/api/campaign-pass/status?tableId=${encodeURIComponent(tableId)}`, {
    headers: apiHeaders({ Authorization: `Bearer ${token}` }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
};

/**
 * Start a Stripe Checkout session for a Campaign Pass.
 * Returns { checkoutUrl } — redirect the browser to this URL.
 * months must be 3, 6, or 12.
 */
export const postCampaignPassCheckout = async (tableId, months) => {
  const token = await getAuthToken();
  if (!token) throw new Error('Not signed in');
  const res = await fetch('/api/campaign-pass/checkout', {
    method: 'POST',
    headers: apiHeaders({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }),
    body: JSON.stringify({ tableId, months }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  return body;
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
