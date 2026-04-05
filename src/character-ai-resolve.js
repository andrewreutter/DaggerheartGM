/**
 * Resolve LLM character-builder output to IDs and rules-safe patches (server + unit tests).
 * Handles mistaken human-readable names anywhere an SRD id is expected.
 */

import { randomUUID } from 'crypto';

import {
  expectedExperienceRowCount,
  isValidAdvancementPickType,
  missingLevelAdvancementChoices,
  maxSelectableDomainCardLevelForRow,
  buildDomainTradeReplacementOptions,
  isDoubleSlotAdvancementType,
  advancementTypesAvailableForLevelRow,
  remainingSlotsForType,
} from './client/lib/advancement-rules.js';
import {
  collectOwnedDomainAbilityIdsThroughCharacterLevel,
  collectOwnedDomainAbilityIds,
  recomputeCharacter,
} from './client/lib/character-calc.js';
import { buildAllowedFeatureSheetDisplayNameKeys } from './client/lib/sheet-display-names.js';

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
/**
 * Common LLM mistake: putting domain ability ids (`srd-abl-*`) in experience advancement picks or bonus maps.
 * @param {unknown} raw
 * @param {(m: string) => void} warn
 * @param {string} label
 */
function warnIfDomainAbilityIdInExperienceField(raw, warn, label) {
  if (raw == null || raw === '') return;
  const t = typeof raw === 'number' ? String(raw) : raw;
  if (typeof t !== 'string') return;
  const s = t.trim();
  if (s.startsWith('srd-abl-')) {
    warn(
      `${label}: "${s}" looks like a domain ability id — use it in abilityIds, domainCardId, or a domain_card pick, not here. For experience picks and experienceBonusChoices, use two distinct character.experiences row ids or exact experience row names.`,
    );
  }
}

/**
 * Model output often uses hyphens where the app uses underscores in `feat__…` keys.
 * @param {string} key
 */
function normalizeFeatureSheetDisplayKeyCandidate(key) {
  return key.replace(/-/g, '_');
}

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
function sanitizeAdvancements(raw, warn, maxLevel = 10) {
  if (!raw || typeof raw !== 'object') return {};
  /** @type {Record<string, { picks?: object[], domainCardId?: string, domainTrade?: { fromId?: string, toId?: string } }>} */
  const out = {};
  const cap = Math.max(1, Math.min(10, Math.round(Number(maxLevel) || 10)));
  for (const [k, v] of Object.entries(raw)) {
    const lvl = parseInt(k, 10);
    if (Number.isNaN(lvl) || lvl < 2 || lvl > cap) continue;
    if (!v || typeof v !== 'object') continue;
    /** @type {{ picks: object[], domainCardId?: string, domainTrade?: { fromId: string, toId: string } }} */
    const row = { picks: [] };
    if (typeof v.domainCardId === 'string' && v.domainCardId.trim()) {
      row.domainCardId = v.domainCardId.trim();
    }
    if (v.domainTrade && typeof v.domainTrade === 'object') {
      const fromId = typeof v.domainTrade.fromId === 'string' ? v.domainTrade.fromId.trim() : '';
      const toId = typeof v.domainTrade.toId === 'string' ? v.domainTrade.toId.trim() : '';
      if (fromId && toId) row.domainTrade = { fromId, toId };
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

/** @param {unknown} t */
function coerceTraitKey(t) {
  if (typeof t !== 'string') return null;
  const s = t.trim().toLowerCase();
  if (TRAIT_KEYS.includes(s)) return s;
  const nk = normalizeLookupKey(t);
  for (const k of TRAIT_KEYS) {
    if (normalizeLookupKey(k) === nk) return k;
  }
  return null;
}

/**
 * @param {object} srdData
 * @param {Set<string>} characterDomainsSet
 * @param {string | null | undefined} multiclassDomainName
 * @param {(m: string) => void} warn
 */
function resolveAbilityIdForCharacterDomains(
  raw,
  advLevel,
  charLevel,
  srdData,
  characterDomainsSet,
  multiclassDomainName,
  abilityMaps,
  warn,
  label,
) {
  const noop = () => {};
  const id = resolveToId(raw, abilityMaps, { warn: noop, kind: label });
  if (!id) {
    resolveToId(raw, abilityMaps, { warn, kind: label });
    return null;
  }
  const ab = srdData.abilitiesById[id];
  if (!ab) {
    warn(`${label}: unknown ability "${raw}"`);
    return null;
  }
  const dom = String(ab.domain || '').trim();
  if (!characterDomainsSet.has(dom)) {
    warn(`${label}: "${ab.name}" (${dom}) is not on this character's domains — cleared`);
    return null;
  }
  const maxLv = maxSelectableDomainCardLevelForRow(charLevel, advLevel, dom, multiclassDomainName);
  if ((ab.level || 1) > maxLv) {
    warn(`${label}: "${ab.name}" exceeds max spell level ${maxLv} for level ${advLevel} — cleared`);
    return null;
  }
  return id;
}

/**
 * @param {Record<string, object>} advancementsOut
 * @param {number} L
 */
function partialCharacterForOwnedThrough(advancementsOut, L, base) {
  const adv = {};
  for (const [k, v] of Object.entries(advancementsOut || {})) {
    const n = parseInt(k, 10);
    if (!Number.isNaN(n) && n < L) adv[k] = v;
  }
  return { ...base, advancements: adv };
}

/**
 * @param {object} ctx
 */
function resolveAdvancementsForDraft(ctx) {
  const {
    sanitizedDraftAdvancements,
    resolvedLevel,
    srdData,
    classId,
    subclassId,
    resolvedAbilities,
    experiences,
    multiclassClassId,
    multiclassSubclassId,
    multiclassDomain,
    selectedClass,
    warn,
  } = ctx;

  const abilityMaps = buildLookupMaps(srdData.abilities);
  const expMaps = buildLookupMaps(experiences);
  const characterDomainsSet = new Set(selectedClass?.domains || []);
  if (multiclassDomain) characterDomainsSet.add(multiclassDomain);

  const base = {
    level: resolvedLevel,
    classId,
    subclassId,
    abilityIds: resolvedAbilities,
    domainSlotAcquiredLevel: resolvedAbilities.map(() => 1),
    multiclassClassId,
    multiclassSubclassId,
    multiclassDomain,
  };

  /** @type {Record<string, { picks: object[], domainCardId?: string, domainTrade?: { fromId: string, toId: string } }>} */
  const out = {};

  for (let L = 2; L <= resolvedLevel; L++) {
    const key = String(L);
    const rowIn = sanitizedDraftAdvancements[key];
    if (!rowIn) {
      out[key] = { picks: [] };
      continue;
    }

    const dataThroughLMinus1 = partialCharacterForOwnedThrough(out, L, base);
    const ownedStartL = collectOwnedDomainAbilityIdsThroughCharacterLevel(dataThroughLMinus1, L - 1);
    const ownedStartSet = new Set(ownedStartL);

    let domainCardId = null;
    if (rowIn.domainCardId) {
      const cand = resolveAbilityIdForCharacterDomains(
        rowIn.domainCardId,
        L,
        resolvedLevel,
        srdData,
        characterDomainsSet,
        multiclassDomain,
        abilityMaps,
        warn,
        `Level ${L} domainCardId`,
      );
      if (cand) {
        if (ownedStartSet.has(cand)) {
          warn(`Level ${L} domainCardId duplicates a card already owned — cleared`);
        } else {
          domainCardId = cand;
        }
      }
    }

    const ownedForDup = new Set(ownedStartSet);
    if (domainCardId) ownedForDup.add(domainCardId);

    const rawPicks = Array.isArray(rowIn.picks) ? [...rowIn.picks] : [];
    while (rawPicks.length < 2) rawPicks.push(null);
    /** @type {(object|null)[]} */
    const resolvedPicks = [null, null];

    const advWithRowShell = { ...out, [key]: { picks: resolvedPicks, domainCardId } };

    const tryRemaining = (type, pi, tentativePicks) => {
      const merged = {
        ...advWithRowShell,
        [key]: { picks: tentativePicks, domainCardId },
      };
      return remainingSlotsForType(merged, resolvedLevel, L, type, L, {
        picks: tentativePicks,
        excludePickIndex: pi,
      });
    };

    if (rawPicks[0] && isDoubleSlotAdvancementType(String(rawPicks[0].type))) {
      const t = String(rawPicks[0].type);
      const allowed = advancementTypesAvailableForLevelRow({ advancementLevel: L, characterLevel: resolvedLevel });
      if (!allowed.includes(t)) {
        warn(`Advancement "${t}" not allowed at level ${L} — removed`);
      } else if (tryRemaining(t, 0, [{ type: t }, null]) <= 0) {
        warn(`No remaining band slot for "${t}" at level ${L} — removed`);
      } else {
        resolvedPicks[0] = { type: t };
      }
    } else {
      for (let pi = 0; pi < 2; pi++) {
        const rp = rawPicks[pi];
        if (!rp || !rp.type) continue;
        if (resolvedPicks[0] && isDoubleSlotAdvancementType(resolvedPicks[0].type)) break;
        const t = String(rp.type);
        const allowed = advancementTypesAvailableForLevelRow({ advancementLevel: L, characterLevel: resolvedLevel });
        if (!allowed.includes(t)) {
          warn(`Advancement pick ${pi + 1} type "${t}" not allowed at level ${L} — removed`);
          continue;
        }
        const tentative = [...resolvedPicks];
        if (t === 'traits') {
          const ts = [];
          for (const x of rp.traits || []) {
            const k = coerceTraitKey(x);
            if (k) ts.push(k);
          }
          if (ts.length !== 2 || ts[0] === ts[1]) {
            warn(`Level ${L} traits pick needs two distinct trait keys — removed`);
            continue;
          }
          tentative[pi] = { type: 'traits', traits: ts };
        } else if (t === 'experience') {
          warnIfDomainAbilityIdInExperienceField(rp.experienceIds?.[0], warn, `Level ${L} experience pick (first id)`);
          warnIfDomainAbilityIdInExperienceField(rp.experienceIds?.[1], warn, `Level ${L} experience pick (second id)`);
          const a = resolveToId(rp.experienceIds?.[0], expMaps, { warn, kind: `level ${L} experience pick (first id)` });
          const b = resolveToId(rp.experienceIds?.[1], expMaps, { warn, kind: `level ${L} experience pick (second id)` });
          if (!a || !b || a === b) {
            warn(`Level ${L} experience pick needs two distinct experience row ids — removed`);
            continue;
          }
          tentative[pi] = { type: 'experience', experienceIds: [a, b] };
        } else if (t === 'domain_card') {
          const aid = resolveAbilityIdForCharacterDomains(
            rp.abilityId,
            L,
            resolvedLevel,
            srdData,
            characterDomainsSet,
            multiclassDomain,
            abilityMaps,
            warn,
            `Level ${L} domain_card pick`,
          );
          if (!aid) continue;
          if (ownedForDup.has(aid)) {
            warn(`Level ${L} domain_card duplicates an owned card — removed`);
            continue;
          }
          tentative[pi] = { type: 'domain_card', abilityId: aid };
        } else {
          tentative[pi] = { type: t };
        }
        if (tryRemaining(t, pi, tentative) <= 0) {
          warn(`No remaining slot for "${t}" at level ${L} pick ${pi + 1} — removed`);
          continue;
        }
        if (t === 'domain_card' && tentative[pi]?.abilityId) {
          ownedForDup.add(tentative[pi].abilityId);
        }
        resolvedPicks[pi] = tentative[pi];
      }
    }

    let domainTrade = undefined;
    if (rowIn.domainTrade?.fromId && rowIn.domainTrade?.toId) {
      const fromRaw = rowIn.domainTrade.fromId;
      const toRaw = rowIn.domainTrade.toId;
      const fromId = resolveToId(fromRaw, abilityMaps, { warn, kind: `level ${L} domainTrade fromId` });
      const toId = resolveToId(toRaw, abilityMaps, { warn, kind: `level ${L} domainTrade toId` });
      const tradeOwned = collectOwnedDomainAbilityIdsThroughCharacterLevel(dataThroughLMinus1, L - 1);
      if (fromId && toId && fromId !== toId) {
        if (!tradeOwned.includes(fromId)) {
          warn(`Level ${L} domainTrade fromId is not owned after level ${L - 1} — removed`);
        } else {
          const replacements = buildDomainTradeReplacementOptions({
            fromId,
            srdData,
            domainsAllowed: characterDomainsSet,
            characterLevel: resolvedLevel,
            multiclassDomain,
            ownedDomainAbilityIds: tradeOwned,
          });
          if (replacements.some((x) => x.id === toId)) {
            domainTrade = { fromId, toId };
          } else {
            warn(`Level ${L} domainTrade toId is not a legal replacement — removed`);
          }
        }
      }
    }

    out[key] = { picks: resolvedPicks, ...(domainCardId ? { domainCardId } : {}) };
    if (domainTrade) out[key].domainTrade = domainTrade;
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
    warnIfDomainAbilityIdInExperienceField(val, warn, `experienceBonusChoices value (for ${featureName})`);
    const id = resolveToId(val, expMaps, { warn, kind: `experience (for ${featureName})` });
    if (id) out[featureName] = id;
  }
  return out;
}

/**
 * @param {unknown} raw
 * @param {object} srdData
 * @param {{ targetLevel?: number }} [opts] — clamps draft level to this max when set (API build target)
 * @returns {{ patch: object, warnings: string[] }}
 */
export function resolveCharacterAiDraft(raw, srdData, opts = {}) {
  const warnings = [];
  const warn = (m) => warnings.push(m);

  const draft = raw && typeof raw === 'object' ? { ...raw } : {};
  const apiTargetLevel =
    opts?.targetLevel != null ? Math.max(1, Math.min(10, Math.round(Number(opts.targetLevel)))) : null;

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
  if (apiTargetLevel != null && resolvedLevel > apiTargetLevel) {
    warn(`Draft level ${resolvedLevel} exceeds requested target ${apiTargetLevel} — clamped`);
    resolvedLevel = apiTargetLevel;
  }

  let multiclassClassId = resolveToId(
    draft.multiclassClassId ?? draft.multiclass_class_id,
    classMaps,
    { warn, kind: 'multiclass class' },
  );
  if (multiclassClassId && multiclassClassId === classId) {
    warn('Multiclass class matches primary class — cleared');
    multiclassClassId = null;
  }
  const mcClassRow = multiclassClassId ? srdData.classesById[multiclassClassId] : null;
  let multiclassSubclassId = resolveToId(
    draft.multiclassSubclassId ?? draft.multiclass_subclass_id,
    subclassMaps,
    { warn, kind: 'multiclass subclass' },
  );
  if (multiclassSubclassId && mcClassRow) {
    const allowedMc = new Set((mcClassRow.subclasses || []).map((n) => normalizeLookupKey(n)));
    const msc = srdData.subclassesById[multiclassSubclassId];
    if (!msc || !allowedMc.has(normalizeLookupKey(msc.name))) {
      warn(`Multiclass subclass "${msc?.name || multiclassSubclassId}" is not valid for the multiclass class — cleared`);
      multiclassSubclassId = null;
    }
  } else if (multiclassSubclassId && !multiclassClassId) {
    warn('Multiclass subclass ignored — multiclass class did not resolve');
    multiclassSubclassId = null;
  }
  let multiclassDomain = null;
  const mcDoms = mcClassRow?.domains || [];
  if (mcClassRow && mcDoms.length > 1) {
    const rawMcDom = draft.multiclassDomain ?? draft.multiclass_domain;
    if (rawMcDom == null || rawMcDom === '') {
      warn('Multiclass class has two domains — set multiclassDomain to one of them');
    } else {
      const rd = String(rawMcDom).trim();
      const match = mcDoms.find((d) => normalizeLookupKey(d) === normalizeLookupKey(rd));
      if (match) multiclassDomain = match;
      else warn(`multiclassDomain "${rd}" is not a domain of the multiclass class — cleared`);
    }
  }
  if (!multiclassClassId) {
    multiclassSubclassId = null;
    multiclassDomain = null;
  } else if (!multiclassSubclassId) {
    multiclassDomain = null;
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
      warn(`Primary weapon exceeds tier cap (≤${resolvedLevel}) — using match anyway`);
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
      warn(`Secondary weapon exceeds tier cap (≤${resolvedLevel}) — using match anyway`);
      secondaryWeaponId = fallback;
    }
  }

  let armorId = resolveToId(draft.armorId ?? draft.armor_id, armorMapsT1, { warn, kind: 'armor' });
  if (draft.armorId != null && armorId == null) {
    const fallback = resolveToId(draft.armorId ?? draft.armor_id, armorMaps, { warn, kind: 'armor (any tier)' });
    if (fallback) {
      warn(`Armor exceeds tier cap (≤${resolvedLevel}) — using match anyway`);
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
    const sanitized = sanitizeAdvancements(draft.advancements, warn, resolvedLevel);
    advancements = resolveAdvancementsForDraft({
      sanitizedDraftAdvancements: sanitized,
      resolvedLevel,
      srdData,
      classId,
      subclassId,
      resolvedAbilities,
      experiences,
      multiclassClassId,
      multiclassSubclassId,
      multiclassDomain,
      selectedClass,
      warn,
    });
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

  /** @type {Record<string, string>} */
  const sheetWeapons = {};
  /** @type {Record<string, string>} */
  const sheetAbilities = {};
  /** @type {Record<string, string>} */
  const sheetFeatures = {};
  const rawSheetNames = draft.sheetDisplayNames ?? draft.sheet_display_names;
  if (rawSheetNames && typeof rawSheetNames === 'object') {
    const allowedWeaponKeys = new Set();
    if (primaryWeaponId) {
      allowedWeaponKeys.add(primaryWeaponId);
      allowedWeaponKeys.add(`slot-primary:${primaryWeaponId}`);
    }
    if (secondaryWeaponId) {
      allowedWeaponKeys.add(secondaryWeaponId);
      allowedWeaponKeys.add(`slot-secondary:${secondaryWeaponId}`);
    }
    const wmap = rawSheetNames.weapons;
    if (wmap && typeof wmap === 'object') {
      for (const [k, v] of Object.entries(wmap)) {
        const key = String(k).trim();
        const label = typeof v === 'string' ? v.trim() : '';
        if (!key || !label) continue;
        if (!allowedWeaponKeys.has(key)) {
          warn(`sheetDisplayNames.weapons key "${key}" ignored — not tied to resolved primary/secondary weapons`);
          continue;
        }
        sheetWeapons[key] = label;
      }
    }
    const previewForOwned = {
      level: resolvedLevel,
      classId,
      subclassId,
      abilityIds: resolvedAbilities,
      domainSlotAcquiredLevel: resolvedAbilities.map(() => 1),
      advancements,
      multiclassClassId,
      multiclassSubclassId,
      multiclassDomain,
    };
    const legalAbilityIds = new Set(collectOwnedDomainAbilityIds(previewForOwned));
    const amap = rawSheetNames.abilities;
    if (amap && typeof amap === 'object') {
      for (const [k, v] of Object.entries(amap)) {
        const key = String(k).trim();
        const label = typeof v === 'string' ? v.trim() : '';
        if (!key || !label) continue;
        const m = /^ability-(.+)$/.exec(key);
        const abId = m ? m[1] : null;
        if (!abId || !legalAbilityIds.has(abId)) {
          warn(`sheetDisplayNames.abilities key "${key}" ignored — not an owned domain card id at this level`);
          continue;
        }
        sheetAbilities[key] = label;
      }
    }

    let allowedFeatureKeys = /** @type {Set<string>} */ (new Set());
    const previewForFeatures = {
      level: resolvedLevel,
      classId,
      subclassId,
      ancestryIds,
      communityId,
      multiclassClassId,
      multiclassSubclassId,
      multiclassDomain,
      abilityIds: resolvedAbilities,
      domainSlotAcquiredLevel: resolvedAbilities.map(() => 1),
      advancements,
      baseTraits,
      experiences,
      experienceBonusChoices,
      primaryWeaponId,
      secondaryWeaponId,
      armorId,
      companion,
    };
    try {
      const elForFeatureKeys = recomputeCharacter(previewForFeatures, srdData);
      allowedFeatureKeys = buildAllowedFeatureSheetDisplayNameKeys(elForFeatureKeys, () => {});
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      warn(`sheetDisplayNames.features skipped — could not build feature key allowlist (${msg})`);
    }

    const fmap = rawSheetNames.features;
    if (fmap && typeof fmap === 'object') {
      for (const [k, v] of Object.entries(fmap)) {
        const key = String(k).trim();
        const label = typeof v === 'string' ? v.trim() : '';
        if (!key || !label) continue;
        let lookupKey = key;
        if (!allowedFeatureKeys.has(lookupKey)) {
          const alt = normalizeFeatureSheetDisplayKeyCandidate(key);
          if (alt !== key && allowedFeatureKeys.has(alt)) lookupKey = alt;
        }
        if (!allowedFeatureKeys.has(lookupKey)) {
          warn(`sheetDisplayNames.features key "${key}" ignored — not a guide or stable feature key for this build`);
          continue;
        }
        sheetFeatures[lookupKey] = label;
      }
    }
  }

  const patch = {
    level: resolvedLevel,
    advancements,
    advancementChoicesLockedThroughLevel: 1,
    domainLoadoutIds: [],
    multiclassClassId,
    multiclassSubclassId,
    multiclassDomain,
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

  if (Object.keys(sheetWeapons).length || Object.keys(sheetAbilities).length || Object.keys(sheetFeatures).length) {
    patch.sheetDisplayNames = {};
    if (Object.keys(sheetWeapons).length) patch.sheetDisplayNames.weapons = sheetWeapons;
    if (Object.keys(sheetAbilities).length) patch.sheetDisplayNames.abilities = sheetAbilities;
    if (Object.keys(sheetFeatures).length) patch.sheetDisplayNames.features = sheetFeatures;
  }

  const advGaps = missingLevelAdvancementChoices(patch, srdData);
  for (const line of advGaps) {
    warn(`Advancement incomplete: ${line}`);
  }
  patch.advancementChoicesLockedThroughLevel = advGaps.length ? 1 : resolvedLevel;

  return { patch, warnings };
}
