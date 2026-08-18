import { maxSelectableDomainCardLevelForRow } from './advancement-rules.js';

const TRAIT_KEYS_ORDER = ['agility', 'strength', 'finesse', 'instinct', 'presence', 'knowledge'];

/**
 * Trait names tied for the highest score (lowercased keys).
 * Used to mark trait-optimal weapons in the character builder.
 */
export function highestTraitNames(traits) {
  if (!traits) return [];
  let max = -Infinity;
  for (const k of TRAIT_KEYS_ORDER) {
    const v = traits[k] ?? 0;
    if (v > max) max = v;
  }
  if (max === -Infinity) return [];
  return TRAIT_KEYS_ORDER.filter((k) => (traits[k] ?? 0) === max);
}

export function pickRandom(arr, randomFn = Math.random) {
  if (!arr?.length) return undefined;
  const rng = typeof randomFn === 'function' ? randomFn : Math.random;
  return arr[Math.floor(rng() * arr.length)];
}

function abilitySelectableForStartingSlot(ability, characterLevel, multiclassDomain) {
  const domain = ability?.domain || '';
  const cap = maxSelectableDomainCardLevelForRow(characterLevel, 1, domain, multiclassDomain);
  return (ability.level || 1) <= cap;
}

/**
 * After a class (and suggested traits) is chosen: pick a trait-optimal primary
 * (and secondary unless two-handed), a random armor, and two random domain cards
 * — one from each class domain when possible.
 */
export function pickSuggestedClassLoadout({
  traits,
  weapons = [],
  armor = [],
  abilities = [],
  classDomains = [],
  characterLevel = 1,
  multiclassDomain = null,
  randomFn = Math.random,
} = {}) {
  const best = highestTraitNames(traits);
  const favored = (w) => best.includes((w.trait || '').toLowerCase());

  const primaryWeapons = weapons.filter((w) => w.primary_or_secondary !== 'Secondary');
  const primaryFavored = primaryWeapons.filter(favored);
  const primaryCandidates = primaryFavored.length ? primaryFavored : primaryWeapons;
  const primaryWeapon = pickRandom(primaryCandidates, randomFn);
  const primaryWeaponId = primaryWeapon?.id ?? null;
  const isTwoHanded = primaryWeapon?.burden === 'Two-Handed';

  let secondaryWeaponId = null;
  if (!isTwoHanded) {
    const secondaryWeapons = weapons.filter((w) => w.primary_or_secondary !== 'Primary');
    const secondaryFavored = secondaryWeapons.filter(favored);
    const secondaryCandidates = secondaryFavored.length ? secondaryFavored : secondaryWeapons;
    const secondaryWeapon = pickRandom(secondaryCandidates, randomFn);
    secondaryWeaponId = secondaryWeapon?.id ?? null;
  }

  const randomArmor = pickRandom(armor, randomFn);
  const armorId = randomArmor?.id ?? null;

  const byDomain = {};
  for (const a of abilities) {
    const d = a.domain || '';
    if (!classDomains.includes(d)) continue;
    if (!abilitySelectableForStartingSlot(a, characterLevel, multiclassDomain)) continue;
    if (!byDomain[d]) byDomain[d] = [];
    byDomain[d].push(a);
  }
  const abilityIds = [];
  const used = new Set();
  for (let i = 0; i < 2; i++) {
    const domainName = classDomains[i];
    const domainAbilities = byDomain[domainName] || [];
    const available = domainAbilities.filter((a) => !used.has(a.id));
    const chosen = pickRandom(available, randomFn);
    if (chosen) used.add(chosen.id);
    abilityIds.push(chosen?.id ?? null);
  }

  return { primaryWeaponId, secondaryWeaponId, armorId, abilityIds };
}
