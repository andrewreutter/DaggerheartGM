/**
 * Resolve LLM character-builder output to IDs and rules-safe patches (server + unit tests).
 * Handles mistaken human-readable names anywhere an SRD id is expected.
 */

import { randomUUID } from 'crypto';

import { expectedExperienceRowCount, isValidAdvancementPickType } from './client/lib/advancement-rules.js';

const TRAIT_KEYS = ['agility', 'strength', 'finesse', 'instinct', 'presence', 'knowledge'];
const TRAIT_POOL = [2, 1, 1, 0, 0, -1];

/** @param {string} s */
export function normalizeLookupKey(s) {
  if (s == null) return '';
  return String(s).trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * @param {object[]} items
 * @returns {{ byId: Record<string, object>, byName: Map<string, string>, dupNames: Set<string> }}
 */
export function buildLookupMaps(items) {
  const byId = {};
  const byName = new Map();
  const dupNames = new Set();
  for (const item of items || []) {
    if (!item?.id) continue;
    byId[item.id] = item;
    const k = normalizeLookupKey(item.name);
    if (!k) continue;
    if (byName.has(k)) dupNames.add(k);
    else byName.set(k, item.id);
  }
  return { byId, byName, dupNames };
}

/**
 * Resolve a raw value (id or display name) to a canonical id.
 * @param {unknown} raw
 * @param {{ byId: Record<string, object>, byName: Map<string, string>, dupNames: Set<string> }} maps
 * @param {{ warn: (m: string) => void, kind: string }} ctx
 */
export function resolveToId(raw, maps, ctx) {
  const { warn, kind } = ctx;
  if (raw == null || raw === '') return null;
  let t = typeof raw === 'number' ? String(raw) : raw;
  if (typeof t !== 'string') {
    warn(`Invalid ${kind} (expected string or id)`);
    return null;
  }
  t = t.trim();
  if (!t) return null;

  if (maps.byId[t]) return t;

  if (t.startsWith('srd-')) {
    warn(`Unknown ${kind} id "${t}"`);
    return null;
  }

  const k = normalizeLookupKey(t);
  if (maps.byName.has(k)) {
    if (maps.dupNames.has(k)) warn(`Ambiguous ${kind} name "${t}" — using first SRD match`);
    return maps.byName.get(k);
  }

  warn(`Could not resolve ${kind} "${raw}" to an SRD id`);
  return null;
}

/**
 * Resolve a level-1 domain card against **legal** class-domain abilities first; if the name/id
 * matches a real SRD card outside those domains, emit a clear warning (common LLM mistake).
 */
function resolveDomainAbilitySlot(slot, legalMaps, fullMaps, srdData, domainSet, warn, idx) {
  const noop = () => {};
  const kind = `domain ability slot ${idx + 1}`;
  const idLegal = resolveToId(slot, legalMaps, { warn: noop, kind });
  if (idLegal) return idLegal;

  const idFull = resolveToId(slot, fullMaps, { warn: noop, kind });
  if (idFull) {
    const ab = srdData.abilitiesById[idFull];
    if (!ab) return null;
    if ((ab.level || 1) > 1) {
      warn(`Ability "${ab.name}" is above level 1 — slot ${idx + 1} cleared`);
      return null;
    }
    if (!domainSet.has(ab.domain)) {
      const doms = [...domainSet].join(', ');
      warn(
        `"${ab.name}" is a ${ab.domain} domain card; this class only uses ${doms} — pick only from that class's level1DomainCards in the catalog — slot ${idx + 1} cleared`,
      );
      return null;
    }
  }
  resolveToId(slot, legalMaps, { warn, kind });
  return null;
}

/**
 * Parse a suggested_traits string like "0, -1, +1, 0, +2, +1" into a baseTraits map.
 * @param {string} str
 */
export function parseSuggestedTraits(str) {
  if (!str || typeof str !== 'string') return null;
  const parts = str.split(',').map((s) => parseInt(s.trim(), 10));
  if (parts.length !== 6 || parts.some(Number.isNaN)) return null;
  const result = {};
  TRAIT_KEYS.forEach((k, i) => {
    result[k] = parts[i];
  });
  return result;
}

export function isValidTraitAssignment(baseTraits) {
  if (!baseTraits) return false;
  const values = TRAIT_KEYS.map((k) => baseTraits[k]).filter((v) => v != null).sort((a, b) => b - a);
  if (values.length !== 6) return false;
  const pool = [...TRAIT_POOL].sort((a, b) => b - a);
  return values.every((v, i) => v === pool[i]);
}

/**
 * @param {object[]} experiences
 * @param {(m: string) => void} warn
 */
function normalizeExperiences(experiences, warn) {
  if (!Array.isArray(experiences)) return [];
  return experiences.map((e, i) => {
    if (!e || typeof e !== 'object') {
      warn(`Ignored invalid experience at index ${i}`);
      return { name: '', score: 2, id: randomUUID() };
    }
    const name = typeof e.name === 'string' ? e.name : '';
    let score = Number(e.score);
    if (Number.isNaN(score)) score = 2;
    score = Math.max(1, Math.min(5, Math.round(score)));
    const id = typeof e.id === 'string' && e.id.trim() ? e.id.trim() : randomUUID();
    const row = { name, score, id };
    if (e.tierEntryAuto) row.tierEntryAuto = true;
    return row;
  });
}

/**
 * @param {unknown} raw
 * @param {(m: string) => void} warn
 */
function sanitizeAdvancements(raw, warn) {
  if (!raw || typeof raw !== 'object') return {};
  /** @type {Record<string, { picks?: object[], domainCardId?: string }>} */
  const out = {};
  for (const [k, v] of Object.entries(raw)) {
    const lvl = parseInt(k, 10);
    if (Number.isNaN(lvl) || lvl < 2 || lvl > 10) continue;
    if (!v || typeof v !== 'object') continue;
    /** @type {{ picks: object[], domainCardId?: string }} */
    const row = { picks: [] };
    if (typeof v.domainCardId === 'string' && v.domainCardId.trim()) {
      row.domainCardId = v.domainCardId.trim();
    }
    if (Array.isArray(v.picks)) {
      for (const p of v.picks) {
        if (!p || typeof p !== 'object' || !p.type) continue;
        if (!isValidAdvancementPickType(String(p.type))) {
          warn(`Invalid advancement pick type at level ${lvl} — skipped`);
          continue;
        }
        row.picks.push({ ...p });
      }
    }
    out[String(lvl)] = row;
  }
  return out;
}

/**
 * Resolve experienceBonusChoices values that may be names or ids.
 * @param {Record<string, unknown>} raw
 * @param {{ id: string, name: string }[]} experiences
 * @param {(m: string) => void} warn
 */
function resolveExperienceBonusChoices(raw, experiences, warn) {
  if (!raw || typeof raw !== 'object') return {};
  const expMaps = buildLookupMaps(experiences);
  const out = {};
  for (const [featureName, val] of Object.entries(raw)) {
    if (!featureName) continue;
    const id = resolveToId(val, expMaps, { warn, kind: `experience (for ${featureName})` });
    if (id) out[featureName] = id;
  }
  return out;
}

/**
 * @param {unknown} raw
 * @param {object} srdData
 * @returns {{ patch: object, warnings: string[] }}
 */
export function resolveCharacterAiDraft(raw, srdData) {
  const warnings = [];
  const warn = (m) => warnings.push(m);

  const draft = raw && typeof raw === 'object' ? { ...raw } : {};

  const classMaps = buildLookupMaps(srdData.classes);
  const subclassMaps = buildLookupMaps(srdData.subclasses);
  const ancestryMaps = buildLookupMaps(srdData.ancestries);
  const communityMaps = buildLookupMaps(srdData.communities);
  const armorMaps = buildLookupMaps(srdData.armor);
  const weaponMaps = buildLookupMaps(srdData.weapons);
  const abilityMaps = buildLookupMaps(srdData.abilities);

  const classId = resolveToId(draft.classId ?? draft.class_id, classMaps, { warn, kind: 'class' });
  const selectedClass = classId ? srdData.classesById[classId] : null;

  let subclassId = resolveToId(draft.subclassId ?? draft.subclass_id, subclassMaps, { warn, kind: 'subclass' });
  if (subclassId && selectedClass) {
    const allowedNames = new Set((selectedClass.subclasses || []).map((n) => normalizeLookupKey(n)));
    const sc = srdData.subclassesById[subclassId];
    if (!sc || !allowedNames.has(normalizeLookupKey(sc.name))) {
      warn(`Subclass "${sc?.name || subclassId}" is not valid for the selected class — cleared`);
      subclassId = null;
    }
  } else if (subclassId && !selectedClass) {
    warn('Subclass ignored because class did not resolve');
    subclassId = null;
  }

  let ancestryIds = [];
  const rawAnc = draft.ancestryIds ?? draft.ancestry_ids;
  if (Array.isArray(rawAnc)) {
    for (const a of rawAnc) {
      const id = resolveToId(a, ancestryMaps, { warn, kind: 'ancestry' });
      if (id && !ancestryIds.includes(id)) ancestryIds.push(id);
    }
  } else {
    const one = resolveToId(rawAnc ?? draft.ancestryId ?? draft.ancestry_id, ancestryMaps, { warn, kind: 'ancestry' });
    if (one) ancestryIds = [one];
  }
  if (ancestryIds.length > 1) {
    warn('Multiple ancestries were returned — keeping the first (the editor uses one ancestry)');
    ancestryIds = ancestryIds.slice(0, 1);
  }

  const communityId = resolveToId(draft.communityId ?? draft.community_id, communityMaps, { warn, kind: 'community' });

  let resolvedLevel = 1;
  if (draft.level != null && draft.level !== '') {
    const lv = Math.round(Number(draft.level));
    if (Number.isFinite(lv) && lv >= 1 && lv <= 10) resolvedLevel = lv;
    else warn('Invalid level in draft — using level 1');
  }
  const armorCandidates = (srdData.armor || []).filter((a) => (a.tier || 1) <= resolvedLevel);
  const weaponCandidates = (srdData.weapons || []).filter((w) => (w.tier || 1) <= resolvedLevel);
  const armorMapsT1 = buildLookupMaps(armorCandidates);
  const weaponMapsT1 = buildLookupMaps(weaponCandidates);

  let primaryWeaponId = resolveToId(draft.primaryWeaponId ?? draft.primary_weapon_id, weaponMapsT1, {
    warn,
    kind: 'primary weapon',
  });
  if (draft.primaryWeaponId != null && primaryWeaponId == null) {
    const fallback = resolveToId(draft.primaryWeaponId ?? draft.primary_weapon_id, weaponMaps, {
      warn,
      kind: 'primary weapon (any tier)',
    });
    if (fallback) {
      warn('Primary weapon was not tier-1 eligible — using match anyway');
      primaryWeaponId = fallback;
    }
  }

  let secondaryWeaponId = resolveToId(draft.secondaryWeaponId ?? draft.secondary_weapon_id, weaponMapsT1, {
    warn,
    kind: 'secondary weapon',
  });
  if (draft.secondaryWeaponId != null && secondaryWeaponId == null) {
    const fallback = resolveToId(draft.secondaryWeaponId ?? draft.secondary_weapon_id, weaponMaps, {
      warn,
      kind: 'secondary weapon (any tier)',
    });
    if (fallback) {
      warn('Secondary weapon was not tier-1 eligible — using match anyway');
      secondaryWeaponId = fallback;
    }
  }

  let armorId = resolveToId(draft.armorId ?? draft.armor_id, armorMapsT1, { warn, kind: 'armor' });
  if (draft.armorId != null && armorId == null) {
    const fallback = resolveToId(draft.armorId ?? draft.armor_id, armorMaps, { warn, kind: 'armor (any tier)' });
    if (fallback) {
      warn('Armor was not tier-1 eligible — using match anyway');
      armorId = fallback;
    }
  }

  const domains = selectedClass?.domains || [];
  const domainSet = new Set(domains);

  const legalAbilityRows = (srdData.abilities || []).filter(
    (a) => (a.level || 1) <= 1 && domainSet.has(a.domain),
  );
  const legalAbilityMaps = buildLookupMaps(legalAbilityRows);

  const rawAbility = draft.abilityIds ?? draft.ability_ids;
  let abilitySlots = Array.isArray(rawAbility) ? [...rawAbility] : [];
  if (abilitySlots.length === 0 && draft.domainCards) abilitySlots = draft.domainCards;
  while (abilitySlots.length < 2) abilitySlots.push(null);
  if (abilitySlots.length > 2) {
    warn('More than two domain card slots were returned — truncated to two');
    abilitySlots = abilitySlots.slice(0, 2);
  }

  const resolvedAbilities = !selectedClass
    ? [null, null]
    : abilitySlots.map((slot, idx) =>
        resolveDomainAbilitySlot(slot, legalAbilityMaps, abilityMaps, srdData, domainSet, warn, idx + 1),
      );

  if (resolvedAbilities[0] && resolvedAbilities[1] && resolvedAbilities[0] === resolvedAbilities[1]) {
    warn('Duplicate domain cards — dropping the second slot');
    resolvedAbilities[1] = null;
  }

  let baseTraits = draft.baseTraits && typeof draft.baseTraits === 'object' ? { ...draft.baseTraits } : {};
  if (!isValidTraitAssignment(baseTraits)) {
    const suggested = selectedClass ? parseSuggestedTraits(selectedClass.suggested_traits) : null;
    if (suggested && isValidTraitAssignment(suggested)) {
      warn('Trait spread from the model was invalid — replaced with the class suggested spread');
      baseTraits = suggested;
    } else {
      warn('Trait spread from the model was invalid — cleared (assign manually)');
      baseTraits = {};
    }
  }

  let experiences = normalizeExperiences(draft.experiences, warn);
  const expNeeded = expectedExperienceRowCount(resolvedLevel);
  if (experiences.length > expNeeded) {
    warn(`Trimmed experiences to ${expNeeded} rows for level ${resolvedLevel}`);
    experiences = experiences.slice(0, expNeeded);
  }
  while (experiences.length < expNeeded) {
    experiences.push({ name: '', score: 2, id: randomUUID(), tierEntryAuto: true });
  }

  let advancements = {};
  if (resolvedLevel >= 2 && draft.advancements != null && typeof draft.advancements === 'object') {
    advancements = sanitizeAdvancements(draft.advancements, warn);
  }
  const experienceBonusChoices = resolveExperienceBonusChoices(
    draft.experienceBonusChoices ?? draft.experience_bonus_choices,
    experiences,
    warn,
  );

  const primaryWeapon = primaryWeaponId ? srdData.weaponsById[primaryWeaponId] : null;
  if (primaryWeapon?.burden === 'Two-Handed' && secondaryWeaponId) {
    warn('Secondary weapon removed because primary is two-handed');
    secondaryWeaponId = null;
  }

  let companion = null;
  if (draft.companion != null && typeof draft.companion === 'object') {
    const c = draft.companion;
    companion = {
      name: typeof c.name === 'string' ? c.name : '',
      species: typeof c.species === 'string' ? c.species : '',
      attackName: typeof c.attackName === 'string' ? c.attackName : typeof c.attack_name === 'string' ? c.attack_name : '',
      evasion: Number.isFinite(Number(c.evasion)) ? Math.round(Number(c.evasion)) : 10,
      maxStress: Number.isFinite(Number(c.maxStress ?? c.max_stress)) ? Math.round(Number(c.maxStress ?? c.max_stress)) : 3,
      currentStress: Number.isFinite(Number(c.currentStress ?? c.current_stress))
        ? Math.round(Number(c.currentStress ?? c.current_stress))
        : 0,
      experiences: normalizeExperiences(c.experiences, warn),
    };
    if (companion.experiences.length < 2) {
      while (companion.experiences.length < 2) {
        companion.experiences.push({ name: '', score: 2, id: randomUUID() });
      }
    }
  }

  const selectedSubclass = subclassId ? srdData.subclassesById[subclassId] : null;
  if (selectedSubclass?.name !== 'Beastbound') {
    companion = null;
  } else if (!companion) {
    companion = {
      name: '',
      species: '',
      attackName: '',
      evasion: 10,
      maxStress: 3,
      currentStress: 0,
      experiences: [
        { name: '', score: 2, id: randomUUID() },
        { name: '', score: 2, id: randomUUID() },
      ],
    };
  }

  const patch = {
    level: resolvedLevel,
    advancements,
    advancementChoicesLockedThroughLevel: 1,
    domainLoadoutIds: [],
    multiclassClassId: null,
    multiclassSubclassId: null,
    multiclassDomain: null,
    spellcastTraitSource: null,
    name: typeof draft.name === 'string' ? draft.name : '',
    pronouns: typeof draft.pronouns === 'string' ? draft.pronouns : '',
    description: typeof draft.description === 'string' ? draft.description : '',
    background: typeof draft.background === 'string' ? draft.background : '',
    connectionText:
      typeof draft.connectionText === 'string'
        ? draft.connectionText
        : typeof draft.connection_text === 'string'
          ? draft.connection_text
          : '',
    classId,
    subclassId,
    ancestryIds,
    communityId,
    baseTraits,
    primaryWeaponId,
    secondaryWeaponId,
    armorId,
    abilityIds: resolvedAbilities,
    domainSlotAcquiredLevel: resolvedAbilities.map(() => 1),
    experiences,
    experienceBonusChoices,
    companion,
  };

  return { patch, warnings };
}
