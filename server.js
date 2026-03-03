import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { watchFile } from 'fs';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { runMigrations, getItems, getPublicItems, upsertItem, deleteItem, countItems, getItemsPaginated, countCommunityItems, getCommunityItemsPaginated, getMirrorIds, getItemsByIds, incrementCloneCount, incrementPlayCount, upsertMirror, findAutoClone, blockRedditPost, unblockRedditPost, getBlockedRedditPostIds, getRedditMirrorsPaginated, getRedditQueuePaginated, getRedditStatusCounts, setRedditMirrorStatus } from './src/db.js';
import { searchFCG } from './src/fcg-search.js';
import { srdRouter, warmCache, getItem as getSrdItem, searchCollection as searchSrdCollection } from './src/srd/index.js';
import { EXTERNAL_SOURCES } from './src/external-sources.js';
import { fetchHoDFoundryDetail } from './src/hod-search.js';
import { getRedditPost } from './src/reddit-search.js';
import multer from 'multer';
import { parseStatBlock, mergeResults, detectCollection, detectCollections } from './src/text-parse.js';
import { ocrImages, ocrBuffer } from './src/ocr-parse.js';
import { runParseCascade } from './src/reddit-parse-cascade.js';
import { startRedditScanner, stopRedditScanner, triggerScanNow } from './src/reddit-scanner.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3456;
const APP_ID = process.env.APP_ID || 'daggerheart-gm-tool';
const COLLECTIONS = ['adversaries', 'environments', 'scenes', 'adventures', 'table_state'];

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
  try {
    const decoded = await getAuth().verifyIdToken(header.slice(7));
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

app.use(express.json());

// --- Config route (no auth required) ---
app.get('/api/config', (req, res) => {
  res.json({
    firebaseConfig: {
      apiKey:     process.env.FIREBASE_API_KEY     || '',
      authDomain: process.env.FIREBASE_AUTH_DOMAIN || '',
      projectId:  process.env.FIREBASE_PROJECT_ID  || '',
      appId:      process.env.FIREBASE_APP_ID      || '',
    },
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
  res.flushHeaders();
  res.write('data: connected\n\n');
  liveReloadClients.add(res);
  req.on('close', () => liveReloadClients.delete(res));
});
let reloadTimer = null;
const broadcastReload = () => {
  clearTimeout(reloadTimer);
  reloadTimer = setTimeout(() => {
    for (const client of liveReloadClients) client.write('data: reload\n\n');
  }, 150);
};
// Poll the two build output files; fires only when mtime changes (actual write), not on reads
watchFile('./public/app.js', { interval: 200 }, broadcastReload);
watchFile('./public/styles.css', { interval: 200 }, broadcastReload);

// --- Rolz session management ---

// In-memory cache: uid -> { cookie, expiresAt }
const rolzSessions = new Map();
const ROLZ_SESSION_TTL = 30 * 60 * 1000; // 30 minutes

// Debug log relay — forwards client-side log payloads to a localhost debug server.
// Only active in development (NODE_ENV != production). Used by Cursor debug mode to
// collect browser-side instrumentation logs via /api/debug-log, bypassing CORS.
// Client sends: { _debugUrl: "http://127.0.0.1:PORT/ingest/UUID", _debugSessionId: "ID", ...payload }
if (process.env.NODE_ENV !== 'production') {
  app.post('/api/debug-log', express.json(), (req, res) => {
    const { _debugUrl, _debugSessionId, ...payload } = req.body || {};
    if (!_debugUrl || !_debugUrl.startsWith('http://127.0.0.1:')) return res.status(400).json({ error: 'Invalid debug URL' });
    const headers = { 'Content-Type': 'application/json' };
    if (_debugSessionId) headers['X-Debug-Session-Id'] = _debugSessionId;
    fetch(_debugUrl, { method: 'POST', headers, body: JSON.stringify(payload) }).catch(() => {});
    res.json({ ok: true });
  });
}

async function rolzLogin(username, password) {
  // Form field is "nick", hidden field "action" is required
  const body = new URLSearchParams({ action: 'signin', nick: username, password, whence: '', t: '' });
  const res = await fetch('https://rolz.org/join/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
    redirect: 'manual',
  });
  const setCookie = res.headers.get('set-cookie');
  if (!setCookie) throw new Error('Rolz login failed — no session cookie returned');
  // Take only the first name=value pair; avoid splitting on commas inside expires dates
  const cookie = setCookie.split(';')[0].trim();
  return cookie;
}

async function getRolzSession(uid, username, password) {
  const cached = rolzSessions.get(uid);
  if (cached && Date.now() < cached.expiresAt) return cached.cookie;
  const cookie = await rolzLogin(username, password);
  rolzSessions.set(uid, { cookie, expiresAt: Date.now() + ROLZ_SESSION_TTL });
  return cookie;
}

// --- Rolz API proxies ---

app.get('/api/rolz-roomlog', requireAuth, async (req, res) => {
  const { room } = req.query;
  if (!room) {
    return res.status(400).json({ error: 'room parameter is required' });
  }
  try {
    const rolzRes = await fetch(`https://rolz.org/api/roomlog?room=${encodeURIComponent(room)}`);
    const body = await rolzRes.text();
    try {
      const parsed = JSON.parse(body);
      res.json(parsed);
    } catch {
      res.json({ raw: body });
    }
  } catch (err) {
    console.error('Rolz roomlog proxy error:', err);
    res.status(500).json({ error: `Failed to reach Rolz.org: ${err.message}` });
  }
});

app.post('/api/rolz-post', requireAuth, async (req, res) => {
  const { room, text, from, rolzUsername, rolzPassword } = req.body;
  if (!room || !text) {
    return res.status(400).json({ error: 'room and text are required' });
  }
  if (!rolzUsername || !rolzPassword) {
    return res.status(400).json({ error: 'rolzUsername and rolzPassword are required' });
  }
  const postToRolz = async (cookie) => {
    const params = new URLSearchParams({ room, text });
    if (from) params.set('from', from);
    return fetch(`https://rolz.org/api/post?${params}`, { headers: { Cookie: cookie } });
  };
  try {
    let cookie = await getRolzSession(req.uid, rolzUsername, rolzPassword);
    let rolzRes = await postToRolz(cookie);
    let body = await rolzRes.text();
    // If session expired, invalidate cache and retry once with a fresh login
    if (body.includes('Invalid account name')) {
      rolzSessions.delete(req.uid);
      cookie = await getRolzSession(req.uid, rolzUsername, rolzPassword);
      rolzRes = await postToRolz(cookie);
      body = await rolzRes.text();
    }
    try {
      res.json(JSON.parse(body));
    } catch {
      res.json({ raw: body });
    }
  } catch (err) {
    console.error('Rolz proxy error:', err);
    res.status(500).json({ error: `Failed to reach Rolz.org: ${err.message}` });
  }
});

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

/**
 * Fetch a page of DB items.
 * Tier 1: own items (sorted by popularity desc).
 * Tier 2: community items — public + mirrors — sorted by popularity desc.
 * Returns { items, ownCount, communityCount, dbCount }
 */
async function fetchDbPage(appId, uid, collection, { includeMine = true, includePublic, includeMirrors = true, search, tier, typeField, typeValue, offset, limit }) {
  const opts = { search, tier, typeField, typeValue };
  const hasCommunity = includePublic || includeMirrors;

  const [ownCount, communityCount] = await Promise.all([
    includeMine ? countItems(appId, uid, collection, opts) : Promise.resolve(0),
    hasCommunity
      ? countCommunityItems(appId, collection, {
          excludeUserId: uid,
          includePublic: Boolean(includePublic),
          includeMirrors: Boolean(includeMirrors),
          ...opts,
        })
      : Promise.resolve(0),
  ]);
  const dbCount = ownCount + communityCount;

  const items = [];
  let remaining = limit;
  let pos = offset;

  // Own items span [0, ownCount)
  if (includeMine && remaining > 0 && pos < ownCount) {
    const slice = await getItemsPaginated(appId, uid, collection, { ...opts, offset: pos, limit: remaining });
    items.push(...slice);
    remaining -= slice.length;
    pos += slice.length;
  }
  pos = Math.max(pos, ownCount);

  // Community items span [ownCount, dbCount)
  if (hasCommunity && remaining > 0 && pos < dbCount) {
    const communityOffset = pos - ownCount;
    const slice = await getCommunityItemsPaginated(appId, collection, {
      excludeUserId: uid,
      includePublic: Boolean(includePublic),
      includeMirrors: Boolean(includeMirrors),
      ...opts,
      offset: communityOffset,
      limit: remaining,
    });
    items.push(...slice);
  }

  return { items, ownCount, communityCount, dbCount };
}

app.get('/api/data/:collection', requireAuth, async (req, res) => {
  const { collection } = req.params;

  // table_state: return the single record without pagination
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
  const tier = req.query.tier || null;
  const typeValue = req.query.type || null;
  const typeField = collection === 'adversaries' ? 'role' : collection === 'environments' ? 'type' : null;
  const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  // Mirrors are never shown as visible DB results — they exist only for ID resolution
  // (clone/resolve flows). Showing them in DB results would break source priority
  // ordering (SRD before HoD before FCG).
  const includeMirrors = false;

  try {
    // Determine which external sources are active for this collection
    const activeExternalSources = EXTERNAL_SOURCES.filter(s =>
      req.query[s.enabledParam] === '1' &&
      (s.collections === null || s.collections.includes(collection))
    );

    // Mirrors are no longer shown as visible DB results — pass empty set for dedup.
    const mirrorIds = new Set();

    const { items: dbItems, dbCount } = await fetchDbPage(APP_ID, req.uid, collection, {
      includeMine, includePublic, includeMirrors, search, tier, typeField, typeValue, offset, limit,
    });

    const dbItemsWithPopularity = dbItems.map(item => ({
      ...item,
      popularity: (item.clone_count || 0) + (item.play_count || 0),
    }));

    // Walk external sources in priority order, filling remaining page slots.
    // Global offset space: [0, dbCount) = DB items, [dbCount, ...) = external sources in order.
    const externalOffset = Math.max(0, offset - dbCount);
    let remaining = limit - dbItemsWithPopularity.length;
    const externalItems = [];
    let externalTotalCount = 0;
    let priorSourceTotal = 0;
    let lastActiveNextLocalOffset = null;
    let lastActivePriorSourceTotal = 0;

    for (const source of activeExternalSources) {
      const sourceLocalOffset = Math.max(0, externalOffset - priorSourceTotal);
      // Always call with at least limit=1 so we get totalCount even when the page is full.
      const searchLimit = remaining > 0 ? remaining : 1;

      const result = await source.search({
        collection, search, tier,
        type: typeValue,
        typeField,
        limit: searchLimit,
        offset: sourceLocalOffset,
        mirrorIds,
        appId: APP_ID,
      });

      if (remaining > 0) {
        externalItems.push(...result.items);
        remaining -= result.items.length;
        if (result.nextLocalOffset !== undefined) {
          lastActiveNextLocalOffset = result.nextLocalOffset;
          lastActivePriorSourceTotal = priorSourceTotal;
        }
      }

      externalTotalCount += result.totalCount;
      priorSourceTotal += result.totalCount;
    }

    // Substitute HoD stubs with enriched mirror data when available.
    // HoD stubs are enriched in the background; if a mirror row exists, use it here so the
    // grid shows the richer data immediately.
    const hodStubIds = externalItems
      .filter(i => i._source === 'hod' && (i.features || []).length === 0)
      .map(i => i.id);
    let mirrorMap = {};
    if (hodStubIds.length > 0) {
      try {
        const mirrorRows = await getItemsByIds(APP_ID, collection, hodStubIds);
        for (const row of mirrorRows) {
          const hasFeatures = (row.features || []).length > 0;
          if (row._source === 'hod') {
            const isEnrichedAdv = collection === 'adversaries' && typeof row.attack?.damage === 'string';
            const isEnrichedEnv = collection === 'environments';
            if (hasFeatures && (isEnrichedAdv || isEnrichedEnv)) mirrorMap[row.id] = row;
          }
        }
      } catch {}
    }
    const enrichedExternal = Object.keys(mirrorMap).length > 0
      ? externalItems.map(i => mirrorMap[i.id] || i)
      : externalItems;

    const allItems = [...dbItemsWithPopularity, ...enrichedExternal];
    // nextOffset tells the client where to start the next page.
    // When a source provides nextLocalOffset (FCG env-subtraction case), use it so the
    // next page starts exactly past all rows consumed (including filtered-out environments).
    const nextOffset = lastActiveNextLocalOffset !== null
      ? dbCount + lastActivePriorSourceTotal + lastActiveNextLocalOffset
      : offset + allItems.length;

    res.json({
      items: allItems,
      totalCount: dbCount + externalTotalCount,
      dbCount,
      nextOffset,
    });
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
    await incrementPlayCount(appId, collection, item.id);
    return item;
  }

  const sourceId = item.id;
  // SRD items are now treated as external (creates a __MIRROR__ row) rather than
  // incrementing counts on __SRD__ DB rows (which no longer exist after migration).
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

  if (isExternal) {
    // Preserve _source in mirror data so items show the correct source badge when displayed
    // as community items in "All" mode (stripping it causes them to render as "Mine").
    const { _owner: _o, id: _eid, is_public: _ip, clone_count: _cc, play_count: _pc, popularity: _pop, ...mirrorData } = item;
    await upsertMirror(appId, collection, sourceId, mirrorData, {
      cloneDelta: isNewClone ? 1 : 0,
      playDelta: 1,
    });
  } else {
    if (isNewClone) await incrementCloneCount(appId, collection, sourceId);
    await incrementPlayCount(appId, collection, sourceId);
  }

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

      const srdFills = await Promise.all(
        missing.filter(id => id.startsWith('srd-')).map(id => getSrdItem(col, id))
      );
      const srdExtras = srdFills.filter(Boolean).map(item => ({ ...item, _source: 'srd' }));

      // For HoD items not in DB, fetch full Foundry JSON detail on demand.
      // These items carry _hodLink on them; if no link is available we skip.
      const hodMissing = missing.filter(id => id.startsWith('hod-'));
      const hodFills = await Promise.all(
        hodMissing.map(async id => {
          const postId = id.replace(/^hod-/, '');
          // We don't have the detail URL here — fall back gracefully.
          // Full detail is only available when the item was previously seen in a search
          // result and mirrored, or when coming through the clone flow.
          try {
            const detailUrl = `https://heartofdaggers.com/?p=${postId}`;
            return await fetchHoDFoundryDetail(postId, detailUrl, col);
          } catch (err) {
            console.warn(`[hod] Could not resolve ${id}:`, err.message);
            return null;
          }
        })
      );
      const hodExtras = hodFills.filter(Boolean);

      // For Reddit items not in DB: they can only be fully resolved if previously parsed
      // (mirror row). Stubs without a mirror are returned as-is (empty features) — they
      // need an explicit click to trigger LLM parsing.
      // reddit-* IDs not found in dbItems are simply absent from the result; the caller
      // should have mirrored them via clone/parse before referencing them in scenes.

      return [...dbItems, ...srdExtras, ...hodExtras];
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

const CLONE_COLLECTIONS = ['adversaries', 'environments'];

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
    // For HoD items, fetch full Foundry JSON detail so we store a rich mirror.
    // List-search items only have summary data; the detail fetch gives us features,
    // attacks, thresholds, experiences, etc.
    let effectiveSource = source;
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

    // For Reddit stubs, LLM-parse the post before cloning so the clone has full game data.
    // Check for a previously parsed mirror first to avoid redundant OpenAI calls.
    if (source._source === 'reddit' && source._redditPostId && (source.features || []).length === 0) {
      try {
        const existingMirrors = await getItemsByIds(APP_ID, collection, [sourceId]);
        const existingMirror = existingMirrors.find(r => r.id === sourceId && (r.features || []).length > 0);
        if (existingMirror) {
          effectiveSource = existingMirror;
        } else {
          const postDetail = await getRedditPost(source._redditPostId);
          const { item: parsed, artworkUrl } = await parseRedditPost({
            title: source.name || postDetail._redditTitle || '',
            text: postDetail._redditSelftext,
            imageUrls: postDetail._redditImages,
            collection,
          });
          effectiveSource = {
            ...source,
            ...parsed,
            id: sourceId,
            imageUrl: artworkUrl || source.imageUrl || '',
            _redditPostId: source._redditPostId,
            _redditPermalink: source._redditPermalink,
          };
        }
      } catch (err) {
        console.warn(`[reddit] Could not parse post for ${sourceId}, using stub data:`, err.message);
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

    // Increment counts on source
    if (isExternal) {
      // Preserve _source in mirror data so items show the correct source badge.
      const { _owner: _o, id: _eid, is_public: _ip, clone_count: _cc, play_count: _pc, popularity: _pop, ...mirrorData } = effectiveSource;
      await upsertMirror(APP_ID, collection, sourceId, mirrorData, {
        cloneDelta: isNewClone ? 1 : 0,
        playDelta: play ? 1 : 0,
      });
    } else if (source._source !== 'own') {
      if (isNewClone) await incrementCloneCount(APP_ID, collection, sourceId);
      if (play) await incrementPlayCount(APP_ID, collection, sourceId);
    }

    res.json({ item: clone });
  } catch (err) {
    console.error(`POST /api/data/${collection}/clone error:`, err);
    res.status(500).json({ error: 'Failed to clone item' });
  }
});

// --- Play endpoint (own items added to GM Table) ---

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
    await incrementPlayCount(APP_ID, collection, itemId);
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
  const hodItems = (Array.isArray(items) ? items : []).filter(i => i._source === 'hod' && i._hodPostId);
  const enriched = {};
  const CONCURRENCY = 5;
  for (let i = 0; i < hodItems.length; i += CONCURRENCY) {
    const batch = hodItems.slice(i, i + CONCURRENCY);
    await Promise.allSettled(batch.map(async (item) => {
      try {
        const detailUrl = item._hodLink || `https://heartofdaggers.com/?p=${item._hodPostId}`;
        const full = await fetchHoDFoundryDetail(item._hodPostId, detailUrl, collection);
        enriched[item.id] = full;
        const { id, _source, _owner, clone_count, play_count, popularity, ...mirrorData } = full;
        upsertMirror(APP_ID, collection, full.id, { ...mirrorData, _source: 'hod' }).catch(() => {});
      } catch (err) {
        console.warn(`[enrich] Could not enrich ${item.id}:`, err.message);
      }
    }));
  }
  res.json({ enriched });
});

// --- Admin: block a Reddit post from appearing to all users ---

app.put('/api/admin/mirror/:collection', requireAuth, requireAdmin, async (req, res) => {
  const { collection } = req.params;
  if (!COLLECTIONS.includes(collection)) {
    return res.status(400).json({ error: 'Unknown collection' });
  }
  const item = req.body;
  if (!item || typeof item !== 'object' || !item.id) {
    return res.status(400).json({ error: 'Invalid item body — id is required' });
  }
  const { id, _source: _s, _owner: _o, clone_count: _cc, play_count: _pc, popularity: _pop, ...rest } = item;
  try {
    await upsertMirror(APP_ID, collection, id, { ...rest, _source: 'reddit' });
    res.json({ id, ...rest, _source: 'reddit' });
  } catch (err) {
    console.error(`PUT /api/admin/mirror/${collection} error:`, err);
    res.status(500).json({ error: 'Failed to save mirror item' });
  }
});

app.post('/api/admin/reddit/scan', requireAuth, requireAdmin, (req, res) => {
  triggerScanNow(APP_ID);
  res.json({ ok: true, message: 'Scan cycle triggered' });
});

app.post('/api/admin/reddit/block', requireAuth, requireAdmin, async (req, res) => {
  const { redditPostId } = req.body || {};
  if (!redditPostId) return res.status(400).json({ error: 'redditPostId is required' });
  try {
    await blockRedditPost(APP_ID, redditPostId, req.email);
    res.json({ ok: true });
  } catch (err) {
    console.error('POST /api/admin/reddit/block error:', err);
    res.status(500).json({ error: 'Failed to block Reddit post' });
  }
});

// --- Reddit parse endpoint (text → OCR → LLM cascade) ---

app.post('/api/reddit/parse', requireAuth, requireAdmin, async (req, res) => {
  const { collection, redditPostId, name, selftext, images, forceLlm, reparse } = req.body || {};
  if (!collection || !['adversaries', 'environments'].includes(collection)) {
    return res.status(400).json({ error: 'collection must be adversaries or environments' });
  }
  if (!redditPostId) {
    return res.status(400).json({ error: 'redditPostId is required' });
  }

  try {
    const itemId = `reddit-${redditPostId}`;

    // Return cached mirror if already parsed (skip when re-parsing)
    if (!reparse) {
      const existing = await getItemsByIds(APP_ID, collection, [itemId]);
      const existingParsed = existing.find(r => r.id === itemId && (r.features || []).length > 0);
      if (existingParsed) {
        return res.json({ item: existingParsed, artworkUrl: existingParsed.imageUrl || null, _parseMethod: 'cached' });
      }
    }

    const results = await runParseCascade({ collection, redditPostId, selftext, images, name, forceLlm });

    // Persist all detected stat blocks as mirror rows (fire-and-forget)
    for (const result of results) {
      const { id: _id, _source: _s, _owner: _o, clone_count: _cc, play_count: _pc, popularity: _pop, ...mirrorData } = result.item;
      upsertMirror(APP_ID, result.collection, result.item.id, { ...mirrorData, _source: 'reddit' }).catch(() => {});
    }

    // Return the first result matching the requested collection (or the first overall)
    const primary = results.find(r => r.collection === collection) || results[0];

    return res.json({ item: primary.item, artworkUrl: primary.artworkUrl, _parseMethod: primary.parseMethod });
  } catch (err) {
    console.error('POST /api/reddit/parse error:', err);
    res.status(500).json({ error: err.message || 'Failed to parse Reddit post' });
  }
});

// --- Generic image/text import (OCR + regex parse, no LLM) ---

const importUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 20 },
  fileFilter: (_req, file, cb) => {
    cb(null, file.mimetype.startsWith('image/'));
  },
});

app.post('/api/import/parse', requireAuth, importUpload.array('images', 20), async (req, res) => {
  try {
    const files = req.files || [];
    const pastedText = (req.body.text || '').trim();
    console.log(`[import] Parsing ${files.length} image(s) + ${pastedText ? 'text' : 'no text'}`);

    // Phase 1: OCR all images, classify each as stat-block or artwork.
    // ocrBuffer() now clusters Tesseract blocks into discrete text regions so
    // a single image with N stat blocks produces N textRegions.
    const ocrResults = [];  // { textRegions, artworkRegions, allClusters, imageWidth, imageHeight, fileIndex }
    const pureArtworkUrls = [];  // data-URL thumbnails for non-stat-block images
    const imageRegions = {};     // fileIndex → { textRegions, allClusters, imageWidth, imageHeight } for debug overlay

    for (let i = 0; i < files.length; i++) {
      try {
        const ocrStart = Date.now();
        const { isStatBlock: isStat, textRegions, artworkRegions, allClusters, imageWidth, imageHeight } = await ocrBuffer(files[i].buffer);
        console.log(`[import] OCR image ${i}: ${imageWidth}x${imageHeight}, ${allClusters?.length || 0} clusters, ${textRegions.length} stat regions, ${Date.now() - ocrStart}ms`);
        // Record debug regions so the lightbox can show cluster bounding boxes
        if (allClusters?.length > 0 && imageWidth && imageHeight) {
          const statBboxSet = new Set(textRegions.map(r => r.bbox ? `${r.bbox.x0},${r.bbox.y0},${r.bbox.x1},${r.bbox.y1}` : ''));
          imageRegions[i] = {
            clusters: allClusters.map(c => ({
              bbox: c.bbox,
              isStatBlock: statBboxSet.has(`${c.bbox.x0},${c.bbox.y0},${c.bbox.x1},${c.bbox.y1}`),
              textPreview: c.text.slice(0, 80),
            })),
            imageWidth,
            imageHeight,
          };
        }
        if (isStat && textRegions.length > 0) {
          ocrResults.push({ textRegions, artworkRegions, fileIndex: i });
        } else {
          // Non-stat-block image → convert to data URL for use as artwork
          const mime = files[i].mimetype || 'image/jpeg';
          pureArtworkUrls.push(`data:${mime};base64,${files[i].buffer.toString('base64')}`);
        }
      } catch (imgErr) {
        console.warn('[import] Failed to process image:', files[i].originalname, imgErr.message);
      }
    }

    // Phase 2: Parse each text region independently.
    // All regions from the same image share the same artwork pool.
    // Within each region, splitStatBlocks() handles stacked same-column stat blocks.
    const results = [];

    for (const { textRegions, artworkRegions, fileIndex } of ocrResults) {
      // Build this image's artwork pool: its own cropped regions + pure artwork images
      const imageArtwork = [...artworkRegions, ...pureArtworkUrls];
      const artworkUrl = imageArtwork[0] || null;
      const additionalArtwork = imageArtwork.slice(1);

      for (const region of textRegions) {
        // Fallback: split region text on repeated stat-block headers (same-column stacking)
        const segments = detectCollections(region.text);

        for (const { collection, item, confidence, missing } of segments) {
          item.imageUrl = artworkUrl || '';
          if (additionalArtwork.length > 0) {
            item._additionalImages = additionalArtwork;
          }
          results.push({ collection, item, confidence, missing, artworkUrl, sourceIndex: fileIndex });
        }
      }
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

    console.log(`[import] Done — ${results.length} item(s) from ${Object.keys(imageRegions).length} image(s)`);
    res.json({ results, imageRegions });
  } catch (err) {
    console.error('POST /api/import/parse error:', err);
    res.status(500).json({ error: err.message || 'Failed to parse import' });
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
  const { id: _id, is_public, _source, _owner, ...rest } = item;
  try {
    await upsertItem(APP_ID, req.uid, collection, id, { ...rest }, Boolean(is_public));
    res.json({ id, ...rest, is_public: Boolean(is_public), _source: 'own' });
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

// --- Admin: Reddit queue endpoints ---

// GET /api/admin/reddit/counts
// Returns { [status]: count } for all non-parsed statuses (queue badge + sub-nav)
app.get('/api/admin/reddit/counts', requireAuth, requireAdmin, async (req, res) => {
  try {
    const counts = await getRedditStatusCounts(APP_ID);
    res.json(counts);
  } catch (err) {
    console.error('GET /api/admin/reddit/counts error:', err);
    res.status(500).json({ error: 'Failed to fetch counts' });
  }
});

// GET /api/admin/reddit/queue?status=needs_review&collection=adversaries&offset=0&limit=20
app.get('/api/admin/reddit/queue', requireAuth, requireAdmin, async (req, res) => {
  const { status, collection, offset: rawOffset, limit: rawLimit } = req.query;
  if (!status) return res.status(400).json({ error: 'status is required' });
  const offset = Math.max(0, parseInt(rawOffset, 10) || 0);
  const limit = Math.min(20, Math.max(1, parseInt(rawLimit, 10) || 10));
  try {
    const result = await getRedditQueuePaginated(APP_ID, { status, collection: collection || null, offset, limit });
    res.json(result);
  } catch (err) {
    console.error('GET /api/admin/reddit/queue error:', err);
    res.status(500).json({ error: 'Failed to fetch queue' });
  }
});

// POST /api/admin/reddit/:collection/:id/status
// Body: { status: "any string" }
// Sets _redditStatus on the mirror; manages blocked_reddit_posts for custom tags.
app.post('/api/admin/reddit/:collection/:id/status', requireAuth, requireAdmin, async (req, res) => {
  const { collection, id } = req.params;
  const { status } = req.body || {};
  if (!collection || !['adversaries', 'environments'].includes(collection)) {
    return res.status(400).json({ error: 'Invalid collection' });
  }
  if (!status || typeof status !== 'string') {
    return res.status(400).json({ error: 'status is required' });
  }
  try {
    const RESERVED = new Set(['needs_review', 'parsed', 'failed']);
    const updated = await setRedditMirrorStatus(APP_ID, collection, id, status);
    if (!updated) return res.status(404).json({ error: 'Mirror not found' });

    // Extract the Reddit post ID from item id (format: reddit-XXXX)
    const redditPostId = id.replace(/^reddit-/, '');

    // Custom tag → block so scanner doesn't re-discover; back to needs_review → unblock
    if (!RESERVED.has(status)) {
      await blockRedditPost(APP_ID, redditPostId, req.email).catch(() => {});
    } else if (status === 'needs_review') {
      await unblockRedditPost(APP_ID, redditPostId).catch(() => {});
    }

    res.json({ ok: true, item: updated });
  } catch (err) {
    console.error(`POST /api/admin/reddit/${collection}/${id}/status error:`, err);
    res.status(500).json({ error: 'Failed to update status' });
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
    startRedditScanner(APP_ID);
  } else {
    console.warn('[db] DATABASE_URL not set — running without database');
  }
  app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
}

startServer().catch(err => {
  console.error('Startup failed:', err);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => { stopRedditScanner(); process.exit(0); });
process.on('SIGINT', () => { stopRedditScanner(); process.exit(0); });
