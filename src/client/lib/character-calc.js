/**
 * Character calculation utilities.
 * Pure functions that compute derived stats from character selections + SRD data.
 */

const TIER_LEVELS = [1, 2, 5, 8]; // level thresholds for tiers 1–4

export function tierFromLevel(level) {
  if (level >= 8) return 4;
  if (level >= 5) return 3;
  if (level >= 2) return 2;
  return 1;
}

const TRAIT_POOL = [2, 1, 1, 0, 0, -1];
const TRAIT_KEYS = ['agility', 'strength', 'finesse', 'instinct', 'presence', 'knowledge'];

export function isTraitAssignmentComplete(baseTraits) {
  if (!baseTraits) return false;
  const assigned = TRAIT_KEYS.map(k => baseTraits[k]).filter(v => v != null);
  return assigned.length === 6;
}

/**
 * Validate that the baseTraits assignment uses exactly the allowed pool.
 * Returns true if valid.
 */
export function isValidTraitAssignment(baseTraits) {
  if (!baseTraits) return false;
  const values = TRAIT_KEYS.map(k => baseTraits[k]).filter(v => v != null).sort((a, b) => b - a);
  if (values.length !== 6) return false;
  const pool = [...TRAIT_POOL].sort((a, b) => b - a);
  return values.every((v, i) => v === pool[i]);
}

/**
 * Compute final trait values = baseTraits + advancement bonuses.
 */
export function computeTraits(baseTraits, advancements, level) {
  const result = {};
  for (const k of TRAIT_KEYS) {
    result[k] = baseTraits?.[k] ?? 0;
  }
  if (advancements) {
    for (let lvl = 2; lvl <= (level || 1); lvl++) {
      const adv = advancements[String(lvl)];
      if (!adv?.picks) continue;
      for (const pick of adv.picks) {
        if (pick.type === 'traits' && Array.isArray(pick.traits)) {
          for (const t of pick.traits) {
            if (t in result) result[t] += 1;
          }
        }
      }
    }
  }
  return result;
}

/**
 * Compute max HP from class base + advancement HP picks.
 */
export function computeMaxHp(classData, advancements, level) {
  let hp = classData?.starting_hp ?? 6;
  if (advancements) {
    for (let lvl = 2; lvl <= (level || 1); lvl++) {
      const adv = advancements[String(lvl)];
      if (!adv?.picks) continue;
      for (const pick of adv.picks) {
        if (pick.type === 'hp') hp += 1;
      }
    }
  }
  return hp;
}

/**
 * Compute max Stress from base (6) + advancement stress picks.
 */
export function computeMaxStress(advancements, level) {
  let stress = 6;
  if (advancements) {
    for (let lvl = 2; lvl <= (level || 1); lvl++) {
      const adv = advancements[String(lvl)];
      if (!adv?.picks) continue;
      for (const pick of adv.picks) {
        if (pick.type === 'stress') stress += 1;
      }
    }
  }
  return stress;
}

/**
 * Compute evasion from class base + advancement evasion picks.
 */
export function computeEvasion(classData, advancements, level) {
  let evasion = classData?.starting_evasion ?? 10;
  if (advancements) {
    for (let lvl = 2; lvl <= (level || 1); lvl++) {
      const adv = advancements[String(lvl)];
      if (!adv?.picks) continue;
      for (const pick of adv.picks) {
        if (pick.type === 'evasion') evasion += 1;
      }
    }
  }
  return evasion;
}

/**
 * Compute proficiency from base (1) + advancement proficiency picks.
 */
export function computeProficiency(advancements, level) {
  let prof = 1;
  if (advancements) {
    for (let lvl = 2; lvl <= (level || 1); lvl++) {
      const adv = advancements[String(lvl)];
      if (!adv?.picks) continue;
      for (const pick of adv.picks) {
        if (pick.type === 'proficiency') prof += 1;
      }
    }
  }
  return prof;
}

/**
 * Parse an armor's base_thresholds string like "Major 3 / Severe 5" into { major, severe }.
 */
export function parseArmorThresholds(thresholdStr) {
  if (!thresholdStr) return null;
  const m = thresholdStr.match(/(\d+)\s*\/\s*(\d+)/);
  if (!m) return null;
  return { major: parseInt(m[1], 10), severe: parseInt(m[2], 10) };
}

/**
 * Resolve armor stats from an SRD armor item.
 */
export function resolveArmor(armorItem) {
  if (!armorItem) return null;
  const thresholds = parseArmorThresholds(armorItem.base_thresholds);
  return {
    armorScore: armorItem.base_score ?? 0,
    armorName: armorItem.name,
    armorThresholds: thresholds,
    maxArmor: armorItem.base_score ?? 0,
  };
}

const ARMOR_MOD_REGEX = /([+-]\d+)\s+to\s+(Finesse|Agility|Strength|Instinct|Presence|Knowledge|Evasion|Armor Score|Severe damage threshold)/gi;
const ARMOR_DIFFICULT_REGEX = /([+-]\d+)\s+to\s+all\s+character\s+traits(?:\s+and\s+(Evasion))?/i;
const ARMOR_ROLL_MOD_REGEX = /([+-]\d+)\s+(?:bonus\s+)?to\s+(?:rolls?\b|Spellcast\s+Rolls?)/i;

/**
 * Parse armor feature text and return stat modifiers + roll modifiers.
 * Mirrors computeWeaponModifiers but for the equipped armor item.
 * Returns { traits, evasion, rollModifiers, feature, sources }.
 */
export function computeArmorModifiers(armorItem) {
  const result = {
    traits: {},
    evasion: 0,
    rollModifiers: [],
    feature: null,
    sources: [],
  };
  if (!armorItem) return result;

  const features = armorItem.features || [];
  if (!features.length) return result;

  const feat = features[0];
  result.feature = { name: feat.name, description: feat.description || feat.text || '' };
  const text = feat.description || feat.text || '';
  if (!text) return result;

  // Special-case: "Difficult" — "-1 to all character traits and Evasion"
  const difficultMatch = ARMOR_DIFFICULT_REGEX.exec(text);
  if (difficultMatch) {
    const value = parseInt(difficultMatch[1], 10);
    for (const k of TRAIT_KEYS) {
      result.traits[k] = (result.traits[k] || 0) + value;
      result.sources.push({ armor: armorItem.name, feature: feat.name, stat: k, value });
    }
    if (difficultMatch[2]) {
      result.evasion += value;
      result.sources.push({ armor: armorItem.name, feature: feat.name, stat: 'evasion', value });
    }
    return result;
  }

  // Standard stat modifiers: "+1 to Evasion", "-1 to Agility", etc.
  let match;
  ARMOR_MOD_REGEX.lastIndex = 0;
  while ((match = ARMOR_MOD_REGEX.exec(text)) !== null) {
    const value = parseInt(match[1], 10);
    const statName = match[2].toLowerCase();
    const mapping = WEAPON_STAT_MAP[statName];
    if (!mapping) continue;
    if (mapping.type === 'trait') {
      result.traits[mapping.key] = (result.traits[mapping.key] || 0) + value;
    } else if (mapping.type === 'evasion') {
      result.evasion += value;
    }
    result.sources.push({ armor: armorItem.name, feature: feat.name, stat: statName, value });
  }

  // Roll modifiers: "+1 to Spellcast Rolls", "+2 bonus to rolls to move silently"
  const rollMatch = ARMOR_ROLL_MOD_REGEX.exec(text);
  if (rollMatch) {
    const score = parseInt(rollMatch[1], 10);
    const isSpellcast = /spellcast/i.test(text);
    const isStealth = /silently|stealth/i.test(text);
    result.rollModifiers.push({
      name: feat.name,
      score,
      description: text,
      rollType: isSpellcast ? 'spellcast' : isStealth ? 'stealth' : 'other',
      // autoApply: always included in matching rolls without player selection.
      // Spellcast is a first-class roll type (like evasion is a stat), so
      // Channeling always applies. Stealth is situational like an experience.
      autoApply: isSpellcast,
    });
  }

  return result;
}

/**
 * Resolve a weapon from SRD data into the app's weapon format.
 */
export function resolveWeapon(weaponItem) {
  if (!weaponItem) return null;
  const feat = (weaponItem.features || [])[0] || null;
  return {
    name: weaponItem.name,
    damage: weaponItem.damage || '',
    damageType: weaponItem.physical_or_magical || '',
    range: weaponItem.range || '',
    trait: weaponItem.trait || '',
    burden: weaponItem.burden || '',
    feature: feat ? { name: feat.name, description: feat.description || '' } : null,
  };
}

/**
 * Resolve features from an SRD ancestry item, tagging each with source info.
 */
function resolveFeatures(items, sourceType, sourceName) {
  if (!items || !Array.isArray(items)) return [];
  return items.map(f => ({
    ...f,
    sourceType,
    source: sourceName || sourceType,
  }));
}

/**
 * Collect all domain card ability IDs from level 1 picks + advancements.
 */
export function collectAbilityIds(data) {
  const ids = (data.abilityIds || []).filter(Boolean);
  if (data.advancements) {
    for (const [, adv] of Object.entries(data.advancements)) {
      if (adv.domainCardId) ids.push(adv.domainCardId);
      if (adv.picks) {
        for (const pick of adv.picks) {
          if (pick.type === 'domain_card' && pick.abilityId) ids.push(pick.abilityId);
        }
      }
    }
  }
  return [...new Set(ids)];
}

/**
 * Main recompute function: given raw character data + srdData, returns
 * the character with all derived fields recomputed.
 */
export function recomputeCharacter(data, srdData) {
  if (!data) return data;
  if (!srdData) return data;

  const result = { ...data };
  const level = data.level ?? 1;
  result.tier = tierFromLevel(level);

  // Resolve class
  const srdClass = srdData.classesById?.[data.classId] || null;
  if (srdClass) {
    result.class = srdClass.name;
    result.domains = srdClass.domains || [];
    result.hopeFeature = srdClass.hope_feature || null;
    result.classFeatures = resolveFeatures(srdClass.class_features, 'class', srdClass.name);
  } else {
    result.class = data.class || null;
    result.domains = data.domains || [];
  }

  // Resolve subclass
  const srdSubclass = srdData.subclassesById?.[data.subclassId] || null;
  if (srdSubclass) {
    result.subclass = srdSubclass.name;
    result.spellcastTrait = srdSubclass.spellcast_trait || null;
    const tier = result.tier;
    const subFeatures = [];
    if (srdSubclass.foundation_features) {
      subFeatures.push(...resolveFeatures(srdSubclass.foundation_features, 'subclass', srdSubclass.name));
    }
    if (tier >= 2 && srdSubclass.specialization_features) {
      subFeatures.push(...resolveFeatures(srdSubclass.specialization_features, 'subclass', srdSubclass.name));
    }
    if (tier >= 3 && srdSubclass.mastery_features) {
      subFeatures.push(...resolveFeatures(srdSubclass.mastery_features, 'subclass', srdSubclass.name));
    }
    result.subclassFeatures = subFeatures;
  } else {
    result.subclass = data.subclass || null;
  }

  // Resolve ancestries
  const ancestryIds = data.ancestryIds || [];
  const ancestryNames = [];
  const ancestryFeatures = [];
  for (const aId of ancestryIds) {
    const srdAnc = srdData.ancestriesById?.[aId];
    if (srdAnc) {
      ancestryNames.push(srdAnc.name);
      ancestryFeatures.push(...resolveFeatures(srdAnc.features, 'ancestry', srdAnc.name));
    }
  }
  if (ancestryNames.length) result.ancestry = ancestryNames;
  if (ancestryFeatures.length) result.ancestryFeatures = ancestryFeatures;

  // Resolve community
  const srdCommunity = srdData.communitiesById?.[data.communityId] || null;
  if (srdCommunity) {
    result.community = srdCommunity.name;
    result.communityFeatures = resolveFeatures(srdCommunity.features, 'community', srdCommunity.name);
  } else {
    result.community = data.community || null;
  }

  // Derived stats
  result.traits = computeTraits(data.baseTraits, data.advancements, level);
  result.maxHp = computeMaxHp(srdClass, data.advancements, level);
  result.maxStress = computeMaxStress(data.advancements, level);
  result.evasion = computeEvasion(srdClass, data.advancements, level);
  result.proficiency = computeProficiency(data.advancements, level);
  result.maxHope = 6;

  // Resolve armor — always recompute from armorId so clearing to null removes stale stats
  result.armorScore = 0;
  result.armorName = null;
  result.armorThresholds = null;
  result.maxArmor = 0;
  const srdArmor = srdData.armorById?.[data.armorId] || null;
  if (srdArmor) {
    const armorStats = resolveArmor(srdArmor);
    Object.assign(result, armorStats);
  }

  // Apply armor feature modifiers BEFORE weapon modifiers
  const armorMods = computeArmorModifiers(srdArmor);
  result.armorMods = armorMods;
  for (const [k, v] of Object.entries(armorMods.traits)) {
    if (result.traits && k in result.traits) result.traits[k] += v;
  }
  if (armorMods.evasion !== 0) result.evasion = (result.evasion ?? 0) + armorMods.evasion;

  // Resolve weapons — always reassign so clearing a weapon ID removes it from the display
  const weapons = [];
  const primaryWeapon = srdData.weaponsById?.[data.primaryWeaponId];
  const secondaryWeapon = srdData.weaponsById?.[data.secondaryWeaponId];
  if (primaryWeapon) weapons.push(resolveWeapon(primaryWeapon));
  if (secondaryWeapon) weapons.push(resolveWeapon(secondaryWeapon));
  result.weapons = weapons;

  // Apply weapon property modifiers (e.g. Cumbersome -1 Finesse, Heavy -1 Evasion)
  const weaponMods = computeWeaponModifiers(result.weapons || []);
  result.weaponMods = weaponMods;
  for (const [k, v] of Object.entries(weaponMods.traits)) {
    if (result.traits && k in result.traits) result.traits[k] += v;
  }
  if (weaponMods.evasion !== 0) result.evasion = (result.evasion ?? 0) + weaponMods.evasion;
  if (weaponMods.armorScore !== 0) {
    result.armorScore = (result.armorScore ?? 0) + weaponMods.armorScore;
    result.maxArmor = (result.maxArmor ?? 0) + weaponMods.armorScore;
  }
  if (weaponMods.severeThreshold !== 0 && result.armorThresholds) {
    result.armorThresholds = {
      ...result.armorThresholds,
      severe: result.armorThresholds.severe + weaponMods.severeThreshold,
    };
  }

  // Resolve abilities (domain cards)
  const allAbilityIds = collectAbilityIds(result);
  if (srdData.abilitiesById && allAbilityIds.length) {
    result.abilities = allAbilityIds.map(id => srdData.abilitiesById[id]).filter(Boolean);
  }

  return result;
}

// Mapping from SRD stat name strings to internal stat keys.
const WEAPON_STAT_MAP = {
  'finesse':                  { type: 'trait', key: 'finesse' },
  'agility':                  { type: 'trait', key: 'agility' },
  'strength':                 { type: 'trait', key: 'strength' },
  'instinct':                 { type: 'trait', key: 'instinct' },
  'presence':                 { type: 'trait', key: 'presence' },
  'knowledge':                { type: 'trait', key: 'knowledge' },
  'evasion':                  { type: 'evasion' },
  'armor score':              { type: 'armorScore' },
  'severe damage threshold':  { type: 'severeThreshold' },
};

const WEAPON_MOD_REGEX = /([+-]\d+)\s+to\s+(Finesse|Agility|Strength|Instinct|Presence|Knowledge|Evasion|Armor Score|Severe damage threshold)/gi;

/**
 * Parse weapon feature text and return aggregate stat modifiers for all equipped weapons.
 * Returns { traits, evasion, armorScore, severeThreshold, sources } where sources is an array
 * of { weapon, feature, stat, value } objects suitable for tooltip display.
 */
export function computeWeaponModifiers(weapons) {
  const result = {
    traits: {},
    evasion: 0,
    armorScore: 0,
    severeThreshold: 0,
    sources: [],
  };
  if (!weapons?.length) return result;

  for (const w of weapons) {
    const text = w.feature?.description || w.feature?.text || '';
    if (!text) continue;
    let match;
    WEAPON_MOD_REGEX.lastIndex = 0;
    while ((match = WEAPON_MOD_REGEX.exec(text)) !== null) {
      const value = parseInt(match[1], 10);
      const statName = match[2].toLowerCase();
      const mapping = WEAPON_STAT_MAP[statName];
      if (!mapping) continue;
      if (mapping.type === 'trait') {
        result.traits[mapping.key] = (result.traits[mapping.key] || 0) + value;
      } else if (mapping.type === 'evasion') {
        result.evasion += value;
      } else if (mapping.type === 'armorScore') {
        result.armorScore += value;
      } else if (mapping.type === 'severeThreshold') {
        result.severeThreshold += value;
      }
      result.sources.push({
        weapon: w.name,
        feature: w.feature.name,
        stat: statName,
        value,
      });
    }
  }
  return result;
}

/**
 * Extract the numeric bonus from a Paired feature description, e.g. "+2 to primary weapon damage…" → 2.
 */
export function parsePairedBonus(featText) {
  if (!featText) return 2;
  const m = featText.match(/\+(\d+)/);
  return m ? parseInt(m[1], 10) : 2;
}

/**
 * Apply a flat numeric bonus to a damage string.
 * "d8" → "d8+2", "d8+1" → "d8+3", "2d6-1" → "2d6+1"
 */
export function applyDamageBonus(damageStr, bonus) {
  if (!damageStr || bonus === 0) return damageStr;
  const m = damageStr.trim().match(/^([^\s+\-]+)([+-]\d+)?(\s+.*)?$/);
  if (!m) return `${damageStr}+${bonus}`;
  const dice = m[1];
  const existing = m[2] ? parseInt(m[2], 10) : 0;
  const suffix = m[3] || '';
  const total = existing + bonus;
  const mod = total > 0 ? `+${total}` : total < 0 ? String(total) : '';
  return `${dice}${mod}${suffix}`;
}

/**
 * Detect paired weapons: find the secondary with a "Paired" feature and its primary partner.
 * Returns { primaryWeapon, pairedWeapon } or null.
 */
export function detectPairedWeapons(weapons) {
  if (!weapons || weapons.length < 2) return null;
  const pairedIdx = weapons.findIndex(w => w.feature?.name?.toLowerCase() === 'paired');
  if (pairedIdx === -1) return null;
  const pairedWeapon = weapons[pairedIdx];
  const primaryWeapon = weapons.find((w, i) => i !== pairedIdx);
  if (!primaryWeapon) return null;
  return { primaryWeapon, pairedWeapon };
}

/**
 * Parse a Versatile weapon's feature text and return a virtual alternate weapon.
 * Versatile feature text format: "This weapon can also be used with these statistics—{Trait}, {Range}, {Damage}."
 * Returns an alternate weapon object or null.
 */
export function parseVersatileAlternate(weapon) {
  const feat = weapon.feature;
  if (!feat || feat.name !== 'Versatile') return null;
  const text = feat.description || feat.text || '';
  const m = text.match(/—([^.]+)/);
  if (!m) return null;
  const parts = m[1].split(',').map(s => s.trim());
  if (parts.length < 3) return null;
  const [trait, range, damage] = parts;
  return {
    name: `${weapon.name} (Versatile)`,
    damage,
    damageType: weapon.damageType,
    range,
    trait,
    feature: weapon.feature,
    _versatile: true,
  };
}

/**
 * Returns an array of { original, alternate } for all Versatile weapons in the list.
 */
export function detectVersatileWeapons(weapons) {
  const result = [];
  for (const w of (weapons || [])) {
    if (w.feature?.name === 'Versatile') {
      const alternate = parseVersatileAlternate(w);
      if (alternate) result.push({ original: w, alternate });
    }
  }
  return result;
}

/**
 * Returns an array of { original, physicalVariant, magicalVariant } for all Otherworldly weapons.
 * Otherworldly feature text: "On a successful attack, you can deal physical or magic damage."
 */
export function detectOtherworldlyWeapons(weapons) {
  const result = [];
  for (const w of (weapons || [])) {
    if (w.feature?.name === 'Otherworldly') {
      const physicalVariant = { ...w, name: `${w.name} (Physical)`, damageType: 'Physical', _otherworldly: 'physical' };
      const magicalVariant = { ...w, name: `${w.name} (Magical)`, damageType: 'Magical', _otherworldly: 'magical' };
      result.push({ original: w, physicalVariant, magicalVariant });
    }
  }
  return result;
}

/**
 * Rewrite a damage string to add one extra die (for Charged feature).
 * e.g. "d8+3" → "2d8+3", "2d6" → "3d6"
 */
export function rewriteDamageForCharged(damageStr) {
  if (!damageStr) return damageStr;
  const m = damageStr.trim().match(/^(\d*)(d\d+)(.*)$/i);
  if (!m) return damageStr;
  const qty = parseInt(m[1] || '1', 10);
  return `${qty + 1}${m[2]}${m[3] || ''}`;
}

/**
 * Returns an array of { original, chargedVariant } for all Charged weapons.
 * Charged feature text: "Mark a Stress to gain +1 to your Proficiency on a primary weapon attack."
 */
export function detectChargedWeapons(weapons) {
  const result = [];
  for (const w of (weapons || [])) {
    if (w.feature?.name === 'Charged') {
      const chargedVariant = {
        ...w,
        name: `${w.name} (Charged)`,
        damage: rewriteDamageForCharged(w.damage),
        _charged: true,
      };
      result.push({ original: w, chargedVariant });
    }
  }
  return result;
}

/**
 * Check if a character has all required fields filled in.
 * Returns { complete: boolean, missing: string[] }.
 */
export function isCharacterComplete(data) {
  if (!data) return { complete: false, missing: ['No data'] };
  const missing = [];
  if (!data.name?.trim()) missing.push('Name');
  if (!data.classId && !data.class) missing.push('Class');
  if (!data.subclassId && !data.subclass) missing.push('Subclass');
  if (!(data.ancestryIds?.length) && !data.ancestry?.length) missing.push('Ancestry');
  if (!data.communityId && !data.community) missing.push('Community');
  const experienceCount = (data.experiences || []).filter(e => e.name?.trim()).length;
  if (experienceCount < 2) missing.push('Experiences (need 2)');
  const allIds = collectAbilityIds(data);
  // data.abilities is derived from the same abilityIds by recomputeCharacter, so use Math.max
  // to avoid double-counting while still supporting Daggerstack characters that store full
  // ability objects in data.abilities rather than just IDs.
  const abilityCount = Math.max(allIds.length, (data.abilities || []).length);

  if (abilityCount < 2) missing.push('Domain Cards (need 2)');
  return { complete: missing.length === 0, missing };
}

export { TRAIT_KEYS, TRAIT_POOL, TIER_LEVELS, WEAPON_STAT_MAP };
