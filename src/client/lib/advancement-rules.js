/**
 * SRD leveling / advancement rules — labels, tier bands, slot budgets, helpers.
 * Pure module (no React).
 *
 * Internal `AdvancementBand` A/B/C maps to the book’s **Tier columns** on the level-up sheet:
 * - **A** = Tier 2 (Levels 2–4)
 * - **B** = Tier 3 (Levels 5–7)
 * - **C** = Tier 4 (Levels 8–10)
 * This is not a single character level; it is which Tier column’s option list applies to that level row.
 */

/** @typedef {'A' | 'B' | 'C'} AdvancementBand */

/** Levels 2–4 → A, 5–7 → B, 8–10 → C */
export function advancementLevelToBand(level) {
  const lvl = Number(level) || 0;
  if (lvl >= 8) return 'C';
  if (lvl >= 5) return 'B';
  return 'A';
}

/** Character level → same band boundaries (tier-2+ character level bands). */
export function characterLevelToBand(level) {
  return advancementLevelToBand(level);
}

export const ADVANCEMENT_BAND_LABELS = {
  A: 'Tier 2 (Levels 2–4)',
  B: 'Tier 3 (Levels 5–7)',
  C: 'Tier 4 (Levels 8–10)',
};

/** Tier-entry levels: automatic +1 Proficiency (and book tier achievements). */
export const TIER_ENTRY_LEVELS = [2, 5, 8];

/** Expected PC experience rows: 2 base + one per tier entry at or below level. */
export function expectedExperienceRowCount(level) {
  const lv = Number(level) || 1;
  let n = 2;
  for (const t of TIER_ENTRY_LEVELS) {
    if (lv >= t) n += 1;
  }
  return n;
}

/**
 * Zero-based index in `experiences[]` for the tier-entry experience gained at a tier-achievement level.
 * Creation uses rows 0–1; tier entries at 2 / 5 / 8 map to indices 2 / 3 / 4 (see {@link expectedExperienceRowCount}).
 *
 * @param {number} tierEntryLevel — one of {@link TIER_ENTRY_LEVELS}
 * @returns {number | null}
 */
export function experienceRowIndexForTierEntryLevel(tierEntryLevel) {
  const idx = TIER_ENTRY_LEVELS.indexOf(Number(tierEntryLevel));
  if (idx === -1) return null;
  return 2 + idx;
}

/**
 * Level row has any advancement content (locks earlier domain slots when the next row is filled).
 */
export function advancementRowHasMeaningfulContent(adv) {
  if (!adv || typeof adv !== 'object') return false;
  if (adv.domainCardId) return true;
  if (adv.domainTrade?.fromId && adv.domainTrade?.toId) return true;
  return (adv.picks || []).some((p) => p && p.type);
}

/**
 * Direct domain dropdown on a creation slot is read-only once the next level row has content.
 * @param {object} opts
 * @param {number} opts.acquiredAtLevel — level when this slot was added (1 = creation).
 * @param {number} opts.characterLevel
 * @param {Record<string, { picks?: object[], domainCardId?: string, domainTrade?: { fromId?: string, toId?: string } }>|null|undefined} opts.advancements
 */
export function isDomainSlotDirectEditLocked({ acquiredAtLevel, characterLevel, advancements }) {
  const acq = Number(acquiredAtLevel) || 1;
  const cl = Number(characterLevel) || 1;
  const nextRowLevel = acq + 1;
  if (nextRowLevel > cl) return false;
  const adv = advancements?.[String(nextRowLevel)];
  return advancementRowHasMeaningfulContent(adv);
}

/**
 * Gates removing extra domain card slots (imports / legacy rows) while level has not changed this session.
 * After the player levels up in-session, slot removal unlocks until they leave or switch characters
 * (`levelingToolsSessionKey` resets the baseline).
 *
 * @param {number} currentLevel
 * @param {number} baselineLevel — stored level at session open (reset when `levelingToolsSessionKey` changes)
 */
export function isDomainLevelingToolsUnlocked(currentLevel, baselineLevel) {
  const cur = Number(currentLevel) || 1;
  const base = Number(baselineLevel) || 1;
  return cur > base;
}

/**
 * Book-style domain card trade: replacement must be same or lower spell level, allowed domain, multiclass cap.
 * @param {object} opts
 * @param {{ level?: number, domain?: string }} opts.oldAbility
 * @param {{ level?: number, domain?: string }} opts.newAbility
 * @param {number} opts.characterLevel
 * @param {string} [opts.multiclassDomain]
 * @param {Set<string>|string[]} opts.domainsAllowed
 */
export function isValidDomainTradeReplacement({
  oldAbility,
  newAbility,
  characterLevel,
  multiclassDomain,
  domainsAllowed,
}) {
  if (!oldAbility || !newAbility || oldAbility.id === newAbility.id) return false;
  const oldLv = Number(oldAbility.level) || 1;
  const newLv = Number(newAbility.level) || 1;
  if (newLv > oldLv) return false;
  const dom = (newAbility.domain || '').trim();
  const allowed = domainsAllowed instanceof Set ? domainsAllowed : new Set(domainsAllowed || []);
  if (!dom || !allowed.has(dom)) return false;
  const mcDom = (multiclassDomain || '').trim();
  if (mcDom && dom === mcDom) {
    const cap = maxMulticlassDomainCardLevel(characterLevel);
    if (newLv > cap) return false;
  }
  return true;
}

/**
 * Valid replacement abilities for trading away `fromId` (book-style domain card trade at level-up).
 * Excludes cards the character already knows (other than the card being replaced).
 *
 * @param {object} opts
 * @param {string|null|undefined} opts.fromId
 * @param {{ abilities?: object[], abilitiesById?: object }|null|undefined} opts.srdData
 * @param {Set<string>|string[]} opts.domainsAllowed
 * @param {number} opts.characterLevel
 * @param {string} [opts.multiclassDomain]
 * @param {string[]} [opts.ownedDomainAbilityIds]
 * @returns {object[]}
 */
export function buildDomainTradeReplacementOptions({
  fromId,
  srdData,
  domainsAllowed,
  characterLevel,
  multiclassDomain,
  ownedDomainAbilityIds,
}) {
  if (!fromId || !srdData?.abilitiesById) return [];
  const oldA = srdData.abilitiesById[fromId];
  if (!oldA) return [];
  const doms = domainsAllowed instanceof Set ? domainsAllowed : new Set(domainsAllowed || []);
  const others = (ownedDomainAbilityIds || []).filter((id) => id !== fromId);
  const filtered = (srdData.abilities || []).filter((a) => {
    if (a.id === fromId) return false;
    if (others.includes(a.id)) return false;
    return isValidDomainTradeReplacement({
      oldAbility: oldA,
      newAbility: a,
      characterLevel,
      multiclassDomain,
      domainsAllowed: doms,
    });
  });
  const seen = new Set();
  const out = [];
  for (const a of filtered) {
    if (!a?.id || seen.has(a.id)) continue;
    seen.add(a.id);
    out.push(a);
  }
  return out;
}

/**
 * When multiclass in this band is unavailable because a subclass upgrade was taken in the same column, returns the subclass upgrade level for the cross-out banner.
 *
 * @returns {{ subclassUpgradeLevel: number, band: AdvancementBand, bandLabel: string } | null}
 */
export function describeSubclassUpgradeMulticlassCrossout(advancements, characterLevel, band) {
  const b = band;
  const maxLv = Number(characterLevel) || 1;
  if (!advancements || typeof advancements !== 'object' || !b) return null;
  if (countPicksOfTypeInBand(advancements, characterLevel, b, 'multiclass') > 0) return null;
  if (effectiveMulticlassBudgetForBand(advancements, characterLevel, b) > 0) return null;
  if ((SLOT_BUDGET_PER_BAND[b]?.multiclass ?? 0) <= 0) return null;
  for (let lvl = 2; lvl <= maxLv; lvl++) {
    if (advancementLevelToBand(lvl) !== b) continue;
    const adv = advancements[String(lvl)];
    for (const p of adv?.picks || []) {
      if (p?.type === 'subclass_upgrade') {
        return {
          subclassUpgradeLevel: lvl,
          band: b,
          bandLabel: ADVANCEMENT_BAND_LABELS[b],
        };
      }
    }
  }
  return null;
}

/**
 * When this tier column (band) has a multiclass advancement pick, returns its level for the cross-out banner.
 * Each of Tier 3 (B) and Tier 4 (C) may have its own multiclass pick, each crossing out one subclass upgrade in that column.
 *
 * @returns {{ multiclassLevel: number, band: AdvancementBand, bandLabel: string } | null}
 */
export function describeMulticlassSubclassUpgradeCrossout(advancements, characterLevel, band) {
  const maxLv = Number(characterLevel) || 1;
  const b = band;
  if (!advancements || typeof advancements !== 'object' || !b) return null;
  for (let lvl = 2; lvl <= maxLv; lvl++) {
    if (advancementLevelToBand(lvl) !== b) continue;
    const adv = advancements[String(lvl)];
    for (const p of adv?.picks || []) {
      if (p?.type === 'multiclass') {
        return {
          multiclassLevel: lvl,
          band: b,
          bandLabel: ADVANCEMENT_BAND_LABELS[b],
        };
      }
    }
  }
  return null;
}

/** +1 Proficiency at each tier entry (levels 2, 5, 8), in addition to character level 1 base. */
export function countAutomaticProficiencyBonuses(level) {
  const lv = Number(level) || 1;
  let n = 0;
  if (lv >= 2) n += 1;
  if (lv >= 5) n += 1;
  if (lv >= 8) n += 1;
  return n;
}

export function isDoubleSlotAdvancementType(type) {
  return type === 'proficiency' || type === 'multiclass';
}

/**
 * Book-style option labels (dropdowns / help).
 * Keys match `advancements[level].picks[].type` and form constants.
 */
export const ADVANCEMENT_TYPE_LABELS = {
  traits: '+1 to two unmarked Traits (within this Tier’s levels)',
  hp: '+1 Max HP',
  stress: '+1 Max Stress',
  evasion: '+1 Evasion',
  experience: '+1 to two distinct Experiences (modifiers)',
  proficiency: '+1 Proficiency (uses both advancement picks for this level)',
  domain_card: 'Additional domain card (same as level pick list)',
  subclass_upgrade: 'Subclass upgrade',
  multiclass:
    'Multiclass (uses both picks at that level; level 5+; once this Tier',
};

/** Max picks of each type per book Tier column (sum across levels in that Tier). Tier 2 has no subclass upgrade / +1 Proficiency / multiclass. */
export const SLOT_BUDGET_PER_BAND = {
  A: {
    traits: 3,
    stress: 2,
    hp: 2,
    experience: 1,
    domain_card: 1,
    evasion: 1,

    proficiency: 0,
    subclass_upgrade: 0,
    multiclass: 0,
  },
  B: {
    traits: 3,
    stress: 2,
    hp: 2,
    experience: 1,
    domain_card: 1,
    evasion: 1,

    subclass_upgrade: 1,
    proficiency: 1,
    multiclass: 1,
  },
  C: {
    evasion: 1,
    stress: 2,
    hp: 2,
    traits: 3,
    experience: 1,
    proficiency: 1,
    domain_card: 1,
    subclass_upgrade: 1,
    multiclass: 1,
  },
};

const ALL_TYPES = [
  'traits',
  'hp',
  'stress',
  'evasion',
  'experience',
  'proficiency',
  'domain_card',
  'subclass_upgrade',
  'multiclass',
];

const VALID_ADVANCEMENT_PICK_TYPES = new Set(ALL_TYPES);

/**
 * @param {string} type
 */
export function isValidAdvancementPickType(type) {
  return typeof type === 'string' && VALID_ADVANCEMENT_PICK_TYPES.has(type);
}

/**
 * Advancement types allowed in the dropdown for a given level row before slot filtering.
 * @param {object} opts
 * @param {number} opts.advancementLevel — level row (2–10)
 * @param {number} opts.characterLevel
 */
export function advancementTypesAvailableForLevelRow({ advancementLevel, characterLevel }) {
  const band = advancementLevelToBand(advancementLevel);
  const advLv = Number(advancementLevel) || 0;
  const charLv = Number(characterLevel) || 1;
  const out = ALL_TYPES.filter((t) => {
    if (band === 'A') {
      if (t === 'subclass_upgrade' || t === 'proficiency' || t === 'multiclass') return false;
    }
    if (t === 'multiclass') {
      if (advLv < 5 || charLv < 5) return false;
      return true;
    }
    return true;
  });
  return out;
}

/**
 * @typedef {{ picks: (object|null|undefined)[], excludePickIndex: number }} SameLevelPartial
 */

/**
 * Count picks of a type within one band for levels ≤ characterLevel.
 *
 * When `ignoreLevel` is set (usually the row being edited), that row is omitted **unless**
 * `sameLevelPartial` is passed: then only sibling picks on that row are counted (excluding
 * `excludePickIndex`) so Pick 1 and Pick 2 budgets stay in sync.
 *
 * @param {Record<string, { picks?: object[] }> | null | undefined} advancements
 * @param {SameLevelPartial | null | undefined} [sameLevelPartial]
 */
export function countPicksOfTypeInBand(advancements, characterLevel, band, type, ignoreLevel = null, sameLevelPartial = null) {
  const maxLv = Number(characterLevel) || 1;
  let n = 0;
  if (!advancements || typeof advancements !== 'object') return 0;
  for (let lvl = 2; lvl <= maxLv; lvl++) {
    if (advancementLevelToBand(lvl) !== band) continue;
    if (ignoreLevel != null && lvl === ignoreLevel) {
      if (sameLevelPartial && Array.isArray(sameLevelPartial.picks)) {
        const ex = Number(sameLevelPartial.excludePickIndex);
        for (let i = 0; i < sameLevelPartial.picks.length; i++) {
          if (i === ex) continue;
          const p = sameLevelPartial.picks[i];
          if (p && p.type === type) n += 1;
        }
      }
      continue;
    }
    const adv = advancements[String(lvl)];
    for (const p of adv?.picks || []) {
      if (p && p.type === type) n += 1;
    }
  }
  return n;
}

/** Trait keys already used by other advancement rows in the same band (excludes `excludeLevel` row). */
export function traitMarksForBandExcludingLevel(advancements, characterLevel, band, excludeLevel) {
  const maxLv = Number(characterLevel) || 1;
  const marks = [];
  if (!advancements || typeof advancements !== 'object') return marks;
  for (let lvl = 2; lvl <= maxLv; lvl++) {
    if (lvl === excludeLevel) continue;
    if (advancementLevelToBand(lvl) !== band) continue;
    const adv = advancements[String(lvl)];
    for (const p of adv?.picks || []) {
      if (p?.type === 'traits' && Array.isArray(p.traits)) {
        for (const t of p.traits) {
          if (typeof t === 'string' && !marks.includes(t)) marks.push(t);
        }
      }
    }
  }
  return marks;
}

/**
 * Trait keys taken by other picks on the same level row (`advancements[level].picks`).
 * Use with {@link traitMarksForBandExcludingLevel} so two "+1 to two unmarked Traits" picks on one level
 * cannot mark the same trait twice.
 *
 * @param {(object|null|undefined)[]|null|undefined} picks — level row picks (typically length 2)
 * @param {number} excludePickIndex — index of the pick being edited (0 or 1)
 * @returns {string[]}
 */
export function traitMarksFromSiblingPicksOnLevelRow(picks, excludePickIndex) {
  const out = [];
  if (!Array.isArray(picks)) return out;
  picks.forEach((p, i) => {
    if (i === excludePickIndex) return;
    if (p?.type === 'traits' && Array.isArray(p.traits)) {
      for (const t of p.traits) {
        if (typeof t === 'string' && !out.includes(t)) out.push(t);
      }
    }
  });
  return out;
}

/**
 * Map trait key → character level at which another `traits` pick in the same band marked it
 * (excluding the pick being edited). Used for small level badges on trait buttons.
 *
 * @param {Record<string, unknown>|null|undefined} advancements
 * @param {number} characterLevel
 * @param {AdvancementBand} band
 * @param {number} excludeLevel — level row of the pick being edited
 * @param {number} excludePickIndex
 * @returns {Record<string, number>}
 */
export function traitMarkLevelByKeyExcludingPick(
  advancements,
  characterLevel,
  band,
  excludeLevel,
  excludePickIndex,
) {
  /** @type {Record<string, number>} */
  const out = {};
  const maxLv = Number(characterLevel) || 1;
  if (!advancements || typeof advancements !== 'object') return out;
  for (let lvl = 2; lvl <= maxLv; lvl++) {
    if (advancementLevelToBand(lvl) !== band) continue;
    const adv = advancements[String(lvl)];
    const picks = adv?.picks || [];
    for (let pi = 0; pi < picks.length; pi++) {
      if (lvl === excludeLevel && pi === excludePickIndex) continue;
      const p = picks[pi];
      if (p?.type === 'traits' && Array.isArray(p.traits)) {
        for (const t of p.traits) {
          if (typeof t === 'string' && out[t] == null) out[t] = lvl;
        }
      }
    }
  }
  return out;
}

/**
 * Ensures no trait appears in more than one `traits` pick on the same level row (earlier pick wins).
 * @param {(object|null|undefined)[]} picks
 * @returns {(object|null|undefined)[]}
 */
export function dedupeTraitPicksAcrossLevelRow(picks) {
  if (!Array.isArray(picks)) return picks;
  const seen = new Set();
  return picks.map((p) => {
    if (!p || p.type !== 'traits' || !Array.isArray(p.traits)) return p;
    const filt = [];
    for (const t of p.traits) {
      if (typeof t !== 'string' || seen.has(t)) continue;
      seen.add(t);
      filt.push(t);
    }
    return { ...p, traits: filt };
  });
}

/**
 * Remaining slot budget for a type in the band of `advancementLevel`.
 */
export function countMulticlassPicksGlobally(advancements, characterLevel, ignoreLevel = null, sameLevelPartial = null) {
  const maxLv = Number(characterLevel) || 1;
  let n = 0;
  if (!advancements || typeof advancements !== 'object') return 0;
  for (let lvl = 2; lvl <= maxLv; lvl++) {
    if (ignoreLevel != null && lvl === ignoreLevel) {
      if (sameLevelPartial && Array.isArray(sameLevelPartial.picks)) {
        const ex = Number(sameLevelPartial.excludePickIndex);
        for (let i = 0; i < sameLevelPartial.picks.length; i++) {
          if (i === ex) continue;
          const p = sameLevelPartial.picks[i];
          if (p?.type === 'multiclass') n += 1;
        }
      }
      continue;
    }
    const adv = advancements[String(lvl)];
    for (const p of adv?.picks || []) {
      if (p?.type === 'multiclass') n += 1;
    }
  }
  return n;
}

/**
 * Level of the first `multiclass` pick (book: cross out one subclass upgrade in that level band).
 * @returns {number | null}
 */
export function firstMulticlassAdvancementLevel(advancements, characterLevel) {
  const maxLv = Number(characterLevel) || 1;
  if (!advancements || typeof advancements !== 'object') return null;
  for (let lvl = 2; lvl <= maxLv; lvl++) {
    const adv = advancements[String(lvl)];
    for (const p of adv?.picks || []) {
      if (p?.type === 'multiclass') return lvl;
    }
  }
  return null;
}

/**
 * Subclass upgrade picks allowed in a band; each multiclass pick **in this band** costs one subclass-upgrade slot (cross-out).
 */
export function effectiveSubclassUpgradeBudgetForBand(advancements, characterLevel, band) {
  const base = SLOT_BUDGET_PER_BAND[band]?.subclass_upgrade ?? 2;
  const mcInBand = countPicksOfTypeInBand(advancements, characterLevel, band, 'multiclass');
  return Math.max(0, base - mcInBand);
}

/**
 * Multiclass picks allowed in a band; each `subclass_upgrade` pick **in this band** costs one multiclass slot (cross-out; mirrors {@link effectiveSubclassUpgradeBudgetForBand}).
 */
export function effectiveMulticlassBudgetForBand(advancements, characterLevel, band) {
  const base = SLOT_BUDGET_PER_BAND[band]?.multiclass ?? 0;
  const subUpInBand = countPicksOfTypeInBand(advancements, characterLevel, band, 'subclass_upgrade');
  return Math.max(0, base - subUpInBand);
}

/**
 * @param {SameLevelPartial | null | undefined} [sameLevelPartial] — pass from level-row editors so sibling picks count toward band budgets.
 */
export function remainingSlotsForType(advancements, characterLevel, advancementLevel, type, ignoreLevel = null, sameLevelPartial = null) {
  const band = advancementLevelToBand(advancementLevel);
  let budget = SLOT_BUDGET_PER_BAND[band]?.[type] ?? 99;
  if (type === 'subclass_upgrade') {
    budget = effectiveSubclassUpgradeBudgetForBand(advancements, characterLevel, band);
  }
  if (type === 'multiclass') {
    budget = effectiveMulticlassBudgetForBand(advancements, characterLevel, band);
  }
  const used = countPicksOfTypeInBand(advancements, characterLevel, band, type, ignoreLevel, sameLevelPartial);
  return Math.max(0, budget - used);
}

/**
 * Multiclass domain card level cap: half character level rounded up (selection only).
 */
export function maxMulticlassDomainCardLevel(characterLevel) {
  const lv = Number(characterLevel) || 1;
  return Math.max(1, Math.ceil(lv / 2));
}

/** Level gate only; per-tier availability uses {@link remainingSlotsForType} for `multiclass` in that band. */
export function canTakeMulticlass(characterLevel) {
  return (Number(characterLevel) || 0) >= 5;
}

/**
 * Globally ordered subclass_upgrade picks (by level) for unlock steps.
 */
export function listSubclassUpgradePicks(advancements, characterLevel) {
  const maxLv = Number(characterLevel) || 1;
  const out = [];
  if (!advancements || typeof advancements !== 'object') return out;
  for (let lvl = 2; lvl <= maxLv; lvl++) {
    const adv = advancements[String(lvl)];
    for (const p of adv?.picks || []) {
      if (p?.type === 'subclass_upgrade') out.push({ level: lvl, pick: p });
    }
  }
  return out;
}

/**
 * Counts `subclass_upgrade` picks strictly before this slot (lower levels, then same level with lower pick index).
 *
 * @param {Record<string, { picks?: object[] }>|null|undefined} advancements
 * @param {number} advancementLevel — level row (2–10)
 * @param {number} pickIndex — 0 or 1 (first vs second pick on that row)
 */
export function countSubclassUpgradePicksBefore(advancements, advancementLevel, pickIndex) {
  const advLv = Number(advancementLevel) || 2;
  const pi = Number(pickIndex) || 0;
  let n = 0;
  if (!advancements || typeof advancements !== 'object') return n;
  for (let lvl = 2; lvl < advLv; lvl++) {
    const adv = advancements[String(lvl)];
    for (const p of adv?.picks || []) {
      if (p?.type === 'subclass_upgrade') n++;
    }
  }
  const adv = advancements[String(advLv)];
  const picks = adv?.picks || [];
  for (let i = 0; i < pi && i < picks.length; i++) {
    if (picks[i]?.type === 'subclass_upgrade') n++;
  }
  return n;
}

/**
 * Dropdown label for the subclass_upgrade advancement type: `Subclass upgrade to Specialization|Mastery - <feature names>` from the SRD subclass.
 *
 * @param {object} opts
 * @param {object|null|undefined} opts.subclass — SRD subclass row (`specialization_features` / `mastery_features`)
 * @param {Record<string, { picks?: object[] }>|null|undefined} opts.advancements
 * @param {number} opts.advancementLevel
 * @param {number} opts.pickIndex
 * @param {string|null|undefined} opts.multiclassClassId
 */
export function formatSubclassUpgradeAdvancementOptionLabel({
  subclass,
  advancements,
  advancementLevel,
  pickIndex,
  multiclassClassId,
}) {
  const prior = countSubclassUpgradePicksBefore(advancements, advancementLevel, pickIndex);
  const next = prior + 1;

  if (!subclass || typeof subclass !== 'object') {
    return 'Subclass upgrade — select a subclass to see features';
  }

  const spec = subclass.specialization_features || [];
  const mast = subclass.mastery_features || [];
  const specNames = spec.map((f) => f?.name).filter(Boolean);
  const mastNames = mast.map((f) => f?.name).filter(Boolean);

  if (multiclassClassId && prior >= 1) {
    return 'Subclass upgrade — no further tier unlocks while multiclassed (Specialization already applied)';
  }

  if (next === 1) {
    if (!specNames.length) return 'Subclass upgrade to Specialization - (no features listed)';
    return `Subclass upgrade to Specialization - ${specNames.join(', ')}`;
  }
  if (next === 2) {
    if (!mastNames.length) return 'Subclass upgrade to Mastery - (no features listed)';
    return `Subclass upgrade to Mastery - ${mastNames.join(', ')}`;
  }
  return ADVANCEMENT_TYPE_LABELS.subclass_upgrade;
}

/**
 * True when any level-up row (2 … character level) has book tracking content: per-level domain card,
 * trade, or at least one advancement pick. Used to gate legacy tier-only subclass unlocks: once a player
 * has started filling leveling rows, subclass specialization/mastery come **only** from explicit
 * `subclass_upgrade` picks (matches editor + live preview).
 *
 * Empty `advancements` or all-empty rows → false (legacy tier fallback still applies for unmigrated sheets).
 */
export function hasAdvancementTrackingFilled(advancements, characterLevel) {
  const maxLv = Number(characterLevel) || 1;
  if (maxLv < 2) return false;
  if (!advancements || typeof advancements !== 'object') return false;
  for (let lvl = 2; lvl <= maxLv; lvl++) {
    const adv = advancements[String(lvl)];
    if (!adv || typeof adv !== 'object') continue;
    if (adv.domainCardId != null && String(adv.domainCardId).trim()) return true;
    const dt = adv.domainTrade;
    if (dt?.fromId && dt?.toId && dt.fromId !== dt.toId) return true;
    for (const p of adv.picks || []) {
      if (p && typeof p === 'object' && p.type) return true;
    }
  }
  return false;
}

/**
 * How many subclass tiers to merge (foundation → specialization → mastery).
 * Legacy: when there are no `subclass_upgrade` picks **and** no filled advancement tracking, match old
 * tier-based unlock (min(2, tier−1)). When tracking is filled, only `subclass_upgrade` picks count.
 * Multiclass: book — no mastery subclass card from leveling; cap at specialization (one upgrade step).
 */
export function deriveSubclassUnlockSteps({ advancements, level, tier, multiclassClassId }) {
  const picks = listSubclassUpgradePicks(advancements, level ?? 1);
  const n = picks.length;
  const legacySteps = Math.min(2, Math.max(0, (tier ?? 1) - 1));
  const tracking = hasAdvancementTrackingFilled(advancements, level);
  if (multiclassClassId) {
    if (n >= 1) return Math.min(1, n);
    return Math.min(1, tracking ? 0 : legacySteps);
  }
  if (n === 0) return tracking ? 0 : legacySteps;
  return Math.min(2, n);
}

/**
 * Max spell level for a domain card chosen on this level row (primary domains vs multiclass domain).
 */
export function maxSelectableDomainCardLevelForRow(characterLevel, advancementLevel, abilityDomain, multiclassDomainName) {
  const rowCap = Number(advancementLevel) || 2;
  const dom = (abilityDomain || '').trim();
  const mcDom = (multiclassDomainName || '').trim();
  if (mcDom && dom === mcDom) {
    return Math.min(rowCap, maxMulticlassDomainCardLevel(characterLevel));
  }
  return rowCap;
}

/**
 * When a character knows more than five domain cards, exactly five IDs are active (loadout).
 * Empty or partial explicit loadout is filled from `ownedIds` order (stable default).
 */
export function normalizeDomainLoadoutIds(ownedIds, explicitLoadout) {
  const owned = [...new Set((ownedIds || []).filter(Boolean))];
  if (owned.length <= 5) return owned;
  const exp = [...new Set((explicitLoadout || []).filter((id) => owned.includes(id)))];
  if (exp.length >= 5) return exp.slice(0, 5);
  const out = [...exp];
  for (const id of owned) {
    if (out.length >= 5) break;
    if (!out.includes(id)) out.push(id);
  }
  return out.slice(0, 5);
}

/**
 * Derive trait marks per band from historical trait advancement picks (migration / display).
 * @returns {Record<AdvancementBand, string[]>}
 */
export function deriveTraitMarksByBandFromAdvancements(advancements, characterLevel) {
  /** @type {Record<AdvancementBand, string[]>} */
  const out = { A: [], B: [], C: [] };
  const maxLv = Number(characterLevel) || 1;
  if (!advancements || typeof advancements !== 'object') return out;
  for (let lvl = 2; lvl <= maxLv; lvl++) {
    const band = advancementLevelToBand(lvl);
    const adv = advancements[String(lvl)];
    for (const p of adv?.picks || []) {
      if (p?.type === 'traits' && Array.isArray(p.traits)) {
        for (const t of p.traits) {
          if (typeof t === 'string' && !out[band].includes(t)) out[band].push(t);
        }
      }
    }
  }
  return out;
}

/**
 * Whether one advancement pick (plus any sub-choices) is fully resolved.
 * `domain_card` picks use {@link pick.abilityId} only — separate from the per-level `domainCardId` row field.
 *
 * @param {object | null | undefined} pick
 * @param {object} data — character data (multiclass fields when relevant)
 * @param {{ classesById?: Record<string, { domains?: string[] }> }} [srdData]
 */
export function isAdvancementPickFullyResolved(pick, data, srdData) {
  if (!pick || typeof pick !== 'object' || !pick.type) return false;
  if (!isValidAdvancementPickType(pick.type)) return false;
  switch (pick.type) {
    case 'traits':
      return Array.isArray(pick.traits) && pick.traits.length === 2;
    case 'experience': {
      const a = pick.experienceIds?.[0];
      const b = pick.experienceIds?.[1];
      return !!(a && b && a !== b);
    }
    case 'domain_card':
      return !!(pick.abilityId && String(pick.abilityId).trim());
    case 'multiclass': {
      if (!data?.multiclassClassId || !data?.multiclassSubclassId) return false;
      const cls = srdData?.classesById?.[data.multiclassClassId];
      const doms = cls?.domains;
      if (Array.isArray(doms) && doms.length > 1) {
        return !!(data.multiclassDomain && String(data.multiclassDomain).trim());
      }
      return true;
    }
    default:
      return true;
  }
}

function rowAdvancementGapParts(adv, data, srdData) {
  const advRow = adv && typeof adv === 'object' ? adv : { picks: [] };
  const rowDomain = advRow.domainCardId;
  const parts = [];
  if (!rowDomain || !String(rowDomain).trim()) parts.push('domain card');
  const picks = [...(advRow.picks || [])];
  while (picks.length < 2) picks.push(null);
  const p0 = picks[0];
  const p1 = picks[1];
  const double = isDoubleSlotAdvancementType(p0?.type);
  if (!isAdvancementPickFullyResolved(p0, data, srdData)) parts.push('advancement pick 1');
  if (!double && !isAdvancementPickFullyResolved(p1, data, srdData)) parts.push('advancement pick 2');
  return parts;
}

/**
 * Human-readable gaps for each level row (2 … character level) that still need picks and/or per-level domain card.
 *
 * @param {object} data
 * @param {{ classesById?: Record<string, { domains?: string[] }> }} [srdData]
 * @returns {string[]}
 */
export function missingLevelAdvancementChoices(data, srdData) {
  const msg = [];
  const lv = Number(data?.level) || 1;
  if (lv < 2) return msg;
  for (let lvl = 2; lvl <= lv; lvl++) {
    const adv = data.advancements?.[String(lvl)] ?? { picks: [] };
    const parts = rowAdvancementGapParts(adv, data, srdData);
    if (parts.length) msg.push(`Level ${lvl}: ${parts.join(', ')}`);
  }
  return msg;
}

/**
 * @param {object} data
 * @param {{ classesById?: Record<string, { domains?: string[] }> }} [srdData]
 * @returns {string[]} advancement level keys `"2"`…`"10"` with gaps
 */
export function getAdvancementIncompleteLevelKeys(data, srdData) {
  const keys = [];
  const lv = Number(data?.level) || 1;
  if (lv < 2) return keys;
  for (let lvl = 2; lvl <= lv; lvl++) {
    const adv = data.advancements?.[String(lvl)] ?? { picks: [] };
    if (rowAdvancementGapParts(adv, data, srdData).length) keys.push(String(lvl));
  }
  return keys;
}

/**
 * New editor sessions set `advancementChoicesLockedThroughLevel` on the character payload.
 * Legacy saves omit it — {@link isAdvancementLockedThroughCurrentLevel} treats that as satisfied.
 */
export function hasAdvancementChoicesLockField(data) {
  return data != null && typeof data === 'object' && Object.prototype.hasOwnProperty.call(data, 'advancementChoicesLockedThroughLevel');
}

/** True when the current level’s advancement row has been confirmed (lockedThrough ≥ character level). */
export function isAdvancementLockedThroughCurrentLevel(data) {
  const lv = Number(data?.level) || 1;
  if (lv < 2) return true;
  if (!hasAdvancementChoicesLockField(data)) return true;
  const locked = Number(data.advancementChoicesLockedThroughLevel);
  return Number.isFinite(locked) && locked >= lv;
}

/** Whether the sheet row for the **current** character level is still editable (not locked). */
export function isCurrentCharacterLevelAdvancementRowEditable(data) {
  const lv = Number(data?.level) || 1;
  if (lv < 2) return false;
  if (!hasAdvancementChoicesLockField(data)) return true;
  const locked = Number(data.advancementChoicesLockedThroughLevel) || 0;
  return lv > locked;
}

const TRAIT_KEY_LABELS_COLLAPSED = {
  agility: 'Agility',
  strength: 'Strength',
  finesse: 'Finesse',
  instinct: 'Instinct',
  presence: 'Presence',
  knowledge: 'Knowledge',
};

const ADVANCEMENT_PICK_SUMMARY_SHORT = {
  hp: '+1 Max HP',
  stress: '+1 Max Stress',
  evasion: '+1 Evasion',
  proficiency: '+1 Proficiency (both picks)',
  multiclass: 'Multiclass',
  domain_card: 'Additional domain card',
  subclass_upgrade: 'Subclass upgrade',
};

function formatOneAdvancementPickSummary(pick, experiences, abilitiesById, subclassSummaryCtx) {
  if (!pick || !pick.type) return null;
  const t = pick.type;
  if (t === 'traits') {
    const ts = (pick.traits || [])
      .map((k) => TRAIT_KEY_LABELS_COLLAPSED[k] || k)
      .filter(Boolean);
    return ts.length ? ts.join(' · ') : 'Traits (incomplete)';
  }
  if (t === 'experience') {
    const ids = (pick.experienceIds || []).filter(Boolean);
    if (!ids.length) return 'Experiences (incomplete)';
    const expList = experiences || [];
    return ids.map((id) => expList.find((e) => e && e.id === id)?.name || id).join(' · ');
  }
  if (t === 'domain_card') {
    const aid = pick.abilityId;
    if (aid && abilitiesById?.[aid]?.name) return `Additional domain: ${abilitiesById[aid].name}`;
    if (aid) return `Additional domain: ${aid}`;
    return `${ADVANCEMENT_PICK_SUMMARY_SHORT.domain_card} (incomplete)`;
  }
  if (t === 'subclass_upgrade' && subclassSummaryCtx) {
    const full = formatSubclassUpgradeAdvancementOptionLabel({
      subclass: subclassSummaryCtx.subclass,
      advancements: subclassSummaryCtx.advancements,
      advancementLevel: subclassSummaryCtx.advancementLevel,
      pickIndex: subclassSummaryCtx.pickIndex,
      multiclassClassId: subclassSummaryCtx.multiclassClassId,
    });
    let rest = full;
    if (full.startsWith('Subclass upgrade to ')) {
      rest = full.slice('Subclass upgrade to '.length).trim();
    } else {
      rest = full.replace(/^Subclass upgrade — \s*/, '').trim();
    }
    return rest || ADVANCEMENT_PICK_SUMMARY_SHORT.subclass_upgrade;
  }
  if (ADVANCEMENT_PICK_SUMMARY_SHORT[t]) return ADVANCEMENT_PICK_SUMMARY_SHORT[t];
  return ADVANCEMENT_TYPE_LABELS[t] || t;
}

/**
 * Short one-line strings for a collapsed level advancement card (pick rows, domain card, trade).
 * Tier-entry experience name is included when provided (tier-achievement levels).
 *
 * @param {object} opts
 * @param {{ picks?: object[], domainCardId?: string, domainTrade?: { fromId?: string, toId?: string } }|null|undefined} opts.adv
 * @param {{ id?: string, name?: string }[]|null|undefined} opts.experiences
 * @param {Record<string, { name?: string }>|null|undefined} opts.abilitiesById
 * @param {string|null|undefined} opts.tierExperienceName
 * @param {number} [opts.advancementLevel] — level row (for subclass upgrade feature names)
 * @param {Record<string, { picks?: object[] }>|null|undefined} [opts.advancements]
 * @param {object|null|undefined} [opts.subclass] — primary SRD subclass row
 * @param {string|null|undefined} [opts.multiclassClassId]
 * @returns {string[]}
 */
export function formatAdvancementRowCollapsedSummary({
  adv,
  experiences,
  abilitiesById,
  tierExperienceName,
  advancementLevel,
  advancements,
  subclass,
  multiclassClassId,
}) {
  const row = adv && typeof adv === 'object' ? adv : {};
  const picks = [...(row.picks || [])];
  while (picks.length < 2) picks.push(null);
  const expList = experiences || [];
  const abi = abilitiesById || {};
  const advLv = Number(advancementLevel) || 0;
  const out = [];

  const te = typeof tierExperienceName === 'string' ? tierExperienceName.trim() : '';
  if (te) out.push(`Tier experience: ${te}`);

  const subCtx = (i) =>
    advLv >= 2
      ? {
          subclass,
          advancements,
          advancementLevel: advLv,
          pickIndex: i,
          multiclassClassId,
        }
      : undefined;

  const doubleFirst = isDoubleSlotAdvancementType(picks[0]?.type);
  if (doubleFirst && picks[0]?.type) {
    const s = formatOneAdvancementPickSummary(picks[0], expList, abi, subCtx(0));
    if (s) out.push(`Pick 1–2: ${s}`);
  } else {
    for (let i = 0; i < 2; i++) {
      const s = formatOneAdvancementPickSummary(picks[i], expList, abi, subCtx(i));
      if (s) out.push(`Pick ${i + 1}: ${s}`);
    }
  }

  if (row.domainCardId) {
    const a = abi[row.domainCardId];
    out.push(`New domain card: ${a?.name || row.domainCardId}`);
  }

  const fromId = row.domainTrade?.fromId;
  const toId = row.domainTrade?.toId;
  if (fromId && toId) {
    const fromN = abi[fromId]?.name || fromId;
    const toN = abi[toId]?.name || toId;
    out.push(`Trade: ${fromN} → ${toN}`);
  }

  return out;
}

/** Printed sheet-style tier headers (all caps). */
export const ADVANCEMENT_BAND_SHEET_TITLES = {
  A: 'TIER 2: LEVELS 2–4',
  B: 'TIER 3: LEVELS 5–7',
  C: 'TIER 4: LEVELS 8–10',
};

export const ADVANCEMENT_TIER_INSTRUCTIONS = {
  A: 'Choose two options from the list below and mark them.',
  B: 'Choose two options from the list below or any from the previous tier and mark them.',
  C: 'Choose two options from the list below or any from the previous tier and mark them.',
};

/** Tier entry level that opens each band column (2 / 5 / 8). */
export function tierEntryLevelForBand(band) {
  if (band === 'A') return 2;
  if (band === 'B') return 5;
  if (band === 'C') return 8;
  return null;
}

/** Level numbers in this band that are at or below the character’s level. */
export function levelsInBandUpToCharacterLevel(characterLevel, band) {
  const cl = Number(characterLevel) || 1;
  const ranges = { A: [2, 4], B: [5, 7], C: [8, 10] };
  const [lo, hi] = ranges[band] || [2, 4];
  const out = [];
  for (let l = lo; l <= hi; l++) {
    if (l <= cl) out.push(l);
  }
  return out;
}

/**
 * Ordered picks of `type` within a band (levels ascending, then pick index).
 * Double-slot types (`proficiency`, `multiclass`) appear once per level from pick index 0 only.
 *
 * @returns {{ level: number, pickIndex: number, isDoubleSlot?: boolean }[]}
 */
export function listOrderedBandSlotFills(advancements, characterLevel, band, type) {
  const maxLv = Number(characterLevel) || 1;
  const out = [];
  if (!advancements || typeof advancements !== 'object') return out;
  for (let lvl = 2; lvl <= maxLv; lvl++) {
    if (advancementLevelToBand(lvl) !== band) continue;
    const picks = advancements[String(lvl)]?.picks || [];
    for (let pi = 0; pi < picks.length; pi++) {
      const p = picks[pi];
      if (!p || p.type !== type) continue;
      if (isDoubleSlotAdvancementType(type)) {
        if (pi === 0) {
          out.push({ level: lvl, pickIndex: 0, isDoubleSlot: true });
        }
        break;
      }
      out.push({ level: lvl, pickIndex: pi });
    }
  }
  return out;
}

/**
 * How many checkbox slots to render for this row (book: proficiency/multiclass use two linked boxes).
 */
export function effectiveSlotCountForBandType(advancements, characterLevel, band, type) {
  if (type === 'proficiency') return 2;
  if (type === 'multiclass') {
    const baseMc = SLOT_BUDGET_PER_BAND[band]?.multiclass ?? 0;
    if (baseMc <= 0) return 0;
    const hasMc = countPicksOfTypeInBand(advancements, characterLevel, band, 'multiclass') > 0;
    if (hasMc) return 2;
    return effectiveMulticlassBudgetForBand(advancements, characterLevel, band) > 0 ? 2 : 0;
  }
  if (type === 'subclass_upgrade') {
    return effectiveSubclassUpgradeBudgetForBand(advancements, characterLevel, band);
  }
  return SLOT_BUDGET_PER_BAND[band]?.[type] ?? 0;
}

/**
 * One UI cell per slot: level number when filled, or null when empty.
 * For double-slot types, both cells mirror the same level when taken.
 *
 * @returns {{ level: number | null, fill: { level: number, pickIndex: number } | null }[]}
 */
export function buildBandSlotDisplayCells(advancements, characterLevel, band, type) {
  const fills = listOrderedBandSlotFills(advancements, characterLevel, band, type);
  const n = effectiveSlotCountForBandType(advancements, characterLevel, band, type);
  const cells = [];
  if (isDoubleSlotAdvancementType(type)) {
    // Multiclass can have 0 effective slots when subclass upgrade uses this tier’s multiclass slot — do not render two empty placeholders (locks replace them in the UI).
    if (n === 0) {
      return [];
    }
    const f = fills[0];
    const lv = f?.level ?? null;
    cells.push({ level: lv, fill: f || null });
    cells.push({ level: lv, fill: f || null });
    return cells;
  }
  for (let i = 0; i < n; i++) {
    const f = fills[i];
    cells.push({ level: f ? f.level : null, fill: f || null });
  }
  return cells;
}

/** Shift non-null picks left after a removal. */
export function compactAdvancementRowPicks(picks) {
  const arr = [...(picks || [])].filter((p) => p && p.type);
  return [arr[0] ?? null, arr[1] ?? null];
}

function initialPickForAdvancementType(type) {
  if (type === 'traits') return { type: 'traits', traits: [] };
  if (type === 'experience') return { type: 'experience', experienceIds: [null, null] };
  return { type };
}

/**
 * Assign one pick of `type` at `focusLevel` if the row has room and band budget allows.
 * @returns {Record<string, object>|null} next `advancements` map, or null if invalid
 */
export function tryAssignAdvancementPickAtFocusLevel(
  advancements,
  characterLevel,
  focusLevel,
  type,
) {
  const adv = advancements && typeof advancements === 'object' ? { ...advancements } : {};
  const fl = Number(focusLevel);
  const cl = Number(characterLevel) || 1;
  if (fl < 2 || fl > cl) return null;

  const allowed = advancementTypesAvailableForLevelRow({ advancementLevel: fl, characterLevel: cl });
  if (!allowed.includes(type)) return null;

  const rowKey = String(fl);
  const prevRow = adv[rowKey] || {};
  let picks = [...(prevRow.picks || [])];
  while (picks.length < 2) picks.push(null);
  const p0 = picks[0];
  const p1 = picks[1];

  if (remainingSlotsForType(adv, cl, fl, type, fl, null) <= 0) return null;

  if (isDoubleSlotAdvancementType(type)) {
    if ((p0 && p0.type) || (p1 && p1.type)) return null;
    picks[0] = { type };
    picks[1] = null;
  } else {
    if (p0?.type && isDoubleSlotAdvancementType(p0.type)) return null;
    if (!p0) picks[0] = initialPickForAdvancementType(type);
    else if (!p1) picks[1] = initialPickForAdvancementType(type);
    else return null;
  }

  picks = dedupeTraitPicksAcrossLevelRow(picks);
  if (isDoubleSlotAdvancementType(type) && isDoubleSlotAdvancementType(picks[0]?.type)) {
    picks[1] = null;
  }

  return {
    ...adv,
    [rowKey]: { ...prevRow, picks },
  };
}

/**
 * Clear the Nth slot in band order for `type` (see {@link listOrderedBandSlotFills}).
 * @returns {Record<string, object>|null}
 */
export function tryClearBandSlotAtOrdinal(advancements, characterLevel, band, type, slotOrdinal) {
  const ord = Number(slotOrdinal);
  if (ord < 0 || Number.isNaN(ord)) return null;
  const fills = listOrderedBandSlotFills(advancements, characterLevel, band, type);
  const adv = advancements && typeof advancements === 'object' ? { ...advancements } : {};
  const target = fills[ord];
  if (!target) return null;

  const rowKey = String(target.level);
  const prevRow = adv[rowKey] || {};
  let picks = [...(prevRow.picks || [])];
  while (picks.length < 2) picks.push(null);

  if (isDoubleSlotAdvancementType(type)) {
    picks[0] = null;
    picks[1] = null;
  } else {
    picks[target.pickIndex] = null;
    picks = compactAdvancementRowPicks(picks);
  }

  return {
    ...adv,
    [rowKey]: { ...prevRow, picks },
  };
}

/**
 * Clears every `multiclass` advancement pick on levels 2 … `characterLevel` (full row clear for double-slot rows).
 * Use when removing multiclass from the character (dropdown or external reset) so advancements stay in sync.
 *
 * @returns {Record<string, object>}
 */
export function clearMulticlassPicksFromAdvancementsUpToLevel(advancements, characterLevel) {
  const maxLv = Number(characterLevel) || 1;
  const adv = advancements && typeof advancements === 'object' ? { ...advancements } : {};
  for (let lvl = 2; lvl <= maxLv; lvl++) {
    const key = String(lvl);
    const row = adv[key];
    const picks = row?.picks;
    if (!Array.isArray(picks) || !picks.length) continue;
    const hasMc = picks.some((p) => p?.type === 'multiclass');
    if (!hasMc) continue;
    adv[key] = { ...row, picks: [null, null] };
  }
  return adv;
}

/**
 * First incomplete level row in this band, or the first level in the band if all complete.
 */
export function defaultFocusLevelForBand(data, srdData, band) {
  const cl = Number(data?.level) || 1;
  const levels = levelsInBandUpToCharacterLevel(cl, band);
  if (!levels.length) return null;
  const incomplete = getAdvancementIncompleteLevelKeys(data, srdData)
    .map(Number)
    .filter((lvl) => advancementLevelToBand(lvl) === band)
    .sort((a, b) => a - b);
  if (incomplete.length) return incomplete[0];
  return levels[0];
}

const DEFAULT_TRAIT_KEYS_ORDER = ['agility', 'strength', 'finesse', 'instinct', 'presence', 'knowledge'];

function pickRandomFromArray(arr, rng) {
  const r = rng || Math.random;
  if (!arr || arr.length === 0) return undefined;
  return arr[Math.floor(r() * arr.length)];
}

/**
 * One trait key: prefer the sole highest score among unmarked; else the sole lowest; else random.
 * @param {string[]} unmarkedKeys
 * @param {Record<string, number>} traitsByKey
 * @param {() => number} [rng]
 */
export function pickTraitKeyWithScorePreference(unmarkedKeys, traitsByKey, rng = Math.random) {
  const keys = (unmarkedKeys || []).filter(Boolean);
  if (!keys.length) return undefined;
  if (keys.length === 1) return keys[0];
  const scores = keys.map((k) => ({ k, v: Number(traitsByKey?.[k]) || 0 }));
  const maxV = Math.max(...scores.map((s) => s.v));
  const maxKeys = scores.filter((s) => s.v === maxV).map((s) => s.k);
  if (maxKeys.length === 1) return maxKeys[0];
  const minV = Math.min(...scores.map((s) => s.v));
  const minKeys = scores.filter((s) => s.v === minV).map((s) => s.k);
  if (minKeys.length === 1) return minKeys[0];
  return pickRandomFromArray(keys, rng);
}

/**
 * Randomize the current level’s advancement row: per-level domain card (highest spell level available),
 * optional trade (50%), tier-entry experience name when applicable, and two advancement picks with sub-choices.
 *
 * @param {object} opts
 * @param {object} opts.formData
 * @param {number} opts.characterLevel — current character level (the row being filled)
 * @param {{ abilities?: object[], abilitiesById?: Record<string, object>, classes?: object[], classesById?: Record<string, object>, subclasses?: object[] }} opts.srdData
 * @param {object[]} opts.abilityOptionsForRow — same filter as `abilityOptionsForAdvancementLevel(level)`
 * @param {Set<string>|string[]} opts.occupiedDomainCardIds — IDs already taken, excluding this row’s domain picks (caller removes current row)
 * @param {(fromId: string) => object[]} opts.getTradeReplacementOptions
 * @param {string[]} opts.tradeFromIds — `collectOwnedDomainAbilityIdsThroughCharacterLevel(data, level - 1)`
 * @param {string[]} [opts.traitKeysOrder]
 * @param {() => number} [opts.rng]
 * @returns {{ advancements: Record<string, object>, experiences?: object[], multiclassClassId?: string|null, multiclassSubclassId?: string|null, multiclassDomain?: string|null }}
 */
export function randomizeLevelAdvancementChoices({
  formData,
  characterLevel,
  srdData,
  abilityOptionsForRow,
  occupiedDomainCardIds,
  getTradeReplacementOptions,
  tradeFromIds,
  traitKeysOrder = DEFAULT_TRAIT_KEYS_ORDER,
  rng = Math.random,
}) {
  const L = Number(characterLevel) || 1;
  const abilitiesById = srdData?.abilitiesById || {};
  const occ = occupiedDomainCardIds instanceof Set ? occupiedDomainCardIds : new Set(occupiedDomainCardIds || []);
  const traitsObj = formData?.traits || {};

  const advancementsBase = formData?.advancements && typeof formData.advancements === 'object' ? { ...formData.advancements } : {};
  const prevRow = advancementsBase[String(L)] || {};
  const band = advancementLevelToBand(L);

  /** Highest spell level first, then stable id. */
  const pickHighestDomainCard = (options, forbidden) => {
    const list = (options || []).filter((a) => a?.id && !forbidden.has(a.id));
    if (!list.length) return null;
    list.sort((a, b) => {
      const lv = (Number(b.level) || 1) - (Number(a.level) || 1);
      if (lv !== 0) return lv;
      return String(a.id).localeCompare(String(b.id));
    });
    return list[0]?.id ?? null;
  };

  let domainCardId = pickHighestDomainCard(abilityOptionsForRow, occ);
  let domainTrade = null;
  if (tradeFromIds?.length && rng() < 0.5) {
    const fromId = pickRandomFromArray([...tradeFromIds], rng);
    if (fromId) {
      const replacements = getTradeReplacementOptions(fromId) || [];
      const toPick = pickRandomFromArray(replacements, rng);
      if (toPick?.id) {
        domainTrade = { fromId, toId: toPick.id };
      }
    }
  }

  const occAfterDomain = new Set(occ);
  if (domainCardId) occAfterDomain.add(domainCardId);
  if (domainTrade?.fromId && domainTrade?.toId) {
    occAfterDomain.delete(domainTrade.fromId);
    occAfterDomain.add(domainTrade.toId);
  }

  let adv = { ...advancementsBase };
  adv[String(L)] = {
    ...prevRow,
    picks: [null, null],
  };
  if (domainCardId) adv[String(L)].domainCardId = domainCardId;
  else delete adv[String(L)].domainCardId;

  if (domainTrade?.fromId && domainTrade?.toId) {
    adv[String(L)].domainTrade = { ...domainTrade };
  } else {
    delete adv[String(L)].domainTrade;
  }

  const typesAvailable = () =>
    ALL_TYPES.filter((t) => {
      if (!advancementTypesAvailableForLevelRow({ advancementLevel: L, characterLevel: L }).includes(t)) {
        return false;
      }
      return remainingSlotsForType(adv, L, L, t, L, null) > 0;
    });

  const tFirst = pickRandomFromArray(typesAvailable(), rng);
  if (tFirst) {
    const next = tryAssignAdvancementPickAtFocusLevel(adv, L, L, tFirst);
    if (next) adv = next;
  }

  if (tFirst && !isDoubleSlotAdvancementType(tFirst)) {
    const tSecond = pickRandomFromArray(typesAvailable(), rng);
    if (tSecond) {
      const next2 = tryAssignAdvancementPickAtFocusLevel(adv, L, L, tSecond);
      if (next2) adv = next2;
    }
  }

  const row = adv[String(L)] || {};
  let picks = [...(row.picks || [])];
  while (picks.length < 2) picks.push(null);

  const marksBand = traitMarksForBandExcludingLevel(adv, L, band, L);

  const fillTraitsPick = (pick, pickIndex) => {
    if (!pick || pick.type !== 'traits') return pick;
    const sibling = traitMarksFromSiblingPicksOnLevelRow(picks, pickIndex);
    const t1 = pickTraitKeyWithScorePreference(
      traitKeysOrder.filter((k) => !marksBand.includes(k) && !sibling.includes(k)),
      traitsObj,
      rng,
    );
    const sib2 = [...sibling];
    if (t1) sib2.push(t1);
    const t2 = pickTraitKeyWithScorePreference(
      traitKeysOrder.filter((k) => !marksBand.includes(k) && !sib2.includes(k)),
      traitsObj,
      rng,
    );
    let traits = [t1, t2].filter(Boolean);
    if (traits.length < 2) {
      const pool = traitKeysOrder.filter(
        (k) => !marksBand.includes(k) && !sibling.includes(k) && !traits.includes(k),
      );
      while (traits.length < 2 && pool.length) {
        const k = pickRandomFromArray(pool, rng);
        if (!k) break;
        traits.push(k);
        const ix = pool.indexOf(k);
        if (ix >= 0) pool.splice(ix, 1);
      }
    }
    return { ...pick, traits: traits.slice(0, 2) };
  };

  const expWithIds = (formData?.experiences || []).filter((e) => e?.id);
  const pickTwoDistinctExperiences = () => {
    const ids = expWithIds.map((e) => e.id);
    if (ids.length < 2) return [ids[0] ?? null, null];
    const a = pickRandomFromArray(ids, rng);
    const rest = ids.filter((id) => id !== a);
    const b = pickRandomFromArray(rest, rng);
    return [a, b];
  };

  const pickHighestDomainForAdvancementPick = () => {
    const id = pickHighestDomainCard(abilityOptionsForRow, occAfterDomain);
    if (id) occAfterDomain.add(id);
    return id || null;
  };

  const randomMulticlassFields = () => {
    const primaryId = formData?.classId;
    const classes = (srdData?.classes || []).filter((c) => c?.id && c.id !== primaryId);
    const mcClass = pickRandomFromArray(classes, rng);
    if (!mcClass?.id) return null;
    const mc = srdData?.classesById?.[mcClass.id];
    const subOpts = (srdData?.subclasses || []).filter((sc) => (mc?.subclasses || []).includes(sc.name));
    const sub = pickRandomFromArray(subOpts, rng);
    const doms = mc?.domains || [];
    let multiclassDomain = null;
    if (Array.isArray(doms) && doms.length > 1) {
      multiclassDomain = pickRandomFromArray([...doms], rng) ?? null;
    }
    return {
      multiclassClassId: mcClass.id,
      multiclassSubclassId: sub?.id ?? null,
      multiclassDomain,
    };
  };

  /** @type {{ multiclassClassId: string, multiclassSubclassId: string|null, multiclassDomain: string|null }|null} */
  let multiclassPatch = null;

  for (let pi = 0; pi < picks.length; pi++) {
    let p = picks[pi];
    if (!p?.type) continue;
    if (p.type === 'traits') {
      p = fillTraitsPick(p, pi);
    } else if (p.type === 'experience') {
      const [a, b] = pickTwoDistinctExperiences();
      p = { ...p, experienceIds: [a, b] };
    } else if (p.type === 'domain_card') {
      const aid = pickHighestDomainForAdvancementPick();
      p = { ...p, abilityId: aid || undefined };
    } else if (p.type === 'multiclass') {
      multiclassPatch = randomMulticlassFields();
      p = { type: 'multiclass' };
    } else {
      p = { ...p };
    }
    picks[pi] = p;
  }

  picks = dedupeTraitPicksAcrossLevelRow(picks);
  if (isDoubleSlotAdvancementType(picks[0]?.type)) {
    picks[1] = null;
  }

  adv[String(L)] = { ...adv[String(L)], picks };

  const out = { advancements: adv };

  if (multiclassPatch) {
    out.multiclassClassId = multiclassPatch.multiclassClassId;
    out.multiclassSubclassId = multiclassPatch.multiclassSubclassId;
    out.multiclassDomain = multiclassPatch.multiclassDomain;
  }

  if (TIER_ENTRY_LEVELS.includes(L)) {
    const expIdx = experienceRowIndexForTierEntryLevel(L);
    if (expIdx != null) {
      const exps = [...(formData?.experiences || [])];
      if (exps[expIdx]) {
        const cur = exps[expIdx];
        const name = `Experience ${expIdx + 1} - choose during play`;
        const next = { ...cur, name };
        if (next.tierEntryAuto && String(name).trim()) delete next.tierEntryAuto;
        exps[expIdx] = next;
        out.experiences = exps;
      }
    }
  }

  return out;
}
