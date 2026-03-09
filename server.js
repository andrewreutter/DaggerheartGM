import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { gunzipSync } from 'zlib';
import { randomInt } from 'crypto';
import { watchFile } from 'fs';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import cron from 'node-cron';
import { runMigrations, getItems, getPublicItems, upsertItem, deleteItem, countItems, getItemsPaginated, countCommunityItems, getCommunityItemsPaginated, getItemsByIds, getItem, recordClone, recordPlay, upsertMirror, findAutoClone, getUnifiedItems, getExternalCacheByIds, getTableStatesByPlayerEmail } from './src/db.js';
import { searchFCG } from './src/fcg-search.js';
import { srdRouter, warmCache, getItem as getSrdItem } from './src/srd/index.js';
import { fetchHoDFoundryDetail } from './src/hod-search.js';
import { loadSrdIntoDb } from './src/srd-loader.js';
import { runFullSync, runSyncSource, isSyncInProgress } from './src/external-sync.js';
import multer from 'multer';
import { parseStatBlock, mergeResults, detectCollection } from './src/text-parse.js';
import { ocrImages, ocrBuffer } from './src/ocr-parse.js';
import { generateImage as hfGenerateImage, editImage as hfEditImage, isConfigured as hfIsConfigured } from './src/huggingface-image.js';
import { syncDaggerstackCharacter, invalidateSrdLookupCache } from './src/daggerstack-sync.js';
import { refreshDaggerstackUuidMap } from './scripts/refresh-daggerstack-uuids.js';
import compression from 'compression';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3456;
const APP_ID = process.env.APP_ID || 'daggerheart-gm-tool';
const COLLECTIONS = ['adversaries', 'environments', 'scenes', 'adventures', 'table_state'];

/** Parse query param as array: tier=1&tier=2 → ['1','2'], tier=1,2 → ['1','2'] */
function parseQueryArray(val) {
  if (val == null) return [];
  if (Array.isArray(val)) return val.filter(Boolean).map(String);
  return String(val).split(',').map(s => s.trim()).filter(Boolean);
}

// Admin access: comma-separated list of email addresses in ADMIN_EMAILS env var.
// e.g. ADMIN_EMAILS=alice@example.com,bob@example.com
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map(e => e.trim().toLowerCase())
  .filter(Boolean);

// --- Firebase Admin (token verification only; no service account key needed) ---
if (!getApps().length) {
  initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID });
}

// --- Auth middleware ---
async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing auth token' });
  }
  const token = header.slice(7);
  if (process.env.NODE_ENV === 'test' && token === 'test-token') {
    req.uid = 'test-user-uid';
    req.email = 'test@example.com';
    return next();
  }
  try {
    const decoded = await getAuth().verifyIdToken(token);
    req.uid = decoded.uid;
    req.email = decoded.email || '';
    next();
  } catch {
    res.status(401).json({ error: 'Invalid auth token' });
  }
}

function requireAdmin(req, res, next) {
  if (!ADMIN_EMAILS.includes(req.email?.toLowerCase())) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

app.use(compression());
// JSON body parser with gzip support (reduces upload time for large payloads)
const JSON_LIMIT = 10 * 1024 * 1024;
app.use((req, res, next) => {
  const ct = req.headers['content-type'];
  if (!ct?.includes('application/json')) return next();
  const chunks = [];
  let len = 0;
  req.on('data', (c) => { len += c.length; if (len <= JSON_LIMIT) chunks.push(c); });
  req.on('end', () => {
    if (len > JSON_LIMIT) return next(new Error('Payload too large'));
    try {
      let buf = Buffer.concat(chunks);
      if (req.headers['content-encoding'] === 'gzip') buf = gunzipSync(buf);
      req.body = JSON.parse(buf.toString());
      next();
    } catch (e) { next(e); }
  });
  req.on('error', next);
});

// --- Config route (no auth required) ---
app.get('/api/config', (req, res) => {
  res.json({
    firebaseConfig: {
      apiKey:     process.env.FIREBASE_API_KEY     || '',
      authDomain: process.env.FIREBASE_AUTH_DOMAIN || '',
      projectId:  process.env.FIREBASE_PROJECT_ID  || '',
      appId:      process.env.FIREBASE_APP_ID      || '',
    },
    imageGenEnabled: hfIsConfigured(),
  });
});

// --- Current user info ---
app.get('/api/me', requireAuth, (req, res) => {
  res.json({ isAdmin: ADMIN_EMAILS.includes(req.email?.toLowerCase()) });
});

// --- Dev live reload (SSE) ---
const liveReloadClients = new Set();
app.get('/livereload', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  req.socket.setTimeout(0);
  res.flushHeaders();
  res.write('data: connected\n\n');
  liveReloadClients.add(res);
  const heartbeat = setInterval(() => res.write(':heartbeat\n\n'), 30000);
  req.on('close', () => {
    clearInterval(heartbeat);
    liveReloadClients.delete(res);
  });
});
let reloadTimer = null;
const broadcastReload = () => {
  clearTimeout(reloadTimer);
  reloadTimer = setTimeout(() => {
    for (const client of liveReloadClients) {
      client.write('data: reload\n\n');
      client.flush?.();
    }
  }, 150);
};
const publicDir = join(__dirname, 'public');
// Skip file watchers in test mode — esbuild rebuilds from other dev agents
// must not trigger live-reload page reloads that would crash test sessions.
if (process.env.NODE_ENV !== 'test') {
  watchFile(join(publicDir, 'app.js'), { interval: 200 }, broadcastReload);
  watchFile(join(publicDir, 'styles.css'), { interval: 200 }, broadcastReload);
  watchFile(join(publicDir, 'index.html'), { interval: 200 }, broadcastReload);
}

// Debug log relay — forwards client-side log payloads to a localhost debug server.
// Only active in development (NODE_ENV != production). Used by Cursor debug mode to
// collect browser-side instrumentation logs via /api/debug-log, bypassing CORS.
// Client sends: { _debugUrl: "http://127.0.0.1:PORT/ingest/UUID", _debugSessionId: "ID", ...payload }
if (process.env.NODE_ENV !== 'production') {
  app.post('/api/debug-log', (req, res) => {
    const { _debugUrl, _debugSessionId, ...payload } = req.body || {};
    if (!_debugUrl || !_debugUrl.startsWith('http://127.0.0.1:')) return res.status(400).json({ error: 'Invalid debug URL' });
    const headers = { 'Content-Type': 'application/json' };
    if (_debugSessionId) headers['X-Debug-Session-Id'] = _debugSessionId;
    fetch(_debugUrl, { method: 'POST', headers, body: JSON.stringify(payload) }).catch(() => {});
    res.json({ ok: true });
  });
}

// --- Server-side dice rolling ---

// Parse NdX±M expression and roll all dice using crypto.randomInt.
function rollDice(expr) {
  const m = /^(\d*)d(\d+)([+-]\d+)?$/i.exec((expr || '').trim());
  if (!m) return null;
  const qty = parseInt(m[1] || '1', 10);
  const sides = parseInt(m[2], 10);
  const modifier = m[3] ? parseInt(m[3], 10) : 0;
  if (sides < 2 || qty < 1 || qty > 100) return null;
  const values = Array.from({ length: qty }, () => randomInt(1, sides + 1));
  const sum = values.reduce((a, b) => a + b, 0);
  const result = sum + modifier;
  const details = qty > 1 ? `(${values.join('+')})` : `(${values[0]})`;
  return { qty, sides, modifier, values, result, details, input: expr };
}

// Parse all [expr] bracket expressions from rollText, roll each, return subItems array.
function rollFromText(rollText) {
  const subItems = [];
  const re = /\[([^\]]+)\]/g;
  let lastEnd = 0;
  let m;
  while ((m = re.exec(rollText)) !== null) {
    const pre = rollText.slice(lastEnd, m.index);
    const expr = m[1].trim();
    const rolled = rollDice(expr);
    if (rolled) {
      subItems.push({ pre, input: rolled.input, result: String(rolled.result), details: rolled.details, post: '' });
    } else {
      subItems.push({ pre, input: expr, result: expr, details: '', post: '' });
    }
    lastEnd = m.index + m[0].length;
  }
  if (subItems.length > 0 && lastEnd < rollText.length) {
    subItems[subItems.length - 1].post = rollText.slice(lastEnd);
  }
  return subItems;
}

// Detect Daggerheart Hope/Fear dual-roll from subItems (mirrors client-side parseDaggerheartRoll).
function parseDaggerheartResult(subItems) {
  let hopeResult = null;
  let fearResult = null;
  let hopePre = null;
  let total = 0;
  for (const sub of subItems) {
    if (/damage/i.test(sub.pre || '')) continue;
    const result = parseInt(sub.result, 10);
    if (isNaN(result)) continue;
    total += result;
    if (/hope/i.test(sub.pre || '')) { hopeResult = result; hopePre = sub.pre; }
    else if (/fear/i.test(sub.pre || '')) fearResult = result;
  }
  if (hopeResult === null || fearResult === null) return null;
  let characterName = null;
  if (hopePre) {
    const withoutHope = hopePre.replace(/\s*hope\s*/i, '').trim();
    const words = withoutHope.split(/\s+/).filter(Boolean);
    if (words.length > 1) { words.pop(); characterName = words.join(' '); }
  }
  const dominant = hopeResult === fearResult ? 'critical' : hopeResult > fearResult ? 'hope' : 'fear';
  return { total, hopeResult, fearResult, dominant, characterName };
}

// Build a full roll data object from text + displayName.
function buildRollData(rollText, displayName, _clientId, extra = {}) {
  const subItems = rollFromText(rollText);
  if (!subItems.length) return null;
  const dh = parseDaggerheartResult(subItems);
  let rollData;
  if (dh) {
    rollData = { ...dh, rollUser: dh.characterName || displayName || '', subItems, timestamp: Date.now() };
  } else {
    let total = 0;
    for (const sub of subItems) {
      if (/damage/i.test(sub.pre || '')) continue;
      const v = parseInt(sub.result, 10);
      if (!isNaN(v)) total += v;
    }
    rollData = { rollUser: displayName || '', total, subItems, timestamp: Date.now() };
  }
  if (_clientId) rollData._clientId = _clientId;
  return { ...rollData, ...extra };
}

// --- Multi-player room state (in-memory) ---
// gmUid -> { players: Map<uid, { res, name, email, photoURL }>, gmClients: Set<res> }
const rooms = new Map();

/** Extract and verify a Firebase JWT from the ?token= query parameter. */
async function verifyTokenFromQuery(req, res) {
  const { token } = req.query;
  if (!token) { res.status(401).json({ error: 'Missing token' }); return null; }
  try {
    const decoded = await getAuth().verifyIdToken(token);
    return { uid: decoded.uid, email: decoded.email || '', name: decoded.name || decoded.email || '', picture: decoded.picture || '' };
  } catch {
    res.status(401).json({ error: 'Invalid token' }); return null;
  }
}

const ROLL_LOG_SIZE = 50;

function getOrCreateRoom(gmUid) {
  if (!rooms.has(gmUid)) rooms.set(gmUid, { players: new Map(), gmClients: new Set(), rollLog: [] });
  return rooms.get(gmUid);
}

function appendRollLog(gmUid, rollData) {
  const room = getOrCreateRoom(gmUid);
  room.rollLog.push(rollData);
  if (room.rollLog.length > ROLL_LOG_SIZE) room.rollLog.shift();
}

function broadcastPresenceToGm(gmUid) {
  const room = rooms.get(gmUid);
  if (!room) return;
  const presence = [...room.players.entries()].map(([uid, p]) => ({ uid, name: p.name, email: p.email, photoURL: p.photoURL }));
  const msg = `event: presence\ndata: ${JSON.stringify({ players: presence })}\n\n`;
  for (const clientRes of room.gmClients) { clientRes.write(msg); clientRes.flush?.(); }
}

function broadcastToAllRoomClients(gmUid, eventName, data, excludeRes = null) {
  const room = rooms.get(gmUid);
  if (!room) return;
  const msg = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const { res } of room.players.values()) { if (res !== excludeRes) { res.write(msg); res.flush?.(); } }
  for (const clientRes of room.gmClients) { if (clientRes !== excludeRes) { clientRes.write(msg); clientRes.flush?.(); } }
}

function broadcastToPlayers(gmUid, eventName, data) {
  const room = rooms.get(gmUid);
  if (!room) return;
  const msg = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const { res } of room.players.values()) { res.write(msg); res.flush?.(); }
}

// --- Data routes ---

app.get('/api/data', requireAuth, async (req, res) => {
  const includeSrd = req.query.includeSrd === '1';
  const includePublic = req.query.includePublic === '1';
  try {
    const results = await Promise.all(
      COLLECTIONS.map(col => getItems(APP_ID, req.uid, col))
    );
    const data = Object.fromEntries(COLLECTIONS.map((col, i) => [col, results[i].map(item => ({ ...item, _source: 'own' }))]));

    if (includeSrd) {
      const srdCollections = ['adversaries', 'environments'];
      const srdResults = await Promise.all(
        srdCollections.map(col => searchSrdCollection(col, { limit: 500, offset: 0 }).then(r => r.items.map(i => ({ ...i, _source: 'srd' }))))
      );
      srdCollections.forEach((col, i) => {
        data[col] = [...data[col], ...srdResults[i]];
      });
    }

    if (includePublic) {
      const publicResults = await Promise.all(
        COLLECTIONS.map(col => getPublicItems(APP_ID, req.uid, col))
      );
      COLLECTIONS.forEach((col, i) => {
        if (data[col]) data[col] = [...data[col], ...publicResults[i]];
      });
    }

    res.json(data);
  } catch (err) {
    console.error('GET /api/data error:', err);
    res.status(500).json({ error: 'Failed to fetch data' });
  }
});

// --- FCG search route (Feature Library independent toggle) ---

app.get('/api/fcg-search', requireAuth, async (req, res) => {
  const { search, tier } = req.query;
  try {
    const result = await searchFCG({
      search: search || '',
      tier: tier ? parseInt(tier, 10) : undefined,
    });
    res.json({ adversaries: result.adversaries, environments: result.environments });
  } catch (err) {
    console.error('GET /api/fcg-search error:', err);
    res.status(500).json({ error: `FCG search failed: ${err.message}` });
  }
});

// --- Per-collection paginated route ---

const PAGINATED_COLLECTIONS = ['adversaries', 'environments', 'scenes', 'adventures'];
const UNIFIED_COLLECTIONS = ['adversaries', 'environments'];

async function fetchDbCounts(appId, uid, collection, { includeMine = true, includePublic, includeMirrors = true, search, tier, tierMax, tiers = [], typeField, typeValue, typeValues = [] }) {
  const opts = tierMax != null
    ? { search, tierMax, typeField, typeValue, typeValues }
    : { search, tier, tiers, typeField, typeValue, typeValues };
  const hasCommunity = includePublic || includeMirrors;
  const [ownCount, communityCount] = await Promise.all([
    includeMine ? countItems(appId, uid, collection, opts) : Promise.resolve(0),
    hasCommunity ? countCommunityItems(appId, collection, { excludeUserId: uid, includePublic: Boolean(includePublic), includeMirrors: Boolean(includeMirrors), ...opts }) : Promise.resolve(0),
  ]);
  return { ownCount, communityCount, dbCount: ownCount + communityCount };
}

async function fetchDbItems(appId, uid, collection, { includeMine, includePublic, includeMirrors, search, tier, tierMax, tiers, typeField, typeValue, typeValues, offset, limit }, { ownCount, communityCount, dbCount }) {
  const opts = tierMax != null ? { search, tierMax, typeField, typeValue, typeValues } : { search, tier, tiers, typeField, typeValue, typeValues };
  const hasCommunity = includePublic || includeMirrors;
  const ownLimit = includeMine && offset < ownCount ? Math.min(limit, ownCount - offset) : 0;
  const communityOffset = Math.max(0, offset - ownCount);
  const communityLimit = hasCommunity && offset + limit > ownCount ? Math.min(limit - ownLimit, Math.max(0, communityCount - communityOffset)) : 0;
  const [ownSlice, communitySlice] = await Promise.all([
    ownLimit > 0 ? getItemsPaginated(appId, uid, collection, { ...opts, offset, limit: ownLimit }) : Promise.resolve([]),
    communityLimit > 0 ? getCommunityItemsPaginated(appId, collection, { excludeUserId: uid, includePublic: Boolean(includePublic), includeMirrors: Boolean(includeMirrors), ...opts, offset: communityOffset, limit: communityLimit }) : Promise.resolve([]),
  ]);
  return { items: [...ownSlice, ...communitySlice], dbCount };
}

app.get('/api/data/:collection', requireAuth, async (req, res) => {
  const { collection } = req.params;

  if (collection === 'table_state') {
    try {
      const rows = await getItems(APP_ID, req.uid, 'table_state');
      return res.json({ items: rows.map(r => ({ ...r, _source: 'own' })), totalCount: rows.length, dbCount: rows.length });
    } catch (err) {
      console.error('GET /api/data/table_state error:', err);
      return res.status(500).json({ error: 'Failed to fetch table_state' });
    }
  }

  if (!PAGINATED_COLLECTIONS.includes(collection)) {
    return res.status(400).json({ error: 'Unknown collection' });
  }

  const includeMine = req.query.includeMine !== '0';
  const includePublic = req.query.includePublic === '1';
  const search = req.query.search || '';
  const includeScaledUp = req.query.includeScaledUp === '1';
  const typeField = collection === 'adversaries' ? 'role' : collection === 'environments' ? 'type' : null;
  const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const sort = req.query.sort || 'popularity';

  const tiersRaw = parseQueryArray(req.query.tier);
  const typeValuesRaw = parseQueryArray(req.query.type);
  const tiers = tiersRaw.map(t => parseInt(t, 10)).filter(n => !isNaN(n) && n >= 1 && n <= 4);
  const typeValues = typeValuesRaw.filter(Boolean);
  const tierMax = (includeScaledUp && tiers.length === 1) ? tiers[0] : null;

  try {
    if (UNIFIED_COLLECTIONS.includes(collection)) {
      const result = await getUnifiedItems(APP_ID, req.uid, collection, {
        includeMine,
        includePublic,
        includeSrd: req.query.includeSrd === '1',
        includeHod: req.query.includeHod === '1',
        includeFcg: req.query.includeFcg === '1',
        search,
        tierMax,
        tiers: tierMax != null ? [] : tiers,
        typeField,
        typeValues,
        sort,
        offset,
        limit,
      });

      const items = result.items.map(item => ({
        ...item,
        popularity: (item.clone_count || 0) + (item.play_count || 0),
      }));

      return res.json({
        items,
        totalCount: result.totalCount,
        dbCount: result.totalCount,
        nextOffset: offset + items.length,
      });
    }

    const includeMirrors = false;
    const dbOpts = { includeMine, includePublic, includeMirrors, search, tier: tiers[0] || null, tierMax, tiers: tierMax != null ? [] : tiers, typeField, typeValue: typeValues[0] || null, typeValues, offset, limit };
    const { ownCount, communityCount, dbCount } = await fetchDbCounts(APP_ID, req.uid, collection, dbOpts);
    const { items } = await fetchDbItems(APP_ID, req.uid, collection, dbOpts, { ownCount, communityCount, dbCount });
    const itemsWithPop = items.map(item => ({ ...item, popularity: (item.clone_count || 0) + (item.play_count || 0) }));
    return res.json({ items: itemsWithPop, totalCount: dbCount, dbCount, nextOffset: offset + items.length });
  } catch (err) {
    console.error(`GET /api/data/${collection} error:`, err);
    res.status(500).json({ error: 'Failed to fetch collection' });
  }
});

// --- Batch resolve route (for scene expansion) ---

/**
 * Adopt a single adversary/environment item into the current user's library.
 * Finds an existing auto-clone or creates one, increments popularity counts on the source.
 * Returns the user's owned clone (or the item itself if already owned).
 */
async function adoptItem(appId, uid, collection, item) {
  if (item._source === 'own') {
    await recordPlay(appId, uid, collection, item.id);
    return item;
  }

  const sourceId = item.id;
  const isExternal = !['public'].includes(item._source);

  let clone = await findAutoClone(appId, uid, collection, sourceId);
  const isNewClone = !clone;

  if (!clone) {
    const { _source: _s, _owner: _o, id: _id, is_public: _ip, clone_count: _cc, play_count: _pc, ...rest } = item;
    const newId = crypto.randomUUID();
    const cloneData = { ...rest, _clonedFrom: sourceId };
    await upsertItem(appId, uid, collection, newId, cloneData, false);
    clone = { id: newId, ...cloneData, is_public: false, clone_count: 0, play_count: 0, popularity: 0, _source: 'own' };
  }

  if (isNewClone) await recordClone(appId, uid, collection, sourceId);
  await recordPlay(appId, uid, collection, sourceId);

  return clone;
}

app.post('/api/data/resolve', requireAuth, async (req, res) => {
  const body = req.body;
  if (!body || typeof body !== 'object') {
    return res.status(400).json({ error: 'Invalid body' });
  }
  const adopt = Boolean(body.adopt);
  try {
    const resolveCollection = async (col, ids) => {
      if (!ids || ids.length === 0) return [];
      const dbItems = await getItemsByIds(APP_ID, col, ids);
      const foundIds = new Set(dbItems.map(i => i.id));
      const missing = ids.filter(id => !foundIds.has(id));
      if (!missing.length) return dbItems;

      let extras = [];
      if (['adversaries', 'environments'].includes(col)) {
        const cacheItems = await getExternalCacheByIds(APP_ID, col, missing);
        const cacheIds = new Set(cacheItems.map(i => i.id));
        extras = cacheItems;
        const stillMissing = missing.filter(id => !cacheIds.has(id));
        for (const id of stillMissing) {
          if (id.startsWith('hod-')) {
            try {
              const postId = id.replace(/^hod-/, '');
              const item = await fetchHoDFoundryDetail(postId, `https://heartofdaggers.com/?p=${postId}`, col);
              extras.push(item);
            } catch (err) {
              console.warn(`[hod] Could not resolve ${id}:`, err.message);
            }
          } else if (id.startsWith('srd-')) {
            const item = await getSrdItem(col, id);
            if (item) extras.push({ ...item, _source: 'srd' });
          }
        }
      } else {
        const srdFills = await Promise.all(missing.filter(id => id.startsWith('srd-')).map(id => getSrdItem(col, id)));
        extras = srdFills.filter(Boolean).map(item => ({ ...item, _source: 'srd' }));
      }

      return [...dbItems, ...extras];
    };

    const [adversaries, environments, scenes] = await Promise.all([
      resolveCollection('adversaries', body.adversaries || []),
      resolveCollection('environments', body.environments || []),
      resolveCollection('scenes', body.scenes || []),
    ]);

    if (adopt) {
      const [adoptedAdvs, adoptedEnvs] = await Promise.all([
        Promise.all(adversaries.map(item => adoptItem(APP_ID, req.uid, 'adversaries', item))),
        Promise.all(environments.map(item => adoptItem(APP_ID, req.uid, 'environments', item))),
      ]);
      return res.json({ adversaries: adoptedAdvs, environments: adoptedEnvs, scenes });
    }

    res.json({ adversaries, environments, scenes });
  } catch (err) {
    console.error('POST /api/data/resolve error:', err);
    res.status(500).json({ error: 'Failed to resolve items' });
  }
});

// --- Clone endpoint (explicit clone + auto-clone-on-play) ---

const CLONE_COLLECTIONS = ['adversaries', 'environments', 'scenes', 'adventures'];

app.post('/api/data/:collection/clone', requireAuth, async (req, res) => {
  const { collection } = req.params;
  if (!CLONE_COLLECTIONS.includes(collection)) {
    return res.status(400).json({ error: 'Unknown collection for clone' });
  }
  const { source, play = false } = req.body;
  if (!source || typeof source !== 'object') {
    return res.status(400).json({ error: 'Invalid source item' });
  }

  const sourceId = source.id;
  // SRD items are treated as external (creates a __MIRROR__ row) alongside FCG and other sources.
  const isExternal = source._source && !['own', 'public'].includes(source._source);

  try {
    // For owned items, client sends stripped payload (no base64 images) to avoid huge uploads.
    // Fetch full source from DB so the clone includes images.
    let effectiveSource = source;
    if (!isExternal && sourceId) {
      const dbSource = await getItem(APP_ID, req.uid, collection, sourceId);
      if (dbSource) effectiveSource = dbSource;
    }
    if (source._source === 'hod' && source._hodPostId) {
      try {
        const detailUrl = source._hodLink || `https://heartofdaggers.com/?p=${source._hodPostId}`;
        const full = await fetchHoDFoundryDetail(source._hodPostId, detailUrl, collection);
        // Preserve the link metadata from the list-search item
        effectiveSource = { ...full, _hodLink: source._hodLink || detailUrl };
      } catch (err) {
        console.warn(`[hod] Could not fetch full detail for ${sourceId}, using summary data:`, err.message);
      }
    }

    let clone = null;
    let isNewClone = true;

    if (play) {
      // Reuse existing auto-clone if present
      clone = await findAutoClone(APP_ID, req.uid, collection, sourceId);
      if (clone) isNewClone = false;
    }

    if (!clone) {
      const { _source: _s, _owner: _o, id: _id, is_public: _ip, clone_count: _cc, play_count: _pc, popularity: _pop, ...rest } = effectiveSource;
      const newId = crypto.randomUUID();
      const cloneData = { ...rest, _clonedFrom: sourceId };
      await upsertItem(APP_ID, req.uid, collection, newId, cloneData, false);
      clone = { id: newId, ...cloneData, is_public: false, clone_count: 0, play_count: 0, popularity: 0, _source: 'own' };
    }

    if (isNewClone) await recordClone(APP_ID, req.uid, collection, sourceId);
    if (play) await recordPlay(APP_ID, req.uid, collection, sourceId);

    res.json({ item: clone });
  } catch (err) {
    console.error(`POST /api/data/${collection}/clone error:`, err);
    res.status(500).json({ error: 'Failed to clone item' });
  }
});

// --- Play endpoint (own items added to Game Table) ---

app.post('/api/data/:collection/play', requireAuth, async (req, res) => {
  const { collection } = req.params;
  if (!CLONE_COLLECTIONS.includes(collection)) {
    return res.status(400).json({ error: 'Unknown collection for play' });
  }
  const { itemId } = req.body;
  if (!itemId) {
    return res.status(400).json({ error: 'itemId is required' });
  }
  try {
    await recordPlay(APP_ID, req.uid, collection, itemId);
    res.json({ ok: true });
  } catch (err) {
    console.error(`POST /api/data/${collection}/play error:`, err);
    res.status(500).json({ error: 'Failed to record play' });
  }
});

app.post('/api/data/:collection/enrich', requireAuth, async (req, res) => {
  const { collection } = req.params;
  if (!CLONE_COLLECTIONS.includes(collection)) {
    return res.status(400).json({ error: 'Unknown collection for enrich' });
  }
  const { items } = req.body;
  const hodItems = (Array.isArray(items) ? items : []).filter(i => i._source === 'hod' && i._hodPostId && (i.features || []).length === 0);
  const enriched = {};
  if (hodItems.length > 0) {
    const cacheItems = await getExternalCacheByIds(APP_ID, collection, hodItems.map(i => i.id));
    for (const c of cacheItems) enriched[c.id] = c;
  }
  res.json({ enriched });
});

// --- Generic image/text import (OCR + regex parse, no LLM) ---

const importUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 20 },
  fileFilter: (_req, file, cb) => {
    cb(null, file.mimetype.startsWith('image/'));
  },
});

// --- Daggerstack character sync ---

app.post('/api/daggerstack/sync', requireAuth, async (req, res) => {
  const { url, email, password } = req.body || {};
  if (!url || !email || !password) {
    return res.status(400).json({ error: 'url, email, and password are required' });
  }
  try {
    const { character, _debug, _lookupTables } = await syncDaggerstackCharacter(url, email, password);
    res.json({ character, _debug, _lookupTables });
  } catch (err) {
    console.error('POST /api/daggerstack/sync error:', err);
    res.status(400).json({ error: err.message });
  }
});

// --- Hugging Face image generation ---

app.post('/api/generate-image', requireAuth, async (req, res) => {
  const { prompt } = req.body || {};
  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({ error: 'prompt is required' });
  }
  if (!hfIsConfigured()) {
    return res.status(503).json({ error: 'Image generation is not configured (HF_TOKEN missing)' });
  }
  try {
    const result = await hfGenerateImage(prompt.trim());
    res.json(result);
  } catch (err) {
    console.error('POST /api/generate-image error:', err);
    res.status(500).json({ error: err.message || 'Image generation failed' });
  }
});

app.post('/api/edit-image', requireAuth, async (req, res) => {
  const { image, prompt } = req.body || {};
  if (!image || typeof image !== 'string' || !image.startsWith('data:')) {
    return res.status(400).json({ error: 'image (base64 data URL) is required' });
  }
  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({ error: 'prompt is required' });
  }
  if (!hfIsConfigured()) {
    return res.status(503).json({ error: 'Image generation is not configured (HF_TOKEN missing)' });
  }
  try {
    const result = await hfEditImage(image, prompt.trim());
    res.json(result);
  } catch (err) {
    console.error('POST /api/edit-image error:', err);
    res.status(500).json({ error: err.message || 'Image editing failed' });
  }
});

app.post('/api/import/parse', requireAuth, importUpload.array('images', 20), async (req, res) => {
  try {
    const files = req.files || [];
    const pastedText = (req.body.text || '').trim();

    // Phase 1: OCR all images, classify each as stat-block or artwork.
    // Mirrors the approach in ocrImages() / the Reddit parse path.
    const ocrResults = [];  // { text, artworkRegions, parsedResult, fileIndex }
    const pureArtworkUrls = [];  // data-URL thumbnails for non-stat-block images

    for (let i = 0; i < files.length; i++) {
      try {
        const { text, isStatBlock: isStat, artworkRegions, parsedResult } = await ocrBuffer(files[i].buffer);
        if (isStat && text) {
          ocrResults.push({ text, artworkRegions, parsedResult, fileIndex: i });
        } else {
          // Non-stat-block image → convert to data URL for use as artwork
          const mime = files[i].mimetype || 'image/jpeg';
          pureArtworkUrls.push(`data:${mime};base64,${files[i].buffer.toString('base64')}`);
        }
      } catch (imgErr) {
        console.warn('[import] Failed to process image:', files[i].originalname, imgErr.message);
      }
    }

    // Phase 2: Parse each stat-block text and assign artwork.
    // Same logic as the Reddit path: prefer pure artwork, fall back to cropped regions.
    const results = [];
    const allCroppedArtwork = ocrResults.flatMap(r => r.artworkRegions);
    const availableArtwork = [...pureArtworkUrls, ...allCroppedArtwork];
    let artworkIdx = 0;

    for (const { text, parsedResult, fileIndex } of ocrResults) {
      // Use pre-merged cross-engine parse result when available; fall back to
      // detectCollection on raw text (single-engine or no parsedResult case).
      const detected = parsedResult || detectCollection(text);
      const { collection, item, confidence, missing } = detected;

      // Assign primary artwork URL — take from the shared pool
      const artworkUrl = availableArtwork[artworkIdx] || null;
      if (artworkUrl) artworkIdx++;
      item.imageUrl = artworkUrl || '';

      // Additional images: remaining available artwork beyond the primary
      const additional = availableArtwork.slice(artworkIdx);
      if (additional.length > 0) {
        item._additionalImages = additional;
      }

      results.push({ collection, item, confidence, missing, artworkUrl, sourceIndex: fileIndex });
    }

    // Phase 3: Parse optional pasted text blocks
    if (pastedText) {
      const blocks = pastedText.split(/\n{3,}/).map(s => s.trim()).filter(Boolean);
      for (const block of blocks) {
        const detected = detectCollection(block);
        const { collection, item, confidence, missing } = detected;
        results.push({ collection, item, confidence, missing, artworkUrl: null, sourceIndex: -1 });
      }
    }

    res.json({ results });
  } catch (err) {
    console.error('POST /api/import/parse error:', err);
    res.status(500).json({ error: err.message || 'Failed to parse import' });
  }
});

/**
 * Deep merge incoming data into current, preserving imageUrl and _additionalImages
 * when the incoming payload omits them (client strips images from normal PUTs).
 */
function deepMergePreservingImages(current, incoming) {
  if (current == null) return incoming;
  if (incoming == null) return current;
  if (typeof incoming !== 'object' || Array.isArray(incoming)) return incoming;

  const result = { ...current };
  for (const key of Object.keys(incoming)) {
    if (key === 'imageUrl' || key === '_additionalImages') {
      const val = incoming[key];
      if (val !== undefined && val !== null && val !== '') {
        result[key] = val;
      }
      // else keep current
    } else if (key === 'adversaries' || key === 'environments') {
      const curArr = current[key] || [];
      const inArr = incoming[key] || [];
      result[key] = inArr.map((inEntry, idx) => {
        const curEntry = curArr[idx];
        if (inEntry && typeof inEntry === 'object' && inEntry.data) {
          return { ...inEntry, data: deepMergePreservingImages(curEntry?.data, inEntry.data) };
        }
        return inEntry;
      });
    } else if (key === 'elements') {
      const curArr = current[key] || [];
      const inArr = incoming[key] || [];
      const curByInstanceId = {};
      curArr.forEach(el => { if (el?.instanceId) curByInstanceId[el.instanceId] = el; });
      result[key] = inArr.map((inEntry) => {
        if (inEntry && typeof inEntry === 'object') {
          const curEntry = inEntry.instanceId ? curByInstanceId[inEntry.instanceId] : undefined;
          return curEntry ? deepMergePreservingImages(curEntry, inEntry) : inEntry;
        }
        return inEntry;
      });
    } else if (typeof incoming[key] === 'object' && incoming[key] !== null && !Array.isArray(incoming[key])) {
      result[key] = deepMergePreservingImages(current[key], incoming[key]);
    } else {
      result[key] = incoming[key];
    }
  }
  return result;
}

app.put('/api/data/:collection/:id/image', requireAuth, async (req, res) => {
  const { collection, id } = req.params;
  if (!COLLECTIONS.includes(collection)) {
    return res.status(400).json({ error: 'Unknown collection' });
  }
  const { imageUrl, _additionalImages, path: jsonPath } = req.body || {};
  if (imageUrl === undefined && _additionalImages === undefined) {
    return res.status(400).json({ error: 'imageUrl or _additionalImages required' });
  }
  try {
    const current = await getItem(APP_ID, req.uid, collection, id);
    if (!current) {
      return res.status(404).json({ error: 'Item not found' });
    }
    const pathParts = (jsonPath || '').split('.').filter(Boolean);
    const imageUpdates = {};
    if (imageUrl !== undefined) imageUpdates.imageUrl = imageUrl;
    if (_additionalImages !== undefined) imageUpdates._additionalImages = _additionalImages;

    let merged;
    if (pathParts.length === 0) {
      merged = { ...current, ...imageUpdates };
    } else {
      merged = JSON.parse(JSON.stringify(current));
      let ptr = merged;
      for (let i = 0; i < pathParts.length - 1; i++) {
        const part = pathParts[i];
        const key = /^\d+$/.test(part) ? parseInt(part, 10) : part;
        ptr = ptr?.[key];
        if (!ptr) break;
      }
      const lastPart = pathParts[pathParts.length - 1];
      const lastKey = /^\d+$/.test(lastPart) ? parseInt(lastPart, 10) : lastPart;
      if (ptr && typeof ptr === 'object') {
        ptr[lastKey] = { ...(ptr[lastKey] || {}), ...imageUpdates };
      }
    }

    const { id: _id, is_public, _source, _owner, ...rest } = merged;
    await upsertItem(APP_ID, req.uid, collection, id, rest, Boolean(merged.is_public));
    res.json({ id, ...rest, is_public: Boolean(merged.is_public), _source: 'own' });
  } catch (err) {
    console.error(`PUT /api/data/${collection}/${id}/image error:`, err);
    res.status(500).json({ error: 'Failed to save image' });
  }
});

app.post('/api/data/:collection/mirror', requireAuth, async (req, res) => {
  const { collection } = req.params;
  if (!CLONE_COLLECTIONS.includes(collection)) {
    return res.status(400).json({ error: 'Unknown collection for mirror' });
  }
  const { item } = req.body;
  if (!item || typeof item !== 'object' || !item.id) {
    return res.status(400).json({ error: 'Invalid item' });
  }
  try {
    const { id, _source, _owner, clone_count, play_count, popularity, ...data } = item;
    await upsertMirror(APP_ID, collection, id, { ...data, _source: _source || 'fcg' });
    res.json({ ok: true });
  } catch (err) {
    console.error(`POST /api/data/${collection}/mirror error:`, err);
    res.status(500).json({ error: 'Failed to create mirror' });
  }
});

app.put('/api/data/:collection', requireAuth, async (req, res) => {
  const { collection } = req.params;
  if (!COLLECTIONS.includes(collection)) {
    return res.status(400).json({ error: 'Unknown collection' });
  }
  const item = req.body;
  if (!item || typeof item !== 'object') {
    return res.status(400).json({ error: 'Invalid item body' });
  }
  const id = item.id || crypto.randomUUID();
  const { id: _id, is_public, _source, _owner, ...incoming } = item;
  try {
    let dataToSave = incoming;
    if (id) {
      const current = await getItem(APP_ID, req.uid, collection, id);
      if (current) {
        const { id: _cid, is_public: _cp, _source: _cs, _owner: _co, ...currentData } = current;
        dataToSave = deepMergePreservingImages(currentData, incoming);
      }
    }
    await upsertItem(APP_ID, req.uid, collection, id, dataToSave, Boolean(is_public));
    const saved = { id, ...dataToSave, is_public: Boolean(is_public), _source: 'own' };
    res.json(saved);

    // Broadcast table_state to all connected room clients (players + other GM windows)
    if (collection === 'table_state' && rooms.has(req.uid)) {
      broadcastToAllRoomClients(req.uid, 'state', dataToSave);
    }
  } catch (err) {
    console.error(`PUT /api/data/${collection} error:`, err);
    res.status(500).json({ error: 'Failed to save item' });
  }
});

app.delete('/api/data/:collection/:id', requireAuth, async (req, res) => {
  const { collection, id } = req.params;
  if (!COLLECTIONS.includes(collection)) {
    return res.status(400).json({ error: 'Unknown collection' });
  }
  try {
    await deleteItem(APP_ID, req.uid, collection, id);
    res.json({ ok: true });
  } catch (err) {
    console.error(`DELETE /api/data/${collection}/${id} error:`, err);
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

// --- Multi-player room API ---

// GET /api/my-rooms — returns GMs whose table_state includes the user's email
app.get('/api/my-rooms', requireAuth, async (req, res) => {
  try {
    const rows = await getTableStatesByPlayerEmail(APP_ID, req.email);
    res.json(rows.map(r => ({ gmUid: r.userId, gmName: r.data?.gmDisplayName || '' })));
  } catch (err) {
    console.error('GET /api/my-rooms error:', err);
    res.status(500).json({ error: 'Failed to fetch rooms' });
  }
});

// GET /api/room/my/players — GM SSE: receive player presence updates
app.get('/api/room/my/players', async (req, res) => {
  const user = await verifyTokenFromQuery(req, res);
  if (!user) return;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  req.socket.setTimeout(0);
  res.flushHeaders();

  const room = getOrCreateRoom(user.uid);
  room.gmClients.add(res);

  // Send current presence immediately
  const presence = [...room.players.entries()].map(([uid, p]) => ({ uid, name: p.name, email: p.email, photoURL: p.photoURL }));
  res.write(`event: presence\ndata: ${JSON.stringify({ players: presence })}\n\n`);

  // Send recent roll history so reconnecting GM windows see prior rolls
  if (room.rollLog.length > 0) {
    res.write(`event: roll-history\ndata: ${JSON.stringify({ rolls: room.rollLog })}\n\n`);
  }
  res.flush?.();

  const heartbeat = setInterval(() => { res.write(':heartbeat\n\n'); res.flush?.(); }, 30000);
  req.on('close', () => { clearInterval(heartbeat); room.gmClients.delete(res); });
});

// GET /api/room/:gmUid/stream — Player SSE: receive table state and events
app.get('/api/room/:gmUid/stream', async (req, res) => {
  const { gmUid } = req.params;
  const user = await verifyTokenFromQuery(req, res);
  if (!user) return;
  try {
    const tableStateItems = await getItems(APP_ID, gmUid, 'table_state');
    const tableState = tableStateItems[0] || {};
    const playerEmails = tableState.playerEmails || [];
    if (!playerEmails.includes(user.email)) {
      return res.status(403).json({ error: 'Not invited to this room' });
    }
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    req.socket.setTimeout(0);
    res.flushHeaders();

    // Send initial state
    res.write(`event: state\ndata: ${JSON.stringify(tableState)}\n\n`);

    // Track player in room
    const room = getOrCreateRoom(gmUid);
    room.players.set(user.uid, { res, name: user.name, email: user.email, photoURL: user.picture });

    // Send current presence to this player
    const presence = [...room.players.entries()].map(([uid, p]) => ({ uid, name: p.name, email: p.email, photoURL: p.photoURL }));
    res.write(`event: presence\ndata: ${JSON.stringify({ players: presence })}\n\n`);

    // Send recent roll history so late-joining players see prior rolls
    if (room.rollLog.length > 0) {
      res.write(`event: roll-history\ndata: ${JSON.stringify({ rolls: room.rollLog })}\n\n`);
    }
    res.flush?.();

    // Notify GM of new player
    broadcastPresenceToGm(gmUid);

    const heartbeat = setInterval(() => { res.write(':heartbeat\n\n'); res.flush?.(); }, 30000);
    req.on('close', () => {
      clearInterval(heartbeat);
      room.players.delete(user.uid);
      broadcastPresenceToGm(gmUid);
    });
  } catch (err) {
    console.error(`GET /api/room/${gmUid}/stream error:`, err);
    if (!res.headersSent) res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/room/my/roll — GM rolls dice server-side; result broadcast to all room clients
app.post('/api/room/my/roll', requireAuth, (req, res) => {
  const { rollText, displayName, _clientId } = req.body;
  if (!rollText) return res.status(400).json({ error: 'rollText is required' });
  const rollData = buildRollData(rollText, displayName, _clientId);
  if (!rollData) return res.status(400).json({ error: 'No dice expressions found in rollText' });
  appendRollLog(req.uid, rollData);
  broadcastToAllRoomClients(req.uid, 'dice-roll', rollData);
  res.json(rollData);
});

// POST /api/room/my/dice-ack — GM broadcasts acknowledgement (dismiss + pulses) to all room clients
app.post('/api/room/my/dice-ack', requireAuth, (req, res) => {
  broadcastToAllRoomClients(req.uid, 'dice-ack', req.body);
  res.json({ ok: true });
});

// POST /api/room/:gmUid/character-update — Player updates their assigned character's runtime state
app.post('/api/room/:gmUid/character-update', requireAuth, async (req, res) => {
  const { gmUid } = req.params;
  const { instanceId, updates } = req.body;
  try {
    const tableStateItems = await getItems(APP_ID, gmUid, 'table_state');
    const tableState = tableStateItems[0] || {};
    if (!(tableState.playerEmails || []).includes(req.email)) {
      return res.status(403).json({ error: 'Not a player in this room' });
    }
    const character = (tableState.elements || []).find(e => e.instanceId === instanceId);
    if (!character || character.assignedPlayerEmail !== req.email) {
      return res.status(403).json({ error: 'Not assigned to this character' });
    }
    broadcastToAllRoomClients(gmUid, 'character-update', { instanceId, updates });
    res.json({ ok: true });
  } catch (err) {
    console.error(`POST /api/room/${gmUid}/character-update error:`, err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/room/:gmUid/add-character — Player adds a character (auto-assigned to themselves)
app.post('/api/room/:gmUid/add-character', requireAuth, async (req, res) => {
  const { gmUid } = req.params;
  try {
    const tableStateItems = await getItems(APP_ID, gmUid, 'table_state');
    const tableState = tableStateItems[0] || {};
    if (!(tableState.playerEmails || []).includes(req.email)) {
      return res.status(403).json({ error: 'Not invited to this room' });
    }
    const { name, playerName, maxHope, maxHp, maxStress, tier } = req.body;
    const character = {
      instanceId: crypto.randomUUID(),
      elementType: 'character',
      assignedPlayerEmail: req.email,
      name: name || 'Unnamed',
      playerName: playerName || req.email,
      tier: tier || 1,
      maxHope: maxHope || 6,
      maxHp: maxHp || 6,
      maxStress: maxStress || 6,
      hope: maxHope || 6,
      currentHp: maxHp || 6,
      currentStress: 0,
      conditions: '',
    };
    broadcastToAllRoomClients(gmUid, 'character-added', character);
    res.json({ character });
  } catch (err) {
    console.error(`POST /api/room/${gmUid}/add-character error:`, err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/room/:gmUid/roll — Player rolls dice server-side; validates room membership,
// broadcasts result to GM + all players via SSE.
app.post('/api/room/:gmUid/roll', requireAuth, async (req, res) => {
  const { gmUid } = req.params;
  const { rollText, displayName, _clientId } = req.body;
  if (!rollText) return res.status(400).json({ error: 'rollText is required' });
  try {
    const tableStateItems = await getItems(APP_ID, gmUid, 'table_state');
    const tableState = tableStateItems[0] || {};
    if (!(tableState.playerEmails || []).includes(req.email)) {
      return res.status(403).json({ error: 'Not a player in this room' });
    }
    const rollData = buildRollData(rollText, displayName, _clientId, { _playerInitiated: true });
    if (!rollData) return res.status(400).json({ error: 'No dice expressions found in rollText' });
    appendRollLog(gmUid, rollData);
    broadcastToAllRoomClients(gmUid, 'dice-roll', rollData);
    res.json(rollData);
  } catch (err) {
    console.error(`POST /api/room/${gmUid}/roll error:`, err);
    res.status(500).json({ error: `Roll failed: ${err.message}` });
  }
});

app.use('/api/srd', srdRouter);

app.use(express.static(join(__dirname, 'public')));

// SPA fallback — serve index.html for any unmatched route
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'index.html'));
});

// --- Startup ---
async function startServer() {
  await warmCache();
  if (process.env.DATABASE_URL) {
    await runMigrations();
    await loadSrdIntoDb(APP_ID);
    cron.schedule('0 3 * * *', async () => {
      if (isSyncInProgress()) return;
      try {
        await runFullSync(APP_ID);
      } catch (err) {
        console.error('[cron] Sync failed:', err.message);
      }
    });
    cron.schedule('0 3 * * 0', async () => {
      if (isSyncInProgress()) return;
      try {
        await runSyncSource(APP_ID, 'hod', null, { fullRefresh: true });
      } catch (err) {
        console.error('[cron] HoD full refresh failed:', err.message);
      }
    });
    cron.schedule('0 4 * * *', async () => {
      try {
        await refreshDaggerstackUuidMap();
        invalidateSrdLookupCache();
        console.log('[cron] Daggerstack UUID map refreshed');
      } catch (err) {
        console.error('[cron] Daggerstack UUID refresh failed:', err.message);
      }
    });
  } else {
    console.warn('[db] DATABASE_URL not set — running without database');
  }
  app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
}

startServer().catch(err => {
  console.error('Startup failed:', err);
  process.exit(1);
});
