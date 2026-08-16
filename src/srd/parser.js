/**
 * SRD sub-application parser.
 *
 * Reads pre-built JSON from daggerheart-srd/.build/03_json/ (git submodule),
 * normalizes each collection into a typed schema, and caches everything in memory.
 *
 * Adversary and environment schemas match the existing app format so Game Table,
 * ItemCard, forms, etc. continue to work without modification.
 */

import { readFile, readdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { ROLES } from '../game-constants.js';
import { slugifySrdListName, makeSrdListId } from './srd-list-ids.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const JSON_DIR = join(__dirname, '..', '..', 'daggerheart-srd', '.build', '03_json');
const SRD_ROOT = join(__dirname, '..', '..', 'daggerheart-srd');
const SRD_README_PATH = join(SRD_ROOT, 'README.md');
const SRD_TEXT_CHUNKS_DIR = join(__dirname, '..', '..', 'data', 'srd-text-chunks');

// --- ID / slug helpers (nested feat/exp ids use same slugify as list rows) ---

const slugify = slugifySrdListName;
const makeId = makeSrdListId;

function stripMarkdown(raw) {
  return String(raw || '')
    .replace(/^---[\s\S]*?---\n*/m, '')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/\*\*|__|\*|_/g, '')
    .replace(/`+/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function excerptText(raw, max = 280) {
  const text = stripMarkdown(raw);
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1)).trimEnd()}...`;
}

function normalizeCampaignHeading(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function parseMarkdownFrontmatter(raw) {
  const text = String(raw || '');
  const m = text.match(/^---\n([\s\S]*?)\n---\n*/);
  if (!m) return { frontmatter: {}, body: text };

  const frontmatter = {};
  const lines = m[1].split('\n');
  let currentListKey = null;
  for (const line of lines) {
    const keyMatch = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (keyMatch) {
      const [, key, restRaw] = keyMatch;
      const rest = restRaw.trim();
      if (rest === '') {
        frontmatter[key] = [];
        currentListKey = key;
      } else {
        frontmatter[key] = rest.replace(/^"|"$/g, '').trim();
        currentListKey = null;
      }
      continue;
    }
    const listMatch = line.match(/^\s*-\s*(.*)$/);
    if (listMatch && currentListKey) {
      frontmatter[currentListKey].push(listMatch[1].replace(/^"|"$/g, '').trim());
    }
  }

  return { frontmatter, body: text.slice(m[0].length) };
}

function collectionSearchText(item, collection) {
  if (!item) return '';
  if (collection === 'rules') {
    return [
      item.name,
      item.breadcrumb,
      item.chapter,
      item.description,
      item.body,
    ].filter(Boolean).join('\n').toLowerCase();
  }
  if (collection === 'campaign_frames') {
    return [
      item.name,
      item.description,
      item.pitch,
      item.tone,
      item.themes,
      item.touchstones,
      item.overview,
      item.principles,
      item.distinctions,
      item.inciting_incident,
      item.campaign_mechanics,
      item.session_zero_questions,
    ].filter(Boolean).join('\n').toLowerCase();
  }
  return String(item.name || '').toLowerCase();
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
 * Short inner names / plurals from SRD potential-adversary lists that are not
 * the full adversary name. Used when no adversary catalog is passed in.
 *
 * Official SRD group shorthand (not a transcription error):
 *   "Outer Realms Monstrosities (Abomination, Corruptor, Thrall)"
 *   "Jagged Knife Bandits (Hexer, Kneebreaker, Lackey, Lieutenant, Shadow, Sniper)"
 * Standalone plural: "Fallen Shock Troops" → Fallen Shock Troop
 */
const POTENTIAL_ADVERSARY_NAME_ALIASES = {
  abomination: 'Outer Realms Abomination',
  corruptor: 'Outer Realms Corruptor',
  thrall: 'Outer Realms Thrall',
  hexer: 'Jagged Knife Hexer',
  kneebreaker: 'Jagged Knife Kneebreaker',
  lackey: 'Jagged Knife Lackey',
  lieutenant: 'Jagged Knife Lieutenant',
  shadow: 'Jagged Knife Shadow',
  sniper: 'Jagged Knife Sniper',
  'fallen shock troops': 'Fallen Shock Troop',
};

function isJunkPotentialAdversaryName(name) {
  const t = String(name || '').trim();
  if (!t) return true;
  if (/^any$/i.test(t)) return true;
  // Parser leftovers like `see "Ghostly Form"` — not real adversary names.
  if (/^see\b/i.test(t)) return true;
  return false;
}

function asKnownAdversaryNameMap(known) {
  if (!known) return null;
  if (known instanceof Map) return known;
  if (Array.isArray(known)) {
    const map = new Map();
    for (const name of known) {
      const t = String(name || '').trim();
      if (t) map.set(t.toLowerCase(), t);
    }
    return map;
  }
  return null;
}

function buildKnownAdversaryNameMap(rawAdversaries) {
  const map = new Map();
  for (const raw of rawAdversaries || []) {
    const name = String(raw?.name || '').trim();
    if (name) map.set(name.toLowerCase(), name);
  }
  return map;
}

function singularizeAdversaryName(name) {
  const t = String(name || '').trim();
  if (!t || /ss$/i.test(t) || !/s$/i.test(t)) return null;
  return t.slice(0, -1);
}

function groupPrefixCandidates(category, inner) {
  const cat = String(category || '').trim();
  const name = String(inner || '').trim();
  if (!cat || !name) return [];
  const words = cat.split(/\s+/);
  const out = [];
  if (words.length > 1) out.push(`${words.slice(0, -1).join(' ')} ${name}`);
  out.push(`${cat} ${name}`);
  return out;
}

function uniqueLastWordMatch(shortName, knownNames) {
  if (!knownNames) return null;
  const key = String(shortName || '').trim().toLowerCase();
  if (!key) return null;
  const hits = [];
  for (const [lower, canon] of knownNames) {
    const parts = lower.split(/\s+/);
    if (parts.length > 1 && parts[parts.length - 1] === key) hits.push(canon);
  }
  return hits.length === 1 ? hits[0] : null;
}

function resolvePotentialAdversaryName(rawName, category, knownNames) {
  const trimmed = String(rawName || '').trim();
  if (isJunkPotentialAdversaryName(trimmed)) return null;

  const aliased = POTENTIAL_ADVERSARY_NAME_ALIASES[trimmed.toLowerCase()] || null;
  const candidates = [];
  if (aliased) candidates.push(aliased);
  candidates.push(trimmed);
  candidates.push(...groupPrefixCandidates(category, trimmed));
  const singular = singularizeAdversaryName(trimmed);
  if (singular) {
    candidates.push(singular);
    candidates.push(...groupPrefixCandidates(category, singular));
  }

  if (knownNames) {
    for (const c of candidates) {
      const hit = knownNames.get(c.toLowerCase());
      if (hit) return hit;
    }
    const unique = uniqueLastWordMatch(trimmed, knownNames)
      || (singular ? uniqueLastWordMatch(singular, knownNames) : null);
    if (unique) return unique;
  }

  return aliased || trimmed;
}

/**
 * Walk an SRD potential-adversaries string into { category, name } segments.
 * Keeps the group label so short members can be prefixed (Jagged Knife Hexer).
 */
function splitPotentialAdversarySegments(raw) {
  const segments = [];
  const groupRe = /([^,()]+)\(([^)]+)\)/g;
  let lastIndex = 0;
  let m;
  while ((m = groupRe.exec(raw)) !== null) {
    for (const part of raw.slice(lastIndex, m.index).split(',')) {
      const t = part.trim();
      if (t) segments.push({ category: null, name: t });
    }
    const category = m[1].trim();
    for (const inner of m[2].split(',')) {
      const t = inner.trim();
      if (t) segments.push({ category, name: t });
    }
    lastIndex = m.index + m[0].length;
  }
  for (const part of raw.slice(lastIndex).split(',')) {
    const t = part.trim();
    if (t) segments.push({ category: null, name: t });
  }
  return segments;
}

/**
 * Parse the SRD `potential_adversaries` string into an array of structured references.
 *
 * SRD strings use mixed formats:
 *   "Beasts (Bear, Dire Wolf), Grove Guardians (Minor Treant, Sylvan Soldier)"
 *   "Guards (Bladed Guard, Head Guard), Masked Thief, Merchant"
 *   "Jagged Knife Bandits (Hexer, Kneebreaker, Lackey, Lieutenant, Shadow, Sniper)"
 *   "Outer Realms Monstrosities (Abomination, Corruptor, Thrall)"
 *   "Any"
 *
 * Groups (Category (A, B)) are flattened to individual names. Inner names that
 * already match an adversary stay as-is (Bear, Bladed Guard). Short members
 * (Hexer, Abomination) are expanded using the group stem, a catalog lookup
 * when `knownAdversaryNames` is provided, or a fallback alias map. Standalone
 * plurals (Fallen Shock Troops) singularize against the catalog / aliases.
 * Junk tokens (`Any`, `see "…"`) are dropped. Each name becomes a linked
 * reference using the deterministic SRD adversary ID.
 *
 * @param {string} raw
 * @param {Map<string, string>|string[]|null} [knownAdversaryNames]
 */
export function parseSrdPotentialAdversaries(raw, knownAdversaryNames = null) {
  if (!raw || !raw.trim() || raw.trim().toLowerCase() === 'any') return [];
  const known = asKnownAdversaryNameMap(knownAdversaryNames);
  const names = [];
  for (const seg of splitPotentialAdversarySegments(raw)) {
    const name = resolvePotentialAdversaryName(seg.name, seg.category, known);
    if (name) names.push(name);
  }
  return names.map(name => ({ adversaryId: makeId('adversaries', name), name }));
}

function normalizeEnvironment(raw, knownAdversaryNames = null) {
  const id = makeId('environments', raw.name || '');
  return {
    id,
    name: raw.name || '',
    tier: parseInt(raw.tier) || 1,
    type: ENV_TYPE_MAP[(raw.type || '').toLowerCase()] || 'exploration',
    difficulty: parseInt(raw.difficulty) || 10,
    description: raw.description || '',
    impulses: raw.impulses || '',
    potential_adversaries: parseSrdPotentialAdversaries(raw.potential_adversaries, knownAdversaryNames),
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

async function loadCampaignFramesCollection() {
  const raw = await readFile(SRD_README_PATH, 'utf8');
  const start = raw.indexOf('\n#### CAMPAIGN FRAMES');
  if (start < 0) return [];
  const nextH2 = raw.slice(start + 1).search(/\n##\s+/);
  const end = nextH2 >= 0 ? start + 1 + nextH2 : raw.length;
  const sectionRaw = raw.slice(start, end);
  const firstFrameHeading = sectionRaw.search(/\n###\s+/);
  const section = firstFrameHeading >= 0 ? sectionRaw.slice(firstFrameHeading + 1) : sectionRaw;
  const frameParts = section
    .split(/^###\s+/m)
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !part.startsWith('CAMPAIGN FRAMES'));

  return frameParts.map((part) => {
    const lines = part.split('\n');
    const name = String(lines.shift() || '').trim();
    const id = makeId('campaign_frames', name);
    const complexityMatch = part.match(/\*\*COMPLEXITY RATING:\*\*\s*(\d+)/i);
    const subsectionMap = new Map();
    const matches = [...part.matchAll(/^#####\s+(.+?)\s*$/gm)];
    for (let i = 0; i < matches.length; i++) {
      const heading = matches[i][1].trim();
      const startIdx = matches[i].index + matches[i][0].length;
      const endIdx = i + 1 < matches.length ? matches[i + 1].index : part.length;
      subsectionMap.set(normalizeCampaignHeading(heading), part.slice(startIdx, endIdx).trim());
    }

    const getSection = (...keys) => {
      for (const key of keys) {
        const val = subsectionMap.get(normalizeCampaignHeading(key));
        if (val) return val;
      }
      return '';
    };

    const pitch = getSection('The Pitch');
    const overview = getSection('Overview');
    const principles = [
      getSection('Player Principles'),
      getSection('GM Principles'),
    ].filter(Boolean).join('\n\n');
    return {
      id,
      name,
      complexity: complexityMatch ? parseInt(complexityMatch[1], 10) : null,
      description: excerptText(pitch || overview || part, 320),
      pitch,
      tone: getSection('Tone & Feel'),
      themes: getSection('Themes'),
      touchstones: getSection('Touchstones'),
      overview,
      principles,
      distinctions: getSection('Distinctions'),
      inciting_incident: getSection('The Inciting Incident', 'Inciting Incident'),
      campaign_mechanics: getSection('Special Mechanics', 'Campaign Mechanics'),
      session_zero_questions: getSection('Session Zero Questions', 'Questions to Consider', 'Questions for Session Zero'),
      source_file: 'daggerheart-srd/README.md',
      _source: 'srd',
    };
  }).filter((item) => item.name);
}

async function loadRulesCollection() {
  const files = (await readdir(SRD_TEXT_CHUNKS_DIR))
    .filter((name) => name.endsWith('.md'))
    .sort();

  const rows = await Promise.all(files.map(async (filename) => {
    const raw = await readFile(join(SRD_TEXT_CHUNKS_DIR, filename), 'utf8');
    const { frontmatter, body } = parseMarkdownFrontmatter(raw);
    const titleMatch = body.match(/^#\s+(.+?)\s*$/m);
    const name = String(titleMatch?.[1] || frontmatter.breadcrumb_titles?.at?.(-1) || frontmatter.breadcrumb || filename)
      .trim();
    const sourceFile = String(frontmatter.source_file || `data/srd-text-chunks/${filename}`);
    return {
      id: makeId('rules', String(frontmatter.breadcrumb || name || filename)),
      name,
      description: excerptText(body, 320),
      breadcrumb: String(frontmatter.breadcrumb || '').trim(),
      breadcrumb_titles: Array.isArray(frontmatter.breadcrumb_titles) ? frontmatter.breadcrumb_titles : [],
      chapter: String(frontmatter.chapter || '').trim(),
      body: body.trim(),
      excerpt: excerptText(body, 420),
      source_file: sourceFile,
      _source: 'srd',
    };
  }));

  return rows.filter((row) => row.name);
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

const EXTRA_COLLECTION_LOADERS = {
  campaign_frames: loadCampaignFramesCollection,
  rules: loadRulesCollection,
};

export const COLLECTION_NAMES = [...Object.keys(NORMALIZERS), ...Object.keys(EXTRA_COLLECTION_LOADERS)].sort();

// --- In-memory cache ---

let cache = null;

async function readJSON(collection) {
  const raw = await readFile(join(JSON_DIR, `${collection}.json`), 'utf8');
  return JSON.parse(raw.replace(/^\uFEFF/, ''));
}

async function loadAll() {
  const jsonNames = COLLECTION_NAMES.filter((name) => !EXTRA_COLLECTION_LOADERS[name]);
  const extraNames = COLLECTION_NAMES.filter((name) => EXTRA_COLLECTION_LOADERS[name]);

  const rawPairs = await Promise.all(jsonNames.map(async (name) => [name, await readJSON(name)]));
  const rawByName = Object.fromEntries(rawPairs);
  const knownAdversaryNames = buildKnownAdversaryNameMap(rawByName.adversaries);

  const result = {};
  for (const name of jsonNames) {
    const raw = rawByName[name];
    const normalized = name === 'environments'
      ? raw.map((item) => normalizeEnvironment(item, knownAdversaryNames))
      : raw.map((item) => NORMALIZERS[name](item));
    result[name] = {
      items: normalized,
      byId: new Map(normalized.map((item) => [item.id, item])),
    };
  }

  for (const name of extraNames) {
    const normalized = await EXTRA_COLLECTION_LOADERS[name]();
    result[name] = {
      items: normalized,
      byId: new Map(normalized.map((item) => [item.id, item])),
    };
  }
  return result;
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
    items = items.filter(item => collectionSearchText(item, collection).includes(q));
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
