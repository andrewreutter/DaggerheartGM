import { ROLES } from './game-constants.js';

const FCG_SEARCH_URL = 'https://freshcutgrass.app/api/adversaries/public/search';

const VALID_ROLES = new Set(ROLES);
const VALID_ENV_TYPES = new Set(['traversal', 'exploration', 'social', 'event']);
const VALID_RANGES = ['Melee', 'Very Close', 'Close', 'Far', 'Very Far'];
const VALID_TRAITS = new Set(['phy', 'mag', 'dir']);

function normRole(raw) {
  const lower = (raw || '').toLowerCase().trim();
  return VALID_ROLES.has(lower) ? lower : 'standard';
}

function normEnvType(raw) {
  // "EnvironmentTraversal" -> strip prefix -> "traversal"
  const stripped = (raw || '').replace(/^Environment/i, '').toLowerCase().trim();
  return VALID_ENV_TYPES.has(stripped) ? stripped : 'event';
}

function normRange(raw) {
  if (!raw) return 'Melee';
  const lower = (raw || '').toLowerCase().trim();
  return VALID_RANGES.find(r => r.toLowerCase() === lower) || 'Melee';
}

// Parse "1d12+2 phy" -> { damage: "1d12+2", trait: "Phy" }
// Parse "1d10" or "1d6+2" -> { damage: "1d10", trait: "Phy" } (default)
function parseDamage(raw) {
  if (!raw) return { damage: '', trait: 'Phy' };
  const parts = raw.trim().split(/\s+/);
  if (parts.length >= 2 && VALID_TRAITS.has(parts[parts.length - 1].toLowerCase())) {
    const trait = parts[parts.length - 1];
    const damage = parts.slice(0, parts.length - 1).join(' ');
    return { damage, trait: trait.charAt(0).toUpperCase() + trait.slice(1).toLowerCase() };
  }
  return { damage: raw.trim(), trait: 'Phy' };
}

// Parse "+2", "2", "0", null -> integer
function parseModifier(raw) {
  if (raw === null || raw === undefined || raw === '') return 0;
  return parseInt(String(raw).replace(/^\+/, ''), 10) || 0;
}

// Parse "Blind obedience +2" -> { name: "Blind obedience", modifier: 2 }
// Parse "Looks like twigs" -> { name: "Looks like twigs", modifier: 0 }
function parseExperience(str) {
  const match = (str || '').match(/^(.+?)\s*([+-]\d+)\s*$/);
  if (match) {
    return { name: match[1].trim(), modifier: parseInt(match[2], 10) };
  }
  return { name: (str || '').trim(), modifier: 0 };
}

// Build feature description combining description + flavourText + uses
function buildFeatureDescription(f) {
  const parts = [];
  if (f.uses && f.uses > 1) parts.push(`(${f.uses} uses)`);
  if (f.description) parts.push(f.description);
  if (f.flavourText) parts.push(f.flavourText);
  return parts.join('\n\n').trim();
}

function translateAdversary(item) {
  const { damage, trait } = parseDamage(item.weapon?.damage);
  const modifier = parseModifier(item.attackModifier);
  const range = normRange(item.weapon?.range);
  const weaponName = item.weapon?.name || '';

  const experiences = (item.experience || []).map(e => {
    const { name, modifier: mod } = parseExperience(e);
    return { id: crypto.randomUUID(), name, modifier: mod };
  });

  const features = (item.features || []).map(f => ({
    id: crypto.randomUUID(),
    name: f.name || '',
    type: (f.type || 'passive').toLowerCase(),
    description: buildFeatureDescription(f),
  }));

  return {
    id: `fcg-${item.id}`,
    name: item.name || '',
    tier: item.tier || 1,
    role: normRole(item.type),
    description: item.shortDescription || '',
    motive: (item.motivesAndTactics || []).join(', '),
    difficulty: item.difficulty || 10,
    hp_max: item.hitPoints || 6,
    stress_max: item.stress || 3,
    hp_thresholds: {
      major: item.damageThresholds?.major ?? Math.floor((item.hitPoints || 6) / 2),
      severe: item.damageThresholds?.severe ?? (item.hitPoints || 6),
    },
    attack: {
      name: weaponName,
      range,
      modifier,
      trait,
      damage,
    },
    experiences,
    features,
    imageUrl: item.image ? `https://freshcutgrass.app${item.image}` : '',
    _source: 'fcg',
  };
}

function translateEnvironment(item) {
  const features = (item.features || []).map(f => ({
    id: crypto.randomUUID(),
    name: f.name || '',
    type: (f.type || 'passive').toLowerCase(),
    description: buildFeatureDescription(f),
  }));

  const descParts = [];
  if (item.shortDescription) descParts.push(item.shortDescription);
  if (item.toneAndFeel) descParts.push(item.toneAndFeel);

  return {
    id: `fcg-${item.id}`,
    name: item.name || '',
    tier: item.tier || 1,
    type: normEnvType(item.type),
    description: descParts.join('\n\n'),
    difficulty: item.difficulty || 10,
    potential_adversaries: (item.potentialAdversaries || []).filter(Boolean).map(name => ({ name: name.trim() })),
    features,
    imageUrl: item.image ? `https://freshcutgrass.app${item.image}` : '',
    _source: 'fcg',
  };
}

function isEnvironmentType(type) {
  return (type || '').startsWith('Environment');
}

/**
 * Search FCG public adversaries/environments API.
 *
 * @param {object} opts
 * @param {string}  [opts.search]     Free-form search text
 * @param {number}  [opts.tier]       Tier filter (1-4)
 * @param {string}  [opts.role]       FCG role value (e.g. "Bruiser", "EnvironmentTraversal")
 * @param {string}  [opts.category]   FCG category filter (e.g. "Environments")
 * @param {string}  [opts.collection] 'adversaries' | 'environments' | undefined (both)
 * @param {number}  [opts.limit]      Max results to return (default 100)
 * @param {number}  [opts.offset]     Offset into FCG results (default 0)
 * @returns {{ adversaries, environments, fcgTotal }}
 *   fcgTotal is FCG's totalCount for the filtered query.
 *   When role or category is set, this is already filtered server-side by FCG.
 *   When neither is set and collection is 'adversaries', it includes environments (estimate).
 */
export async function searchFCG({ search, tier, role, category, collection, limit = 100, offset = 0 } = {}) {
  const params = new URLSearchParams({ sort: 'popularity', limit: String(limit), offset: String(offset) });
  if (search) params.set('search', search);
  if (tier) params.set('tier', String(tier));
  if (role) params.set('role', role);
  if (category) params.set('category', category);

  const res = await fetch(`${FCG_SEARCH_URL}?${params}`);
  if (!res.ok) throw new Error(`FCG search API returned ${res.status}`);

  const json = await res.json();
  const items = json.data || [];
  const fcgTotal = json.totalCount || 0;

  const adversaries = [];
  const environments = [];

  for (const item of items) {
    if (isEnvironmentType(item.type)) {
      if (!collection || collection === 'environments') {
        environments.push(translateEnvironment(item));
      }
    } else {
      if (!collection || collection === 'adversaries') {
        adversaries.push(translateAdversary(item));
      }
    }
  }

  return { adversaries, environments, fcgTotal };
}
