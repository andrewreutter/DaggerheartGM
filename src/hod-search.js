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

const HOD_VAULT_URL = 'https://heartofdaggers.com/vault/';
const HOD_AJAX_URL = 'https://heartofdaggers.com/wp-admin/admin-ajax.php';

const VALID_ROLES = new Set(['bruiser', 'horde', 'leader', 'minion', 'ranged', 'skulk', 'social', 'solo', 'standard', 'support']);
const VALID_ENV_TYPES = new Set(['traversal', 'exploration', 'social', 'event']);
const VALID_RANGES = ['Melee', 'Very Close', 'Close', 'Far', 'Very Far'];

// ---------------------------------------------------------------------------
// Nonce cache — vault page nonce refreshed every 30 minutes
// ---------------------------------------------------------------------------

let cachedNonce = null;
let nonceFetchedAt = 0;
const NONCE_TTL = 30 * 60 * 1000; // 30 minutes

async function getVaultNonce() {
  if (cachedNonce && Date.now() - nonceFetchedAt < NONCE_TTL) {
    return cachedNonce;
  }
  const res = await fetch(HOD_VAULT_URL, {
    headers: { 'User-Agent': 'DaggerheartGM/1.0' },
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
  const lower = raw.toLowerCase().trim();
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

function translateFoundryAdversary(json, postId) {
  const sys = json.system || {};
  const resources = sys.resources || {};
  const hp = resources.hitPoints || {};
  const stress = resources.stress || {};
  const thresholds = sys.damageThresholds || {};
  const atkSys = sys.attack || {};
  const roll = atkSys.roll || {};

  // Damage: Foundry stores parts as [["1d20", "Physical"]] or similar
  let damage = '';
  let trait = 'Phy';
  const parts = atkSys.damage?.parts || [];
  if (parts.length > 0) {
    const part = parts[0];
    // parts[0] may be [formula, type] or just a string
    const formula = Array.isArray(part) ? part[0] : part;
    const typeStr = Array.isArray(part) ? (part[1] || '') : '';
    damage = formula || '';
    const { trait: t } = parseDamageString(`${damage} ${typeStr}`);
    trait = t;
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
        description: fsys.description || fsys.effect || '',
      };
    });

  const motives = sys.motivesAndTactics || '';

  return {
    id: `hod-${postId}`,
    name: json.name || '',
    tier: sys.tier || 1,
    role: normRole(sys.type),
    description: sys.description || '',
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
  };
}

function translateFoundryEnvironment(json, postId) {
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
        description: fsys.description || fsys.effect || '',
      };
    });

  return {
    id: `hod-${postId}`,
    name: json.name || '',
    tier: sys.tier || 1,
    type: normEnvType(sys.type),
    description: sys.description || '',
    difficulty: sys.difficulty || 10,
    potential_adversaries: '',
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
  // Tier not present per-item in adversary rows — use the filter param when active
  const tier = tierFilter ? Number(tierFilter) : null;
  return {
    id: `hod-${postId}`,
    name: row.title || '',
    tier,
    role: normRole(row.advType),
    description: row.desc || '',
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
    description: row.desc || '',
    difficulty: row.envDifficulty ? parseInt(row.envDifficulty, 10) : 10,
    potential_adversaries: '',
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
export async function searchHoD({ search, tier, type, collection, limit = 20, offset = 0 } = {}) {
  const nonce = await getVaultNonce();

  // HoD uses 1-indexed page numbers; per_page default is 20
  const perPage = Math.min(100, Math.max(1, limit));
  const page = Math.floor(offset / perPage) + 1;

  // Build multipart form data
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
    // HoD type values are Title-cased (e.g. "Solo", "Bruiser")
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

  const res = await fetch(HOD_AJAX_URL, {
    method: 'POST',
    body: form,
    headers: { 'User-Agent': 'DaggerheartGM/1.0' },
  });
  if (!res.ok) throw new Error(`HoD AJAX returned ${res.status}`);

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
export async function fetchHoDFoundryDetail(postId, detailUrl, collection) {
  // Step 1: load the detail page to extract the per-item nonce
  const pageRes = await fetch(detailUrl, {
    headers: { 'User-Agent': 'DaggerheartGM/1.0' },
  });
  if (!pageRes.ok) throw new Error(`HoD detail page returned ${pageRes.status} for ${detailUrl}`);
  const pageHtml = await pageRes.text();

  // window.HB_EXPORT_JSON = { ajaxUrl: "...", postId: 35892, nonce: "d54cadf1be" }
  const nonceMatch = pageHtml.match(/window\.HB_EXPORT_JSON\s*=\s*\{[^}]*"nonce"\s*:\s*"([^"]+)"/);
  if (!nonceMatch) throw new Error(`Could not find Foundry export nonce on HoD detail page: ${detailUrl}`);
  const exportNonce = nonceMatch[1];

  // Step 2: fetch Foundry JSON
  const exportUrl = `${HOD_AJAX_URL}?action=hb_export_adversary_json&post_id=${postId}&nonce=${exportNonce}`;
  const exportRes = await fetch(exportUrl, {
    headers: { 'User-Agent': 'DaggerheartGM/1.0' },
  });
  if (!exportRes.ok) throw new Error(`HoD Foundry export returned ${exportRes.status}`);

  const foundryJson = await exportRes.json();

  // Translate to native schema
  const isEnv = collection === 'environments';
  return isEnv
    ? translateFoundryEnvironment(foundryJson, postId)
    : translateFoundryAdversary(foundryJson, postId);
}
