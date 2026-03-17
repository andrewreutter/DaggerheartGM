import express from 'express';
import { createServer } from 'node:http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { gunzipSync } from 'zlib';
import { randomInt } from 'crypto';
import { watchFile } from 'fs';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import cron from 'node-cron';
import { runMigrations, getItems, getPublicItems, upsertItem, deleteItem, countItems, getItemsPaginated, countCommunityItems, getCommunityItemsPaginated, getItemsByIds, getItem, recordClone, recordPlay, upsertMirror, findAutoClone, getUnifiedItems, getExternalCacheByIds, getTableStatesByPlayerEmail, appendDiceRoll, ackDiceRoll, getRecentDiceRolls, setBannerStatus, getPendingBanners, getDiceRollById, updateDiceRollData, resolveCharacterElements as resolveCharacterElementsDb, stripCharacterElementsForDb } from './src/db.js';
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
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { CHARACTER_RUNTIME_KEYS, applyTableOp } from './src/client/lib/table-ops.js';
import subscriptionManager from './src/subscriptions.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3456;
const APP_ID = process.env.APP_ID || 'daggerheart-gm-tool';
const COLLECTIONS = ['adversaries', 'environments', 'scenes', 'adventures', 'characters', 'table_state'];

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

// --- Supabase Storage client (optional — only when env vars are set) ---
const supabase = (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
  ? createSupabaseClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

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
    supabaseStorageBase: process.env.SUPABASE_URL
      ? `${process.env.SUPABASE_URL}/storage/v1/object/public`
      : null,
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
  watchFile(join(publicDir, 'app.css'), { interval: 200 }, broadcastReload);
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
// Also handles pure integer constants (e.g. "3", "-2") used for trait modifiers.
function rollDice(expr) {
  const trimmed = (expr || '').trim();
  // Pure integer constant (e.g. trait modifier "3" or "-2")
  const constMatch = /^([+-]?\d+)$/.exec(trimmed);
  if (constMatch) {
    const val = parseInt(constMatch[1], 10);
    return { qty: 0, sides: 0, modifier: val, values: [], result: val, details: `(${val})`, input: expr };
  }
  // Extended regex: NdS[kh|kl][!][mN][+/-M]
  const m = /^(\d*)d(\d+)(kh|kl)?(!)?(?:m(\d+))?([+-]\d+)?$/i.exec(trimmed);
  if (!m) return null;
  const qty      = parseInt(m[1] || '1', 10);
  const sides    = parseInt(m[2], 10);
  const keep     = (m[3] || '').toLowerCase() || null; // 'kh', 'kl', or null
  const exploding = !!m[4];
  const minimum  = m[5] ? parseInt(m[5], 10) : null;
  const modifier = m[6] ? parseInt(m[6], 10) : 0;
  if (sides < 2 || qty < 1 || qty > 100) return null;

  // Roll initial dice
  let values = Array.from({ length: qty }, () => randomInt(1, sides + 1));

  // Apply minimum per die
  if (minimum != null) values = values.map(v => Math.max(v, minimum));

  // Exploding dice: any die = max triggers extra rolls (safety cap: 10 rounds)
  const extraValues = [];
  if (exploding) {
    let toCheck = values.filter(v => v === sides);
    for (let safety = 0; toCheck.length > 0 && safety < 10; safety++) {
      const extras = toCheck.map(() => randomInt(1, sides + 1));
      extraValues.push(...extras);
      toCheck = extras.filter(v => v === sides);
    }
  }

  // Keep highest / lowest: discard all but one
  let keptValues = values;
  let discardedValues = [];
  if (keep === 'kh') {
    const maxVal = Math.max(...values);
    const maxIdx = values.indexOf(maxVal);
    keptValues = [maxVal];
    discardedValues = values.filter((_, i) => i !== maxIdx);
  } else if (keep === 'kl') {
    const minVal = Math.min(...values);
    const minIdx = values.indexOf(minVal);
    keptValues = [minVal];
    discardedValues = values.filter((_, i) => i !== minIdx);
  }

  const allValues = [...values, ...extraValues];
  const keptSum = keptValues.reduce((a, b) => a + b, 0) + extraValues.reduce((a, b) => a + b, 0);
  const result = keptSum + modifier;

  // Build details string.
  // kh/kl: "(discarded1,discarded2->kept)"
  // exploding/normal: "(v1+v2+...)"
  let details;
  if (keep) {
    const discStr = discardedValues.join(',');
    const keptStr = keptValues[0];
    details = `(${discStr ? discStr + '->' : ''}${keptStr})`;
  } else {
    details = allValues.length === 1 ? `(${allValues[0]})` : `(${allValues.join('+')})`;
  }

  return { qty, sides, modifier, keep, exploding, minimum, values: allValues, keptValues, discardedValues, result, details, input: expr };
}

// Parse all [expr] bracket expressions from rollText, roll each, return { subItems, tags }.
// {Name: description} feature tags are extracted first and stripped from the text so they
// don't interfere with [expr] parsing.
function rollFromText(rollText) {
  // Extract {Name: text} feature tags.
  const tags = [];
  const tagRe = /\{([^}:]+):\s*([^}]+)\}/g;
  let tagMatch;
  while ((tagMatch = tagRe.exec(rollText)) !== null) {
    tags.push({ name: tagMatch[1].trim(), text: tagMatch[2].trim() });
  }
  const cleanedText = rollText.replace(/\{[^}]+\}/g, '').trim();

  const subItems = [];
  const re = /\[([^\]]+)\]/g;
  let lastEnd = 0;
  let m;
  while ((m = re.exec(cleanedText)) !== null) {
    const pre = cleanedText.slice(lastEnd, m.index);
    const expr = m[1].trim();
    const rolled = rollDice(expr);
    if (rolled) {
      let result = rolled.result;
      let details = rolled.details;
      // Damage with multiple dice: retain only the highest die in the total (Daggerheart rule).
      if (/damage/i.test(pre) && rolled.values && rolled.values.length > 1 && !rolled.keep) {
        const maxVal = Math.max(...rolled.values);
        result = maxVal + (rolled.modifier || 0);
        const others = rolled.values.filter(v => v !== maxVal);
        details = others.length ? `(${others.join(',')}->${maxVal})` : `(${maxVal})`;
      }
      subItems.push({ pre, input: rolled.input, result: String(result), details, post: '' });
    } else {
      subItems.push({ pre, input: expr, result: expr, details: '', post: '' });
    }
    lastEnd = m.index + m[0].length;
  }
  if (subItems.length > 0 && lastEnd < cleanedText.length) {
    subItems[subItems.length - 1].post = cleanedText.slice(lastEnd);
  }
  return { subItems, tags };
}

// Reroll only the Hope die (Feline Instincts). Keeps other subItems from previousSubItems by index.
function rerollHopeDieOnly(rollText, previousSubItems) {
  const tags = [];
  const tagRe = /\{([^}:]+):\s*([^}]+)\}/g;
  let tagMatch;
  while ((tagMatch = tagRe.exec(rollText)) !== null) {
    tags.push({ name: tagMatch[1].trim(), text: tagMatch[2].trim() });
  }
  const cleanedText = rollText.replace(/\{[^}]+\}/g, '').trim();
  const subItems = [];
  const re = /\[([^\]]+)\]/g;
  let lastEnd = 0;
  let idx = 0;
  let m;
  while ((m = re.exec(cleanedText)) !== null) {
    const pre = cleanedText.slice(lastEnd, m.index);
    const expr = m[1].trim();
    if (/hope/i.test(pre)) {
      const rolled = rollDice(expr);
      if (rolled) {
        subItems.push({ pre, input: rolled.input, result: String(rolled.result), details: rolled.details, post: '' });
      } else {
        subItems.push({ pre, input: expr, result: expr, details: '', post: '' });
      }
    } else if (idx < previousSubItems.length) {
      subItems.push({ ...previousSubItems[idx], post: '' });
    }
    idx++;
    lastEnd = m.index + m[0].length;
  }
  if (subItems.length > 0 && lastEnd < cleanedText.length) {
    subItems[subItems.length - 1].post = cleanedText.slice(lastEnd);
  }
  return { subItems, tags };
}

// Reroll only the Hope and Fear dice (Ranger's Focus: end Focus to reroll Duality). Keeps other subItems from previousSubItems by index.
function rerollDualityOnly(rollText, previousSubItems) {
  const tags = [];
  const tagRe = /\{([^}:]+):\s*([^}]+)\}/g;
  let tagMatch;
  while ((tagMatch = tagRe.exec(rollText)) !== null) {
    tags.push({ name: tagMatch[1].trim(), text: tagMatch[2].trim() });
  }
  const cleanedText = rollText.replace(/\{[^}]+\}/g, '').trim();
  const subItems = [];
  const re = /\[([^\]]+)\]/g;
  let lastEnd = 0;
  let idx = 0;
  let m;
  while ((m = re.exec(cleanedText)) !== null) {
    const pre = cleanedText.slice(lastEnd, m.index);
    const expr = m[1].trim();
    if (/hope/i.test(pre) || /fear/i.test(pre)) {
      const rolled = rollDice(expr);
      if (rolled) {
        subItems.push({ pre, input: rolled.input, result: String(rolled.result), details: rolled.details, post: '' });
      } else {
        subItems.push({ pre, input: expr, result: expr, details: '', post: '' });
      }
    } else if (idx < previousSubItems.length) {
      subItems.push({ ...previousSubItems[idx], post: '' });
    }
    idx++;
    lastEnd = m.index + m[0].length;
  }
  if (subItems.length > 0 && lastEnd < cleanedText.length) {
    subItems[subItems.length - 1].post = cleanedText.slice(lastEnd);
  }
  return { subItems, tags };
}

// Extra dice sub-items (feature dice) that should not count toward the action total.
const EXTRA_PRE_RE = /^\s*(Reload|Invigorate|Lifesteal)\s*$/i;

// Detect Daggerheart Hope/Fear dual-roll from subItems (mirrors client-side parseDaggerheartRoll).
function parseDaggerheartResult(subItems) {
  let hopeResult = null;
  let fearResult = null;
  let hopePre = null;
  let total = 0;
  for (const sub of subItems) {
    if (/damage/i.test(sub.pre || '')) continue;
    if (EXTRA_PRE_RE.test(sub.pre || '')) continue;
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
  const { subItems, tags } = rollFromText(rollText);
  if (!subItems.length) return null;
  const dh = parseDaggerheartResult(subItems);
  let rollData;
  if (dh) {
    rollData = { ...dh, rollUser: dh.characterName || displayName || '', subItems, timestamp: Date.now() };
  } else {
    let total = 0;
    for (const sub of subItems) {
      if (/damage/i.test(sub.pre || '')) continue;
      if (EXTRA_PRE_RE.test(sub.pre || '')) continue;
      const v = parseInt(sub.result, 10);
      if (!isNaN(v)) total += v;
    }
    rollData = { rollUser: displayName || '', total, subItems, timestamp: Date.now() };
  }
  rollData.rollText = rollText;
  if (tags.length) rollData.tags = tags;
  if (_clientId) rollData._clientId = _clientId;
  // Preserve client displayName so weapon attack banners show "CharacterName WeaponName".
  if (displayName) rollData.displayName = displayName;
  return { ...rollData, ...extra };
}

// --- Multi-player room state (in-memory) ---
// gmUid -> { players: Map<uid, { res, name, email, photoURL }>, gmClients: Set<res> }
const rooms = new Map();


/** Extract and verify a Firebase JWT from the ?token= query parameter. */
async function verifyTokenFromQuery(req, res) {
  const { token } = req.query;
  if (!token) { res.status(401).json({ error: 'Missing token' }); return null; }
  if (process.env.NODE_ENV === 'test' && token === 'test-token') {
    return { uid: 'test-user-uid', email: 'test@example.com', name: 'Test User', picture: '' };
  }
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

async function appendRollLog(gmUid, rollData) {
  const room = getOrCreateRoom(gmUid);
  room.rollLog.push(rollData);
  if (room.rollLog.length > ROLL_LOG_SIZE) room.rollLog.shift();
  try {
    const dbId = await appendDiceRoll(APP_ID, gmUid, rollData);
    // Mutate in place so the caller's reference (and the rollLog entry) carries the DB id
    rollData._rollDbId = dbId;
    // Notify subscription manager so all clients get an updated banners snapshot
    subscriptionManager.notifyChange('banners', gmUid);
  } catch (err) {
    console.error('[dice] DB write failed:', err.message);
  }
}

function broadcastPresenceToGm(gmUid) {
  const room = rooms.get(gmUid);
  if (!room) return;
  const presence = [...room.players.entries()].map(([uid, p]) => ({ uid, name: p.name, email: p.email, photoURL: p.photoURL }));
  const msg = `event: presence\ndata: ${JSON.stringify({ players: presence })}\n\n`;
  for (const clientRes of room.gmClients) { clientRes.write(msg); clientRes.flush?.(); }
}


// Fields persisted for character elements in table_state.
// All other fields are resolved from the character library at read time.
const CHARACTER_PERSIST_KEYS = new Set([...CHARACTER_RUNTIME_KEYS, 'id', 'name']);

/**
 * Resolve character elements in table state against the live character library.
 * Thin wrapper around db.js version so existing server.js call sites work unchanged.
 */
async function resolveCharacterElements(elements) {
  return resolveCharacterElementsDb(APP_ID, elements);
}

/**
 * Strip character elements down to only the persisted keys before writing to the DB.
 * Thin wrapper around db.js version.
 */
function stripCharacterElements(elements) {
  return stripCharacterElementsForDb(elements);
}

/**
 * Per-room serialization lock for table-state writes.
 * Maps gmUid → Promise (the tail of the current op queue for that room).
 * Each call to applyOpToTableState chains onto the previous promise so concurrent
 * ops are processed sequentially, preventing read-modify-write races.
 */
const roomOpLocks = new Map();

/**
 * Apply a table op to the current DB state for a GM's room, write back, and notify subscribers.
 * Returns the new state object (or null if no DB available).
 * Ops for the same room are serialized to prevent concurrent write races.
 */
async function applyOpToTableState(gmUid, op) {
  const prev = roomOpLocks.get(gmUid) ?? Promise.resolve();
  const next = prev.then(async () => {
    const rows = await getItems(APP_ID, gmUid, 'table_state');
    const rawState = rows[0] ? (() => { const { id: _id, is_public: _ip, _source: _src, ...data } = rows[0]; return data; })() : {};
    // applyTableOp uses 'activeElements' key; DB uses 'elements'
    const stateForOp = { ...rawState, activeElements: rawState.elements || [] };
    const changes = applyTableOp(op, stateForOp);
    const { activeElements: newElements, ...otherChanges } = changes;
    const newState = {
      ...rawState,
      ...otherChanges,
      ...(newElements !== undefined ? { elements: stripCharacterElements(newElements) } : {}),
    };
    await upsertItem(APP_ID, gmUid, 'table_state', 'current', newState, false);
    subscriptionManager.notifyChange('table_state', gmUid);
    return newState;
  });
  // Store the settled promise (errors swallowed) so the chain never breaks on failure
  roomOpLocks.set(gmUid, next.catch(() => {}));
  return next;
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

const PAGINATED_COLLECTIONS = ['adversaries', 'environments', 'scenes', 'adventures', 'characters'];
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
      const resolved = await Promise.all(rows.map(async r => {
        const elements = await resolveCharacterElements(r.elements);
        return { ...r, elements, _source: 'own' };
      }));
      return res.json({ items: resolved, totalCount: resolved.length, dbCount: resolved.length });
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

// --- Map image upload (Supabase Storage) ---

const MIME_TO_EXT = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif',
  'image/webp': 'webp', 'image/svg+xml': 'svg', 'image/avif': 'avif',
  'image/apng': 'apng',
};

const mapImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    cb(null, !!MIME_TO_EXT[file.mimetype]);
  },
});

app.post('/api/room/my/map-image', requireAuth, mapImageUpload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  const gmUid = req.uid;
  if (!supabase) {
    // Fallback: return the raw buffer as a data URL so clients without Supabase still work
    const b64 = req.file.buffer.toString('base64');
    const dataUrl = `data:${req.file.mimetype};base64,${b64}`;
    return res.json({ url: dataUrl });
  }
  const ext = MIME_TO_EXT[req.file.mimetype] || 'bin';
  const storagePath = `map-images/${gmUid}/${crypto.randomUUID()}.${ext}`;
  try {
    const { error } = await supabase.storage
      .from('whiteboard-assets')
      .upload(storagePath, req.file.buffer, { contentType: req.file.mimetype, upsert: false });
    if (error) throw error;
    const { data } = supabase.storage.from('whiteboard-assets').getPublicUrl(storagePath);
    res.json({ url: data.publicUrl });
  } catch (err) {
    console.error('POST /api/room/my/map-image error:', err);
    res.status(500).json({ error: err.message || 'Upload failed' });
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
  const { id: _id, is_public, _source, _owner, _clientId, ...incoming } = item;
  try {
    let dataToSave = incoming;
    if (id) {
      const current = await getItem(APP_ID, req.uid, collection, id);
      if (current) {
        const { id: _cid, is_public: _cp, _source: _cs, _owner: _co, ...currentData } = current;
        dataToSave = deepMergePreservingImages(currentData, incoming);
      }
    }
    // Strip character elements to only persisted keys before writing to DB
    if (collection === 'table_state' && Array.isArray(dataToSave.elements)) {
      dataToSave = { ...dataToSave, elements: stripCharacterElements(dataToSave.elements) };
    }
    await upsertItem(APP_ID, req.uid, collection, id, dataToSave, Boolean(is_public));
    const saved = { id, ...dataToSave, is_public: Boolean(is_public), _source: 'own' };
    res.json(saved);

    // When a character is saved, notify the table_state subscription for any active room
    // where the saving user is the GM or a connected player. The subscription re-queries
    // getResolvedTableState which calls resolveCharacterElements, so all clients receive
    // fresh character data without a separate op type.
    if (collection === 'characters' && saved.id) {
      for (const [gmUid, room] of rooms) {
        if (gmUid === req.uid || room.players.has(req.uid)) {
          subscriptionManager.notifyChange('table_state', gmUid);
        }
      }
    }

    // Notify table_state subscribers when the table_state record itself is saved.
    if (collection === 'table_state') {
      subscriptionManager.notifyChange('table_state', req.uid);
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

// GET /api/room/my/players — GM SSE: receive player presence, table state, banners, and dice rolls
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

  // Send recent roll history (all statuses) for the Action Log strip.
  try {
    const rolls = await getRecentDiceRolls(APP_ID, user.uid);
    if (rolls.length > 0) {
      res.write(`event: roll-history\ndata: ${JSON.stringify({ rolls })}\n\n`);
    }
  } catch (err) {
    console.error('[dice] roll-history fetch failed:', err.message);
    if (room.rollLog.length > 0) {
      res.write(`event: roll-history\ndata: ${JSON.stringify({ rolls: room.rollLog })}\n\n`);
    }
  }
  res.flush?.();

  // Subscribe to channels — each sends initial snapshot immediately and on every change.
  subscriptionManager.subscribe('banners', user.uid, res);
  subscriptionManager.subscribe('table_state', user.uid, res);

  const heartbeat = setInterval(() => { res.write(':heartbeat\n\n'); res.flush?.(); }, 30000);
  req.on('close', () => {
    clearInterval(heartbeat);
    room.gmClients.delete(res);
    subscriptionManager.unsubscribe('banners', user.uid, res);
    subscriptionManager.unsubscribe('table_state', user.uid, res);
  });
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

    // Track player in room
    const room = getOrCreateRoom(gmUid);
    room.players.set(user.uid, { res, name: user.name, email: user.email, photoURL: user.picture });

    // Send current presence to this player
    const presence = [...room.players.entries()].map(([uid, p]) => ({ uid, name: p.name, email: p.email, photoURL: p.photoURL }));
    res.write(`event: presence\ndata: ${JSON.stringify({ players: presence })}\n\n`);

    // Send recent roll history (all statuses) for the Action Log strip.
    try {
      const rolls = await getRecentDiceRolls(APP_ID, gmUid);
      if (rolls.length > 0) {
        res.write(`event: roll-history\ndata: ${JSON.stringify({ rolls })}\n\n`);
      }
    } catch (err) {
      console.error('[dice] roll-history fetch failed:', err.message);
      if (room.rollLog.length > 0) {
        res.write(`event: roll-history\ndata: ${JSON.stringify({ rolls: room.rollLog })}\n\n`);
      }
    }
    res.flush?.();

    // Subscribe to channels — table_state sends the initial resolved snapshot immediately.
    subscriptionManager.subscribe('banners', gmUid, res);
    subscriptionManager.subscribe('table_state', gmUid, res);

    // Notify GM of new player
    broadcastPresenceToGm(gmUid);

    const heartbeat = setInterval(() => { res.write(':heartbeat\n\n'); res.flush?.(); }, 30000);
    req.on('close', () => {
      clearInterval(heartbeat);
      room.players.delete(user.uid);
      subscriptionManager.unsubscribe('banners', gmUid, res);
      subscriptionManager.unsubscribe('table_state', gmUid, res);
      broadcastPresenceToGm(gmUid);
    });
  } catch (err) {
    console.error(`GET /api/room/${gmUid}/stream error:`, err);
    if (!res.headersSent) res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/room/my/roll — GM rolls dice server-side; persists to DB, returns result.
app.post('/api/room/my/roll', requireAuth, async (req, res) => {
  const { rollText, displayName, _clientId, ...extraMeta } = req.body;
  if (!rollText) return res.status(400).json({ error: 'rollText is required' });
  const rollData = buildRollData(rollText, displayName, _clientId, extraMeta);
  if (!rollData) return res.status(400).json({ error: 'No dice expressions found in rollText' });
  await appendRollLog(req.uid, rollData);
  res.json(rollData);
});

// POST /api/room/my/action — GM persists an action notification; clients learn of it via the banners subscription.
// (no dice rolling; used for feature announcements, session cycle notifications, etc.)
app.post('/api/room/my/action', requireAuth, async (req, res) => {
  const { _clientId, ...notification } = req.body;
  if (!notification._action) notification._action = true;
  const payload = { ...notification, _clientId: _clientId || null };
  await appendRollLog(req.uid, payload);
  res.json({ ok: true, _rollDbId: payload._rollDbId ?? null });
});

// POST /api/room/:gmUid/action — Player broadcasts an action notification to the GM room
app.post('/api/room/:gmUid/action', requireAuth, async (req, res) => {
  const { gmUid } = req.params;
  const { _clientId, ...notification } = req.body;
  try {
    const tableStateItems = await getItems(APP_ID, gmUid, 'table_state');
    const tableState = tableStateItems[0] || {};
    if (!(tableState.playerEmails || []).includes(req.email)) {
      return res.status(403).json({ error: 'Not a player in this room' });
    }
    if (!notification._action) notification._action = true;
    const payload = { ...notification, _clientId: _clientId || null, _initiatorUid: req.uid };
    await appendRollLog(gmUid, payload);
    res.json({ ok: true, _rollDbId: payload._rollDbId ?? null });
  } catch (err) {
    console.error(`POST /api/room/${gmUid}/action error:`, err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/room/my/banner-ack — GM acknowledges or cancels a banner.
// Updates DB status; the subscription manager pushes an updated banners snapshot to all clients.
// When action is 'acknowledge' and wingsOfLightD8 is true, server deducts 1 Hope from the roll's
// _attackerInstanceId, rolls 1d8, and returns wingsOfLightD8Result (banner is also marked acknowledged).
app.post('/api/room/my/banner-ack', requireAuth, async (req, res) => {
  const { bannerId, action, wingsOfLightD8 } = req.body;
  let wingsOfLightD8Result = null;

  if (action === 'acknowledge' && wingsOfLightD8 && bannerId && process.env.DATABASE_URL) {
    try {
      const row = await getDiceRollById(APP_ID, req.uid, bannerId);
      if (row && row.status === 'pending' && row.data?._wingsOfLightAddD8 && row.data._wingsOfLightD8Result == null && row.data._attackerInstanceId) {
        const tableRows = await getItems(APP_ID, req.uid, 'table_state');
        const state = tableRows[0] || {};
        const elements = state.elements || [];
        const charEl = elements.find(e => e.elementType === 'character' && e.instanceId === row.data._attackerInstanceId);
        const maxHope = charEl?.maxHope ?? 6;
        const currentHope = charEl?.hope ?? maxHope;
        if (currentHope >= 1) {
          const newHope = Math.max(0, currentHope - 1);
          await applyOpToTableState(req.uid, { op: 'update-element', instanceId: row.data._attackerInstanceId, updates: { hope: newHope } });
          wingsOfLightD8Result = randomInt(1, 9);
        }
      }
    } catch (err) {
      console.error('[banner-ack] wingsOfLightD8 error:', err.message);
    }
  }

  if (bannerId) {
    const status = action === 'cancel' ? 'cancelled' : 'acknowledged';
    setBannerStatus(bannerId, status)
      .then(() => subscriptionManager.notifyChange('banners', req.uid))
      .catch(err => console.error('[banner] DB status update failed:', err.message));
  }

  const payload = { ok: true };
  if (wingsOfLightD8Result != null) payload.wingsOfLightD8Result = wingsOfLightD8Result;
  res.json(payload);
});

// POST /api/room/my/reroll-hope-die — GM: Feline Instincts — reroll only the Hope die; cost already applied by client.
app.post('/api/room/my/reroll-hope-die', requireAuth, async (req, res) => {
  const { rollText, displayName, previousSubItems, ...extraMeta } = req.body;
  if (!rollText || !previousSubItems || !Array.isArray(previousSubItems)) {
    return res.status(400).json({ error: 'rollText and previousSubItems required' });
  }
  const { subItems, tags } = rerollHopeDieOnly(rollText, previousSubItems);
  if (!subItems.length) return res.status(400).json({ error: 'No dice expressions found' });
  const dh = parseDaggerheartResult(subItems);
  let rollData;
  if (dh) {
    rollData = { ...dh, rollUser: dh.characterName || displayName || '', subItems, timestamp: Date.now() };
  } else {
    let total = 0;
    for (const sub of subItems) {
      if (/damage/i.test(sub.pre || '')) continue;
      if (EXTRA_PRE_RE.test(sub.pre || '')) continue;
      const v = parseInt(sub.result, 10);
      if (!isNaN(v)) total += v;
    }
    rollData = { rollUser: displayName || '', total, subItems, timestamp: Date.now() };
  }
  rollData.rollText = rollText;
  if (tags.length) rollData.tags = tags;
  Object.assign(rollData, extraMeta);
  const dbId = await appendDiceRoll(APP_ID, req.uid, rollData);
  rollData._rollDbId = dbId;
  subscriptionManager.notifyChange('banners', req.uid);
  res.json(rollData);
});

// POST /api/room/my/reroll-duality-dice — GM: Ranger's Focus — reroll Hope and Fear dice only; Focus cleared by client before calling.
app.post('/api/room/my/reroll-duality-dice', requireAuth, async (req, res) => {
  const { rollText, displayName, previousSubItems, ...extraMeta } = req.body;
  if (!rollText || !previousSubItems || !Array.isArray(previousSubItems)) {
    return res.status(400).json({ error: 'rollText and previousSubItems required' });
  }
  const { subItems, tags } = rerollDualityOnly(rollText, previousSubItems);
  if (!subItems.length) return res.status(400).json({ error: 'No dice expressions found' });
  const dh = parseDaggerheartResult(subItems);
  let rollData;
  if (dh) {
    rollData = { ...dh, rollUser: dh.characterName || displayName || '', subItems, timestamp: Date.now() };
  } else {
    let total = 0;
    for (const sub of subItems) {
      if (/damage/i.test(sub.pre || '')) continue;
      if (EXTRA_PRE_RE.test(sub.pre || '')) continue;
      const v = parseInt(sub.result, 10);
      if (!isNaN(v)) total += v;
    }
    rollData = { rollUser: displayName || '', total, subItems, timestamp: Date.now() };
  }
  rollData.rollText = rollText;
  if (tags.length) rollData.tags = tags;
  Object.assign(rollData, extraMeta);
  const dbId = await appendDiceRoll(APP_ID, req.uid, rollData);
  rollData._rollDbId = dbId;
  subscriptionManager.notifyChange('banners', req.uid);
  res.json(rollData);
});

// POST /api/room/:gmUid/banner-feline-reroll-request — Player: toggle _felineRerollRequestedBy on banner (set to uid or clear if already self).
app.post('/api/room/:gmUid/banner-feline-reroll-request', requireAuth, async (req, res) => {
  const { gmUid } = req.params;
  const bannerId = req.body?.bannerId != null ? Number(req.body.bannerId) : null;
  if (req.uid === gmUid || bannerId == null || Number.isNaN(bannerId)) {
    return res.status(400).json({ error: 'Invalid request' });
  }
  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ error: 'Requires database' });
  }
  try {
    const tableStateItems = await getItems(APP_ID, gmUid, 'table_state');
    const tableState = tableStateItems[0] || {};
    if (!(tableState.playerEmails || []).includes(req.email)) {
      return res.status(403).json({ error: 'Not a player in this room' });
    }
    const row = await getDiceRollById(APP_ID, gmUid, bannerId);
    if (!row || row.status !== 'pending') {
      return res.status(404).json({ error: 'Banner not found or already resolved' });
    }
    const dataPatch = row.data._felineRerollRequestedBy === req.uid
      ? { _felineRerollRequestedBy: null }
      : { _felineRerollRequestedBy: req.uid };
    const requested = dataPatch._felineRerollRequestedBy != null;
    await updateDiceRollData(APP_ID, gmUid, bannerId, dataPatch);
    subscriptionManager.notifyChange('banners', gmUid);
    res.json({ ok: true, requested });
  } catch (err) {
    console.error(`POST /api/room/${gmUid}/banner-feline-reroll-request error:`, err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/room/:gmUid/banner-ranger-focus-reroll-request — Player: toggle _rangerFocusRerollRequestedBy on banner.
app.post('/api/room/:gmUid/banner-ranger-focus-reroll-request', requireAuth, async (req, res) => {
  const { gmUid } = req.params;
  const bannerId = req.body?.bannerId != null ? Number(req.body.bannerId) : null;
  if (req.uid === gmUid || bannerId == null || Number.isNaN(bannerId)) {
    return res.status(400).json({ error: 'Invalid request' });
  }
  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ error: 'Requires database' });
  }
  try {
    const tableStateItems = await getItems(APP_ID, gmUid, 'table_state');
    const tableState = tableStateItems[0] || {};
    if (!(tableState.playerEmails || []).includes(req.email)) {
      return res.status(403).json({ error: 'Not a player in this room' });
    }
    const row = await getDiceRollById(APP_ID, gmUid, bannerId);
    if (!row || row.status !== 'pending') {
      return res.status(404).json({ error: 'Banner not found or already resolved' });
    }
    const dataPatch = row.data._rangerFocusRerollRequestedBy === req.uid
      ? { _rangerFocusRerollRequestedBy: null }
      : { _rangerFocusRerollRequestedBy: req.uid };
    const requested = dataPatch._rangerFocusRerollRequestedBy != null;
    await updateDiceRollData(APP_ID, gmUid, bannerId, dataPatch);
    subscriptionManager.notifyChange('banners', gmUid);
    res.json({ ok: true, requested });
  } catch (err) {
    console.error(`POST /api/room/${gmUid}/banner-ranger-focus-reroll-request error:`, err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/room/my/banner-wings-d8 — GM: Wings of Light — spend 1 Hope and roll 1d8, patch banner with _wingsOfLightAddD8 and _wingsOfLightD8Result.
app.post('/api/room/my/banner-wings-d8', requireAuth, async (req, res) => {
  const bannerId = req.body?.bannerId != null ? Number(req.body.bannerId) : null;
  if (bannerId == null || Number.isNaN(bannerId) || !process.env.DATABASE_URL) {
    return res.status(400).json({ error: 'bannerId required' });
  }
  try {
    const row = await getDiceRollById(APP_ID, req.uid, bannerId);
    if (!row || row.status !== 'pending' || !row.data?._attackerInstanceId) {
      return res.status(404).json({ error: 'Banner not found or not a character attack' });
    }
    const tableRows = await getItems(APP_ID, req.uid, 'table_state');
    const state = tableRows[0] || {};
    const elements = state.elements || [];
    const charEl = elements.find(e => e.elementType === 'character' && e.instanceId === row.data._attackerInstanceId);
    const maxHope = charEl?.maxHope ?? 6;
    const currentHope = charEl?.hope ?? maxHope;
    if (currentHope < 1) {
      return res.status(400).json({ error: 'Character has no Hope to spend' });
    }
    const newHope = Math.max(0, currentHope - 1);
    await applyOpToTableState(req.uid, { op: 'update-element', instanceId: row.data._attackerInstanceId, updates: { hope: newHope } });
    const d8Result = randomInt(1, 9);
    await updateDiceRollData(APP_ID, req.uid, bannerId, { _wingsOfLightAddD8: true, _wingsOfLightD8Result: d8Result });
    subscriptionManager.notifyChange('banners', req.uid);
    res.json({ ok: true, d8Result });
  } catch (err) {
    console.error('POST /api/room/my/banner-wings-d8 error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/room/:gmUid/banner-wings-d8-toggle — Player: toggle _wingsOfLightAddD8 on a banner (shared state; no Hope spend or roll).
app.post('/api/room/:gmUid/banner-wings-d8-toggle', requireAuth, async (req, res) => {
  const { gmUid } = req.params;
  const bannerId = req.body?.bannerId != null ? Number(req.body.bannerId) : null;
  const value = req.body?.value === true;
  if (req.uid === gmUid || bannerId == null || Number.isNaN(bannerId)) {
    return res.status(400).json({ error: 'Invalid request' });
  }
  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ error: 'Requires database' });
  }
  try {
    const tableStateItems = await getItems(APP_ID, gmUid, 'table_state');
    const tableState = tableStateItems[0] || {};
    if (!(tableState.playerEmails || []).includes(req.email)) {
      return res.status(403).json({ error: 'Not a player in this room' });
    }
    const row = await getDiceRollById(APP_ID, gmUid, bannerId);
    if (!row || row.status !== 'pending') {
      return res.status(404).json({ error: 'Banner not found or already resolved' });
    }
    await updateDiceRollData(APP_ID, gmUid, bannerId, { _wingsOfLightAddD8: value });
    subscriptionManager.notifyChange('banners', gmUid);
    res.json({ ok: true, value });
  } catch (err) {
    console.error(`POST /api/room/${gmUid}/banner-wings-d8-toggle error:`, err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/room/:gmUid/banner-hold-them-off — GM or player: toggle Hold Them Off (3 Hope, select up to 3 targets) on a banner.
app.post('/api/room/:gmUid/banner-hold-them-off', requireAuth, async (req, res) => {
  const { gmUid } = req.params;
  const bannerId = req.body?.bannerId != null ? Number(req.body.bannerId) : null;
  const active = req.body?.active === true;
  if (bannerId == null || Number.isNaN(bannerId)) {
    return res.status(400).json({ error: 'bannerId required' });
  }
  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ error: 'Requires database' });
  }
  try {
    const isGm = req.uid === gmUid;
    if (!isGm) {
      const tableStateItems = await getItems(APP_ID, gmUid, 'table_state');
      const tableState = tableStateItems[0] || {};
      if (!(tableState.playerEmails || []).includes(req.email)) {
        return res.status(403).json({ error: 'Not a player in this room' });
      }
    }
    const row = await getDiceRollById(APP_ID, gmUid, bannerId);
    if (!row || row.status !== 'pending') {
      return res.status(404).json({ error: 'Banner not found or already resolved' });
    }
    await updateDiceRollData(APP_ID, gmUid, bannerId, { _holdThemOffActive: active });
    subscriptionManager.notifyChange('banners', gmUid);
    res.json({ ok: true, active });
  } catch (err) {
    console.error(`POST /api/room/${gmUid}/banner-hold-them-off error:`, err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/room/:gmUid/banner-make-a-scene-target — GM or player: set the target adversary for a Make a Scene banner.
// Patches _selectedTargetInstanceId on the pending roll; pushes updated banners snapshot to all clients.
app.post('/api/room/:gmUid/banner-make-a-scene-target', requireAuth, async (req, res) => {
  const { gmUid } = req.params;
  const bannerId = req.body?.bannerId != null ? Number(req.body.bannerId) : null;
  const instanceId = req.body?.instanceId ?? null;
  if (bannerId == null || Number.isNaN(bannerId)) {
    return res.status(400).json({ error: 'bannerId required' });
  }
  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ error: 'Requires database' });
  }
  try {
    const isGm = req.uid === gmUid;
    if (!isGm) {
      const tableStateItems = await getItems(APP_ID, gmUid, 'table_state');
      const tableState = tableStateItems[0] || {};
      if (!(tableState.playerEmails || []).includes(req.email)) {
        return res.status(403).json({ error: 'Not a player in this room' });
      }
    }
    const row = await getDiceRollById(APP_ID, gmUid, bannerId);
    if (!row || row.status !== 'pending') {
      return res.status(404).json({ error: 'Banner not found or already resolved' });
    }
    await updateDiceRollData(APP_ID, gmUid, bannerId, { _selectedTargetInstanceId: instanceId });
    subscriptionManager.notifyChange('banners', gmUid);
    res.json({ ok: true, instanceId });
  } catch (err) {
    console.error(`POST /api/room/${gmUid}/banner-make-a-scene-target error:`, err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/room/:gmUid/banner-prayer-die-select — GM or player: select a Prayer Die for add-to-roll or damage-reduction.
// Patches _prayerAddRollDie and/or _prayerDmgReduceDie on the pending roll; pushes updated banner to all clients.
app.post('/api/room/:gmUid/banner-prayer-die-select', requireAuth, async (req, res) => {
  const { gmUid } = req.params;
  const bannerId = req.body?.bannerId != null ? Number(req.body.bannerId) : null;
  const { addRollDie, dmgReduceDie } = req.body || {};
  if (bannerId == null || Number.isNaN(bannerId)) {
    return res.status(400).json({ error: 'bannerId required' });
  }
  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ error: 'Requires database' });
  }
  try {
    const isGm = req.uid === gmUid;
    if (!isGm) {
      const tableStateItems = await getItems(APP_ID, gmUid, 'table_state');
      const tableState = tableStateItems[0] || {};
      if (!(tableState.playerEmails || []).includes(req.email)) {
        return res.status(403).json({ error: 'Not a player in this room' });
      }
    }
    const row = await getDiceRollById(APP_ID, gmUid, bannerId);
    if (!row || row.status !== 'pending') {
      return res.status(404).json({ error: 'Banner not found or already resolved' });
    }
    const patch = {};
    if ('addRollDie' in req.body) patch._prayerAddRollDie = addRollDie ?? null;
    if ('dmgReduceDie' in req.body) patch._prayerDmgReduceDie = dmgReduceDie ?? null;
    await updateDiceRollData(APP_ID, gmUid, bannerId, patch);
    subscriptionManager.notifyChange('banners', gmUid);
    res.json({ ok: true });
  } catch (err) {
    console.error(`POST /api/room/${gmUid}/banner-prayer-die-select error:`, err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/room/:gmUid/banner-rally-toggle — GM or player: toggle Rally Die add-to-roll or add-to-damage on a banner.
// Patches _rallyDieAddToRoll or _rallyDieAddToDamage on the pending roll; pushes updated banners to all clients.
app.post('/api/room/:gmUid/banner-rally-toggle', requireAuth, async (req, res) => {
  const { gmUid } = req.params;
  const bannerId = req.body?.bannerId != null ? Number(req.body.bannerId) : null;
  const field = req.body?.field;
  const value = req.body?.value === true;
  if (bannerId == null || Number.isNaN(bannerId)) {
    return res.status(400).json({ error: 'bannerId required' });
  }
  if (field !== '_rallyDieAddToRoll' && field !== '_rallyDieAddToDamage') {
    return res.status(400).json({ error: 'field must be _rallyDieAddToRoll or _rallyDieAddToDamage' });
  }
  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ error: 'Requires database' });
  }
  try {
    const isGm = req.uid === gmUid;
    if (!isGm) {
      const tableStateItems = await getItems(APP_ID, gmUid, 'table_state');
      const tableState = tableStateItems[0] || {};
      if (!(tableState.playerEmails || []).includes(req.email)) {
        return res.status(403).json({ error: 'Not a player in this room' });
      }
    }
    const row = await getDiceRollById(APP_ID, gmUid, bannerId);
    if (!row || row.status !== 'pending') {
      return res.status(404).json({ error: 'Banner not found or already resolved' });
    }
    // Mutual exclusivity: enabling one toggle clears the other.
    const oppositeField = field === '_rallyDieAddToRoll' ? '_rallyDieAddToDamage' : '_rallyDieAddToRoll';
    const patch = value ? { [field]: true, [oppositeField]: false } : { [field]: false };
    await updateDiceRollData(APP_ID, gmUid, bannerId, patch);
    subscriptionManager.notifyChange('banners', gmUid);
    res.json({ ok: true, field, value });
  } catch (err) {
    console.error(`POST /api/room/${gmUid}/banner-rally-toggle error:`, err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/room/my/banner-rally-ack — GM: acknowledge a Rally Die banner toggle.
// Cancels the original banner, removes the Rally Die modifier from the attacker, rolls the die,
// and creates a copy banner with the extra die added to roll and/or damage.
app.post('/api/room/my/banner-rally-ack', requireAuth, async (req, res) => {
  const gmUid = req.uid;
  const bannerId = req.body?.bannerId != null ? Number(req.body.bannerId) : null;
  const addToRoll = req.body?.addToRoll === true;
  const addToDamage = req.body?.addToDamage === true;
  if (bannerId == null || Number.isNaN(bannerId)) {
    return res.status(400).json({ error: 'bannerId required' });
  }
  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ error: 'Requires database' });
  }
  try {
    const row = await getDiceRollById(APP_ID, gmUid, bannerId);
    if (!row || row.status !== 'pending') {
      return res.status(404).json({ error: 'Banner not found or already resolved' });
    }
    const originalData = row.data || {};

    // 1. Cancel the original banner.
    await setBannerStatus(bannerId, 'cancelled');

    // 2. Find the Rally Die modifier on the attacker and remove it.
    const attackerInstanceId = originalData._attackerInstanceId;
    let rallyDieSize = 'd6';
    if (attackerInstanceId) {
      const tableStateItems = await getItems(APP_ID, gmUid, 'table_state');
      const tableState = tableStateItems[0] || {};
      const elements = tableState.elements || tableState.activeElements || [];
      const attacker = elements.find(e => e.instanceId === attackerInstanceId);
      if (attacker?.activeModifiers?.length > 0) {
        const rallyMod = attacker.activeModifiers.find(m => m.name === 'Rally Die');
        if (rallyMod) {
          rallyDieSize = rallyMod.dice || 'd6';
          const newMods = attacker.activeModifiers.filter(m => m.id !== rallyMod.id);
          await applyOpToTableState(gmUid, {
            op: 'update-element',
            instanceId: attackerInstanceId,
            updates: { activeModifiers: newMods },
          });
        }
      }
    }

    // 3. Roll the Rally Die.
    const sides = parseInt((rallyDieSize || 'd6').replace('d', ''), 10) || 6;
    const rallyRoll = randomInt(1, sides + 1);

    // 4. Build the copy banner's subItems.
    const origSubItems = Array.isArray(originalData.subItems) ? originalData.subItems : [];
    let newSubItems = [...origSubItems];

    if (addToRoll) {
      // Insert Rally sub-item after the Fear sub-item (before damage/extras).
      const fearIdx = newSubItems.findIndex(s => /fear/i.test(s.pre || ''));
      const insertIdx = fearIdx >= 0 ? fearIdx + 1 : newSubItems.findIndex(s => /damage/i.test(s.pre || ''));
      const rallySubItem = {
        pre: 'Rally',
        input: rallyDieSize,
        result: String(rallyRoll),
        details: `(${rallyRoll})`,
        post: '',
      };
      if (insertIdx >= 0) {
        newSubItems = [...newSubItems.slice(0, insertIdx), rallySubItem, ...newSubItems.slice(insertIdx)];
      } else {
        newSubItems = [...newSubItems, rallySubItem];
      }
    }

    // 5. Recompute roll totals from the new subItems.
    const dh = parseDaggerheartResult(newSubItems);
    let copyData;
    if (dh) {
      copyData = { ...dh, rollUser: dh.characterName || originalData.rollUser || '', subItems: newSubItems, timestamp: Date.now() };
    } else {
      let total = 0;
      for (const sub of newSubItems) {
        if (/damage/i.test(sub.pre || '')) continue;
        if (EXTRA_PRE_RE.test(sub.pre || '')) continue;
        const v = parseInt(sub.result, 10);
        if (!isNaN(v)) total += v;
      }
      copyData = { rollUser: originalData.rollUser || '', total, subItems: newSubItems, timestamp: Date.now() };
    }

    // 6. Preserve all original metadata (_-prefixed keys), clear rally toggle fields, mark as applied.
    for (const k of Object.keys(originalData)) {
      if (k.startsWith('_') && !(k in copyData)) copyData[k] = originalData[k];
    }
    copyData._rallyDieApplied = true;
    delete copyData._rallyDieAddToRoll;
    delete copyData._rallyDieAddToDamage;
    if (originalData.rollText) copyData.rollText = originalData.rollText;
    if (originalData.displayName) copyData.displayName = originalData.displayName;
    if (originalData.tags) copyData.tags = originalData.tags;

    // 7. For damage: set _rallyDieDamageResult so the banner annotates damage.
    if (addToDamage) copyData._rallyDieDamageResult = rallyRoll;

    // 8. Append the copy banner and notify.
    const dbId = await appendDiceRoll(APP_ID, gmUid, copyData);
    copyData._rollDbId = dbId;
    subscriptionManager.notifyChange('banners', gmUid);

    res.json({ ok: true });
  } catch (err) {
    console.error('POST /api/room/my/banner-rally-ack error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/room/my/banner-heart-d4 — GM: Heart of a Poet (Wordsmith) — spend 1 Hope and roll 1d4 on a non-attack action roll banner.
app.post('/api/room/my/banner-heart-d4', requireAuth, async (req, res) => {
  const bannerId = req.body?.bannerId != null ? Number(req.body.bannerId) : null;
  if (bannerId == null || Number.isNaN(bannerId) || !process.env.DATABASE_URL) {
    return res.status(400).json({ error: 'bannerId required' });
  }
  try {
    const row = await getDiceRollById(APP_ID, req.uid, bannerId);
    if (!row || row.status !== 'pending' || !row.data?._attackerInstanceId) {
      return res.status(404).json({ error: 'Banner not found or not a character action roll' });
    }
    const tableRows = await getItems(APP_ID, req.uid, 'table_state');
    const state = tableRows[0] || {};
    const elements = state.elements || [];
    const charEl = elements.find(e => e.elementType === 'character' && e.instanceId === row.data._attackerInstanceId);
    const maxHope = charEl?.maxHope ?? 6;
    const currentHope = charEl?.hope ?? maxHope;
    if (currentHope < 1) {
      return res.status(400).json({ error: 'Character has no Hope to spend' });
    }
    const newHope = Math.max(0, currentHope - 1);
    await applyOpToTableState(req.uid, { op: 'update-element', instanceId: row.data._attackerInstanceId, updates: { hope: newHope } });
    const d4Result = randomInt(1, 5);
    await updateDiceRollData(APP_ID, req.uid, bannerId, { _heartOfAPoetAddD4: true, _heartOfAPoetD4Result: d4Result });
    subscriptionManager.notifyChange('banners', req.uid);
    res.json({ ok: true, d4Result });
  } catch (err) {
    console.error('POST /api/room/my/banner-heart-d4 error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/room/my/banner-heart-d4-ack — GM: acknowledge a Heart of a Poet banner toggle.
// Cancels the original banner, decrements 1 Hope, rolls 1d4, creates copy banner with d4 added.
app.post('/api/room/my/banner-heart-d4-ack', requireAuth, async (req, res) => {
  const gmUid = req.uid;
  const bannerId = req.body?.bannerId != null ? Number(req.body.bannerId) : null;
  if (bannerId == null || Number.isNaN(bannerId)) {
    return res.status(400).json({ error: 'bannerId required' });
  }
  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ error: 'Requires database' });
  }
  try {
    const row = await getDiceRollById(APP_ID, gmUid, bannerId);
    if (!row || row.status !== 'pending') {
      return res.status(404).json({ error: 'Banner not found or already resolved' });
    }
    const originalData = row.data || {};

    // 1. Cancel the original banner.
    await setBannerStatus(bannerId, 'cancelled');

    // 2. Decrement 1 Hope from the attacker.
    const attackerInstanceId = originalData._attackerInstanceId;
    if (attackerInstanceId) {
      const tableStateItems = await getItems(APP_ID, gmUid, 'table_state');
      const state = tableStateItems[0] || {};
      const elements = state.elements || state.activeElements || [];
      const charEl = elements.find(e => e.elementType === 'character' && e.instanceId === attackerInstanceId);
      const currentHope = charEl?.hope ?? (charEl?.maxHope ?? 6);
      if (currentHope >= 1) {
        await applyOpToTableState(gmUid, {
          op: 'update-element',
          instanceId: attackerInstanceId,
          updates: { hope: Math.max(0, currentHope - 1) },
        });
      }
    }

    // 3. Roll 1d4.
    const d4Result = randomInt(1, 5);

    // 4. Build the copy banner's subItems — insert d4 after Fear sub-item.
    const origSubItems = Array.isArray(originalData.subItems) ? originalData.subItems : [];
    const d4SubItem = { pre: 'Heart of a Poet', input: '1d4', result: String(d4Result), details: `(${d4Result})`, post: '' };
    const fearIdx = origSubItems.findIndex(s => /fear/i.test(s.pre || ''));
    const insertIdx = fearIdx >= 0 ? fearIdx + 1 : origSubItems.findIndex(s => /damage/i.test(s.pre || ''));
    let newSubItems;
    if (insertIdx >= 0) {
      newSubItems = [...origSubItems.slice(0, insertIdx), d4SubItem, ...origSubItems.slice(insertIdx)];
    } else {
      newSubItems = [...origSubItems, d4SubItem];
    }

    // 5. Recompute roll totals from the new subItems.
    const dh = parseDaggerheartResult(newSubItems);
    let copyData;
    if (dh) {
      copyData = { ...dh, rollUser: dh.characterName || originalData.rollUser || '', subItems: newSubItems, timestamp: Date.now() };
    } else {
      let total = 0;
      for (const sub of newSubItems) {
        if (/damage/i.test(sub.pre || '')) continue;
        if (EXTRA_PRE_RE.test(sub.pre || '')) continue;
        const v = parseInt(sub.result, 10);
        if (!isNaN(v)) total += v;
      }
      copyData = { rollUser: originalData.rollUser || '', total, subItems: newSubItems, timestamp: Date.now() };
    }

    // 6. Preserve original metadata, clear toggle fields, mark as applied.
    for (const k of Object.keys(originalData)) {
      if (k.startsWith('_') && !(k in copyData)) copyData[k] = originalData[k];
    }
    copyData._heartOfAPoetApplied = true;
    delete copyData._heartOfAPoetAddD4;
    copyData._heartOfAPoetD4Result = d4Result;
    if (originalData.rollText) copyData.rollText = originalData.rollText;
    if (originalData.displayName) copyData.displayName = originalData.displayName;
    if (originalData.tags) copyData.tags = originalData.tags;

    // 7. Append the copy banner and notify.
    await appendDiceRoll(APP_ID, gmUid, copyData);
    subscriptionManager.notifyChange('banners', gmUid);

    res.json({ ok: true });
  } catch (err) {
    console.error('POST /api/room/my/banner-heart-d4-ack error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/room/:gmUid/banner-heart-d4-toggle — GM or player: toggle intent to add d4 on a Heart of a Poet banner.
app.post('/api/room/:gmUid/banner-heart-d4-toggle', requireAuth, async (req, res) => {
  const { gmUid } = req.params;
  const bannerId = req.body?.bannerId != null ? Number(req.body.bannerId) : null;
  const value = req.body?.value === true;
  if (bannerId == null || Number.isNaN(bannerId)) {
    return res.status(400).json({ error: 'bannerId required' });
  }
  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ error: 'Requires database' });
  }
  try {
    if (req.uid !== gmUid) {
      const tableStateItems = await getItems(APP_ID, gmUid, 'table_state');
      const tableState = tableStateItems[0] || {};
      if (!(tableState.playerEmails || []).includes(req.email)) {
        return res.status(403).json({ error: 'Not a player in this room' });
      }
    }
    const row = await getDiceRollById(APP_ID, gmUid, bannerId);
    if (!row || row.status !== 'pending') {
      return res.status(404).json({ error: 'Banner not found or already resolved' });
    }
    await updateDiceRollData(APP_ID, gmUid, bannerId, { _heartOfAPoetAddD4: value });
    subscriptionManager.notifyChange('banners', gmUid);
    res.json({ ok: true, value });
  } catch (err) {
    console.error(`POST /api/room/${gmUid}/banner-heart-d4-toggle error:`, err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/room/:gmUid/banner-cancel — Player cancels their own pending banner (GM has not acked/cancelled yet).
app.post('/api/room/:gmUid/banner-cancel', requireAuth, async (req, res) => {
  const { gmUid } = req.params;
  const bannerId = req.body?.bannerId != null ? Number(req.body.bannerId) : null;
  if (req.uid === gmUid || bannerId == null || Number.isNaN(bannerId)) {
    return res.status(400).json({ error: 'Invalid request' });
  }
  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ error: 'Player banner cancel requires database' });
  }
  try {
    const tableStateItems = await getItems(APP_ID, gmUid, 'table_state');
    const tableState = tableStateItems[0] || {};
    if (!(tableState.playerEmails || []).includes(req.email)) {
      return res.status(403).json({ error: 'Not a player in this room' });
    }
    const row = await getDiceRollById(APP_ID, gmUid, bannerId);
    if (!row || row.status !== 'pending') {
      return res.status(404).json({ error: 'Banner not found or already resolved' });
    }
    if (row.data._initiatorUid !== req.uid) {
      return res.status(403).json({ error: 'You can only cancel your own banner' });
    }
    if (row.data._action !== true) {
      return res.status(400).json({ error: 'Cannot cancel a banner that contains dice rolls' });
    }
    await setBannerStatus(bannerId, 'cancelled');
    subscriptionManager.notifyChange('banners', gmUid);
    res.json({ ok: true });
  } catch (err) {
    console.error(`POST /api/room/${gmUid}/banner-cancel error:`, err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/room/:gmUid/life-support-select — Player or GM sets Life Support target selection (syncs to all clients).
// selectedLifeSupportTargetInstanceId may be null to clear the selection.
app.post('/api/room/:gmUid/life-support-select', requireAuth, async (req, res) => {
  const { gmUid } = req.params;
  const { _rollDbId, selectedLifeSupportTargetInstanceId } = req.body || {};
  if (_rollDbId == null) {
    return res.status(400).json({ error: '_rollDbId required' });
  }
  try {
    if (req.uid === gmUid) {
      await applyOpToTableState(gmUid, {
        op: 'life-support-select',
        _rollDbId,
        selectedLifeSupportTargetInstanceId,
      });
    } else {
      const tableStateItems = await getItems(APP_ID, gmUid, 'table_state');
      const tableState = tableStateItems[0] || {};
      if (!(tableState.playerEmails || []).includes(req.email)) {
        return res.status(403).json({ error: 'Not a player in this room' });
      }
      await applyOpToTableState(gmUid, {
        op: 'life-support-select',
        _rollDbId,
        selectedLifeSupportTargetInstanceId,
      });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('POST /api/room/:gmUid/life-support-select error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/room/my/op — GM applies a table op, persists to DB, and notifies all subscribers.
app.post('/api/room/my/op', requireAuth, async (req, res) => {
  const op = req.body;
  if (!op || typeof op !== 'object' || !op.op) {
    return res.status(400).json({ error: 'Invalid op' });
  }
  if (!process.env.DATABASE_URL) {
    return res.json({ ok: true });
  }
  try {
    await applyOpToTableState(req.uid, op);
    res.json({ ok: true });
  } catch (err) {
    console.error('POST /api/room/my/op error:', err);
    res.status(500).json({ error: 'Failed to apply op' });
  }
});


// POST /api/room/:gmUid/character-update — Player updates their assigned character's runtime state (GM can always update in own room)
app.post('/api/room/:gmUid/character-update', requireAuth, async (req, res) => {
  const { gmUid } = req.params;
  const { instanceId, updates } = req.body;
  try {
    const tableStateItems = await getItems(APP_ID, gmUid, 'table_state');
    const tableState = tableStateItems[0] || {};
    const character = (tableState.elements || []).find(e => e.instanceId === instanceId);
    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }
    const isRoomOwner = req.uid === gmUid;
    if (!isRoomOwner) {
      if (!(tableState.playerEmails || []).includes(req.email)) {
        return res.status(403).json({ error: 'Not a player in this room' });
      }
      if (character.assignedPlayerEmail !== req.email) {
        return res.status(403).json({ error: 'Not assigned to this character' });
      }
    }
    // Apply the update to the persisted state and notify all subscribers
    await applyOpToTableState(gmUid, { op: 'update-element', instanceId, updates });
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
    const { id: charId, name, playerName, maxHope, maxHp, maxStress, tier,
      hope, currentHp, currentStress, currentArmor, conditions, tokenX, tokenY,
      assignedPlayerUid, ...extraFields } = req.body;
    const instanceId = crypto.randomUUID();
    const runtimeData = {
      instanceId,
      elementType: 'character',
      assignedPlayerEmail: req.email,
      assignedPlayerUid: assignedPlayerUid || req.uid,
      playerName: playerName || req.email,
      hope: hope ?? (maxHope || 6),
      currentHp: currentHp ?? (maxHp || 6),
      currentStress: currentStress ?? 0,
      currentArmor: currentArmor ?? 0,
      conditions: conditions || '',
      tokenX: tokenX ?? null,
      tokenY: tokenY ?? null,
    };

    // Resolve from library so all clients get the latest character data, not a snapshot.
    let character;
    if (charId) {
      const [libChar] = await getItemsByIds(APP_ID, 'characters', [charId]);
      if (libChar) {
        character = { ...libChar, ...runtimeData };
      }
    }
    if (!character) {
      // Fallback: library record not found, use the full snapshot sent by the player.
      character = {
        ...extraFields,
        id: charId,
        name: name || 'Unnamed',
        tier: tier || 1,
        maxHope: maxHope || 6,
        maxHp: maxHp || 6,
        maxStress: maxStress || 6,
        ...runtimeData,
      };
    }
    // Add the character to persisted state and notify all subscribers
    await applyOpToTableState(gmUid, { op: 'add-elements', elements: [character] });
    res.json({ character });
  } catch (err) {
    console.error(`POST /api/room/${gmUid}/add-character error:`, err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/room/:gmUid/roll — Player rolls dice server-side; validates room membership, persists to DB.
app.post('/api/room/:gmUid/roll', requireAuth, async (req, res) => {
  const { gmUid } = req.params;
  const { rollText, displayName, _clientId, ...rest } = req.body;
  if (!rollText) return res.status(400).json({ error: 'rollText is required' });
  // Forward any _-prefixed meta fields (hopeCost, featureUse, attackerInstanceId, etc.)
  // so the GM's dice-ack handler can apply resource costs from player feature rolls.
  const extraMeta = Object.fromEntries(Object.entries(rest).filter(([k]) => k.startsWith('_')));
  try {
    const tableStateItems = await getItems(APP_ID, gmUid, 'table_state');
    const tableState = tableStateItems[0] || {};
    if (!(tableState.playerEmails || []).includes(req.email)) {
      return res.status(403).json({ error: 'Not a player in this room' });
    }
    const rollData = buildRollData(rollText, displayName, _clientId, { _playerInitiated: true, _initiatorUid: req.uid, ...extraMeta });
    if (!rollData) return res.status(400).json({ error: 'No dice expressions found in rollText' });
    await appendRollLog(gmUid, rollData);
    res.json(rollData);
  } catch (err) {
    console.error(`POST /api/room/${gmUid}/roll error:`, err);
    res.status(500).json({ error: `Roll failed: ${err.message}` });
  }
});

app.use('/api/srd', srdRouter);

app.use(express.static(join(__dirname, 'public')));

// SPA fallback — serve index.html for any unmatched route (except asset paths)
// Don't send HTML for .js/.css/etc. or the browser throws "invalid MIME type"
const ASSET_EXT = /\.(js|mjs|cjs|css|map|ico|png|jpg|jpeg|gif|svg|woff2?|ttf|webp)$/i;
app.get('*', (req, res) => {
  if (ASSET_EXT.test(req.path)) {
    res.status(404).end();
    return;
  }
  res.sendFile(join(__dirname, 'public', 'index.html'));
});

// --- Startup ---
async function startServer() {
  await warmCache();
  if (process.env.DATABASE_URL) {
    await runMigrations();
    await loadSrdIntoDb(APP_ID);
    await subscriptionManager.init(APP_ID);
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
  const httpServer = createServer(app);
  httpServer.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
}

startServer().catch(err => {
  console.error('Startup failed:', err);
  process.exit(1);
});
