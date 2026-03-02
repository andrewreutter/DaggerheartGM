/**
 * Fetch pre-built SRD JSON from seansbox/daggerheart-srd on GitHub,
 * transform to the app's data schema, and write to data/.
 *
 * Usage: node scripts/fetch-srd.js
 * Output: data/srd-adversaries.json, data/srd-environments.json
 */

import { writeFile, mkdir } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { randomUUID } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');

const BASE_URL = 'https://raw.githubusercontent.com/seansbox/daggerheart-srd/main/.build/03_json';

const VALID_ROLES = ['minion', 'social', 'support', 'horde', 'ranged', 'skulk', 'standard', 'leader', 'bruiser'];

const ENV_TYPE_MAP = {
  exploration: 'exploration',
  social: 'social',
  traversal: 'traversal',
  event: 'event',
};

const TRAIT_MAP = {
  phy: 'Phy',
  physical: 'Phy',
  mag: 'Mag',
  magic: 'Mag',
  dir: 'Dir',
  direct: 'Dir',
};

function stripMarkdown(text) {
  if (!text) return '';
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .trim();
}

function parseFeatureName(rawName) {
  // "Relentless (3) - Passive" -> { name: "Relentless (3)", type: "passive" }
  // "Earth Eruption - Action" -> { name: "Earth Eruption", type: "action" }
  const lastDash = rawName.lastIndexOf(' - ');
  if (lastDash >= 0) {
    const name = rawName.slice(0, lastDash).trim();
    const typeRaw = rawName.slice(lastDash + 3).toLowerCase().trim();
    const type = ['action', 'reaction', 'passive'].includes(typeRaw) ? typeRaw : 'passive';
    return { name, type };
  }
  return { name: rawName.trim(), type: 'passive' };
}

function parseFeatures(featureArr) {
  if (!Array.isArray(featureArr)) return [];
  return featureArr.map(f => {
    const { name, type } = parseFeatureName(f.name || '');
    return {
      id: randomUUID(),
      name,
      type,
      description: stripMarkdown(f.text || ''),
    };
  });
}

function parseExperiences(expStr) {
  if (!expStr) return [];
  // "Tremor Sense +2" or "Tremor Sense +2, Keen Senses +3"
  return expStr.split(/,\s*/).map(part => {
    const m = part.trim().match(/^(.+?)\s*([+-]\d+)$/);
    if (m) return { id: randomUUID(), name: m[1].trim(), modifier: parseInt(m[2]) };
    return null;
  }).filter(Boolean);
}

function parseDamageAndTrait(damageStr) {
  // "1d12+2 phy" -> { damage: "1d12+2", trait: "Phy" }
  if (!damageStr) return { damage: '', trait: 'Phy' };
  const parts = damageStr.trim().split(/\s+/);
  const damage = parts[0] || '';
  const traitRaw = (parts[1] || '').toLowerCase();
  const trait = TRAIT_MAP[traitRaw] || 'Phy';
  return { damage, trait };
}

function parseAttackModifier(atkStr) {
  if (!atkStr) return 0;
  return parseInt(atkStr.replace(/^\+/, '')) || 0;
}

function parseThresholds(threshStr) {
  if (!threshStr) return { major: null, severe: null };
  const m = threshStr.match(/(\d+)\s*\/\s*(\d+)/);
  if (m) return { major: parseInt(m[1]), severe: parseInt(m[2]) };
  return { major: null, severe: null };
}

function parseDifficulty(diffStr) {
  if (!diffStr) return 10;
  const n = parseInt(diffStr);
  return isNaN(n) ? 0 : n;
}

function transformAdversary(raw) {
  const roleKey = (raw.type || '').toLowerCase();
  const role = VALID_ROLES.includes(roleKey) ? roleKey : 'standard';
  const { damage, trait } = parseDamageAndTrait(raw.damage);

  return {
    id: randomUUID(),
    name: raw.name || '',
    tier: parseInt(raw.tier) || 1,
    role,
    motive: raw.motives_and_tactics || '',
    description: raw.description || '',
    imageUrl: '',
    difficulty: parseDifficulty(raw.difficulty),
    hp_max: parseInt(raw.hp) || 4,
    hp_thresholds: parseThresholds(raw.thresholds),
    stress_max: parseInt(raw.stress) || 2,
    attack: {
      name: raw.attack || '',
      range: raw.range || 'Melee',
      modifier: parseAttackModifier(raw.atk),
      trait,
      damage,
    },
    experiences: parseExperiences(raw.experience),
    features: parseFeatures(raw.feature),
  };
}

function transformEnvironment(raw) {
  const typeKey = (raw.type || '').toLowerCase();
  const type = ENV_TYPE_MAP[typeKey] || 'exploration';

  return {
    id: randomUUID(),
    name: raw.name || '',
    tier: parseInt(raw.tier) || 1,
    type,
    difficulty: parseDifficulty(raw.difficulty),
    description: raw.description || '',
    impulses: raw.impulses || '',
    potential_adversaries: raw.potential_adversaries || '',
    imageUrl: '',
    features: parseFeatures(raw.feature),
  };
}

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: HTTP ${res.status}`);
  return res.json();
}

async function main() {
  console.log('Fetching SRD data from GitHub...');

  const [rawAdversaries, rawEnvironments] = await Promise.all([
    fetchJSON(`${BASE_URL}/adversaries.json`),
    fetchJSON(`${BASE_URL}/environments.json`),
  ]);

  const adversaries = rawAdversaries.map(transformAdversary);
  const environments = rawEnvironments.map(transformEnvironment);

  console.log(`Fetched ${adversaries.length} adversaries, ${environments.length} environments`);

  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(join(DATA_DIR, 'srd-adversaries.json'), JSON.stringify(adversaries, null, 2));
  await writeFile(join(DATA_DIR, 'srd-environments.json'), JSON.stringify(environments, null, 2));

  console.log('Written to data/srd-adversaries.json and data/srd-environments.json');

  // Spot check
  const weaponmaster = adversaries.find(a => a.name === 'Weaponmaster');
  if (weaponmaster) {
    console.log('\nWeaponmaster check:', JSON.stringify({
      name: weaponmaster.name,
      tier: weaponmaster.tier,
      role: weaponmaster.role,
      difficulty: weaponmaster.difficulty,
      hp_max: weaponmaster.hp_max,
      hp_thresholds: weaponmaster.hp_thresholds,
      stress_max: weaponmaster.stress_max,
      attack: weaponmaster.attack,
      featureCount: weaponmaster.features.length,
    }, null, 2));
  }

  const grove = environments.find(e => e.name === 'Abandoned Grove');
  if (grove) {
    console.log('\nAbandoned Grove check:', JSON.stringify({
      name: grove.name,
      tier: grove.tier,
      type: grove.type,
      difficulty: grove.difficulty,
      featureCount: grove.features.length,
    }, null, 2));
  }
}

main().catch(err => { console.error(err); process.exit(1); });
