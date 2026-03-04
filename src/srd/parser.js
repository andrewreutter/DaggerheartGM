/**
 * SRD sub-application parser.
 *
 * Reads pre-built JSON from daggerheart-srd/.build/03_json/ (git submodule),
 * normalizes each collection into a typed schema, and caches everything in memory.
 *
 * Adversary and environment schemas match the existing app format so Game Table,
 * ItemCard, forms, etc. continue to work without modification.
 */

import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { ROLES } from '../game-constants.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const JSON_DIR = join(__dirname, '..', '..', 'daggerheart-srd', '.build', '03_json');

// --- ID / slug helpers ---

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

const COLLECTION_PREFIXES = {
  abilities:    'srd-abl',
  adversaries:  'srd-adv',
  ancestries:   'srd-anc',
  armor:        'srd-arm',
  beastforms:   'srd-bst',
  classes:      'srd-cls',
  communities:  'srd-com',
  consumables:  'srd-cns',
  domains:      'srd-dom',
  environments: 'srd-env',
  items:        'srd-itm',
  subclasses:   'srd-sub',
  weapons:      'srd-wpn',
};

function makeId(collection, name) {
  const prefix = COLLECTION_PREFIXES[collection] || 'srd';
  return `${prefix}-${slugify(name)}`;
}

// --- Shared feature parsing ---

function parseFeatureName(rawName) {
  const lastDash = rawName.lastIndexOf(' - ');
  if (lastDash >= 0) {
    const name = rawName.slice(0, lastDash).trim();
    const typeRaw = rawName.slice(lastDash + 3).toLowerCase().trim();
    const type = ['action', 'reaction', 'passive'].includes(typeRaw) ? typeRaw : 'passive';
    return { name, type };
  }
  return { name: rawName.trim(), type: 'passive' };
}

function parseFeatures(featureArr, parentId) {
  if (!Array.isArray(featureArr)) return [];
  return featureArr.map(f => {
    const { name, type } = parseFeatureName(f.name || '');
    return {
      id: `${parentId}-feat-${slugify(name)}`,
      name,
      type,
      description: f.text || '',
    };
  });
}

// --- Adversary-specific parsers (must match existing app schema) ---

const VALID_ROLES = new Set(ROLES);

function normalizeRole(type) {
  const t = (type || '').toLowerCase();
  if (t.startsWith('horde')) return 'horde';
  return VALID_ROLES.has(t) ? t : 'standard';
}

function parseThresholds(str) {
  if (!str || str.toLowerCase() === 'none') return { major: null, severe: null };
  const m = str.match(/(\d+)\s*\/\s*(\d+)/);
  if (m) return { major: parseInt(m[1]), severe: parseInt(m[2]) };
  return { major: null, severe: null };
}

const TRAIT_MAP = { phy: 'Phy', physical: 'Phy', mag: 'Mag', magic: 'Mag', dir: 'Dir', direct: 'Dir' };

function parseDamageAndTrait(damageStr) {
  if (!damageStr) return { damage: '', trait: 'Phy' };
  const parts = damageStr.trim().split(/\s+/);
  const damage = parts[0] || '';
  const traitRaw = (parts[1] || '').toLowerCase();
  const trait = TRAIT_MAP[traitRaw] || 'Phy';
  return { damage, trait };
}

function parseExperiences(expStr, parentId) {
  if (!expStr) return [];
  return expStr.split(/,\s*/).map(part => {
    const m = part.trim().match(/^(.+?)\s*([+-]\d+)$/);
    if (m) {
      const name = m[1].trim();
      return { id: `${parentId}-exp-${slugify(name)}`, name, modifier: parseInt(m[2]) };
    }
    return null;
  }).filter(Boolean);
}

// --- Per-collection normalizers ---

function normalizeAdversary(raw) {
  const id = makeId('adversaries', raw.name || '');
  const { damage, trait } = parseDamageAndTrait(raw.damage);
  return {
    id,
    name: raw.name || '',
    tier: parseInt(raw.tier) || 1,
    role: normalizeRole(raw.type),
    motive: raw.motives_and_tactics || '',
    description: raw.description || '',
    imageUrl: '',
    difficulty: parseInt(raw.difficulty) || 10,
    hp_max: parseInt(raw.hp) || 4,
    hp_thresholds: parseThresholds(raw.thresholds),
    stress_max: parseInt(raw.stress) || 2,
    attack: {
      name: raw.attack || '',
      range: raw.range || 'Melee',
      modifier: parseInt((raw.atk || '+0').replace(/^\+/, '')) || 0,
      trait,
      damage,
    },
    experiences: parseExperiences(raw.experience, id),
    features: parseFeatures(raw.feature, id),
  };
}

const ENV_TYPE_MAP = { exploration: 'exploration', social: 'social', traversal: 'traversal', event: 'event' };

/**
 * Parse the SRD `potential_adversaries` string into an array of structured references.
 *
 * SRD strings use mixed formats:
 *   "Beasts (Bear, Dire Wolf), Grove Guardians (Minor Treant, Sylvan Soldier)"
 *   "Guards (Bladed Guard, Head Guard), Masked Thief, Merchant"
 *   "Any"
 *
 * Groups (Category (A, B)) are flattened — category labels are discarded and only
 * individual adversary names are kept. Each name becomes a linked reference using
 * the deterministic SRD adversary ID so it resolves against SRD data.
 */
function parseSrdPotentialAdversaries(raw) {
  if (!raw || !raw.trim() || raw.trim().toLowerCase() === 'any') return [];
  const names = [];
  // Replace each "Category (Name1, Name2)" group with just its contents
  const expanded = raw.replace(/[^,()]+\(([^)]+)\)/g, (_, inner) => inner);
  for (const part of expanded.split(',')) {
    const name = part.trim();
    if (name) names.push(name);
  }
  return names.map(name => ({ adversaryId: makeId('adversaries', name), name }));
}

function normalizeEnvironment(raw) {
  const id = makeId('environments', raw.name || '');
  return {
    id,
    name: raw.name || '',
    tier: parseInt(raw.tier) || 1,
    type: ENV_TYPE_MAP[(raw.type || '').toLowerCase()] || 'exploration',
    difficulty: parseInt(raw.difficulty) || 10,
    description: raw.description || '',
    impulses: raw.impulses || '',
    potential_adversaries: parseSrdPotentialAdversaries(raw.potential_adversaries),
    imageUrl: '',
    features: parseFeatures(raw.feature, id),
  };
}

function normalizeAbility(raw) {
  const id = makeId('abilities', raw.name || '');
  return {
    id,
    name: raw.name || '',
    level: parseInt(raw.level) || 1,
    domain: raw.domain || '',
    type: raw.type || '',
    recall_cost: parseInt(raw.recall) || 0,
    description: raw.text || '',
  };
}

function normalizeAncestry(raw) {
  const id = makeId('ancestries', raw.name || '');
  return {
    id,
    name: raw.name || '',
    description: raw.description || '',
    features: parseFeatures(raw.feature, id),
  };
}

function normalizeArmor(raw) {
  const id = makeId('armor', raw.name || '');
  return {
    id,
    name: raw.name || '',
    tier: parseInt(raw.tier) || 1,
    base_thresholds: raw.base_thresholds || '',
    base_score: parseInt(raw.base_score) || 0,
    features: parseFeatures(raw.feature, id),
  };
}

function normalizeBeastform(raw) {
  const id = makeId('beastforms', raw.name || '');
  return {
    id,
    name: raw.name || '',
    tier: parseInt(raw.tier) || 1,
    examples: raw.examples || '',
    trait_bonus: raw.trait_bonus || '',
    evasion_bonus: raw.evasion_bonus || '',
    attack: raw.attack || '',
    advantages: raw.advantages || '',
    features: parseFeatures(raw.feature, id),
  };
}

function normalizeClass(raw) {
  const id = makeId('classes', raw.name || '');
  return {
    id,
    name: raw.name || '',
    description: raw.description || '',
    domains: [raw.domain_1, raw.domain_2].filter(Boolean),
    starting_evasion: parseInt(raw.evasion) || 10,
    starting_hp: parseInt(raw.hp) || 5,
    class_items: raw.items || '',
    suggested_traits: raw.suggested_traits || '',
    suggested_primary: raw.suggested_primary || '',
    suggested_secondary: raw.suggested_secondary || '',
    suggested_armor: raw.suggested_armor || '',
    hope_feature: raw.hope_feature_name
      ? { name: raw.hope_feature_name, description: raw.hope_feature_text || '' }
      : null,
    class_features: parseFeatures(raw.feature, id),
    subclasses: [raw.subclass_1, raw.subclass_2].filter(Boolean),
    background_questions: (raw.background || []).map(b => b.question),
    connections: (raw.connection || []).map(c => c.question),
  };
}

function normalizeCommunity(raw) {
  const id = makeId('communities', raw.name || '');
  return {
    id,
    name: raw.name || '',
    description: raw.description || '',
    traits: raw.note || '',
    features: parseFeatures(raw.feature, id),
  };
}

function normalizeConsumable(raw) {
  const id = makeId('consumables', raw.name || '');
  return {
    id,
    name: raw.name || '',
    description: raw.description || '',
  };
}

function normalizeDomain(raw) {
  const id = makeId('domains', raw.name || '');
  return {
    id,
    name: raw.name || '',
    description: raw.description || '',
    cards: (raw.card || []).map((levelOptions, idx) => ({
      level: idx + 1,
      options: levelOptions,
    })),
  };
}

function normalizeItem(raw) {
  const id = makeId('items', raw.name || '');
  return {
    id,
    name: raw.name || '',
    description: raw.description || '',
  };
}

function normalizeSubclass(raw) {
  const id = makeId('subclasses', raw.name || '');
  return {
    id,
    name: raw.name || '',
    description: raw.description || '',
    spellcast_trait: raw.spellcast_trait || '',
    foundation_features: parseFeatures(raw.foundation, `${id}-foundation`),
    specialization_features: parseFeatures(raw.specialization, `${id}-spec`),
    mastery_features: parseFeatures(raw.mastery, `${id}-mastery`),
  };
}

function normalizeWeapon(raw) {
  const id = makeId('weapons', raw.name || '');
  return {
    id,
    name: raw.name || '',
    tier: parseInt(raw.tier) || 1,
    primary_or_secondary: raw.primary_or_secondary || '',
    physical_or_magical: raw.physical_or_magical || '',
    trait: raw.trait || '',
    range: raw.range || '',
    damage: raw.damage || '',
    burden: raw.burden || '',
    features: parseFeatures(raw.feature, id),
  };
}

const NORMALIZERS = {
  abilities:    normalizeAbility,
  adversaries:  normalizeAdversary,
  ancestries:   normalizeAncestry,
  armor:        normalizeArmor,
  beastforms:   normalizeBeastform,
  classes:      normalizeClass,
  communities:  normalizeCommunity,
  consumables:  normalizeConsumable,
  domains:      normalizeDomain,
  environments: normalizeEnvironment,
  items:        normalizeItem,
  subclasses:   normalizeSubclass,
  weapons:      normalizeWeapon,
};

export const COLLECTION_NAMES = Object.keys(NORMALIZERS).sort();

// --- In-memory cache ---

let cache = null;

async function readJSON(collection) {
  const raw = await readFile(join(JSON_DIR, `${collection}.json`), 'utf8');
  return JSON.parse(raw.replace(/^\uFEFF/, ''));
}

async function loadAll() {
  const entries = await Promise.all(
    COLLECTION_NAMES.map(async name => {
      const raw = await readJSON(name);
      const normalized = raw.map(item => NORMALIZERS[name](item));
      const byId = new Map(normalized.map(item => [item.id, item]));
      return [name, { items: normalized, byId }];
    })
  );
  return Object.fromEntries(entries);
}

async function getCache() {
  if (!cache) cache = await loadAll();
  return cache;
}

// --- Public API ---

export async function getCollectionNames() {
  return COLLECTION_NAMES;
}

export async function getCollection(name) {
  const c = await getCache();
  return c[name]?.items ?? null;
}

export async function getItem(collection, id) {
  const c = await getCache();
  return c[collection]?.byId.get(id) ?? null;
}

/**
 * Search a collection with optional filters and pagination.
 *
 * @param {string} collection
 * @param {{ search?: string, tier?: string|number|null, tierMax?: number|null, tiers?: number[], type?: string|null, types?: string[], limit?: number, offset?: number }} opts
 * @returns {Promise<{ items: Array, totalCount: number }>}
 */
export async function searchCollection(collection, {
  search = '',
  tier = null,
  tierMax = null,
  tiers = [],
  type = null,
  types = [],
  limit = 20,
  offset = 0,
} = {}) {
  const c = await getCache();
  if (!c[collection]) return { items: [], totalCount: 0 };

  let items = c[collection].items;

  if (search) {
    const q = search.toLowerCase();
    items = items.filter(item => item.name.toLowerCase().includes(q));
  }

  if (tierMax != null) {
    const max = Number(tierMax);
    items = items.filter(item => (Number(item.tier) || 1) <= max);
  } else if (Array.isArray(tiers) && tiers.length > 0) {
    const tierSet = new Set(tiers.map(t => String(t)));
    items = items.filter(item => tierSet.has(String(item.tier)));
  } else if (tier != null) {
    const t = String(tier);
    items = items.filter(item => String(item.tier) === t);
  }

  const typeField =
    collection === 'adversaries'  ? 'role' :
    collection === 'environments' ? 'type' :
    collection === 'abilities'    ? 'type' :
    collection === 'weapons'      ? 'primary_or_secondary' :
    null;

  if (typeField && Array.isArray(types) && types.length > 0) {
    const typeSet = new Set(types.map(t => t.toLowerCase()));
    items = items.filter(item => typeSet.has((item[typeField] || '').toLowerCase()));
  } else if (typeField && type != null) {
    const t = type.toLowerCase();
    items = items.filter(item => (item[typeField] || '').toLowerCase() === t);
  }

  const totalCount = items.length;
  if (limit === 0) return { items: [], totalCount };
  const lim = Math.max(1, Number(limit) || 20);
  const off = Math.max(0, Number(offset) || 0);
  return { items: items.slice(off, off + lim), totalCount };
}

/**
 * Warm the cache at startup. Call this once during server init to avoid a
 * slow first request.
 */
export async function warmCache() {
  await getCache();
  const total = COLLECTION_NAMES.reduce((n, col) => n + (cache[col]?.items.length ?? 0), 0);
  console.log(`[srd] Loaded ${total} items across ${COLLECTION_NAMES.length} collections`);
}
