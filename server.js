import express from 'express';
import { createServer } from 'node:http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { gunzipSync } from 'zlib';
import { randomInt, randomUUID } from 'crypto';
import { watchFile, readFileSync, appendFileSync, mkdirSync } from 'fs';
import { readFile } from 'fs/promises';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import cron from 'node-cron';
import { runMigrations, getItems, getPublicItems, upsertItem, deleteItem, countItems, getItemsPaginated, countCommunityItems, getCommunityItemsPaginated, getItemsByIds, getItem, recordClone, recordPlay, upsertMirror, findAutoClone, getUnifiedItems, getUnifiedLibraryAll, getUnifiedLibraryAllBranchCounts, getExternalCacheByIds, getTableStatesByPlayerEmail, getTableStateById, listTableStates, appendDiceRoll, ackDiceRoll, getRecentDiceRolls, setBannerStatus, getPendingBanners, getDiceRollById, updateDiceRollData, resolveCharacterElements as resolveCharacterElementsDb, stripCharacterElementsForDb, getResolvedTableState, setTableStateNotifyHook, getUserPreferences, upsertUserPreferences, queryAiUsageAggregates } from './src/db.js';
import { srdRouter, warmCache, getItem as getSrdItem } from './src/srd/index.js';
import { fetchHoDFoundryDetail } from './src/hod-search.js';
import { loadSrdIntoDb } from './src/srd-loader.js';
import { COLLECTION_NAMES as SRD_COLLECTION_NAMES } from './src/srd/parser.js';
import { redactTableStateForPlayerAudience } from './src/client/lib/session-countdowns.js';
import { filterFeatureCatalog, getFeatureCatalogById } from './src/v2-feature-catalog.js';
import { unifiedListConfig } from './src/unified-list-config.js';
import { runFullSync, runSyncSource, isSyncInProgress } from './src/external-sync.js';
import multer from 'multer';
import { parseStatBlock, mergeResults, detectCollection } from './src/text-parse.js';
import {
  ocrImages,
  ocrBuffer,
  analyzePageLayout,
  ocrCropRegionText,
  parseEncounterDropBuffer,
  parseEncounterDropText,
} from './src/ocr-parse.js';
import { generateImage as xaiGenerateImage, editImage as xaiEditImage, isConfigured as xaiIsConfigured } from './src/xai-image.js';
import { logXaiImageUsage } from './src/ai-usage-log.js';
import {
  attachEstimatedCostsToAggregateRows,
  AI_USAGE_PRICING_TIER,
  AI_USAGE_PRICING_NOTE,
} from './src/ai-usage-pricing.js';
import { syncDaggerstackCharacter, invalidateSrdLookupCache } from './src/daggerstack-sync.js';
import { refreshDaggerstackUuidMap } from './scripts/refresh-daggerstack-uuids.js';
import compression from 'compression';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { CHARACTER_RUNTIME_KEYS, applyTableOp } from './src/client/lib/table-ops.js';
import { gateTableOpForPrepMode, isTablePlayAllowed } from './src/client/lib/table-session-gate.js';
import { v2RollDieExtrasFromActionLoopPayload } from './src/client/lib/v2-action-notification-dice.js';
import { computePlayerV2CrossSheetChipApply } from './src/server/v2-player-cross-sheet-chip.js';
import { computePlayerV2ReviewChipApply, loadSrdDataForV2Engine } from './src/server/v2-player-review-chip.js';
import { buildCharacterAiFromConcept } from './src/llm-character-builder.js';
import { buildAdversaryAiFromConcept } from './src/llm-adversary-builder.js';
import { buildEnvironmentAiFromConcept } from './src/llm-environment-builder.js';
import { buildEncounterAiFromConcept } from './src/llm-encounter-builder.js';
import { answerLibraryQuestion, semanticFilterLibraryItems } from './src/library-ai.js';
import { migrateV2PendingMapRollId } from './src/client/lib/v2-pending-map-move.js';
import { buildForcedMovementActionNotification } from './src/client/lib/v2-forced-movement-banner.js';
import { attachDerivedMapConfig } from './src/client/lib/map-table-state.js';
import subscriptionManager from './src/subscriptions.js';
import { safeResolveUnderFeaturesRoot } from './src/sanitize-feature-source-path.js';
import { registerDevAgentRoutes } from './src/server/dev-agent-routes.js';
import { DEFAULT_CHARACTER_STARTING_HOPE, ROLES, ENV_TYPES } from './src/game-constants.js';
import { parseHttpBooleanLoose } from './src/parse-http-bool.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FEATURES_V2_ROOT = join(__dirname, 'src', 'features-v2');
const app = express();
const PORT = process.env.PORT || 3456;
const APP_ID = process.env.APP_ID || 'daggerheart-gm-tool';
const COLLECTIONS = [...SRD_COLLECTION_NAMES, 'scenes', 'adventures', 'characters', 'table_state'];

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

// QA (e.g. dev agent footer on Feature Source modal): same format as ADMIN_EMAILS.
const QA_EMAILS = (process.env.QA_EMAILS || '')
  .split(',')
  .map(e => e.trim().toLowerCase())
  .filter(Boolean);

function isQaEmail(email) {
  return QA_EMAILS.includes(email?.toLowerCase());
}

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

/** Admin or QA — dev-agent queue APIs and Feature Source modal dev agent footer. */
function requireAdminOrQa(req, res, next) {
  const em = req.email?.toLowerCase();
  if (!ADMIN_EMAILS.includes(em) && !QA_EMAILS.includes(em)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  next();
}

app.use(compression({
  // SSE connections (EventSource) must not be gzip-compressed. When connecting directly to Express
  // (e.g. local dev), the browser sends Accept-Encoding: gzip and the compression middleware wraps
  // the SSE stream, causing named events (banners, table_state) to be silently swallowed by the
  // browser's EventSource parser. On production (Fly.io) the reverse proxy strips Accept-Encoding
  // from SSE requests before forwarding, so this was never an issue there.
  filter: (req, res) => {
    if (req.headers.accept?.includes('text/event-stream')) return false;
    return compression.filter(req, res);
  },
}));
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
    imageGenEnabled: xaiIsConfigured(),
    supabaseStorageBase: process.env.SUPABASE_URL
      ? `${process.env.SUPABASE_URL}/storage/v1/object/public`
      : null,
    devAgentQueueEnabled: process.env.DEV_AGENT_QUEUE_ENABLED === '1',
    conceptAiEnabled: !!process.env.OPENAI_API_KEY,
  });
});

// --- Current user info ---
app.get('/api/me', requireAuth, async (req, res) => {
  const em = req.email?.toLowerCase();
  let preferences = { hideAiUi: false };
  try {
    if (process.env.DATABASE_URL) {
      preferences = await getUserPreferences(APP_ID, req.uid);
    }
  } catch (err) {
    console.error('GET /api/me preferences:', err);
  }
  res.json({
    isAdmin: ADMIN_EMAILS.includes(em),
    isQa: isQaEmail(req.email),
    preferences,
  });
});

app.put('/api/me/preferences', requireAuth, async (req, res) => {
  const { hideAiUi } = req.body || {};
  if (typeof hideAiUi !== 'boolean') {
    return res.status(400).json({ error: 'hideAiUi must be a boolean' });
  }
  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ error: 'Preferences require database' });
  }
  try {
    await upsertUserPreferences(APP_ID, req.uid, { hideAiUi });
    res.json({ preferences: { hideAiUi } });
  } catch (err) {
    console.error('PUT /api/me/preferences:', err);
    res.status(500).json({ error: 'Failed to save preferences' });
  }
});

registerDevAgentRoutes(app, { requireAuth, requireAdminOrQa });

/** Parse `YYYY-MM-DD` as UTC midnight; invalid → null */
function parseUtcDateParam(s) {
  if (!s || typeof s !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo || dt.getUTCDate() !== d) return null;
  return dt;
}

/** Inclusive UTC calendar `from` / `to` → `fromInclusive`, `toExclusive` for SQL. */
function resolveAiUsageRange(query) {
  const todayUtc = new Date();
  const toDefaultEnd = new Date(Date.UTC(todayUtc.getUTCFullYear(), todayUtc.getUTCMonth(), todayUtc.getUTCDate() + 1));
  const fromDefault = new Date(toDefaultEnd);
  fromDefault.setUTCDate(fromDefault.getUTCDate() - 30);

  let toInclusive = parseUtcDateParam(query.to) || new Date(Date.UTC(todayUtc.getUTCFullYear(), todayUtc.getUTCMonth(), todayUtc.getUTCDate()));
  let fromInclusive = parseUtcDateParam(query.from) || fromDefault;

  if (fromInclusive.getTime() > toInclusive.getTime()) {
    const t = fromInclusive;
    fromInclusive = toInclusive;
    toInclusive = t;
  }

  const toExclusive = new Date(toInclusive);
  toExclusive.setUTCDate(toExclusive.getUTCDate() + 1);

  return { fromInclusive, toExclusive };
}

app.get('/api/admin/ai-usage', requireAuth, requireAdmin, async (req, res) => {
  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ error: 'Database required for usage metrics' });
  }
  try {
    const { fromInclusive, toExclusive } = resolveAiUsageRange(req.query || {});
    const builderRaw = req.query?.builder;
    const builder =
      typeof builderRaw === 'string' && builderRaw.trim() !== '' ? builderRaw.trim() : null;

    const { totals, byDay } = await queryAiUsageAggregates(APP_ID, {
      fromInclusive,
      toExclusive,
      builder,
    });

    res.setHeader('Cache-Control', 'no-store');
    res.json({
      fromInclusive: fromInclusive.toISOString().slice(0, 10),
      toInclusive: new Date(toExclusive.getTime() - 86400000).toISOString().slice(0, 10),
      builder,
      pricingTier: AI_USAGE_PRICING_TIER,
      pricingNote: AI_USAGE_PRICING_NOTE,
      totals: attachEstimatedCostsToAggregateRows(totals),
      byDay: attachEstimatedCostsToAggregateRows(byDay),
    });
  } catch (err) {
    console.error('GET /api/admin/ai-usage:', err);
    res.status(500).json({ error: 'Failed to load AI usage' });
  }
});

/** Feature authoring guide — reads `docs/feature-authoring-guide.md` on each request (always current on disk). */
app.get('/api/docs/feature-authoring-guide', requireAuth, async (req, res) => {
  try {
    const path = join(__dirname, 'docs', 'feature-authoring-guide.md');
    const markdown = await readFile(path, 'utf8');
    res.setHeader('Cache-Control', 'no-store');
    res.json({ markdown });
  } catch (err) {
    console.error('GET /api/docs/feature-authoring-guide failed:', err);
    res.status(500).json({ error: 'Failed to load guide' });
  }
});

/** Read-only V2 feature module source for signed-in users (path validated under `src/features-v2/`). */
app.get('/api/features-v2/source', requireAuth, async (req, res) => {
  const rel = typeof req.query.path === 'string' ? req.query.path : '';
  const abs = safeResolveUnderFeaturesRoot(FEATURES_V2_ROOT, rel);
  if (!abs) {
    return res.status(400).json({ error: 'Invalid path' });
  }
  try {
    const source = await readFile(abs, 'utf8');
    res.setHeader('Cache-Control', 'no-store');
    res.json({ path: rel.replace(/\\/g, '/'), source });
  } catch (err) {
    if (err?.code === 'ENOENT') {
      return res.status(404).json({ error: 'Not found' });
    }
    console.error('GET /api/features-v2/source failed:', err);
    res.status(500).json({ error: 'Failed to read file' });
  }
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

// Debug log relay — appends NDJSON under `.cursor/debug-{sessionId}.log` (always), and optionally
// forwards to a localhost ingest URL. `_debugUrl` is optional so logging works when ingest is down
// or the URL/port does not match this Cursor session.
// Client sends: { _debugUrl?: "http://127.0.0.1:PORT/ingest/UUID", _debugSessionId?: "ID", sessionId?, ... }
if (process.env.NODE_ENV !== 'production') {
  app.post('/api/debug-log', (req, res) => {
    const body = req.body || {};
    const { _debugUrl, _debugSessionId, ...payload } = body;
    const sidRaw = (typeof payload.sessionId === 'string' && payload.sessionId) || _debugSessionId || 'default';
    const safeSid = /^[a-zA-Z0-9_-]+$/.test(String(sidRaw)) ? String(sidRaw) : 'default';
    try {
      const dir = join(process.cwd(), '.cursor');
      mkdirSync(dir, { recursive: true });
      const line =
        JSON.stringify({
          ...payload,
          _debugSessionId: _debugSessionId || undefined,
          _receivedAt: Date.now(),
        }) + '\n';
      appendFileSync(join(dir, `debug-${safeSid}.log`), line, 'utf8');
    } catch {
      /* ignore */
    }
    if (_debugUrl && typeof _debugUrl === 'string' && _debugUrl.startsWith('http://127.0.0.1:')) {
      const headers = { 'Content-Type': 'application/json' };
      if (_debugSessionId) headers['X-Debug-Session-Id'] = _debugSessionId;
      fetch(_debugUrl, { method: 'POST', headers, body: JSON.stringify(payload) }).catch(() => {});
    }
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
  let remainder = lastEnd < cleanedText.length ? cleanedText.slice(lastEnd) : '';
  let staticModifier = 0;
  const modMatch = remainder.match(/\s*\+\s*(\d+)\s*$/);
  if (modMatch) {
    staticModifier = parseInt(modMatch[1], 10);
    remainder = remainder.slice(0, remainder.length - modMatch[0].length).trimEnd();
  }
  if (subItems.length > 0 && remainder) {
    subItems[subItems.length - 1].post = remainder;
  }
  return { subItems, tags, staticModifier };
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

/** NdX on standard polyhedra only — V2 action-pool bonus dice (Hope spent client-side). */
function parseAllowedV2ActionDieExpr(raw) {
  const s = String(raw ?? '').trim();
  if (!/^([1-9]\d{0,2})?d(4|6|8|10|12|20)$/i.test(s)) return null;
  return s;
}

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
    if (/disadvantage/i.test(sub.pre || '')) { total -= result; continue; }
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
  const { subItems, tags, staticModifier = 0 } = rollFromText(rollText);
  if (!subItems.length) return null;
  const dh = parseDaggerheartResult(subItems);
  let rollData;
  if (dh) {
    rollData = { ...dh, total: dh.total + staticModifier, rollUser: dh.characterName || displayName || '', subItems, timestamp: Date.now() };
  } else {
    let total = 0;
    for (const sub of subItems) {
      if (/damage/i.test(sub.pre || '')) continue;
      if (EXTRA_PRE_RE.test(sub.pre || '')) continue;
      const v = parseInt(sub.result, 10);
      if (isNaN(v)) continue;
      if (/disadvantage/i.test(sub.pre || '')) { total -= v; continue; }
      total += v;
    }
    rollData = { rollUser: displayName || '', total: total + staticModifier, subItems, timestamp: Date.now() };
  }
  rollData.rollText = rollText;
  if (tags.length) rollData.tags = tags;
  if (_clientId) rollData._clientId = _clientId;
  // Preserve client displayName so weapon attack banners show "CharacterName WeaponName".
  if (displayName) rollData.displayName = displayName;
  return { ...rollData, ...extra };
}

// Build augmented roll: copy original subItems with _preset: true, roll extra damage, append new sub-item. For Kick etc.
// When suppressAncestryFeature is set, only that feature's chip is hidden on the new banner (client-side).
function buildAugmentedRollWithExtraDamage(originalData, extraDamageExpr, extraDamageLabel, narration, suppressAncestryFeature) {
  const origSubItems = Array.isArray(originalData.subItems) ? originalData.subItems : [];
  const presetSubItems = origSubItems.map(sub => ({ ...sub, _preset: true }));
  const rolled = rollDice(extraDamageExpr);
  if (!rolled) return null;
  // Use full sum for extra damage (e.g. Kick 2d6). Do not apply "keep highest" — that rule
  // applies only to the initial weapon damage in rollFromText, not to added damage dice.
  const newSubItem = {
    pre: `${extraDamageLabel || 'Extra'} ${extraDamageExpr} damage`, // <name> <dice>; must match /damage/i so it's summed as damage
    input: rolled.input,
    result: String(rolled.result),
    details: rolled.details,
    post: '',
  };
  const newSubItems = [...presetSubItems, newSubItem];
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
  for (const k of Object.keys(originalData)) {
    if (k.startsWith('_') && k !== '_presetSubIndexes' && !(k in copyData)) copyData[k] = originalData[k];
  }
  if (originalData.rollText) copyData.rollText = originalData.rollText;
  if (originalData.displayName) copyData.displayName = originalData.displayName;
  if (originalData.tags) copyData.tags = originalData.tags;
  if (narration) copyData._narration = narration;
  if (suppressAncestryFeature != null) copyData._suppressAncestryFeature = suppressAncestryFeature;
  return copyData;
}

// Build replacement roll that rerolls only one duality die (Hope or Fear). All other subItems get _preset: true.
// Used by roll.reroll('Hope') / roll.reroll('Fear') (e.g. Feline Instincts).
function buildRerollDieRoll(originalData, dieType, suppressAncestryFeature) {
  const origSubItems = Array.isArray(originalData.subItems) ? originalData.subItems : [];
  const preRe = dieType === 'Hope' ? /hope/i : /fear/i;
  const newSubItems = origSubItems.map((sub) => {
    if (preRe.test(sub.pre || '')) {
      const expr = (sub.input || '').trim() || 'd12';
      const rolled = rollDice(expr);
      if (rolled) {
        return { ...sub, input: rolled.input, result: String(rolled.result), details: rolled.details, post: sub.post || '' };
      }
      return { ...sub, post: sub.post || '' };
    }
    return { ...sub, _preset: true, post: sub.post || '' };
  });
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
  for (const k of Object.keys(originalData)) {
    if (k.startsWith('_') && k !== '_presetSubIndexes' && !(k in copyData)) copyData[k] = originalData[k];
  }
  if (originalData.rollText) copyData.rollText = originalData.rollText;
  if (originalData.displayName) copyData.displayName = originalData.displayName;
  if (originalData.tags) copyData.tags = originalData.tags;
  if (suppressAncestryFeature != null) copyData._suppressAncestryFeature = suppressAncestryFeature;
  return copyData;
}

// Build replacement roll that rerolls both Hope and Fear duality dice. All other subItems get _preset: true.
// Used by roll.reroll('Duality') (e.g. Faerie Luckbender).
function buildRerollDualityRoll(originalData, suppressAncestryFeature) {
  const origSubItems = Array.isArray(originalData.subItems) ? originalData.subItems : [];
  const dualityRe = /hope|fear/i;
  const newSubItems = origSubItems.map((sub) => {
    if (dualityRe.test(sub.pre || '')) {
      const expr = (sub.input || '').trim() || 'd12';
      const rolled = rollDice(expr);
      if (rolled) {
        return { ...sub, input: rolled.input, result: String(rolled.result), details: rolled.details, post: sub.post || '' };
      }
      return { ...sub, post: sub.post || '' };
    }
    return { ...sub, _preset: true, post: sub.post || '' };
  });
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
  for (const k of Object.keys(originalData)) {
    if (k.startsWith('_') && k !== '_presetSubIndexes' && !(k in copyData)) copyData[k] = originalData[k];
  }
  if (originalData.rollText) copyData.rollText = originalData.rollText;
  if (originalData.displayName) copyData.displayName = originalData.displayName;
  if (originalData.tags) copyData.tags = originalData.tags;
  if (suppressAncestryFeature != null) copyData._suppressAncestryFeature = suppressAncestryFeature;
  return copyData;
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
/** In-memory roll log fallback keyed by gmUid (used when DB fetch fails). */
const gmRollLogs = new Map();

/** Rooms are keyed by tableId. Presence and GM clients are per-table. */
function getOrCreateRoom(tableId) {
  if (!tableId) return null;
  if (!rooms.has(tableId)) rooms.set(tableId, { players: new Map(), gmClients: new Set() });
  return rooms.get(tableId);
}

async function appendRollLog(gmUid, rollData) {
  const suppressBanner = rollData._suppressActionBanner === true;
  const toStore = { ...rollData };
  delete toStore._suppressActionBanner;
  delete rollData._suppressActionBanner;

  if (!gmRollLogs.has(gmUid)) gmRollLogs.set(gmUid, []);
  const log = gmRollLogs.get(gmUid);
  log.push(toStore);
  if (log.length > ROLL_LOG_SIZE) log.shift();
  try {
    const dbId = await appendDiceRoll(APP_ID, gmUid, toStore, {
      status: suppressBanner ? 'acknowledged' : 'pending',
    });
    toStore._rollDbId = dbId;
    rollData._rollDbId = dbId;
  } catch (err) {
    console.error('[dice] DB write failed:', err.message);
  }
  subscriptionManager.notifyChange('banners', gmUid);
  if (suppressBanner && toStore._rollDbId != null) {
    subscriptionManager.broadcastBannersChannelEvent(gmUid, 'roll-log-append', {
      roll: { ...toStore, _rollDbId: toStore._rollDbId },
    });
  }
}

function broadcastPresenceToTable(tableId) {
  const room = rooms.get(tableId);
  if (!room) return;
  const presence = [...room.players.entries()].map(([uid, p]) => ({ uid, name: p.name, email: p.email, photoURL: p.photoURL }));
  const msg = `event: presence\ndata: ${JSON.stringify({ players: presence })}\n\n`;
  for (const clientRes of room.gmClients) { clientRes.write(msg); clientRes.flush?.(); }
}

/** Ephemeral map click ping — all GM + player SSE connections for this table (no DB). */
function broadcastMapPingToTable(tableId, payload) {
  const room = rooms.get(tableId);
  if (!room) return;
  const msg = `event: map_ping\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const clientRes of room.gmClients) {
    try {
      if (!clientRes.writableEnded) { clientRes.write(msg); clientRes.flush?.(); }
    } catch { /* ignore */ }
  }
  for (const [, p] of room.players) {
    try {
      if (p?.res && !p.res.writableEnded) { p.res.write(msg); p.res.flush?.(); }
    } catch { /* ignore */ }
  }
}

/** Ephemeral map scribble segment — same delivery as map_ping (no DB). */
function broadcastMapScribbleToTable(tableId, payload) {
  const room = rooms.get(tableId);
  if (!room) return;
  const msg = `event: map_scribble\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const clientRes of room.gmClients) {
    try {
      if (!clientRes.writableEnded) { clientRes.write(msg); clientRes.flush?.(); }
    } catch { /* ignore */ }
  }
  for (const [, p] of room.players) {
    try {
      if (p?.res && !p.res.writableEnded) { p.res.write(msg); p.res.flush?.(); }
    } catch { /* ignore */ }
  }
}

async function resolveDisplayNameForMapPing(req) {
  try {
    const u = await getAuth().getUser(req.uid);
    const n = (u.displayName && String(u.displayName).trim()) || (u.email && u.email.split('@')[0]);
    return n || 'Player';
  } catch {
    return req.email?.split('@')[0] || 'Player';
  }
}

// In-memory pending player intents (pre-roll banner state): tableId → intent object
// Intent shape: { characterName, characterInstanceId, rollText, chips, timestamp }
// chips are display-only (no functions): [{ label, description, hopeCost, stressCost, frequency, isToggle }]
const pendingIntents = new Map();

function broadcastIntentToGm(tableId, intent) {
  const room = rooms.get(tableId);
  if (!room) return;
  const msg = `event: intent\ndata: ${JSON.stringify(intent)}\n\n`;
  for (const clientRes of room.gmClients) { clientRes.write(msg); clientRes.flush?.(); }
}

/** Resolve table by tableId and validate requester has access (owner or in playerEmails). Returns { tableId, gmUid, tableState } or { error, message }. */
async function resolveTableAccess(appId, tableId, req) {
  const row = await getTableStateById(appId, tableId);
  if (!row) return { error: 404, message: 'Table not found' };
  const gmUid = row.userId;
  const tableState = row.data || {};
  const isOwner = req.uid === gmUid;
  const isPlayer = (tableState.playerEmails || []).includes(req.email);
  if (!isOwner && !isPlayer) return { error: 403, message: 'Not invited to this table' };
  return { tableId, gmUid, tableState };
}

/** GM-only: table must exist, belong to reqUid, and session must be started (prep mode blocks play). */
async function assertGmTableSessionActive(tableId, reqUid, res, opts = {}) {
  const { bypassPrepGate = false } = opts;
  const row = await getTableStateById(APP_ID, tableId);
  if (!row || row.userId !== reqUid) {
    res.status(403).json({ error: 'Not your table' });
    return false;
  }
  if (!bypassPrepGate && !isTablePlayAllowed(row.data || {})) {
    const paused = row.data?.top?.sessionPaused === true;
    res.status(400).json({
      error: paused ? 'Session paused' : 'Session not started',
      playBlocked: paused ? 'paused' : 'prep',
    });
    return false;
  }
  return true;
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
 * Per-table serialization lock for table-state writes.
 * Maps tableId → Promise (the tail of the current op queue for that table).
 */
const roomOpLocks = new Map();

/**
 * Apply a table op to the DB state for the given tableId, write back, and notify subscribers.
 * Looks up table ownership by tableId; ops for the same table are serialized.
 */
async function applyOpToTableState(tableId, op) {
  const prev = roomOpLocks.get(tableId) ?? Promise.resolve();
  const next = prev.then(async () => {
    const row = await getTableStateById(APP_ID, tableId);
    if (!row) throw new Error(`Table not found: ${tableId}`);
    const { userId, data: rawState } = row;
    const state = rawState || {};
    const bypassPrepGate = op?.bypassPrepGate === true;
    const gated = gateTableOpForPrepMode(state, op);
    if (!gated.ok) {
      const err = new Error(gated.error);
      err.statusCode = 400;
      const top = state.top || {};
      err.playBlocked = top.sessionPaused === true ? 'paused' : 'prep';
      throw err;
    }
    op = gated.op;
    // applyTableOp uses 'activeElements' key; DB uses 'elements'
    const stateForOp = { ...state, activeElements: state.elements || [] };
    const changes = applyTableOp(op, stateForOp);
    const { activeElements: newElements, ...otherChanges } = changes;
    const newState = {
      ...state,
      ...otherChanges,
      ...(newElements !== undefined ? { elements: stripCharacterElements(newElements) } : {}),
    };
    if (newState.maps?.length) {
      delete newState.mapConfig;
    }
    const skipActivityStamp =
      op.op === 'set-gm-display-name' ||
      op.op === 'touch-session-activity' ||
      op.op === 'set-map-view' ||
      op.op === 'set-map-free-explore' ||
      op.op === 'set-active-map' ||
      op.op === 'set-active-view' ||
      op.op === 'force-player-map-view' ||
      op.op === 'add-map' ||
      op.op === 'add-map-view' ||
      op.op === 'remove-map' ||
      op.op === 'remove-map-view' ||
      op.op === 'rename-map' ||
      op.op === 'rename-map-view' ||
      op.op === 'set-view-broadcast' ||
      op.op === 'set-map-share' ||
      op.op === 'set-map-overlay' ||
      op.op === 'set-map-fog' ||
      op.op === 'set-map-view-overlay' ||
      op.op === 'set-map-view-fog' ||
      bypassPrepGate;
    if (!skipActivityStamp) {
      newState.top = {
        ...(newState.top || {}),
        lastPlayActivityAt: Date.now(),
      };
    }
    await upsertItem(APP_ID, userId, 'table_state', tableId, newState, false);
    subscriptionManager.notifyChange('table_state', tableId);
    return newState;
  });
  roomOpLocks.set(tableId, next.catch(() => {}));
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

// --- Per-collection paginated route ---

/** SRD-backed unified list + app-only collections */
const PAGINATED_COLLECTIONS = [...SRD_COLLECTION_NAMES, 'features', 'scenes', 'adventures', 'characters'];
const UNIFIED_COLLECTIONS = SRD_COLLECTION_NAMES;

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

/** Shared query parsing for Library “All” merged browse + branch counts */
function parseLibraryAllQuery(req) {
  const includeMine = req.query.includeMine !== '0';
  const includePublic = req.query.includePublic === '1';
  const includeSrd = req.query.includeSrd === '1';
  const includeHod = req.query.includeHod === '1';
  const search = req.query.search || '';
  const sort = req.query.sort || 'popularity';
  const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const includeScaledUp = req.query.includeScaledUp === '1';
  const semantic = typeof req.query.semantic === 'string' ? req.query.semantic.trim() : '';

  const tiersRaw = parseQueryArray(req.query.tier);
  const tiers = tiersRaw.map(t => parseInt(t, 10)).filter(n => !isNaN(n) && n >= 1 && n <= 12);
  const levelsRaw = parseQueryArray(req.query.level);
  const levels = levelsRaw.map(t => parseInt(t, 10)).filter(n => !isNaN(n) && n >= 1 && n <= 12);

  const advRole = parseQueryArray(req.query.advRole);
  const envType = parseQueryArray(req.query.envType);
  const ablDomain = parseQueryArray(req.query.ablDomain);
  const wpnSlot = parseQueryArray(req.query.wpnSlot);
  const wpnPhyMag = parseQueryArray(req.query.wpnPhyMag);
  const featScope = parseQueryArray(req.query.featScope);

  return {
    includeMine,
    includePublic,
    includeSrd,
    includeHod,
    search,
    semantic,
    sort,
    offset,
    limit,
    tiers,
    levels,
    advRole,
    envType,
    ablDomain,
    wpnSlot,
    wpnPhyMag,
    includeScaledUp,
    featScope,
  };
}

/** Per-collection counts for Library nav (same filters as library-all; COUNT only) */
app.get('/api/data/library-all-counts', requireAuth, async (req, res) => {
  const q = parseLibraryAllQuery(req);
  if (q.semantic) {
    return res.json({
      countsByCollection: null,
      totalCount: 0,
      dbCount: 0,
      semanticApplied: true,
    });
  }
  try {
    const result = await getUnifiedLibraryAllBranchCounts(APP_ID, req.uid, {
      includeMine: q.includeMine,
      includePublic: q.includePublic,
      includeSrd: q.includeSrd,
      includeHod: q.includeHod,
      search: q.search,
      tiers: q.tiers,
      levels: q.levels,
      advRole: q.advRole,
      envType: q.envType,
      ablDomain: q.ablDomain,
      wpnSlot: q.wpnSlot,
      wpnPhyMag: q.wpnPhyMag,
      includeScaledUp: q.includeScaledUp,
      featScope: q.featScope,
    });
    return res.json({
      countsByCollection: result.countsByCollection,
      totalCount: result.totalCount,
      dbCount: result.totalCount,
    });
  } catch (err) {
    console.error('GET /api/data/library-all-counts error:', err);
    return res.status(500).json({ error: 'Failed to fetch library-all-counts' });
  }
});

/** Merged SRD unified collections for Library “All” tab — see `getUnifiedLibraryAll` in db.js */
app.get('/api/data/library-all', requireAuth, async (req, res) => {
  const q = parseLibraryAllQuery(req);

  try {
    const semanticCandidateLimit = Math.max(q.limit * 6, 150);
    const result = await getUnifiedLibraryAll(APP_ID, req.uid, {
      includeMine: q.includeMine,
      includePublic: q.includePublic,
      includeSrd: q.includeSrd,
      includeHod: q.includeHod,
      search: q.search,
      sort: q.sort,
      offset: q.semantic ? 0 : q.offset,
      limit: q.semantic ? semanticCandidateLimit : q.limit,
      tiers: q.tiers,
      levels: q.levels,
      advRole: q.advRole,
      envType: q.envType,
      ablDomain: q.ablDomain,
      wpnSlot: q.wpnSlot,
      wpnPhyMag: q.wpnPhyMag,
      includeScaledUp: q.includeScaledUp,
      featScope: q.featScope,
    });
    if (q.semantic) {
      const ranked = await semanticFilterLibraryItems(q.semantic, result.items, 'all', { limit: q.limit });
      return res.json({
        items: ranked.items,
        totalCount: ranked.items.length,
        dbCount: ranked.items.length,
        nextOffset: ranked.items.length,
        countsByCollection: null,
        semanticApplied: true,
      });
    }
    return res.json({
      items: result.items,
      totalCount: result.totalCount,
      dbCount: result.totalCount,
      nextOffset: result.nextOffset,
      countsByCollection: result.countsByCollection,
    });
  } catch (err) {
    console.error('GET /api/data/library-all error:', err);
    return res.status(500).json({ error: 'Failed to fetch library-all' });
  }
});

app.get('/api/data/:collection', requireAuth, async (req, res) => {
  const { collection } = req.params;

  if (collection === 'table_state') {
    try {
      const tableId = req.query.tableId;
      if (tableId) {
        let row = await getTableStateById(APP_ID, tableId);
        // Auto-create the primary table row the first time a user accesses their own table
        // (e.g. fresh local DB or new account with no prior table state).
        if (!row && tableId === req.uid) {
          const emptyState = { elements: [], playerEmails: [], gmDisplayName: '', fearCount: 0, top: { sessionStarted: false } };
          await upsertItem(APP_ID, req.uid, 'table_state', tableId, emptyState, false);
          row = { userId: req.uid, data: emptyState };
        }
        if (!row) return res.status(404).json({ error: 'Table not found' });
        const isOwner = row.userId === req.uid;
        const isPlayer = (row.data?.playerEmails || []).includes(req.email);
        if (!isOwner && !isPlayer) {
          return res.status(403).json({ error: 'Not your table' });
        }
        // Must match SSE `table_state` snapshots from `getResolvedTableState` (idle pause, activity seed).
        let resolvedState = await getResolvedTableState(APP_ID, tableId);
        if (!resolvedState) {
          return res.status(404).json({ error: 'Table not found' });
        }
        if (!isOwner && isPlayer) {
          resolvedState = redactTableStateForPlayerAudience(resolvedState);
        }
        const resolved = [{ ...resolvedState, _source: 'own', id: tableId, ownerUid: row.userId }];
        return res.json({ items: resolved, totalCount: 1, dbCount: 1 });
      }
      const rows = await listTableStates(APP_ID, req.uid);
      const resolved = await Promise.all(rows.map(async r => {
        const elements = await resolveCharacterElementsDb(APP_ID, (r.data?.elements) || []);
        const merged = { ...(r.data || {}), id: r.id, elements, _source: 'own' };
        return attachDerivedMapConfig(merged);
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
  const semantic = typeof req.query.semantic === 'string' ? req.query.semantic.trim() : '';
  const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const sort = req.query.sort || 'popularity';

  const tiersRaw = parseQueryArray(req.query.tier);
  const tiers = tiersRaw.map(t => parseInt(t, 10)).filter(n => !isNaN(n) && n >= 1 && n <= 12);
  const typeValuesRaw = parseQueryArray(req.query.type);
  const typeValues = typeValuesRaw.filter(Boolean);
  const extraTypeValues = parseQueryArray(req.query.type2).filter(Boolean);
  const tierMax = collection === 'adversaries' && includeScaledUp && tiers.length === 1 ? tiers[0] : null;
  const tierMaxExclusive = tierMax != null;

  try {
    if (collection === 'features') {
      const featScope = parseQueryArray(req.query.featScope);
      const singleId = req.query.id;
      if (singleId) {
        const row = getFeatureCatalogById(singleId);
        if (!row) return res.status(404).json({ error: 'Not found' });
        const item = { ...row, popularity: (row.clone_count || 0) + (row.play_count || 0) };
        return res.json({
          items: [item],
          totalCount: 1,
          dbCount: 1,
          nextOffset: 1,
        });
      }
      const result = filterFeatureCatalog({
        search,
        featScope,
        tiers,
        sort,
        offset: semantic ? 0 : offset,
        limit: semantic ? Math.max(limit * 6, 150) : limit,
      });
      if (semantic) {
        const ranked = await semanticFilterLibraryItems(semantic, result.items, collection, { limit });
        return res.json({
          items: ranked.items,
          totalCount: ranked.items.length,
          dbCount: ranked.items.length,
          nextOffset: ranked.items.length,
          semanticApplied: true,
        });
      }
      return res.json({
        items: result.items,
        totalCount: result.totalCount,
        dbCount: result.totalCount,
        nextOffset: offset + result.items.length,
      });
    }

    if (UNIFIED_COLLECTIONS.includes(collection)) {
      const cfg = unifiedListConfig(collection);
      const result = await getUnifiedItems(APP_ID, req.uid, collection, {
        includeMine,
        includePublic,
        includeSrd: req.query.includeSrd === '1',
        includeHod: req.query.includeHod === '1',
        search,
        tierMax,
        tierMaxExclusive,
        tiers: tierMax != null ? [] : tiers,
        typeField: cfg.typeField,
        typeValues,
        extraTypeField: cfg.extraTypeField,
        extraTypeValues,
        tierExprSql: cfg.tierExprSql,
        sort,
        offset: semantic ? 0 : offset,
        limit: semantic ? Math.max(limit * 6, 150) : limit,
      });

      const items = result.items.map(item => ({
        ...item,
        popularity: (item.clone_count || 0) + (item.play_count || 0),
      }));
      if (semantic) {
        const ranked = await semanticFilterLibraryItems(semantic, items, collection, { limit });
        return res.json({
          items: ranked.items,
          totalCount: ranked.items.length,
          dbCount: ranked.items.length,
          nextOffset: ranked.items.length,
          semanticApplied: true,
        });
      }

      return res.json({
        items,
        totalCount: result.totalCount,
        dbCount: result.totalCount,
        nextOffset: offset + items.length,
      });
    }

    const includeMirrors = false;
    const typeField = null;
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

app.post('/api/library-ai-answer', requireAuth, async (req, res) => {
  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({ error: 'Concept AI is not configured' });
  }
  const question = req.body?.question;
  if (typeof question !== 'string' || !question.trim()) {
    return res.status(400).json({ error: 'question (non-empty string) is required' });
  }

  try {
    const result = await answerLibraryQuestion(question.trim(), {
      appId: APP_ID,
      userId: req.uid,
      scope: req.body?.scope && typeof req.body.scope === 'object' ? req.body.scope : {},
    });
    return res.json(result);
  } catch (err) {
    console.error('POST /api/library-ai-answer error:', err);
    return res.status(500).json({ error: err.message || 'Library assistant failed' });
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

const CLONE_COLLECTIONS = [...SRD_COLLECTION_NAMES, 'scenes', 'adventures'];

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
  // SRD/HoD items are external (cache / fetch); migrated FCG catalog rows are public `items` with id `fcg-*`.
  const isExternal = source._source && !['own', 'public'].includes(source._source);

  try {
    // For owned items, client sends stripped payload (no base64 images) to avoid huge uploads.
    // Fetch full source from DB so the clone includes images.
    let effectiveSource = source;
    if (!isExternal && sourceId) {
      let dbSource = await getItem(APP_ID, req.uid, collection, sourceId);
      if (!dbSource && source._source === 'public') {
        const rows = await getItemsByIds(APP_ID, collection, [sourceId]);
        dbSource = rows[0] || null;
      }
      if (dbSource) effectiveSource = dbSource;
    }
    if (isExternal && sourceId && String(sourceId).startsWith('fcg-')) {
      const rows = await getItemsByIds(APP_ID, collection, [sourceId]);
      if (rows.length) effectiveSource = rows[0];
    }
    if (source._source === 'srd' && sourceId) {
      const cachedRows = await getExternalCacheByIds(APP_ID, collection, [sourceId]);
      if (cachedRows.length > 0) {
        effectiveSource = cachedRows[0];
      }
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
  if (collection !== 'adversaries' && collection !== 'environments') {
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

/** Character draft from a concept (OpenAI tool loop + resolver; levels 1–10). */
app.post('/api/character-ai-build', requireAuth, async (req, res) => {
  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({ error: 'Concept AI is not configured' });
  }
  const concept = req.body?.concept;
  if (typeof concept !== 'string' || !concept.trim()) {
    return res.status(400).json({ error: 'concept (non-empty string) is required' });
  }
  let targetLevel = 1;
  if (req.body?.targetLevel != null && req.body?.targetLevel !== '') {
    const t = Math.round(Number(req.body.targetLevel));
    if (!Number.isFinite(t) || t < 1 || t > 10) {
      return res.status(400).json({ error: 'targetLevel must be an integer from 1 to 10' });
    }
    targetLevel = t;
  }
  try {
    const result = await buildCharacterAiFromConcept(concept.trim(), {
      targetLevel,
    });
    res.json(result);
  } catch (err) {
    if (err?.code === 'BAD_REQUEST') {
      return res.status(400).json({ error: err.message });
    }
    console.error('POST /api/character-ai-build error:', err);
    res.status(500).json({ error: err.message || 'Character AI failed' });
  }
});

function parseConceptAiTier(v) {
  const t = typeof v === 'number' ? v : parseInt(String(v ?? ''), 10);
  if (Number.isNaN(t) || t < 1 || t > 4) return null;
  return t;
}

function parseConceptAiRole(v) {
  const r = String(v ?? '').toLowerCase().trim();
  return ROLES.includes(r) ? r : null;
}

function parseConceptAiEnvType(v) {
  const x = String(v ?? '').toLowerCase().trim();
  return ENV_TYPES.includes(x) ? x : null;
}

/** Adversary draft from a concept (OpenAI). Body: concept, tier (1–4), role (ROLES). */
app.post('/api/adversary-ai-build', requireAuth, async (req, res) => {
  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({ error: 'Concept AI is not configured' });
  }
  const concept = req.body?.concept;
  if (typeof concept !== 'string' || !concept.trim()) {
    return res.status(400).json({ error: 'concept (non-empty string) is required' });
  }
  const tier = parseConceptAiTier(req.body?.tier);
  const role = parseConceptAiRole(req.body?.role);
  if (tier == null || role == null) {
    return res.status(400).json({ error: 'tier (1–4) and role are required' });
  }
  try {
    const { patch, justification, warnings } = await buildAdversaryAiFromConcept(concept.trim(), { tier, role });
    res.json({ patch, justification, warnings });
  } catch (err) {
    if (err?.code === 'BAD_REQUEST') {
      return res.status(400).json({ error: err.message });
    }
    console.error('POST /api/adversary-ai-build error:', err);
    res.status(500).json({ error: err.message || 'Adversary AI failed' });
  }
});

/** Environment draft from a concept (OpenAI). Body: concept, tier (1–4), type (ENV_TYPES). */
app.post('/api/environment-ai-build', requireAuth, async (req, res) => {
  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({ error: 'Concept AI is not configured' });
  }
  const concept = req.body?.concept;
  if (typeof concept !== 'string' || !concept.trim()) {
    return res.status(400).json({ error: 'concept (non-empty string) is required' });
  }
  const tier = parseConceptAiTier(req.body?.tier);
  const type = parseConceptAiEnvType(req.body?.type);
  if (tier == null || type == null) {
    return res.status(400).json({ error: 'tier (1–4) and type are required' });
  }
  try {
    const { patch, justification, warnings } = await buildEnvironmentAiFromConcept(concept.trim(), { tier, type });
    res.json({ patch, justification, warnings });
  } catch (err) {
    if (err?.code === 'BAD_REQUEST') {
      return res.status(400).json({ error: err.message });
    }
    console.error('POST /api/environment-ai-build error:', err);
    res.status(500).json({ error: err.message || 'Environment AI failed' });
  }
});

/** Encounter plan from a concept (OpenAI). Body: concept, partySize, partyTier, remainingBattlePoints, includePublic, hasEnvironmentOnTable, tableAdversarySummary */
app.post('/api/encounter-ai-build', requireAuth, async (req, res) => {
  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({ error: 'Concept AI is not configured' });
  }
  const concept = req.body?.concept;
  if (typeof concept !== 'string' || !concept.trim()) {
    return res.status(400).json({ error: 'concept (non-empty string) is required' });
  }
  const partySize = parseInt(String(req.body?.partySize ?? ''), 10);
  const partyTier = parseInt(String(req.body?.partyTier ?? ''), 10);
  const remainingBattlePoints = parseInt(String(req.body?.remainingBattlePoints ?? ''), 10);
  if (Number.isNaN(partySize) || partySize < 1 || partySize > 12) {
    return res.status(400).json({ error: 'partySize (1–12) is required' });
  }
  if (Number.isNaN(partyTier) || partyTier < 1 || partyTier > 4) {
    return res.status(400).json({ error: 'partyTier (1–4) is required' });
  }
  if (Number.isNaN(remainingBattlePoints) || remainingBattlePoints < 0) {
    return res.status(400).json({ error: 'remainingBattlePoints (non-negative integer) is required' });
  }
  const includePublic = parseHttpBooleanLoose(req.body?.includePublic, false);
  const hasEnvironmentOnTable = !!req.body?.hasEnvironmentOnTable;
  const tableAdversarySummary = Array.isArray(req.body?.tableAdversarySummary) ? req.body.tableAdversarySummary : [];
  const stepRaw = req.body?.step;
  const step = stepRaw === 'finish' ? 'finish' : stepRaw === 'plan' ? 'plan' : 'full';
  const encounterPlan = req.body?.encounterPlan;
  try {
    const result = await buildEncounterAiFromConcept(concept.trim(), {
      appId: APP_ID,
      userId: req.uid,
      partySize,
      partyTier,
      remainingBattlePoints,
      includePublic,
      hasEnvironmentOnTable,
      tableAdversarySummary,
      step,
      encounterPlan,
    });
    const { _debug, ...rest } = result;
    res.json(rest);
  } catch (err) {
    if (err?.code === 'BAD_REQUEST') {
      return res.status(400).json({ error: err.message });
    }
    console.error('POST /api/encounter-ai-build error:', err);
    res.status(500).json({ error: err.message || 'Encounter AI failed' });
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

// --- x.ai Grok Imagine image generation ---

app.post('/api/generate-image', requireAuth, async (req, res) => {
  const { prompt } = req.body || {};
  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({ error: 'prompt is required' });
  }
  if (!xaiIsConfigured()) {
    return res.status(503).json({ error: 'Image generation is not configured (XAI_API_KEY missing)' });
  }
  const xaiModel = process.env.XAI_IMAGE_MODEL || 'grok-imagine-image';
  const t0 = Date.now();
  try {
    const result = await xaiGenerateImage(prompt.trim());
    logXaiImageUsage('image_generate', {
      ok: true,
      latencyMs: Date.now() - t0,
      model: xaiModel,
      usage: result.usage ?? null,
    });
    const { imageUrl } = result;
    res.json({ imageUrl });
  } catch (err) {
    logXaiImageUsage('image_generate', {
      ok: false,
      latencyMs: Date.now() - t0,
      model: xaiModel,
      errorCode: 'XAI_ERROR',
      usage: null,
    });
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
  if (!xaiIsConfigured()) {
    return res.status(503).json({ error: 'Image generation is not configured (XAI_API_KEY missing)' });
  }
  const xaiModel = process.env.XAI_IMAGE_MODEL || 'grok-imagine-image';
  const t0 = Date.now();
  try {
    const result = await xaiEditImage(image, prompt.trim());
    logXaiImageUsage('image_edit', {
      ok: true,
      latencyMs: Date.now() - t0,
      model: xaiModel,
      usage: result.usage ?? null,
    });
    const { imageUrl } = result;
    res.json({ imageUrl });
  } catch (err) {
    logXaiImageUsage('image_edit', {
      ok: false,
      latencyMs: Date.now() - t0,
      model: xaiModel,
      errorCode: 'XAI_ERROR',
      usage: null,
    });
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

/** Game Table Encounter panel: OCR + parse one image for adversary, environment, or note import. */
app.post('/api/import/encounter-drop', requireAuth, importUpload.single('image'), async (req, res) => {
  try {
    const kind = (req.body?.kind || '').trim();
    if (!['adversary', 'environment', 'note'].includes(kind)) {
      return res.status(400).json({ error: 'kind must be adversary, environment, or note' });
    }
    const file = req.file;
    if (!file?.buffer) {
      return res.status(400).json({ error: 'image file is required' });
    }
    const result = await parseEncounterDropBuffer(file.buffer, kind);
    res.json(result);
  } catch (err) {
    console.error('POST /api/import/encounter-drop error:', err);
    res.status(500).json({ error: err.message || 'Failed to parse encounter import' });
  }
});

app.post('/api/import/page-layout', requireAuth, importUpload.single('image'), async (req, res) => {
  try {
    const file = req.file;
    if (!file?.buffer) {
      return res.status(400).json({ error: 'image file is required' });
    }
    const layout = await analyzePageLayout(file.buffer);
    res.json(layout);
  } catch (err) {
    console.error('POST /api/import/page-layout error:', err);
    res.status(500).json({ error: err.message || 'Failed to analyze page layout' });
  }
});

/** OCR a cropped region for the encounter import modal: raw text + text-detected flag. */
app.post('/api/import/page-layout-region-ocr', requireAuth, importUpload.single('image'), async (req, res) => {
  try {
    const file = req.file;
    if (!file?.buffer) {
      return res.status(400).json({ error: 'image file is required' });
    }
    const { text, hasText } = await ocrCropRegionText(file.buffer);
    res.json({ hasText, text });
  } catch (err) {
    console.error('POST /api/import/page-layout-region-ocr error:', err);
    res.status(500).json({ error: err.message || 'Failed to classify region' });
  }
});

/** Parse OCR/plaintext for encounter import without re-running OCR (same shapes as encounter-drop). */
// Body is already parsed by the global application/json middleware (see JSON_LIMIT above); do not
// add express.json() here — it would try to read the stream again and return 500.
app.post('/api/import/encounter-parse-text', requireAuth, async (req, res) => {
  try {
    const kind = (req.body?.kind || '').trim();
    if (!['adversary', 'environment', 'note'].includes(kind)) {
      return res.status(400).json({ error: 'kind must be adversary, environment, or note' });
    }
    const text = typeof req.body?.text === 'string' ? req.body.text : '';
    const result = parseEncounterDropText(text, kind);
    res.json(result);
  } catch (err) {
    console.error('POST /api/import/encounter-parse-text error:', err);
    res.status(500).json({ error: err.message || 'Failed to parse text' });
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
    await upsertMirror(APP_ID, collection, id, { ...data, _source: _source || 'mirror' });
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

// GET /api/my-rooms — returns tables the user is invited to (per-table playerEmails)
app.get('/api/my-rooms', requireAuth, async (req, res) => {
  try {
    const rows = await getTableStatesByPlayerEmail(APP_ID, req.email);
    res.json(rows.map(r => ({
      tableId: r.tableId,
      gmUid: r.userId,
      gmName: r.data?.gmDisplayName || '',
      tableName: r.data?.tableName || (r.tableId === r.userId ? 'My Game Table' : 'Table'),
    })));
  } catch (err) {
    console.error('GET /api/my-rooms error:', err);
    res.status(500).json({ error: 'Failed to fetch rooms' });
  }
});

// GET /api/my-tables — returns tables the user owns (for nav tabs and New Table)
app.get('/api/my-tables', requireAuth, async (req, res) => {
  try {
    const rows = await listTableStates(APP_ID, req.uid);
    res.json(rows.map(r => ({
      id: r.id,
      name: r.data?.tableName || (r.id === req.uid ? 'My Game Table' : 'Table'),
    })));
  } catch (err) {
    console.error('GET /api/my-tables error:', err);
    res.status(500).json({ error: 'Failed to fetch tables' });
  }
});

// POST /api/my-tables — create a new table (empty state), return { id, name }
app.post('/api/my-tables', requireAuth, async (req, res) => {
  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ error: 'Database required' });
  }
  try {
    const name = (req.body?.name && String(req.body.name).trim()) || 'New Table';
    const { randomUUID } = await import('crypto');
    const tableId = randomUUID();
    const emptyState = { elements: [], playerEmails: [], gmDisplayName: '', tableName: name, top: { sessionStarted: false } };
    await upsertItem(APP_ID, req.uid, 'table_state', tableId, emptyState, false);
    res.status(201).json({ id: tableId, name });
  } catch (err) {
    console.error('POST /api/my-tables error:', err);
    res.status(500).json({ error: 'Failed to create table' });
  }
});

// GET /api/room/my/players — GM SSE: receive player presence, table state, banners, and dice rolls
app.get('/api/room/my/players', async (req, res) => {
  const user = await verifyTokenFromQuery(req, res);
  if (!user) return;
  const tableId = req.query.tableId || user.uid;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  req.socket.setTimeout(0);
  res.flushHeaders();

  const room = getOrCreateRoom(tableId);
  room.gmClients.add(res);

  const presence = [...room.players.entries()].map(([uid, p]) => ({ uid, name: p.name, email: p.email, photoURL: p.photoURL }));
  res.write(`event: presence\ndata: ${JSON.stringify({ players: presence })}\n\n`);

  try {
    const rolls = await getRecentDiceRolls(APP_ID, user.uid);
    if (rolls.length > 0) {
      res.write(`event: roll-history\ndata: ${JSON.stringify({ rolls })}\n\n`);
    }
  } catch (err) {
    console.error('[dice] roll-history fetch failed:', err.message);
    const fallback = gmRollLogs.get(user.uid);
    if (fallback?.length > 0) {
      res.write(`event: roll-history\ndata: ${JSON.stringify({ rolls: fallback })}\n\n`);
    }
  }
  res.flush?.();

  subscriptionManager.subscribe('banners', user.uid, res);
  subscriptionManager.subscribe('table_state', tableId, res, { tableStateAudience: 'gm' });

  // Send any current pending player intent so GM sees it on reconnect
  const existingIntent = pendingIntents.get(tableId);
  if (existingIntent) {
    res.write(`event: intent\ndata: ${JSON.stringify(existingIntent)}\n\n`);
    res.flush?.();
  }

  const heartbeat = setInterval(() => { res.write(':heartbeat\n\n'); res.flush?.(); }, 30000);
  req.on('close', () => {
    clearInterval(heartbeat);
    room.gmClients.delete(res);
    subscriptionManager.unsubscribe('banners', user.uid, res);
    subscriptionManager.unsubscribe('table_state', tableId, res);
  });
});

// GET /api/room/:tableId/stream — Player SSE: receive table state and events for a specific table
app.get('/api/room/:tableId/stream', async (req, res) => {
  const { tableId } = req.params;
  const user = await verifyTokenFromQuery(req, res);
  if (!user) return;
  try {
    const row = await getTableStateById(APP_ID, tableId);
    if (!row) return res.status(404).json({ error: 'Table not found' });
    const { userId: gmUid, data: tableState } = row;
    const playerEmails = tableState?.playerEmails || [];
    if (!playerEmails.includes(user.email)) {
      return res.status(403).json({ error: 'Not invited to this table' });
    }
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    req.socket.setTimeout(0);
    res.flushHeaders();

    const room = getOrCreateRoom(tableId);
    room.players.set(user.uid, { res, name: user.name, email: user.email, photoURL: user.picture });

    const presence = [...room.players.entries()].map(([uid, p]) => ({ uid, name: p.name, email: p.email, photoURL: p.photoURL }));
    res.write(`event: presence\ndata: ${JSON.stringify({ players: presence })}\n\n`);

    try {
      const rolls = await getRecentDiceRolls(APP_ID, gmUid);
      if (rolls.length > 0) {
        res.write(`event: roll-history\ndata: ${JSON.stringify({ rolls })}\n\n`);
      }
    } catch (err) {
      console.error('[dice] roll-history fetch failed:', err.message);
      const fallback = gmRollLogs.get(gmUid);
      if (fallback?.length > 0) {
        res.write(`event: roll-history\ndata: ${JSON.stringify({ rolls: fallback })}\n\n`);
      }
    }
    res.flush?.();

    subscriptionManager.subscribe('banners', gmUid, res);
    subscriptionManager.subscribe('table_state', tableId, res, { tableStateAudience: 'player' });

    broadcastPresenceToTable(tableId);

    const heartbeat = setInterval(() => { res.write(':heartbeat\n\n'); res.flush?.(); }, 30000);
    req.on('close', () => {
      clearInterval(heartbeat);
      room.players.delete(user.uid);
      subscriptionManager.unsubscribe('banners', gmUid, res);
      subscriptionManager.unsubscribe('table_state', tableId, res);
      broadcastPresenceToTable(tableId);
    });
  } catch (err) {
    console.error(`GET /api/room/${tableId}/stream error:`, err);
    if (!res.headersSent) res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/room/my/map-ping — GM broadcast map click ripple (SSE `map_ping` to all; not persisted).
app.post('/api/room/my/map-ping', requireAuth, async (req, res) => {
  const { tableId: bodyTableId, xFt, yFt, mapId } = req.body || {};
  const tid = bodyTableId || req.uid;
  const row = await getTableStateById(APP_ID, tid);
  if (!row || row.userId !== req.uid) {
    return res.status(403).json({ error: 'Not your table' });
  }
  const x = Number(xFt);
  const y = Number(yFt);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return res.status(400).json({ error: 'Invalid coordinates' });
  }
  const displayName = await resolveDisplayNameForMapPing(req);
  const payload = {
    id: randomUUID(),
    xFt: x,
    yFt: y,
    displayName,
    mapId: mapId != null && mapId !== '' ? String(mapId) : null,
    tsMs: Date.now(),
  };
  broadcastMapPingToTable(tid, payload);
  res.json({ ok: true, ping: payload });
});

// POST /api/room/:tableId/map-ping — invited player broadcast map click ripple (same as GM).
app.post('/api/room/:tableId/map-ping', requireAuth, async (req, res) => {
  const ctx = await resolveTableAccess(APP_ID, req.params.tableId, req);
  if (ctx.error) return res.status(ctx.error).json({ error: ctx.message });
  const { xFt, yFt, mapId } = req.body || {};
  const x = Number(xFt);
  const y = Number(yFt);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return res.status(400).json({ error: 'Invalid coordinates' });
  }
  const displayName = await resolveDisplayNameForMapPing(req);
  const payload = {
    id: randomUUID(),
    xFt: x,
    yFt: y,
    displayName,
    mapId: mapId != null && mapId !== '' ? String(mapId) : null,
    tsMs: Date.now(),
  };
  broadcastMapPingToTable(ctx.tableId, payload);
  res.json({ ok: true, ping: payload });
});

function validateMapScribbleBody(body) {
  if (!body || typeof body !== 'object') return null;
  const id = typeof body.id === 'string' && body.id.length <= 80 ? body.id : null;
  const _clientId = typeof body._clientId === 'string' && body._clientId.length <= 80 ? body._clientId : null;
  const strokeId = typeof body.strokeId === 'string' && body.strokeId.length <= 80 ? body.strokeId : null;
  const mapId = body.mapId != null && body.mapId !== '' ? String(body.mapId) : null;
  const t0 = Number(body.t0);
  const kind = body.kind === 'dot' || body.kind === 'segment' ? body.kind : null;
  const rgba = typeof body.rgba === 'string' && body.rgba.length <= 80 ? body.rgba : null;
  const rFt = Number(body.rFt);
  if (!id || !_clientId || !strokeId || !kind || !rgba || !Number.isFinite(t0) || !Number.isFinite(rFt) || rFt <= 0 || rFt > 5000) {
    return null;
  }
  if (kind === 'dot') {
    const xFt = Number(body.xFt);
    const yFt = Number(body.yFt);
    if (!Number.isFinite(xFt) || !Number.isFinite(yFt)) return null;
    return { id, _clientId, strokeId, mapId, t0, kind, rgba, rFt, xFt, yFt };
  }
  const x0Ft = Number(body.x0Ft);
  const y0Ft = Number(body.y0Ft);
  const x1Ft = Number(body.x1Ft);
  const y1Ft = Number(body.y1Ft);
  if (![x0Ft, y0Ft, x1Ft, y1Ft].every(Number.isFinite)) return null;
  return { id, _clientId, strokeId, mapId, t0, kind, rgba, rFt, x0Ft, y0Ft, x1Ft, y1Ft };
}

// POST /api/room/my/map-scribble — GM broadcast ephemeral scribble stroke (SSE `map_scribble`).
app.post('/api/room/my/map-scribble', requireAuth, async (req, res) => {
  const { tableId: bodyTableId, ...rest } = req.body || {};
  const tid = bodyTableId || req.uid;
  const row = await getTableStateById(APP_ID, tid);
  if (!row || row.userId !== req.uid) {
    return res.status(403).json({ error: 'Not your table' });
  }
  const payload = validateMapScribbleBody(rest);
  if (!payload) {
    return res.status(400).json({ error: 'Invalid scribble payload' });
  }
  broadcastMapScribbleToTable(tid, payload);
  res.json({ ok: true });
});

// POST /api/room/:tableId/map-scribble — player broadcast (same as GM).
app.post('/api/room/:tableId/map-scribble', requireAuth, async (req, res) => {
  const ctx = await resolveTableAccess(APP_ID, req.params.tableId, req);
  if (ctx.error) return res.status(ctx.error).json({ error: ctx.message });
  const payload = validateMapScribbleBody(req.body || {});
  if (!payload) {
    return res.status(400).json({ error: 'Invalid scribble payload' });
  }
  broadcastMapScribbleToTable(ctx.tableId, payload);
  res.json({ ok: true });
});

// POST /api/room/my/roll — GM rolls dice server-side; persists to DB, returns result.
// When silent is true: build and return roll data only (no DB write, no banner notification).
app.post('/api/room/my/roll', requireAuth, async (req, res) => {
  const { rollText, displayName, _clientId, silent, tableId: bodyTableId, bypassPrepGate, ...extraMeta } = req.body;
  if (!rollText) return res.status(400).json({ error: 'rollText is required' });
  const rollData = buildRollData(rollText, displayName, _clientId, extraMeta);
  if (!rollData) {
    return res.status(400).json({ error: 'No dice expressions found in rollText' });
  }
  if (!silent) {
    const tid = bodyTableId || req.uid;
    if (!(await assertGmTableSessionActive(tid, req.uid, res, { bypassPrepGate: bypassPrepGate === true }))) return;
    await appendRollLog(req.uid, rollData);
    if (process.env.DATABASE_URL && bypassPrepGate !== true) {
      try {
        await applyOpToTableState(tid, { op: 'touch-session-activity' });
      } catch {
        /* ignore */
      }
    }
  }
  res.json(rollData);
});

// POST /api/room/my/action — GM persists an action notification; clients learn of it via the banners subscription.
// (no dice rolling; used for feature announcements, session cycle notifications, etc.)
app.post('/api/room/my/action', requireAuth, async (req, res) => {
  const { _clientId, tableId: bodyTableId, bypassPrepGate, ...notification } = req.body;
  const tid = bodyTableId || req.uid;
  const row = await getTableStateById(APP_ID, tid);
  if (!row || row.userId !== req.uid) {
    return res.status(403).json({ error: 'Not your table' });
  }
  if (!isTablePlayAllowed(row.data || {}) && !notification._sessionStart && bypassPrepGate !== true) {
    const paused = row.data?.top?.sessionPaused === true;
    return res.status(400).json({
      error: paused ? 'Session paused' : 'Session not started',
      playBlocked: paused ? 'paused' : 'prep',
    });
  }
  if (!notification._action) notification._action = true;
  const payload = { ...notification, _clientId: _clientId || null };
  await appendRollLog(req.uid, payload);
  res.json({ ok: true, _rollDbId: payload._rollDbId ?? null });
});

// POST /api/room/:tableId/action — Player broadcasts an action notification to the table
app.post('/api/room/:tableId/action', requireAuth, async (req, res) => {
  const ctx = await resolveTableAccess(APP_ID, req.params.tableId, req);
  if (ctx.error) return res.status(ctx.error).json({ error: ctx.message });
  const { gmUid } = ctx;
  const { _clientId, bypassPrepGate: _playerBypassIgnored, ...notification } = req.body;
  try {
    if (!isTablePlayAllowed(ctx.tableState) && !notification._sessionStart) {
      const paused = ctx.tableState?.top?.sessionPaused === true;
      return res.status(400).json({
        error: paused ? 'Session paused' : 'Session not started',
        playBlocked: paused ? 'paused' : 'prep',
      });
    }
    if (!notification._action) notification._action = true;
    const payload = { ...notification, _clientId: _clientId || null, _initiatorUid: req.uid };
    await appendRollLog(gmUid, payload);
    res.json({ ok: true, _rollDbId: payload._rollDbId ?? null });
  } catch (err) {
    console.error('POST /api/room/:tableId/action error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/room/my/banner-ack — GM acknowledges or cancels a banner.
// Updates DB status; the subscription manager pushes an updated banners snapshot to all clients.
// When action is 'acknowledge' and wingsOfLightD8 is true, server deducts 1 Hope from the roll's
// _attackerInstanceId, rolls 1d8, and returns wingsOfLightD8Result (banner is also marked acknowledged).
app.post('/api/room/my/banner-ack', requireAuth, async (req, res) => {
  const { bannerId, action, wingsOfLightD8, tableId: bodyTableId } = req.body;
  const tableId = bodyTableId || req.uid;
  let wingsOfLightD8Result = null;

  if (action === 'acknowledge' && wingsOfLightD8 && bannerId && process.env.DATABASE_URL) {
    try {
      const row = await getDiceRollById(APP_ID, req.uid, bannerId);
      if (row && row.status === 'pending' && row.data?._wingsOfLightAddD8 && row.data._wingsOfLightD8Result == null && row.data._attackerInstanceId) {
        const tableRow = await getTableStateById(APP_ID, tableId);
        if (tableRow && tableRow.userId === req.uid) {
          const elements = (tableRow.data?.elements) || [];
          const charEl = elements.find(e => e.elementType === 'character' && e.instanceId === row.data._attackerInstanceId);
          const maxHope = charEl?.maxHope ?? 6;
          const currentHope = charEl?.hope ?? maxHope;
          if (currentHope >= 1) {
            const newHope = Math.max(0, currentHope - 1);
            await applyOpToTableState(tableId, { op: 'update-element', instanceId: row.data._attackerInstanceId, updates: { hope: newHope } });
            wingsOfLightD8Result = randomInt(1, 9);
          }
        }
      }
    } catch (err) {
      console.error('[banner-ack] wingsOfLightD8 error:', err.message);
    }
  }

  if (action === 'acknowledge' && bannerId && process.env.DATABASE_URL) {
    try {
      const row = await getDiceRollById(APP_ID, req.uid, bannerId);
      if (row && row.status === 'pending' && row.data?._rest === true) {
        const tableRow = await getTableStateById(APP_ID, tableId);
        if (tableRow && tableRow.userId === req.uid) {
          const state = tableRow.data || {};
          const elements = state.elements || state.activeElements || [];
          const characterCount = elements.filter(e => e.elementType === 'character').length;
          const total = typeof row.data.total === 'number' ? row.data.total : 0;
          const fearDelta = row.data._restDuration === 'long' ? total + characterCount : total;
          const currentFear = state.fearCount ?? 0;
          const newFear = Math.min(12, currentFear + fearDelta);
          await applyOpToTableState(tableId, { op: 'set-fear', fearCount: newFear });
        }
      }
    } catch (err) {
      console.error('[banner-ack] rest fear error:', err.message);
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
  const { rollText, displayName, previousSubItems, tableId: bodyTableId, ...extraMeta } = req.body;
  const tid = bodyTableId || req.uid;
  if (!(await assertGmTableSessionActive(tid, req.uid, res))) return;
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
  const { rollText, displayName, previousSubItems, tableId: bodyTableId, ...extraMeta } = req.body;
  const tid = bodyTableId || req.uid;
  if (!(await assertGmTableSessionActive(tid, req.uid, res))) return;
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

// POST /api/room/:tableId/banner-feline-reroll-request — Player: toggle _felineRerollRequestedBy on banner (set to uid or clear if already self).
app.post('/api/room/:tableId/banner-feline-reroll-request', requireAuth, async (req, res) => {
  const ctx = await resolveTableAccess(APP_ID, req.params.tableId, req);
  if (ctx.error) return res.status(ctx.error).json({ error: ctx.message });
  const { gmUid } = ctx;
  const bannerId = req.body?.bannerId != null ? Number(req.body.bannerId) : null;
  if (req.uid === gmUid || bannerId == null || Number.isNaN(bannerId)) {
    return res.status(400).json({ error: 'Invalid request' });
  }
  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ error: 'Requires database' });
  }
  try {
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
    console.error('POST /api/room/:tableId/banner-feline-reroll-request error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/room/:tableId/banner-ranger-focus-reroll-request — Player: toggle _rangerFocusRerollRequestedBy on banner.
app.post('/api/room/:tableId/banner-ranger-focus-reroll-request', requireAuth, async (req, res) => {
  const ctx = await resolveTableAccess(APP_ID, req.params.tableId, req);
  if (ctx.error) return res.status(ctx.error).json({ error: ctx.message });
  const { gmUid } = ctx;
  const bannerId = req.body?.bannerId != null ? Number(req.body.bannerId) : null;
  if (req.uid === gmUid || bannerId == null || Number.isNaN(bannerId)) {
    return res.status(400).json({ error: 'Invalid request' });
  }
  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ error: 'Requires database' });
  }
  try {
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
    console.error('POST /api/room/:tableId/banner-ranger-focus-reroll-request error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/room/my/banner-wings-d8 — GM: Wings of Light — spend 1 Hope and roll 1d8, patch banner with _wingsOfLightAddD8 and _wingsOfLightD8Result.
app.post('/api/room/my/banner-wings-d8', requireAuth, async (req, res) => {
  const tableId = req.body?.tableId || req.uid;
  const bannerId = req.body?.bannerId != null ? Number(req.body.bannerId) : null;
  if (bannerId == null || Number.isNaN(bannerId) || !process.env.DATABASE_URL) {
    return res.status(400).json({ error: 'bannerId required' });
  }
  try {
    const tableRow = await getTableStateById(APP_ID, tableId);
    if (!tableRow || tableRow.userId !== req.uid) {
      return res.status(403).json({ error: 'Not your table' });
    }
    const row = await getDiceRollById(APP_ID, req.uid, bannerId);
    if (!row || row.status !== 'pending' || !row.data?._attackerInstanceId) {
      return res.status(404).json({ error: 'Banner not found or not a character attack' });
    }
    const elements = (tableRow.data?.elements) || [];
    const charEl = elements.find(e => e.elementType === 'character' && e.instanceId === row.data._attackerInstanceId);
    const maxHope = charEl?.maxHope ?? 6;
    const currentHope = charEl?.hope ?? maxHope;
    if (currentHope < 1) {
      return res.status(400).json({ error: 'Character has no Hope to spend' });
    }
    const newHope = Math.max(0, currentHope - 1);
    await applyOpToTableState(tableId, { op: 'update-element', instanceId: row.data._attackerInstanceId, updates: { hope: newHope } });
    const d8Result = randomInt(1, 9);
    await updateDiceRollData(APP_ID, req.uid, bannerId, { _wingsOfLightAddD8: true, _wingsOfLightD8Result: d8Result });
    subscriptionManager.notifyChange('banners', req.uid);
    res.json({ ok: true, d8Result });
  } catch (err) {
    console.error('POST /api/room/my/banner-wings-d8 error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/room/:tableId/banner-wings-d8-toggle — Player: toggle _wingsOfLightAddD8 on a banner (shared state; no Hope spend or roll).
app.post('/api/room/:tableId/banner-wings-d8-toggle', requireAuth, async (req, res) => {
  const ctx = await resolveTableAccess(APP_ID, req.params.tableId, req);
  if (ctx.error) return res.status(ctx.error).json({ error: ctx.message });
  const { gmUid } = ctx;
  const bannerId = req.body?.bannerId != null ? Number(req.body.bannerId) : null;
  const value = req.body?.value === true;
  if (req.uid === gmUid || bannerId == null || Number.isNaN(bannerId)) {
    return res.status(400).json({ error: 'Invalid request' });
  }
  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ error: 'Requires database' });
  }
  try {
    const row = await getDiceRollById(APP_ID, gmUid, bannerId);
    if (!row || row.status !== 'pending') {
      return res.status(404).json({ error: 'Banner not found or already resolved' });
    }
    await updateDiceRollData(APP_ID, gmUid, bannerId, { _wingsOfLightAddD8: value });
    subscriptionManager.notifyChange('banners', gmUid);
    res.json({ ok: true, value });
  } catch (err) {
    console.error('POST /api/room/:tableId/banner-wings-d8-toggle error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/room/:tableId/banner-hold-them-off — GM or player: toggle Hold Them Off (3 Hope, select up to 3 targets) on a banner.
app.post('/api/room/:tableId/banner-hold-them-off', requireAuth, async (req, res) => {
  const ctx = await resolveTableAccess(APP_ID, req.params.tableId, req);
  if (ctx.error) return res.status(ctx.error).json({ error: ctx.message });
  const { tableId, gmUid } = ctx;
  const bannerId = req.body?.bannerId != null ? Number(req.body.bannerId) : null;
  const active = req.body?.active === true;
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
    await updateDiceRollData(APP_ID, gmUid, bannerId, { _holdThemOffActive: active });
    subscriptionManager.notifyChange('banners', gmUid);
    res.json({ ok: true, active });
  } catch (err) {
    console.error('POST /api/room/:tableId/banner-hold-them-off error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/room/:tableId/banner-targets — GM or player: set multi-target selection on a pending banner (synced across clients).
app.post('/api/room/:tableId/banner-targets', requireAuth, async (req, res) => {
  const ctx = await resolveTableAccess(APP_ID, req.params.tableId, req);
  if (ctx.error) return res.status(ctx.error).json({ error: ctx.message });
  const { gmUid } = ctx;
  const bannerId = req.body?.bannerId != null ? Number(req.body.bannerId) : null;
  const { selectedTargetInstanceIds, useArmorByTargetId, useImpenetrableByTargetId, hopefulArmorInsteadByInstanceId } = req.body || {};
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
    const patch = {};
    if (Array.isArray(selectedTargetInstanceIds)) {
      patch._selectedTargetInstanceIds = selectedTargetInstanceIds;
      patch._selectedTargetInstanceId = selectedTargetInstanceIds.length === 1 ? selectedTargetInstanceIds[0] : null;
    }
    if (useArmorByTargetId != null && typeof useArmorByTargetId === 'object') patch._useArmorByTargetId = useArmorByTargetId;
    if (useImpenetrableByTargetId != null && typeof useImpenetrableByTargetId === 'object') patch._useImpenetrableByTargetId = useImpenetrableByTargetId;
    if (hopefulArmorInsteadByInstanceId != null && typeof hopefulArmorInsteadByInstanceId === 'object') patch._hopefulArmorInsteadByInstanceId = hopefulArmorInsteadByInstanceId;
    if (Object.keys(patch).length === 0) return res.json({ ok: true });
    await updateDiceRollData(APP_ID, gmUid, bannerId, patch);
    subscriptionManager.notifyChange('banners', gmUid);
    res.json({ ok: true });
  } catch (err) {
    console.error('POST /api/room/:tableId/banner-targets error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/room/:tableId/banner-make-a-scene-target — GM or player: set the target adversary for a Make a Scene banner.
app.post('/api/room/:tableId/banner-make-a-scene-target', requireAuth, async (req, res) => {
  const ctx = await resolveTableAccess(APP_ID, req.params.tableId, req);
  if (ctx.error) return res.status(ctx.error).json({ error: ctx.message });
  const { gmUid } = ctx;
  const bannerId = req.body?.bannerId != null ? Number(req.body.bannerId) : null;
  const instanceId = req.body?.instanceId ?? null;
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
    await updateDiceRollData(APP_ID, gmUid, bannerId, { _selectedTargetInstanceId: instanceId });
    subscriptionManager.notifyChange('banners', gmUid);
    res.json({ ok: true, instanceId });
  } catch (err) {
    console.error('POST /api/room/:tableId/banner-make-a-scene-target error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/room/my/banner-action-add-die — GM: V2 action-pool bonus die (e.g. Heart of a Poet). Rolls die, splices sub-item, recomputes total. Does not spend Hope (client already applied).
app.post('/api/room/my/banner-action-add-die', requireAuth, async (req, res) => {
  const tableId = req.body?.tableId || req.uid;
  const bannerId = req.body?.bannerId != null ? Number(req.body.bannerId) : null;
  const dieExpr = parseAllowedV2ActionDieExpr(req.body?.die);
  const label = String(req.body?.name ?? 'Bonus').trim().slice(0, 120) || 'Bonus';
  if (bannerId == null || Number.isNaN(bannerId) || !dieExpr) {
    return res.status(400).json({ error: 'bannerId and valid die required' });
  }
  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ error: 'Requires database' });
  }
  try {
    const tableRow = await getTableStateById(APP_ID, tableId);
    if (!tableRow || tableRow.userId !== req.uid) {
      return res.status(403).json({ error: 'Not your table' });
    }
    if (!isTablePlayAllowed(tableRow.data || {})) {
      const paused = tableRow.data?.top?.sessionPaused === true;
      return res.status(400).json({
        error: paused ? 'Session paused' : 'Session not started',
        playBlocked: paused ? 'paused' : 'prep',
      });
    }
    const row = await getDiceRollById(APP_ID, req.uid, bannerId);
    if (!row || row.status !== 'pending') {
      return res.status(404).json({ error: 'Banner not found or already resolved' });
    }
    const rolled = rollDice(dieExpr);
    if (!rolled) {
      return res.status(400).json({ error: 'Could not roll die' });
    }
    const originalData = row.data || {};
    const origSubItems = Array.isArray(originalData.subItems) ? originalData.subItems : [];
    const subItem = {
      pre: label,
      input: rolled.input,
      result: String(rolled.result),
      details: rolled.details,
      post: '',
    };
    const fearIdx = origSubItems.findIndex(s => /fear/i.test(s.pre || ''));
    const insertIdx = fearIdx >= 0 ? fearIdx + 1 : origSubItems.findIndex(s => /damage/i.test(s.pre || ''));
    const newSubItems =
      insertIdx >= 0
        ? [...origSubItems.slice(0, insertIdx), subItem, ...origSubItems.slice(insertIdx)]
        : [...origSubItems, subItem];

    const dh = parseDaggerheartResult(newSubItems);
    const patch = { subItems: newSubItems, timestamp: Date.now() };
    if (dh) {
      Object.assign(patch, {
        total: dh.total,
        hopeResult: dh.hopeResult,
        fearResult: dh.fearResult,
        dominant: dh.dominant,
        rollUser: dh.characterName || originalData.rollUser || '',
      });
    } else {
      let total = 0;
      for (const sub of newSubItems) {
        if (/damage/i.test(sub.pre || '')) continue;
        if (EXTRA_PRE_RE.test(sub.pre || '')) continue;
        const v = parseInt(sub.result, 10);
        if (!isNaN(v)) total += v;
      }
      patch.total = total;
      if (originalData.rollUser) patch.rollUser = originalData.rollUser;
    }
    const ok = await updateDiceRollData(APP_ID, req.uid, bannerId, patch);
    if (!ok) {
      return res.status(404).json({ error: 'Banner not found or already resolved' });
    }
    subscriptionManager.notifyChange('banners', req.uid);
    res.json({ ok: true, result: rolled.result });
  } catch (err) {
    console.error('POST /api/room/my/banner-action-add-die error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/room/my/banner-action-add-static — GM: V2 action-pool static bonus (e.g. Seraph Prayer Die face value). In-place patch; no re-roll.
app.post('/api/room/my/banner-action-add-static', requireAuth, async (req, res) => {
  const tableId = req.body?.tableId || req.uid;
  const bannerId = req.body?.bannerId != null ? Number(req.body.bannerId) : null;
  const label = String(req.body?.name ?? 'Bonus').trim().slice(0, 120) || 'Bonus';
  const rawVal = req.body?.value;
  const value = typeof rawVal === 'number' ? rawVal : parseInt(String(rawVal ?? '').trim(), 10);
  if (bannerId == null || Number.isNaN(bannerId) || !Number.isFinite(value) || value < -999 || value > 999) {
    return res.status(400).json({ error: 'bannerId and numeric value required' });
  }
  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ error: 'Requires database' });
  }
  try {
    const tableRow = await getTableStateById(APP_ID, tableId);
    if (!tableRow || tableRow.userId !== req.uid) {
      return res.status(403).json({ error: 'Not your table' });
    }
    if (!isTablePlayAllowed(tableRow.data || {})) {
      const paused = tableRow.data?.top?.sessionPaused === true;
      return res.status(400).json({
        error: paused ? 'Session paused' : 'Session not started',
        playBlocked: paused ? 'paused' : 'prep',
      });
    }
    const row = await getDiceRollById(APP_ID, req.uid, bannerId);
    if (!row || row.status !== 'pending') {
      return res.status(404).json({ error: 'Banner not found or already resolved' });
    }
    const originalData = row.data || {};
    const origSubItems = Array.isArray(originalData.subItems) ? originalData.subItems : [];
    const subItem = {
      pre: label,
      input: String(value),
      result: String(value),
      details: '',
      post: '',
    };
    const fearIdx = origSubItems.findIndex(s => /fear/i.test(s.pre || ''));
    const insertIdx = fearIdx >= 0 ? fearIdx + 1 : origSubItems.findIndex(s => /damage/i.test(s.pre || ''));
    const newSubItems =
      insertIdx >= 0
        ? [...origSubItems.slice(0, insertIdx), subItem, ...origSubItems.slice(insertIdx)]
        : [...origSubItems, subItem];

    const dh = parseDaggerheartResult(newSubItems);
    const patch = { subItems: newSubItems, timestamp: Date.now() };
    if (dh) {
      Object.assign(patch, {
        total: dh.total,
        hopeResult: dh.hopeResult,
        fearResult: dh.fearResult,
        dominant: dh.dominant,
        rollUser: dh.characterName || originalData.rollUser || '',
      });
    } else {
      let total = 0;
      for (const sub of newSubItems) {
        if (/damage/i.test(sub.pre || '')) continue;
        if (EXTRA_PRE_RE.test(sub.pre || '')) continue;
        const v = parseInt(sub.result, 10);
        if (!isNaN(v)) total += v;
      }
      patch.total = total;
      if (originalData.rollUser) patch.rollUser = originalData.rollUser;
    }
    const ok = await updateDiceRollData(APP_ID, req.uid, bannerId, patch);
    if (!ok) {
      return res.status(404).json({ error: 'Banner not found or already resolved' });
    }
    subscriptionManager.notifyChange('banners', req.uid);
    res.json({ ok: true, value });
  } catch (err) {
    console.error('POST /api/room/my/banner-action-add-static error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/room/:tableId/banner-cancel — Player cancels their own pending banner (GM has not acked/cancelled yet).
app.post('/api/room/:tableId/banner-cancel', requireAuth, async (req, res) => {
  const ctx = await resolveTableAccess(APP_ID, req.params.tableId, req);
  if (ctx.error) return res.status(ctx.error).json({ error: ctx.message });
  const { gmUid } = ctx;
  const bannerId = req.body?.bannerId != null ? Number(req.body.bannerId) : null;
  if (req.uid === gmUid || bannerId == null || Number.isNaN(bannerId)) {
    return res.status(400).json({ error: 'Invalid request' });
  }
  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ error: 'Player banner cancel requires database' });
  }
  try {
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
    console.error('POST /api/room/:tableId/banner-cancel error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/room/:tableId/banner-chip-resolve — GM or player in room: set _chipResolved[stateKey] = 'ack' | 'reject' for ancestry chip.
app.post('/api/room/:tableId/banner-chip-resolve', requireAuth, async (req, res) => {
  const ctx = await resolveTableAccess(APP_ID, req.params.tableId, req);
  if (ctx.error) return res.status(ctx.error).json({ error: ctx.message });
  const { gmUid } = ctx;
  const bannerId = req.body?.bannerId != null ? Number(req.body.bannerId) : null;
  const stateKey = req.body?.stateKey;
  const action = req.body?.action; // 'ack' | 'reject'
  if (bannerId == null || Number.isNaN(bannerId) || !stateKey || (action !== 'ack' && action !== 'reject')) {
    return res.status(400).json({ error: 'bannerId, stateKey, and action (ack|reject) required' });
  }
  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ error: 'Requires database' });
  }
  try {
    const row = await getDiceRollById(APP_ID, gmUid, bannerId);
    if (!row || row.status !== 'pending') {
      return res.status(404).json({ error: 'Banner not found or already resolved' });
    }
    const resolved = { ...(row.data._chipResolved || {}), [stateKey]: action };
    const extraPatch = req.body?.extraPatch && typeof req.body.extraPatch === 'object' ? req.body.extraPatch : {};
    const allowedExtra = {};
    if (extraPatch._damageTotalOverride != null) allowedExtra._damageTotalOverride = extraPatch._damageTotalOverride;
    if (extraPatch._hpLossReduction != null) allowedExtra._hpLossReduction = extraPatch._hpLossReduction;
    if (extraPatch._treatAsMissForTarget != null) allowedExtra._treatAsMissForTarget = extraPatch._treatAsMissForTarget;
    await updateDiceRollData(APP_ID, gmUid, bannerId, { _chipResolved: resolved, ...allowedExtra });
    subscriptionManager.notifyChange('banners', gmUid);
    res.json({ ok: true });
  } catch (err) {
    console.error('POST /api/room/:tableId/banner-chip-resolve error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/room/my/banner-add-damage — GM: ancestry chip added extra damage (e.g. Faun Kick). Cancel original, append augmented roll.
app.post('/api/room/my/banner-add-damage', requireAuth, async (req, res) => {
  const gmUid = req.uid;
  const bannerId = req.body?.bannerId != null ? Number(req.body.bannerId) : null;
  const extraDamage = req.body?.extraDamage; // e.g. '2d6'
  const extraDamageLabel = req.body?.extraDamageLabel || 'Kick';
  const narration = req.body?.narration;
  const suppressAncestryFeature = req.body?.suppressAncestryFeature; // e.g. 'Kick' — only that chip is hidden on new banner
  if (bannerId == null || Number.isNaN(bannerId) || !extraDamage) {
    return res.status(400).json({ error: 'bannerId and extraDamage required' });
  }
  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ error: 'Requires database' });
  }
  try {
    const tid = req.body?.tableId || req.uid;
    if (!(await assertGmTableSessionActive(tid, req.uid, res))) return;
    const row = await getDiceRollById(APP_ID, gmUid, bannerId);
    if (!row || row.status !== 'pending') {
      return res.status(404).json({ error: 'Banner not found or already resolved' });
    }
    const copyData = buildAugmentedRollWithExtraDamage(row.data, extraDamage, extraDamageLabel, narration, suppressAncestryFeature);
    if (!copyData) {
      return res.status(400).json({ error: 'Invalid extraDamage expression' });
    }
    copyData._replacedRollDbId = bannerId;
    await setBannerStatus(bannerId, 'cancelled');
    const dbId = await appendDiceRoll(APP_ID, gmUid, copyData);
    copyData._rollDbId = dbId;
    subscriptionManager.notifyChange('banners', gmUid);
    res.json({ roll: copyData });
  } catch (err) {
    console.error('POST /api/room/my/banner-add-damage error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/room/my/banner-reroll-die — GM: ancestry chip requested reroll of one or both duality dice.
// dieType: 'Hope' | 'Fear' | 'Duality'. Cancel original, append replacement; suppress only the triggering chip.
app.post('/api/room/my/banner-reroll-die', requireAuth, async (req, res) => {
  const gmUid = req.uid;
  const bannerId = req.body?.bannerId != null ? Number(req.body.bannerId) : null;
  const dieType = req.body?.dieType; // 'Hope' | 'Fear' | 'Duality'
  const suppressAncestryFeature = req.body?.suppressAncestryFeature;
  if (bannerId == null || Number.isNaN(bannerId) || !dieType) {
    return res.status(400).json({ error: 'bannerId and dieType required' });
  }
  if (dieType !== 'Hope' && dieType !== 'Fear' && dieType !== 'Duality') {
    return res.status(400).json({ error: 'dieType must be Hope, Fear, or Duality' });
  }
  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ error: 'Requires database' });
  }
  try {
    const tid = req.body?.tableId || req.uid;
    if (!(await assertGmTableSessionActive(tid, req.uid, res))) return;
    const row = await getDiceRollById(APP_ID, gmUid, bannerId);
    if (!row || row.status !== 'pending') {
      return res.status(404).json({ error: 'Banner not found or already resolved' });
    }
    const copyData = dieType === 'Duality'
      ? buildRerollDualityRoll(row.data, suppressAncestryFeature ?? null)
      : buildRerollDieRoll(row.data, dieType, suppressAncestryFeature ?? null);
    copyData._replacedRollDbId = bannerId;
    await setBannerStatus(bannerId, 'cancelled');
    const dbId = await appendDiceRoll(APP_ID, gmUid, copyData);
    copyData._rollDbId = dbId;
    subscriptionManager.notifyChange('banners', gmUid);
    res.json({ roll: copyData });
  } catch (err) {
    console.error('POST /api/room/my/banner-reroll-die error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/room/:tableId/life-support-select — Player or GM sets Life Support target selection (syncs to all clients).
app.post('/api/room/:tableId/life-support-select', requireAuth, async (req, res) => {
  const ctx = await resolveTableAccess(APP_ID, req.params.tableId, req);
  if (ctx.error) return res.status(ctx.error).json({ error: ctx.message });
  const { tableId } = ctx;
  const { _rollDbId, selectedLifeSupportTargetInstanceId } = req.body || {};
  if (_rollDbId == null) {
    return res.status(400).json({ error: '_rollDbId required' });
  }
  try {
    await applyOpToTableState(tableId, {
      op: 'life-support-select',
      _rollDbId,
      selectedLifeSupportTargetInstanceId,
    });
    res.json({ ok: true });
  } catch (err) {
    if (err?.statusCode === 400) {
      return res.status(400).json({ error: err.message || 'Bad request' });
    }
    console.error('POST /api/room/:tableId/life-support-select error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/room/:tableId/rest-move-select — GM or player sets a rest move for a character (syncs to all clients).
app.post('/api/room/:tableId/rest-move-select', requireAuth, async (req, res) => {
  const ctx = await resolveTableAccess(APP_ID, req.params.tableId, req);
  if (ctx.error) return res.status(ctx.error).json({ error: ctx.message });
  const { tableId, gmUid, tableState } = ctx;
  const { rollDbId, instanceId, slot, moveId, targetInstanceId, rollResult } = req.body || {};
  const slotNum = typeof slot === 'number' ? slot : parseInt(slot, 10);
  if (rollDbId == null || !instanceId || !Number.isInteger(slotNum) || slotNum < 1 || slotNum > 10) {
    return res.status(400).json({ error: 'rollDbId, instanceId, and slot (1–10) required' });
  }
  const op = {
    op: 'rest-move-select',
    rollDbId,
    instanceId,
    slot: slotNum,
    moveId: moveId ?? null,
  };
  if (targetInstanceId !== undefined) op.targetInstanceId = targetInstanceId;
  if (rollResult !== undefined) op.rollResult = rollResult;
  try {
    if (req.uid !== gmUid) {
      const elements = tableState.elements || [];
      const character = elements.find(e => e.elementType === 'character' && e.instanceId === instanceId);
      if (!character) return res.status(404).json({ error: 'Character not found' });
      const assignedByUid = character.assignedPlayerUid === req.uid;
      const assignedByEmail = !!req.email && (character.assignedPlayerEmail || '').toLowerCase() === req.email.toLowerCase();
      if (!assignedByUid && !assignedByEmail) {
        return res.status(403).json({ error: 'Not assigned to this character' });
      }
    }
    await applyOpToTableState(tableId, op);
    res.json({ ok: true });
  } catch (err) {
    if (err?.statusCode === 400) {
      return res.status(400).json({ error: err.message || 'Bad request' });
    }
    console.error('POST /api/room/:tableId/rest-move-select error:', err);
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
  const tableId = op.tableId || req.uid;
  try {
    let row = await getTableStateById(APP_ID, tableId);
    // Auto-create the primary table row if it doesn't exist yet (e.g. fresh local DB).
    if (!row && tableId === req.uid) {
      const emptyState = { elements: [], playerEmails: [], gmDisplayName: '', fearCount: 0, top: { sessionStarted: false } };
      await upsertItem(APP_ID, req.uid, 'table_state', tableId, emptyState, false);
      row = { userId: req.uid, data: emptyState };
    }
    if (!row || row.userId !== req.uid) {
      return res.status(403).json({ error: 'Not your table' });
    }
    const { tableId: _t, ...opData } = op;
    await applyOpToTableState(tableId, opData);
    res.json({ ok: true });
  } catch (err) {
    if (err?.statusCode === 400) {
      return res.status(400).json({
        error: err.message || 'Bad request',
        ...(err.playBlocked ? { playBlocked: err.playBlocked } : {}),
      });
    }
    console.error('POST /api/room/my/op error:', err);
    res.status(500).json({ error: 'Failed to apply op' });
  }
});


// POST /api/room/:tableId/intent — Player (or GM) broadcasts a pre-roll intent banner to the GM.
// Body: { characterName, characterInstanceId, rollText, chips }
// chips must be plain serializable objects (no functions).
app.post('/api/room/:tableId/intent', requireAuth, async (req, res) => {
  const ctx = await resolveTableAccess(APP_ID, req.params.tableId, req);
  if (ctx.error) return res.status(ctx.error).json({ error: ctx.message });
  const { characterName, characterInstanceId, rollText, chips } = req.body;
  const intent = { characterName, characterInstanceId, rollText, chips: chips || [], timestamp: Date.now() };
  pendingIntents.set(req.params.tableId, intent);
  broadcastIntentToGm(req.params.tableId, intent);
  res.json({ ok: true });
});

// DELETE /api/room/:tableId/intent — Clear the pending intent (called after Proceed or Cancel).
app.delete('/api/room/:tableId/intent', requireAuth, async (req, res) => {
  const ctx = await resolveTableAccess(APP_ID, req.params.tableId, req);
  if (ctx.error) return res.status(ctx.error).json({ error: ctx.message });
  pendingIntents.delete(req.params.tableId);
  broadcastIntentToGm(req.params.tableId, null);
  res.json({ ok: true });
});


// POST /api/room/:tableId/character-update — Player updates their assigned character's runtime state (GM can always update in own room)
app.post('/api/room/:tableId/character-update', requireAuth, async (req, res) => {
  const ctx = await resolveTableAccess(APP_ID, req.params.tableId, req);
  if (ctx.error) return res.status(ctx.error).json({ error: ctx.message });
  const { tableId, gmUid, tableState } = ctx;
  const { instanceId, updates } = req.body;
  try {
    const el = (tableState.elements || []).find(e => e.instanceId === instanceId);
    if (!el) return res.status(404).json({ error: 'Character not found' });
    if (req.uid !== gmUid) {
      if (el.elementType === 'boardToken') {
        const parent = (tableState.elements || []).find((e) => e.instanceId === el.parentInstanceId);
        if (!parent || parent.assignedPlayerEmail !== req.email) {
          return res.status(403).json({ error: 'Not assigned to this character' });
        }
      } else if (el.assignedPlayerEmail !== req.email) {
        return res.status(403).json({ error: 'Not assigned to this character' });
      }
    }
    await applyOpToTableState(tableId, { op: 'update-element', instanceId, updates });
    res.json({ ok: true });
  } catch (err) {
    if (err?.statusCode === 400) {
      return res.status(400).json({
        error: err.message || 'Bad request',
        ...(err.playBlocked ? { playBlocked: err.playBlocked } : {}),
      });
    }
    console.error('POST /api/room/:tableId/character-update error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/room/:tableId/v2-cross-sheet-chip — Player activates a V2 cross-sheet card chip (e.g. Rally clear stress). Server recomputes engine mutations from chipKey (same as GM postTableOp).
app.post('/api/room/:tableId/v2-cross-sheet-chip', requireAuth, async (req, res) => {
  const ctx = await resolveTableAccess(APP_ID, req.params.tableId, req);
  if (ctx.error) return res.status(ctx.error).json({ error: ctx.message });
  const { tableId, gmUid, tableState } = ctx;
  if (req.uid === gmUid) {
    return res.status(400).json({ error: 'GM clients use postTableOp' });
  }
  const { viewerInstanceId, chipKey } = req.body || {};
  try {
    const rawElements = tableState.elements || [];
    const activeElements = await resolveCharacterElements(rawElements);
    const viewerEl = activeElements.find(
      (e) => e.elementType === 'character' && e.instanceId === viewerInstanceId
    );
    if (!viewerEl) return res.status(404).json({ error: 'Character not found' });
    const assignedByUid = viewerEl.assignedPlayerUid === req.uid;
    const assignedByEmail =
      !!req.email &&
      (viewerEl.assignedPlayerEmail || '').toLowerCase() === req.email.toLowerCase();
    if (!assignedByUid && !assignedByEmail) {
      return res.status(403).json({ error: 'Not assigned to this character' });
    }

    const computed = computePlayerV2CrossSheetChipApply({
      activeElements,
      tableState,
      viewerInstanceId,
      chipKey,
    });
    if (!computed.ok) {
      return res.status(computed.status).json({ error: computed.error });
    }
    const { updates, actionLoopNotifications } = computed;
    if (updates.length > 0) {
      await applyOpToTableState(tableId, { op: 'update-elements', updates });
    }
    for (const p of actionLoopNotifications) {
      const baseDesc = p.description || '';
      const actionText =
        p.affectedSummary && String(p.affectedSummary).trim()
          ? `${baseDesc}\n${p.affectedSummary}`
          : baseDesc;
      const payload = {
        _action: true,
        rollUser: p.rollUser || 'Table',
        actionName: p.title,
        actionText,
        _v2ActionLoop: true,
        _reactorInstanceId: p.instanceId,
        ...v2RollDieExtrasFromActionLoopPayload(p),
        ...(Array.isArray(p.affectedNames) && p.affectedNames.length > 0
          ? { _affectedNames: p.affectedNames, _affectedInstanceIds: p.affectedInstanceIds }
          : {}),
        _initiatorUid: req.uid,
      };
      await appendRollLog(gmUid, payload);
    }
    res.json({ ok: true });
  } catch (err) {
    if (err?.statusCode === 400) {
      return res.status(400).json({ error: err.message || 'Bad request' });
    }
    console.error('POST /api/room/:tableId/v2-cross-sheet-chip error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/room/:tableId/v2-review-chip — Player applies V2 review banner chips for their assigned character (same engine as GM).
app.post('/api/room/:tableId/v2-review-chip', requireAuth, async (req, res) => {
  const ctx = await resolveTableAccess(APP_ID, req.params.tableId, req);
  if (ctx.error) return res.status(ctx.error).json({ error: ctx.message });
  const { tableId, gmUid, tableState } = ctx;
  if (req.uid === gmUid) {
    return res.status(400).json({ error: 'GM clients use postTableOp' });
  }
  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ error: 'Requires database' });
  }
  const { viewerInstanceId, bannerId, activationKey, selectOpts } = req.body || {};
  const bid = bannerId != null ? Number(bannerId) : null;
  if (!viewerInstanceId || bid == null || Number.isNaN(bid) || !activationKey) {
    return res.status(400).json({ error: 'viewerInstanceId, bannerId, and activationKey required' });
  }
  try {
    const rawElements = tableState.elements || [];
    const activeElements = await resolveCharacterElements(rawElements);
    const viewerEl = activeElements.find(
      (e) => e.elementType === 'character' && e.instanceId === viewerInstanceId
    );
    if (!viewerEl) return res.status(404).json({ error: 'Character not found' });
    const assignedByUid = viewerEl.assignedPlayerUid === req.uid;
    const assignedByEmail =
      !!req.email &&
      (viewerEl.assignedPlayerEmail || '').toLowerCase() === req.email.toLowerCase();
    if (!assignedByUid && !assignedByEmail) {
      return res.status(403).json({ error: 'Not assigned to this character' });
    }

    const diceRow = await getDiceRollById(APP_ID, gmUid, bid);
    if (!diceRow || diceRow.status !== 'pending') {
      return res.status(404).json({ error: 'Banner not found or already resolved' });
    }
    const roll = diceRow.data || {};
    const srdData = await loadSrdDataForV2Engine();
    const computed = computePlayerV2ReviewChipApply({
      activeElements,
      tableState,
      viewerInstanceId,
      roll,
      activationKey,
      selectOpts,
      srdData,
    });
    if (!computed.ok) {
      return res.status(computed.status).json({ error: computed.error });
    }
    const {
      chip,
      updates: elementUpdates,
      serverFollowups,
      engineRollDisplayOnly,
      unsupported,
      skipped,
    } = computed;

    if (elementUpdates?.length) {
      await applyOpToTableState(tableId, { op: 'update-elements', updates: elementUpdates });
    }

    let currentBannerId = bid;
    const bannerMigrations = [];

    async function refreshResolvedElements() {
      const resolved = await getResolvedTableState(APP_ID, tableId);
      return resolved?.elements || [];
    }

    let elsForMigrate = await refreshResolvedElements();

    for (const f of serverFollowups || []) {
      if (f.kind === 'addDamage') {
        const dice = String(f.payload?.dice ?? '').trim();
        if (!dice || currentBannerId == null) continue;
        const extraDamageLabel = String(f.payload?.name || chip._featureName || 'V2').slice(0, 80);
        const pendingRow = await getDiceRollById(APP_ID, gmUid, currentBannerId);
        if (!pendingRow || pendingRow.status !== 'pending') continue;
        const copyData = buildAugmentedRollWithExtraDamage(
          pendingRow.data,
          dice,
          extraDamageLabel,
          undefined,
          chip._featureName
        );
        if (!copyData) continue;
        const prevRollId = currentBannerId;
        copyData._replacedRollDbId = prevRollId;
        await setBannerStatus(prevRollId, 'cancelled');
        const newDbId = await appendDiceRoll(APP_ID, gmUid, copyData);
        copyData._rollDbId = newDbId;
        currentBannerId = newDbId;
        bannerMigrations.push({ from: prevRollId, to: currentBannerId });
        subscriptionManager.notifyChange('banners', gmUid);
        const mig = migrateV2PendingMapRollId(prevRollId, currentBannerId, elsForMigrate);
        if (mig.length) {
          await applyOpToTableState(tableId, { op: 'update-elements', updates: mig });
        }
        elsForMigrate = await refreshResolvedElements();
      } else if (f.kind === 'rerollDie') {
        if (currentBannerId == null) continue;
        const pendingRow = await getDiceRollById(APP_ID, gmUid, currentBannerId);
        if (!pendingRow || pendingRow.status !== 'pending') continue;
        const dieType = f.dieType;
        const copyData =
          dieType === 'Duality'
            ? buildRerollDualityRoll(pendingRow.data, chip._featureName ?? null)
            : buildRerollDieRoll(pendingRow.data, dieType, chip._featureName ?? null);
        const prevRollId = currentBannerId;
        copyData._replacedRollDbId = prevRollId;
        await setBannerStatus(prevRollId, 'cancelled');
        const newDbId = await appendDiceRoll(APP_ID, gmUid, copyData);
        copyData._rollDbId = newDbId;
        currentBannerId = newDbId;
        bannerMigrations.push({ from: prevRollId, to: currentBannerId });
        subscriptionManager.notifyChange('banners', gmUid);
        const mig = migrateV2PendingMapRollId(prevRollId, currentBannerId, elsForMigrate);
        if (mig.length) {
          await applyOpToTableState(tableId, { op: 'update-elements', updates: mig });
        }
        elsForMigrate = await refreshResolvedElements();
      } else if (f.kind === 'patchActionRollAddDie') {
        const die = String(f.payload?.die ?? '').trim();
        if (!die || currentBannerId == null) continue;
        const dieExpr = parseAllowedV2ActionDieExpr(die);
        if (!dieExpr) continue;
        const rolled = rollDice(dieExpr);
        if (!rolled) continue;
        const pendingRow = await getDiceRollById(APP_ID, gmUid, currentBannerId);
        if (!pendingRow || pendingRow.status !== 'pending') continue;
        const originalData = pendingRow.data || {};
        const origSubItems = Array.isArray(originalData.subItems) ? originalData.subItems : [];
        const extraName = String(f.payload?.name ?? chip._featureName ?? 'Bonus').slice(0, 120);
        const subItem = {
          pre: extraName,
          input: rolled.input,
          result: String(rolled.result),
          details: rolled.details,
          post: '',
        };
        const fearIdx = origSubItems.findIndex(s => /fear/i.test(s.pre || ''));
        const insertIdx = fearIdx >= 0 ? fearIdx + 1 : origSubItems.findIndex(s => /damage/i.test(s.pre || ''));
        const newSubItems =
          insertIdx >= 0
            ? [...origSubItems.slice(0, insertIdx), subItem, ...origSubItems.slice(insertIdx)]
            : [...origSubItems, subItem];
        const dh = parseDaggerheartResult(newSubItems);
        const patch = { subItems: newSubItems, timestamp: Date.now() };
        if (dh) {
          Object.assign(patch, {
            total: dh.total,
            hopeResult: dh.hopeResult,
            fearResult: dh.fearResult,
            dominant: dh.dominant,
            rollUser: dh.characterName || originalData.rollUser || '',
          });
        } else {
          let total = 0;
          for (const sub of newSubItems) {
            if (/damage/i.test(sub.pre || '')) continue;
            if (EXTRA_PRE_RE.test(sub.pre || '')) continue;
            const v = parseInt(sub.result, 10);
            if (!isNaN(v)) total += v;
          }
          patch.total = total;
          if (originalData.rollUser) patch.rollUser = originalData.rollUser;
        }
        const ok = await updateDiceRollData(APP_ID, gmUid, currentBannerId, patch);
        if (ok) subscriptionManager.notifyChange('banners', gmUid);
      } else if (f.kind === 'patchActionRollAddStatic') {
        const v = Number(f.payload?.value);
        if (!Number.isFinite(v) || currentBannerId == null) continue;
        const pendingRow = await getDiceRollById(APP_ID, gmUid, currentBannerId);
        if (!pendingRow || pendingRow.status !== 'pending') continue;
        const originalData = pendingRow.data || {};
        const origSubItems = Array.isArray(originalData.subItems) ? originalData.subItems : [];
        const extraName = String(f.payload?.name ?? chip._featureName ?? 'Bonus').slice(0, 120);
        const subItem = {
          pre: extraName,
          input: String(v),
          result: String(v),
          details: `(${v})`,
          post: '',
        };
        const fearIdx = origSubItems.findIndex(s => /fear/i.test(s.pre || ''));
        const insertIdx = fearIdx >= 0 ? fearIdx + 1 : origSubItems.findIndex(s => /damage/i.test(s.pre || ''));
        const newSubItems =
          insertIdx >= 0
            ? [...origSubItems.slice(0, insertIdx), subItem, ...origSubItems.slice(insertIdx)]
            : [...origSubItems, subItem];
        const dh = parseDaggerheartResult(newSubItems);
        const patch = { subItems: newSubItems, timestamp: Date.now() };
        if (dh) {
          Object.assign(patch, {
            total: dh.total,
            hopeResult: dh.hopeResult,
            fearResult: dh.fearResult,
            dominant: dh.dominant,
            rollUser: dh.characterName || originalData.rollUser || '',
          });
        } else {
          let total = 0;
          for (const sub of newSubItems) {
            if (/damage/i.test(sub.pre || '')) continue;
            if (EXTRA_PRE_RE.test(sub.pre || '')) continue;
            const v2 = parseInt(sub.result, 10);
            if (!isNaN(v2)) total += v2;
          }
          patch.total = total;
          if (originalData.rollUser) patch.rollUser = originalData.rollUser;
        }
        const ok = await updateDiceRollData(APP_ID, gmUid, currentBannerId, patch);
        if (ok) subscriptionManager.notifyChange('banners', gmUid);
      } else if (f.kind === 'forcedMovementNotice') {
        const p = f.payload || f.mutation?.payload;
        if (p) {
          const notice = buildForcedMovementActionNotification(p, elsForMigrate);
          if (chip?._featureName) notice.actionName = String(chip._featureName).slice(0, 120);
          notice._initiatorUid = req.uid;
          await appendRollLog(gmUid, notice);
        }
      }
    }

    if (unsupported?.length && process.env.NODE_ENV !== 'production') {
      console.warn('[V2] Player review chip unsupported mutations:', unsupported.map((m) => m.type));
    }
    if (skipped?.length && process.env.NODE_ENV !== 'production') {
      console.warn('[V2] Player review chip skipped mutations:', skipped.map((m) => m.type));
    }

    let hopeConvertedRollDbId = null;
    for (const m of engineRollDisplayOnly || []) {
      if (
        m?.type === 'setRollOutcome' &&
        m.payload?.rollKey === 'action' &&
        m.payload?.outcome === 'hope'
      ) {
        hopeConvertedRollDbId = bid;
        break;
      }
    }

    res.json({
      ok: true,
      currentRollDbId: currentBannerId,
      initialRollDbId: bid,
      bannerMigrations,
      hopeConvertedRollDbId,
    });
  } catch (err) {
    if (err?.statusCode === 400) {
      return res.status(400).json({ error: err.message || 'Bad request' });
    }
    console.error('POST /api/room/:tableId/v2-review-chip error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/room/:tableId/add-character — Player adds a character (auto-assigned to themselves)
app.post('/api/room/:tableId/add-character', requireAuth, async (req, res) => {
  const ctx = await resolveTableAccess(APP_ID, req.params.tableId, req);
  if (ctx.error) return res.status(ctx.error).json({ error: ctx.message });
  const { tableId } = ctx;
  try {
    const { id: charId, name, playerName, maxHope, maxHp, maxStress, tier,
      hope, currentHp, currentStress, currentArmor, conditions, tokenX, tokenY,
      assignedPlayerUid, ...extraFields } = req.body;
    const instanceId = crypto.randomUUID();
    const maxH = maxHope || 6;
    const runtimeData = {
      instanceId,
      elementType: 'character',
      assignedPlayerEmail: req.email,
      assignedPlayerUid: assignedPlayerUid || req.uid,
      playerName: playerName || req.email,
      hope: hope != null ? hope : Math.min(DEFAULT_CHARACTER_STARTING_HOPE, maxH),
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
    await applyOpToTableState(tableId, { op: 'add-elements', elements: [character] });
    res.json({ character });
  } catch (err) {
    console.error('POST /api/room/:tableId/add-character error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/room/:tableId/roll — Player rolls dice server-side; validates table membership, persists to DB.
app.post('/api/room/:tableId/roll', requireAuth, async (req, res) => {
  if (process.env.NODE_ENV !== 'production') console.log('[roll] POST /api/room/:tableId/roll received', req.params.tableId, req.body?.rollText?.slice(0, 40));
  const ctx = await resolveTableAccess(APP_ID, req.params.tableId, req);
  if (ctx.error) return res.status(ctx.error).json({ error: ctx.message });
  const { gmUid } = ctx;
  const { rollText, displayName, _clientId, silent, bypassPrepGate: _playerRollBypassIgnored, ...rest } = req.body;
  if (!rollText) return res.status(400).json({ error: 'rollText is required' });
  const extraMeta = Object.fromEntries(Object.entries(rest).filter(([k]) => k.startsWith('_')));
  try {
    if (!silent && !isTablePlayAllowed(ctx.tableState)) {
      const paused = ctx.tableState?.top?.sessionPaused === true;
      return res.status(400).json({
        error: paused ? 'Session paused' : 'Session not started',
        playBlocked: paused ? 'paused' : 'prep',
      });
    }
    const rollData = buildRollData(rollText, displayName, _clientId, { _playerInitiated: true, _initiatorUid: req.uid, ...extraMeta });
    if (!rollData) return res.status(400).json({ error: 'No dice expressions found in rollText' });
    if (!silent) {
      await appendRollLog(gmUid, rollData);
      if (process.env.DATABASE_URL) {
        try {
          await applyOpToTableState(req.params.tableId, { op: 'touch-session-activity' });
        } catch {
          /* ignore */
        }
      }
      if (process.env.NODE_ENV !== 'production') console.log('[roll] POST /api/room/:tableId/roll', rollData._rollDbId != null ? 'persisted' : 'in-memory', 'targetId:', extraMeta._selectedTargetInstanceId ?? null);
    }
    res.json(rollData);
  } catch (err) {
    console.error('POST /api/room/:tableId/roll error:', err);
    res.status(500).json({ error: `Roll failed: ${err.message}` });
  }
});

app.use('/api/srd', srdRouter);

/** Dev hot-reload: inject only when not production/test, or when ENABLE_LIVERELOAD=1 (e.g. staging). */
function shouldInjectLiveReloadClient() {
  if (process.env.ENABLE_LIVERELOAD === '1') return true;
  const n = process.env.NODE_ENV;
  if (n === 'production' || n === 'test') return false;
  return true;
}

const LIVERELOAD_CLIENT_SNIPPET = `
  <script>
    (function() {
      var src = new EventSource('/livereload');
      var wasConnected = false;
      src.onopen = function() { if (wasConnected) location.reload(); };
      src.onmessage = function(e) {
        if (e.data === 'reload') {
          wasConnected = true;
          location.reload();
        }
      };
    })();
  </script>`;

let spaHtmlCache = null;
function getSpaHtml() {
  if (spaHtmlCache == null) {
    const raw = readFileSync(join(__dirname, 'public', 'index.html'), 'utf8');
    spaHtmlCache = shouldInjectLiveReloadClient()
      ? raw.replace('</body>', `${LIVERELOAD_CLIENT_SNIPPET}\n</body>`)
      : raw;
  }
  return spaHtmlCache;
}

function sendSpaHtml(res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(getSpaHtml());
}

app.get('/index.html', (req, res) => {
  sendSpaHtml(res);
});

app.use(express.static(join(__dirname, 'public'), { index: false }));

// SPA fallback — serve index.html for any unmatched route (except asset paths)
// Don't send HTML for .js/.css/etc. or the browser throws "invalid MIME type"
const ASSET_EXT = /\.(js|mjs|cjs|css|map|ico|png|jpg|jpeg|gif|svg|woff2?|ttf|webp)$/i;
app.get('*', (req, res) => {
  if (ASSET_EXT.test(req.path)) {
    res.status(404).end();
    return;
  }
  sendSpaHtml(res);
});

// --- Startup ---
async function startServer() {
  await warmCache();
  if (process.env.DATABASE_URL) {
    await runMigrations();
    await loadSrdIntoDb(APP_ID);
    await subscriptionManager.init(APP_ID);
    setTableStateNotifyHook((tableId) => subscriptionManager.notifyChange('table_state', tableId));
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
