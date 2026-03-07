/**
 * Heart of Daggers Homebrew Vault integration.
 *
 * Two main operations:
 *   searchHoD()           - list search via WordPress AJAX endpoint (summary data only)
 *   fetchHoDFoundryDetail() - full Foundry VTT JSON for a single item (fetched on clone/resolve)
 *
 * HoD uses a WordPress admin-ajax.php backend. The list endpoint requires a nonce
 * scraped from the public vault page (<div id="hb-hub-config" data-nonce="...">).
 * The Foundry JSON export requires a per-item nonce scraped from the detail page
 * (window.HB_EXPORT_JSON = { nonce: "...", postId: ... }).
 */

import { ROLES } from './game-constants.js';
import { ProxyAgent, fetch as undiciFetch } from 'undici';

const HOD_VAULT_URL = 'https://heartofdaggers.com/vault/';
const HOD_AJAX_URL = 'https://heartofdaggers.com/wp-admin/admin-ajax.php';

const USER_AGENT = process.env.HOD_USER_AGENT || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const PROXY_URL = process.env.HOD_PROXY || process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
const dispatcher = PROXY_URL ? new ProxyAgent(PROXY_URL) : undefined;

async function fetchWithProxy(url, options = {}) {
  const opts = { ...options };
  if (dispatcher) {
    opts.dispatcher = dispatcher;
  }
  // Use undici.fetch if proxy is configured (for dispatcher support) or native fetch otherwise
  // Note: Node 18+ native fetch also supports dispatcher, but undici.fetch is explicit.
  // We'll use undiciFetch always to ensure consistent behavior with ProxyAgent.
  return undiciFetch(url, opts);
}

const VALID_ROLES = new Set(ROLES);

const VALID_ENV_TYPES = new Set(['traversal', 'exploration', 'social', 'event']);
const VALID_RANGES = ['Melee', 'Very Close', 'Close', 'Far', 'Very Far'];

// ---------------------------------------------------------------------------
// Nonce cache — vault page nonce refreshed every 30 minutes
// ---------------------------------------------------------------------------

let cachedNonce = null;
let nonceFetchedAt = 0;
const NONCE_TTL = 30 * 60 * 1000; // 30 minutes

export async function getVaultNonce(forceRefresh = false) {
  if (!forceRefresh && cachedNonce && Date.now() - nonceFetchedAt < NONCE_TTL) {
    return cachedNonce;
  }
  if (forceRefresh) {
    cachedNonce = null;
  }
  const res = await fetchWithProxy(HOD_VAULT_URL, {
    headers: { 'User-Agent': USER_AGENT },
  });
  if (!res.ok) throw new Error(`HoD vault page returned ${res.status}`);
  const html = await res.text();
  const match = html.match(/id="hb-hub-config"[^>]*data-nonce="([^"]+)"/);
  if (!match) throw new Error('Could not find HoD nonce in vault page');
  cachedNonce = match[1];
  nonceFetchedAt = Date.now();
  return cachedNonce;
}

// ---------------------------------------------------------------------------
// Normalisation helpers
// ---------------------------------------------------------------------------

function stripHtml(raw) {
  if (!raw) return '';
  return raw
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&#0*39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normRole(raw) {
  const lower = (raw || '').toLowerCase().trim();
  return VALID_ROLES.has(lower) ? lower : 'standard';
}

function normEnvType(raw) {
  const lower = (raw || '').toLowerCase().trim();
  return VALID_ENV_TYPES.has(lower) ? lower : 'event';
}

function normRange(raw) {
  if (!raw) return 'Melee';
  // Expand camelCase Foundry VTT values (e.g. "veryClose" -> "very close")
  const lower = raw.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().trim();
  return VALID_RANGES.find(r => r.toLowerCase() === lower) || 'Melee';
}

// Parse "+6" or "6" or null -> integer
function parseModifier(raw) {
  if (raw === null || raw === undefined || raw === '') return 0;
  return parseInt(String(raw).replace(/^\+/, ''), 10) || 0;
}

// Parse "3d20 Physical" -> { damage: "3d20", trait: "Phy" }
function parseDamageString(raw) {
  if (!raw) return { damage: '', trait: 'Phy' };
  // Match damage expression optionally followed by damage type word
  const m = raw.trim().match(/^(\S+)\s*(physical|magical|magic|phy|mag|dir)?/i);
  if (!m) return { damage: raw.trim(), trait: 'Phy' };
  const damage = m[1];
  const typeWord = (m[2] || '').toLowerCase();
  let trait = 'Phy';
  if (typeWord.startsWith('mag')) trait = 'Mag';
  else if (typeWord === 'dir') trait = 'Dir';
  return { damage, trait };
}

// Parse "Blind obedience +2" -> { name, modifier }
function parseExperience(str) {
  const match = (str || '').match(/^(.+?)\s*([+-]\d+)\s*$/);
  if (match) return { name: match[1].trim(), modifier: parseInt(match[2], 10) };
  return { name: (str || '').trim(), modifier: 0 };
}

// ---------------------------------------------------------------------------
// Foundry VTT JSON translation
// ---------------------------------------------------------------------------

function translateFoundryAdversary(json, postId, detailUrl) {
  const sys = json.system || {};
  const resources = sys.resources || {};
  const hp = resources.hitPoints || {};
  const stress = resources.stress || {};
  const thresholds = sys.damageThresholds || {};
  const atkSys = sys.attack || {};
  const roll = atkSys.roll || {};

  // Damage: Foundry stores parts in two possible formats:
  //   Old format: [["1d20", "Physical"], ...]  (array of [formula, type] tuples)
  //   New format: [{value:{flatMultiplier,dice,bonus}, type:["physical"], ...}, ...]
  let damage = '';
  let trait = 'Phy';
  const parts = atkSys.damage?.parts || [];
  if (parts.length > 0) {
    const part = parts[0];
    if (Array.isArray(part)) {
      // Old format: [formula_string, type_string]
      damage = part[0] || '';
      const { trait: t } = parseDamageString(`${damage} ${part[1] || ''}`);
      trait = t;
    } else if (part && typeof part === 'object') {
      // New format: { value: { flatMultiplier, dice, bonus }, type: ["physical"], ... }
      const v = part.value || {};
      const multiplier = v.flatMultiplier ?? 1;
      const dice = v.dice || '';
      const bonus = v.bonus ?? 0;
      damage = `${multiplier}${dice}${bonus > 0 ? '+' + bonus : bonus < 0 ? bonus : ''}`;
      const typeArr = Array.isArray(part.type) ? part.type : [];
      const { trait: t } = parseDamageString(`${damage} ${typeArr[0] || ''}`);
      trait = t;
    }
  }

  // Range: may be in attack.range or attack.properties
  const rangeRaw = atkSys.range?.value || atkSys.range || '';
  const range = normRange(String(rangeRaw));

  // Experiences: Foundry stores as object { "0": { name, modifier } } or array
  const expRaw = sys.experiences || {};
  const experiences = Object.values(expRaw).map(e => {
    if (typeof e === 'string') {
      const { name, modifier } = parseExperience(e);
      return { id: crypto.randomUUID(), name, modifier };
    }
    return { id: crypto.randomUUID(), name: e.name || '', modifier: parseModifier(e.modifier) };
  });

  // Features come as items[] with type === 'feature'
  const features = (json.items || [])
    .filter(f => f.type === 'feature')
    .map(f => {
      const fsys = f.system || {};
      const ftype = (fsys.featureType || fsys.type || 'passive').toLowerCase();
      // Normalise to passive/action/reaction
      const normType = ftype === 'action' ? 'action' : ftype === 'reaction' ? 'reaction' : 'passive';
      return {
        id: crypto.randomUUID(),
        name: f.name || '',
        type: normType,
        description: stripHtml(fsys.description || fsys.effect || ''),
      };
    });

  const motives = stripHtml(sys.motivesAndTactics || '');

  return {
    id: `hod-${postId}`,
    name: json.name || '',
    tier: sys.tier || 1,
    role: normRole(sys.type),
    description: stripHtml(sys.description || ''),
    motive: motives,
    difficulty: sys.difficulty || 10,
    hp_max: hp.max || 6,
    stress_max: stress.max || 3,
    hp_thresholds: {
      major: thresholds.major ?? Math.floor((hp.max || 6) / 2),
      severe: thresholds.severe ?? (hp.max || 6),
    },
    attack: {
      name: atkSys.name || '',
      range,
      modifier: parseModifier(roll.bonus ?? roll.modifier),
      trait,
      damage,
    },
    experiences,
    features,
    imageUrl: json.img || '',
    _source: 'hod',
    _hodPostId: postId,
    _hodLink: detailUrl || '',
  };
}

function parseHodPotentialAdversaries(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean).map(n => ({ name: String(n).trim() })).filter(e => e.name);
  if (typeof raw === 'string') {
    return raw.split(',').map(s => s.trim()).filter(Boolean).map(name => ({ name }));
  }
  return [];
}

function translateFoundryEnvironment(json, postId, detailUrl) {
  const sys = json.system || {};

  const features = (json.items || [])
    .filter(f => f.type === 'feature')
    .map(f => {
      const fsys = f.system || {};
      const ftype = (fsys.featureType || fsys.type || 'passive').toLowerCase();
      const normType = ftype === 'action' ? 'action' : ftype === 'reaction' ? 'reaction' : 'passive';
      return {
        id: crypto.randomUUID(),
        name: f.name || '',
        type: normType,
        description: stripHtml(fsys.description || fsys.effect || ''),
      };
    });

  const potAdv = sys.potentialAdversaries ?? sys.potential_adversaries ?? sys.adversaries ?? null;

  return {
    id: `hod-${postId}`,
    name: json.name || '',
    tier: sys.tier || 1,
    type: normEnvType(sys.type),
    description: stripHtml(sys.description || ''),
    difficulty: sys.difficulty || 10,
    potential_adversaries: parseHodPotentialAdversaries(potAdv),
    features,
    imageUrl: json.img || '',
    _source: 'hod',
    _hodPostId: postId,
  };
}

// ---------------------------------------------------------------------------
// HTML parsing helpers for list results
// ---------------------------------------------------------------------------

/**
 * Parse all data-* attributes from hb-row anchor elements in the HTML response.
 * Returns an array of plain objects with camelCased keys.
 */
function parseHodRows(html) {
  const rows = [];
  // Match each <a class="hb-row ..."> element — data attrs are on the opening tag
  const rowRe = /<a\s[^>]*class="[^"]*hb-row[^"]*"([^>]*)>/g;
  let rowMatch;
  while ((rowMatch = rowRe.exec(html)) !== null) {
    const attrsStr = rowMatch[1];
    const attrs = {};
    const attrRe = /\bdata-([\w-]+)="([^"]*)"/g;
    let m;
    while ((m = attrRe.exec(attrsStr)) !== null) {
      // Convert data-adv-type to advType (camelCase)
      const key = m[1].replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      attrs[key] = m[2]
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'");
    }
    if (attrs.id) rows.push(attrs);
  }
  return rows;
}

function rowToAdversary(row, tierFilter) {
  const postId = row.id;
  const tier = row.advTier ? parseInt(row.advTier, 10) : (tierFilter ? Number(tierFilter) : null);
  return {
    id: `hod-${postId}`,
    name: row.title || '',
    tier,
    role: normRole(row.advType),
    description: stripHtml(row.desc || ''),
    motive: '',
    difficulty: row.advDifficulty ? parseInt(row.advDifficulty, 10) : 10,
    hp_max: row.advHp ? parseInt(row.advHp, 10) : 6,
    stress_max: row.advStress ? parseInt(row.advStress, 10) : 3,
    hp_thresholds: { major: null, severe: null },
    attack: { name: '', range: 'Melee', modifier: 0, trait: 'Phy', damage: '' },
    experiences: [],
    features: [],
    imageUrl: '',
    _source: 'hod',
    _hodPostId: postId,
    _hodLink: row.link || '',
  };
}

function rowToEnvironment(row, tierFilter) {
  const postId = row.id;
  const tier = row.envTier ? parseInt(row.envTier, 10) : (tierFilter ? Number(tierFilter) : null);
  return {
    id: `hod-${postId}`,
    name: row.title || '',
    tier,
    type: normEnvType(row.envType),
    description: stripHtml(row.desc || ''),
    difficulty: row.envDifficulty ? parseInt(row.envDifficulty, 10) : 10,
    potential_adversaries: parseHodPotentialAdversaries(row.envPad || null),
    features: [],
    imageUrl: '',
    _source: 'hod',
    _hodPostId: postId,
    _hodLink: row.link || '',
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Search HoD Homebrew Vault list endpoint.
 *
 * @param {object} opts
 * @param {string}  [opts.search]     - Free-form search text
 * @param {string|number} [opts.tier] - Tier filter (1–4)
 * @param {string}  [opts.type]       - Role/type filter (app-native value, e.g. 'solo')
 * @param {string}  opts.collection   - 'adversaries' | 'environments'
 * @param {number}  [opts.limit]      - Max items to return (default 20, max 100)
 * @param {number}  [opts.offset]     - Zero-based offset (HoD uses 1-indexed pages)
 * @returns {{ items, totalCount }}
 */
function buildSearchForm(nonce, { search, tier, type, collection, limit, offset }) {
  const perPage = Math.min(100, Math.max(1, limit));
  const page = Math.floor(offset / perPage) + 1;

  const form = new FormData();
  form.append('action', 'hb_hub_query');
  form.append('nonce', nonce);
  form.append('q', search || '');
  form.append('cat', collection === 'environments' ? 'environments' : 'adversaries');
  form.append('sort', 'recent');
  form.append('page', String(page));
  form.append('per_page', String(perPage));
  form.append('author', '');
  form.append('campaign_frame', '');

  if (collection === 'adversaries') {
    form.append('adv_tier', tier ? String(tier) : '');
    form.append('adv_type', type ? type.charAt(0).toUpperCase() + type.slice(1) : '');
    form.append('adv_dmgtype', '');
    form.append('adv_diff_min', '');
    form.append('adv_diff_max', '');
    form.append('adv_hp_min', '');
    form.append('adv_hp_max', '');
    form.append('adv_mt', '');
    form.append('adv_feature', '');
  } else {
    form.append('env_tier', tier ? String(tier) : '');
    form.append('env_type', type ? type.charAt(0).toUpperCase() + type.slice(1) : '');
    form.append('env_diff_min', '');
    form.append('env_diff_max', '');
    form.append('env_impulse', '');
    form.append('env_pad', '');
    form.append('env_feat', '');
  }

  return form;
}

export async function searchHoD({ search, tier, type, collection, limit = 20, offset = 0 } = {}) {
  let nonce = await getVaultNonce();
  const opts = { search, tier, type, collection, limit, offset };

  const doRequest = async () => {
    const form = buildSearchForm(nonce, opts);
    const res = await fetchWithProxy(HOD_AJAX_URL, {
      method: 'POST',
      body: form,
      headers: { 'User-Agent': USER_AGENT },
    });
    if (!res.ok) throw new Error(`HoD AJAX returned ${res.status}`, { cause: res });
    return res;
  };

  let res;
  try {
    res = await doRequest();
  } catch (err) {
    const status = err.cause?.status ?? err.message?.match(/\d{3}/)?.[0];
    if (Number(status) === 415) {
      nonce = await getVaultNonce(true);
      res = await doRequest();
    } else {
      throw err;
    }
  }

  const json = await res.json();
  if (!json.success) throw new Error('HoD AJAX returned success:false');

  const data = json.data || {};
  const html = data.html || '';
  const totalCount = data.found || 0;

  const rows = parseHodRows(html);

  const items = rows.map(row =>
    collection === 'environments'
      ? rowToEnvironment(row, tier)
      : rowToAdversary(row, tier)
  );

  return { items, totalCount };
}

/**
 * Fetch full Foundry VTT JSON detail for a single HoD item, then translate to
 * the native app schema.
 *
 * This is a two-step operation:
 *   1. Fetch the detail page HTML and extract window.HB_EXPORT_JSON (nonce + postId).
 *   2. Call the Foundry JSON export endpoint.
 *
 * @param {string|number} postId    - HoD WordPress post ID (the numeric part after 'hod-')
 * @param {string}        detailUrl - Full URL to the HoD detail page
 * @param {string}        collection - 'adversaries' | 'environments'
 * @returns {object} Fully populated native item object
 */
function extractExportNonce(pageHtml, collection) {
  const isEnv = collection === 'environments';
  const nonceVarRe = isEnv
    ? /window\.HB_ENV_EXPORT_JSON\s*=\s*\{[^}]*(?:"nonce"|nonce)\s*:\s*"([^"]+)"/
    : /window\.HB_EXPORT_JSON\s*=\s*\{[^}]*(?:"nonce"|nonce)\s*:\s*"([^"]+)"/;
  const nonceMatch = pageHtml.match(nonceVarRe);
  return nonceMatch?.[1] ?? null;
}

export async function fetchHoDFoundryDetail(postId, detailUrl, collection) {
  // Step 1: load the detail page to extract the per-item nonce
  const pageRes = await fetchWithProxy(detailUrl, {
    headers: { 'User-Agent': USER_AGENT },
  });
  if (!pageRes.ok) throw new Error(`HoD detail page returned ${pageRes.status} for ${detailUrl}`);
  let pageHtml = await pageRes.text();

  let exportNonce = extractExportNonce(pageHtml, collection);
  if (!exportNonce) throw new Error(`Could not find Foundry export nonce on HoD detail page: ${detailUrl}`);

  const isEnv = collection === 'environments';
  const exportAction = isEnv ? 'hb_export_environment_json' : 'hb_export_adversary_json';

  const doExport = async () => {
    const exportUrl = `${HOD_AJAX_URL}?action=${exportAction}&post_id=${postId}&nonce=${exportNonce}`;
    const exportRes = await fetchWithProxy(exportUrl, {
      headers: { 'User-Agent': USER_AGENT },
    });
    if (!exportRes.ok) throw new Error(`HoD Foundry export returned ${exportRes.status}`, { cause: exportRes });
    return exportRes;
  };

  let exportRes;
  try {
    exportRes = await doExport();
  } catch (err) {
    const status = err.cause?.status ?? err.message?.match(/\d{3}/)?.[0];
    if (Number(status) === 415) {
      const retryPageRes = await fetchWithProxy(detailUrl, {
        headers: { 'User-Agent': USER_AGENT },
      });
      if (!retryPageRes.ok) throw new Error(`HoD detail page returned ${retryPageRes.status} for ${detailUrl}`);
      pageHtml = await retryPageRes.text();
      exportNonce = extractExportNonce(pageHtml, collection);
      if (!exportNonce) throw new Error(`Could not find Foundry export nonce on HoD detail page: ${detailUrl}`);
      exportRes = await doExport();
    } else {
      throw err;
    }
  }

  const foundryJson = await exportRes.json();

  // Translate to native schema
  const result = isEnv
    ? translateFoundryEnvironment(foundryJson, postId)
    : translateFoundryAdversary(foundryJson, postId);

  return result;
}

