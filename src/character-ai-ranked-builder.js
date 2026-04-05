import {
  advancementTypesAvailableForLevelRow,
  advancementLevelToBand,
  experienceRowIndexForTierEntryLevel,
  isDoubleSlotAdvancementType,
  isValidAdvancementPickType,
  pickTraitKeyWithScorePreference,
  remainingSlotsForType,
  traitMarksForBandExcludingLevel,
  traitMarksFromSiblingPicksOnLevelRow,
  tryAssignAdvancementPickAtFocusLevel,
} from './client/lib/advancement-rules.js';
import { collectOwnedDomainAbilityIdsThroughCharacterLevel } from './client/lib/character-calc.js';
import { fetchCharacterBuildProfile } from './character-ai-build-profile.js';
import {
  buildLookupMaps,
  normalizeLookupKey,
  resolveCharacterAiDraft,
  resolveToId,
  validateCharacterAiDraftStrict,
} from './character-ai-resolve.js';

const DEFAULT_ADVANCEMENT_TYPE_ORDER = [
  'traits',
  'evasion',
  'hp',
  'stress',
  'experience',
  'subclass_upgrade',
  'multiclass',
  'proficiency',
];

const DEFAULT_TRAIT_KEYS = ['agility', 'strength', 'finesse', 'instinct', 'presence', 'knowledge'];

function noop() {}

function uniqueStrings(values) {
  const out = [];
  const seen = new Set();
  for (const value of values || []) {
    const key = typeof value === 'string' ? value.trim() : '';
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

function normalizeStringOrId(raw) {
  if (typeof raw === 'string') return raw.trim();
  if (raw && typeof raw === 'object' && typeof raw.id === 'string') return raw.id.trim();
  return '';
}

function sortTraitKeysByPreference(baseTraits) {
  return [...DEFAULT_TRAIT_KEYS].sort((a, b) => {
    const av = Number(baseTraits?.[a]) || 0;
    const bv = Number(baseTraits?.[b]) || 0;
    if (bv !== av) return bv - av;
    return a.localeCompare(b);
  });
}

function rowIsFullyTyped(row) {
  const picks = [...(row?.picks || [])];
  while (picks.length < 2) picks.push(null);
  const p0 = picks[0];
  const p1 = picks[1];
  if (!p0?.type) return false;
  if (isDoubleSlotAdvancementType(p0.type)) return true;
  return !!p1?.type;
}

function paddedRowPicks(row) {
  const picks = [...(row?.picks || [])];
  while (picks.length < 2) picks.push(null);
  return picks;
}

function firstEmptyPickIndex(picks) {
  for (let i = 0; i < picks.length; i++) {
    if (!picks[i]?.type) return i;
  }
  return -1;
}

function rowAlreadyHasType(picks, type) {
  return (picks || []).some((pick) => pick?.type === type);
}

function pickTopRankedId(options, rankedIds, fallbackIds, forbidden = new Set()) {
  const legalIds = new Set((options || []).map((row) => row?.id).filter(Boolean));
  for (const id of rankedIds || []) {
    if (legalIds.has(id) && !forbidden.has(id)) return id;
  }
  for (const id of fallbackIds || []) {
    if (legalIds.has(id) && !forbidden.has(id)) return id;
  }
  for (const row of options || []) {
    if (row?.id && !forbidden.has(row.id)) return row.id;
  }
  return null;
}

function buildAbilityFallbackOrder(profile) {
  const ids = [];
  for (const row of profile?.startingAbilityOptions || []) {
    if (row?.id && !ids.includes(row.id)) ids.push(row.id);
  }
  for (const row of profile?.legalDomainCards || []) {
    if (row?.id && !ids.includes(row.id)) ids.push(row.id);
  }
  return ids;
}

function buildTypePriority(rankedTypes) {
  const preferred = [];
  for (const raw of rankedTypes || []) {
    const type = typeof raw === 'string' ? raw.trim() : '';
    if (!isValidAdvancementPickType(type) || preferred.includes(type)) continue;
    preferred.push(type);
  }
  for (const type of DEFAULT_ADVANCEMENT_TYPE_ORDER) {
    if (!preferred.includes(type)) preferred.push(type);
  }
  return preferred;
}

function resolvePackageSuggestion(rawPackage, srdData) {
  const classMaps = buildLookupMaps(srdData.classes);
  const subclassMaps = buildLookupMaps(srdData.subclasses);
  const warnCtx = { warn: noop, kind: 'package' };

  const raw = rawPackage && typeof rawPackage === 'object' ? rawPackage : {};
  const classId = resolveToId(raw.classId ?? raw.primaryClassId ?? raw.className ?? raw.class, classMaps, {
    ...warnCtx,
    kind: 'class',
  });
  if (!classId) return null;
  const classRow = srdData.classesById?.[classId] || null;
  if (!classRow) return null;

  let subclassId = resolveToId(raw.subclassId ?? raw.subclassName ?? raw.subclass, subclassMaps, {
    ...warnCtx,
    kind: 'subclass',
  });
  if (subclassId) {
    const sc = srdData.subclassesById?.[subclassId];
    const allowedNames = new Set((classRow.subclasses || []).map((name) => normalizeLookupKey(name)));
    if (!sc || !allowedNames.has(normalizeLookupKey(sc.name))) subclassId = null;
  }
  if (!subclassId) return null;

  let multiclassClassId = resolveToId(raw.multiclassClassId ?? raw.multiclassClass ?? raw.multiclassClassName, classMaps, {
    ...warnCtx,
    kind: 'multiclass class',
  });
  if (multiclassClassId === classId) multiclassClassId = null;
  const mcClassRow = multiclassClassId ? srdData.classesById?.[multiclassClassId] || null : null;

  let multiclassSubclassId = resolveToId(
    raw.multiclassSubclassId ?? raw.multiclassSubclass ?? raw.multiclassSubclassName,
    subclassMaps,
    {
      ...warnCtx,
      kind: 'multiclass subclass',
    },
  );
  if (multiclassSubclassId && mcClassRow) {
    const msc = srdData.subclassesById?.[multiclassSubclassId];
    const allowedNames = new Set((mcClassRow.subclasses || []).map((name) => normalizeLookupKey(name)));
    if (!msc || !allowedNames.has(normalizeLookupKey(msc.name))) multiclassSubclassId = null;
  }
  if (!mcClassRow || !multiclassSubclassId) {
    multiclassClassId = null;
    multiclassSubclassId = null;
  }

  let multiclassDomain = null;
  if (mcClassRow && multiclassSubclassId) {
    const domains = mcClassRow.domains || [];
    if (domains.length > 1) {
      const rawDomain = typeof raw.multiclassDomain === 'string' ? raw.multiclassDomain.trim() : '';
      multiclassDomain =
        domains.find((name) => normalizeLookupKey(name) === normalizeLookupKey(rawDomain)) || null;
      if (!multiclassDomain) {
        multiclassClassId = null;
        multiclassSubclassId = null;
      }
    } else {
      multiclassDomain = domains[0] || null;
    }
  }

  return {
    classId,
    subclassId,
    multiclassClassId,
    multiclassSubclassId,
    multiclassDomain,
  };
}

function loadPackageProfile(packageSuggestion, targetLevel, srdData) {
  if (!packageSuggestion?.classId || !packageSuggestion?.subclassId) return null;
  const profile = fetchCharacterBuildProfile(
    {
      classId: packageSuggestion.classId,
      subclassId: packageSuggestion.subclassId,
      targetLevel,
      multiclassClassId: packageSuggestion.multiclassClassId || null,
      multiclassSubclassId: packageSuggestion.multiclassSubclassId || null,
      multiclassDomain: packageSuggestion.multiclassDomain || null,
    },
    srdData,
  );
  if (!profile?.ok) return null;
  return {
    package: packageSuggestion,
    profile,
  };
}

function sanitizeAbilityRanking(rawRanking, srdData, limit = 50) {
  const abilityMaps = buildLookupMaps(srdData.abilities);
  const out = [];
  for (const raw of rawRanking || []) {
    const value = normalizeStringOrId(raw);
    if (!value) continue;
    const id = resolveToId(value, abilityMaps, { warn: noop, kind: 'domain card' });
    if (!id || out.includes(id)) continue;
    out.push(id);
    if (out.length >= limit) break;
  }
  return out;
}

function sanitizeTypeRanking(rawRanking) {
  const out = [];
  for (const raw of rawRanking || []) {
    const value = typeof raw === 'string' ? raw.trim() : '';
    if (!isValidAdvancementPickType(value) || out.includes(value)) continue;
    out.push(value);
  }
  return out;
}

function firstTwoDistinctExperienceIds(experiences) {
  const ids = uniqueStrings((experiences || []).map((row) => row?.id));
  return [ids[0] || null, ids[1] || null];
}

function fillTraitsForRow(row, advancements, level, baseTraits) {
  const picks = paddedRowPicks(row);
  const band = advancementLevelToBand(level);
  const traitKeys = sortTraitKeysByPreference(baseTraits);
  const next = [...picks];
  for (let pickIndex = 0; pickIndex < next.length; pickIndex++) {
    const pick = next[pickIndex];
    if (!pick || pick.type !== 'traits') continue;
    const marksBand = traitMarksForBandExcludingLevel(advancements, level, band, level);
    const sibling = traitMarksFromSiblingPicksOnLevelRow(next, pickIndex);
    const t1 = pickTraitKeyWithScorePreference(
      traitKeys.filter((key) => !marksBand.includes(key) && !sibling.includes(key)),
      baseTraits,
      () => 0,
    );
    const siblingPlus = [...sibling];
    if (t1) siblingPlus.push(t1);
    const t2 = pickTraitKeyWithScorePreference(
      traitKeys.filter((key) => !marksBand.includes(key) && !siblingPlus.includes(key)),
      baseTraits,
      () => 0,
    );
    const chosen = [];
    if (t1) chosen.push(t1);
    if (t2 && !chosen.includes(t2)) chosen.push(t2);
    for (const key of traitKeys) {
      if (chosen.length >= 2) break;
      if (marksBand.includes(key) || sibling.includes(key) || chosen.includes(key)) continue;
      chosen.push(key);
    }
    next[pickIndex] = { ...pick, traits: chosen.slice(0, 2) };
  }
  return next;
}

function fillExperienceForRow(row, experiences) {
  const picks = paddedRowPicks(row);
  const [a, b] = firstTwoDistinctExperienceIds(experiences);
  return picks.map((pick) => {
    if (!pick || pick.type !== 'experience') return pick;
    return { ...pick, experienceIds: [a, b] };
  });
}

function fillDomainCardPicksForRow(row, level, draft, rowOptions, rankedIds, fallbackIds) {
  const picks = paddedRowPicks(row);
  const workingRow = { ...row, picks: [...picks] };
  const next = [...picks];
  for (let pickIndex = 0; pickIndex < next.length; pickIndex++) {
    const pick = next[pickIndex];
    if (!pick || pick.type !== 'domain_card') continue;
    const owned = new Set(collectOwnedDomainAbilityIdsThroughCharacterLevel(draft, level - 1));
    if (workingRow.domainCardId) owned.add(workingRow.domainCardId);
    for (let i = 0; i < pickIndex; i++) {
      const prior = next[i];
      if (prior?.type === 'domain_card' && prior.abilityId) owned.add(prior.abilityId);
    }
    const abilityId = pickTopRankedId(rowOptions, rankedIds, fallbackIds, owned);
    next[pickIndex] = abilityId ? { ...pick, abilityId } : { ...pick };
  }
  return next;
}

function buildDomainFallbackIdsForRow(rowOptions) {
  return (rowOptions || [])
    .map((row) => row?.id)
    .filter(Boolean)
    .sort((a, b) => String(a).localeCompare(String(b)));
}

function countAvailableTraitsForPick(advancements, level, picks, pickIndex, baseTraits) {
  const band = advancementLevelToBand(level);
  const marksBand = traitMarksForBandExcludingLevel(advancements, level, band, level);
  const sibling = traitMarksFromSiblingPicksOnLevelRow(picks, pickIndex);
  return sortTraitKeysByPreference(baseTraits).filter(
    (key) => !marksBand.includes(key) && !sibling.includes(key),
  ).length;
}

function pickIdForDomainCardAdvancement({
  draft,
  level,
  row,
  pickIndex,
  rowOptions,
  rankedAbilityIds,
  fallbackAbilityIds,
}) {
  const owned = new Set(collectOwnedDomainAbilityIdsThroughCharacterLevel(draft, level - 1));
  if (row?.domainCardId) owned.add(row.domainCardId);
  const picks = paddedRowPicks(row);
  for (let i = 0; i < pickIndex; i++) {
    const prior = picks[i];
    if (prior?.type === 'domain_card' && prior.abilityId) owned.add(prior.abilityId);
  }
  return pickTopRankedId(rowOptions, rankedAbilityIds, fallbackAbilityIds, owned);
}

function canAssignTypeAtLevel({
  advancements,
  basePatch,
  level,
  type,
  rowOptions,
  rankedAbilityIds,
  fallbackAbilityIds,
}) {
  const picks = paddedRowPicks(advancements[String(level)]);
  const pickIndex = firstEmptyPickIndex(picks);
  if (pickIndex < 0) return false;
  if (!advancementTypesAvailableForLevelRow({ advancementLevel: level, characterLevel: basePatch.level }).includes(type)) {
    return false;
  }
  if (picks[0]?.type && isDoubleSlotAdvancementType(picks[0].type)) return false;
  if (rowAlreadyHasType(picks, type)) return false;
  if (isDoubleSlotAdvancementType(type) && pickIndex !== 0) return false;

  const sameLevelPartial = { picks, excludePickIndex: pickIndex };
  if (remainingSlotsForType(advancements, basePatch.level, level, type, level, sameLevelPartial) <= 0) {
    return false;
  }

  if (type === 'multiclass' && !basePatch.multiclassClassId) return false;
  if (type === 'traits' && countAvailableTraitsForPick(advancements, level, picks, pickIndex, basePatch.baseTraits) < 2) {
    return false;
  }
  if (type === 'experience') {
    const [a, b] = firstTwoDistinctExperienceIds(basePatch.experiences);
    if (!a || !b || a === b) return false;
  }
  if (type === 'domain_card') {
    const abilityId = pickIdForDomainCardAdvancement({
      draft: { ...basePatch, advancements },
      level,
      row: advancements[String(level)] || { picks },
      pickIndex,
      rowOptions,
      rankedAbilityIds,
      fallbackAbilityIds,
    });
    if (!abilityId) return false;
  }
  return true;
}

function levelHasRemainingLegalType({
  advancements,
  basePatch,
  level,
  typePriority,
  rowOptions,
  rankedAbilityIds,
  fallbackAbilityIds,
}) {
  return typePriority.some((type) =>
    canAssignTypeAtLevel({
      advancements,
      basePatch,
      level,
      type,
      rowOptions,
      rankedAbilityIds,
      fallbackAbilityIds,
    }),
  );
}

function ensureNamedTierEntryExperiences(experiences, level) {
  const next = Array.isArray(experiences) ? experiences.map((row) => ({ ...(row || {}) })) : [];
  for (const tierLevel of [2, 5, 8]) {
    if (level < tierLevel) continue;
    const expIdx = experienceRowIndexForTierEntryLevel(tierLevel);
    if (expIdx == null || !next[expIdx]) continue;
    const current = next[expIdx];
    if (String(current.name || '').trim()) continue;
    const name = `Experience ${expIdx + 1} - choose during play`;
    const updated = { ...current, name };
    if (updated.tierEntryAuto) delete updated.tierEntryAuto;
    next[expIdx] = updated;
  }
  return next;
}

function buildAdvancementsFromRankings({ basePatch, profile, rankedAbilityIds, rankedTypes, srdData }) {
  let advancements = {};
  const fallbackAbilityIds = buildAbilityFallbackOrder(profile);
  const typePriority = buildTypePriority(rankedTypes);

  for (let level = 2; level <= basePatch.level; level++) {
    const rowOptions = profile?.advancementRows?.[String(level)]?.domainCardOptions || [];
    const ownedBeforeLevel = new Set(
      collectOwnedDomainAbilityIdsThroughCharacterLevel(
        { ...basePatch, advancements },
        level - 1,
      ),
    );
    const domainCardId = pickTopRankedId(rowOptions, rankedAbilityIds, fallbackAbilityIds, ownedBeforeLevel);
    advancements[String(level)] = {
      picks: [null, null],
      ...(domainCardId ? { domainCardId } : {}),
    };

    if (
      basePatch.multiclassClassId &&
      level === 5 &&
      canAssignTypeAtLevel({
        advancements,
        basePatch,
        level,
        type: 'multiclass',
        rowOptions,
        rankedAbilityIds,
        fallbackAbilityIds: buildDomainFallbackIdsForRow(rowOptions),
      })
    ) {
      const forced = tryAssignAdvancementPickAtFocusLevel(advancements, basePatch.level, level, 'multiclass');
      if (forced) advancements = forced;
    }

    let guard = 0;
    while (!rowIsFullyTyped(advancements[String(level)]) && guard < 20) {
      guard += 1;
      let progress = false;
      for (const type of typePriority) {
        if (
          !canAssignTypeAtLevel({
            advancements,
            basePatch,
            level,
            type,
            rowOptions,
            rankedAbilityIds,
            fallbackAbilityIds: buildDomainFallbackIdsForRow(rowOptions),
          })
        ) {
          continue;
        }
        const next = tryAssignAdvancementPickAtFocusLevel(advancements, basePatch.level, level, type);
        if (!next) continue;
        if (
          !rowIsFullyTyped(next[String(level)]) &&
          !levelHasRemainingLegalType({
            advancements: next,
            basePatch,
            level,
            typePriority,
            rowOptions,
            rankedAbilityIds,
            fallbackAbilityIds: buildDomainFallbackIdsForRow(rowOptions),
          })
        ) {
          continue;
        }
        advancements = next;
        progress = true;
        break;
      }
      if (!progress) break;
    }

    const row = advancements[String(level)] || { picks: [null, null] };
    let picks = fillTraitsForRow(row, advancements, level, basePatch.baseTraits);
    picks = fillExperienceForRow({ ...row, picks }, basePatch.experiences);
    picks = fillDomainCardPicksForRow(
      { ...row, picks },
      level,
      { ...basePatch, advancements },
      rowOptions,
      rankedAbilityIds,
      buildDomainFallbackIdsForRow(rowOptions),
    );
    advancements[String(level)] = {
      ...row,
      picks,
    };
  }

  return advancements;
}

function buildCandidateLabel(label, profile) {
  const cls = profile?.primaryClass?.name || 'Class';
  const sub = profile?.primarySubclass?.name || 'Subclass';
  return `${label}: ${cls} / ${sub}`;
}

function filterIntermediateWarnings(warnings) {
  return (warnings || []).filter(
    (warning) =>
      !String(warning).startsWith('Advancement incomplete:') &&
      !String(warning).startsWith('Could not resolve experience (for ') &&
      !String(warning).includes('"experience" to an SRD id'),
  );
}

function buildCandidate({
  label,
  reason,
  packageInfo,
  baseCharacter,
  targetLevel,
  rankedAbilityIds,
  startingCardRanking,
  rankedTypes,
  srdData,
}) {
  const rawSheetDisplayNames =
    baseCharacter?.sheetDisplayNames && typeof baseCharacter.sheetDisplayNames === 'object'
      ? baseCharacter.sheetDisplayNames
      : baseCharacter?.sheet_display_names && typeof baseCharacter.sheet_display_names === 'object'
        ? baseCharacter.sheet_display_names
        : null;
  const baseDraft = {
    ...(baseCharacter && typeof baseCharacter === 'object' ? baseCharacter : {}),
    level: targetLevel,
    classId: packageInfo.package.classId,
    subclassId: packageInfo.package.subclassId,
    multiclassClassId: packageInfo.package.multiclassClassId,
    multiclassSubclassId: packageInfo.package.multiclassSubclassId,
    multiclassDomain: packageInfo.package.multiclassDomain,
    abilityIds: [null, null],
    advancements: {},
  };
  const { patch: normalizedBase, warnings: normalizeWarnings } = resolveCharacterAiDraft(baseDraft, srdData, {
    targetLevel,
  });

  const rankedStartingIds = uniqueStrings([
    ...sanitizeAbilityRanking(startingCardRanking, srdData, 20),
    ...rankedAbilityIds,
  ]);
  const fallbackAbilityIds = buildAbilityFallbackOrder(packageInfo.profile);
  const startingPool = packageInfo.profile?.startingAbilityOptions || [];
  const startingForbidden = new Set();
  const abilityIds = [];
  while (abilityIds.length < 2) {
    const nextId = pickTopRankedId(startingPool, rankedStartingIds, fallbackAbilityIds, startingForbidden);
    if (!nextId) break;
    startingForbidden.add(nextId);
    abilityIds.push(nextId);
  }
  while (abilityIds.length < 2) abilityIds.push(null);

  const basePatch = {
    ...normalizedBase,
    level: targetLevel,
    classId: packageInfo.package.classId,
    subclassId: packageInfo.package.subclassId,
    multiclassClassId: packageInfo.package.multiclassClassId,
    multiclassSubclassId: packageInfo.package.multiclassSubclassId,
    multiclassDomain: packageInfo.package.multiclassDomain,
    abilityIds: abilityIds.slice(0, 2),
    domainSlotAcquiredLevel: [1, 1],
    advancements: {},
    advancementChoicesLockedThroughLevel: targetLevel,
  };

  const advancements = buildAdvancementsFromRankings({
    basePatch,
    profile: packageInfo.profile,
    rankedAbilityIds,
    rankedTypes,
    srdData,
  });

  const finalDraft = {
    ...basePatch,
    experiences: ensureNamedTierEntryExperiences(basePatch.experiences, targetLevel),
    advancements,
    advancementChoicesLockedThroughLevel: targetLevel,
    ...(rawSheetDisplayNames ? { sheetDisplayNames: rawSheetDisplayNames } : {}),
  };
  const strict = validateCharacterAiDraftStrict(finalDraft, srdData, { targetLevel });
  if (!strict.ok) {
    const err = new Error(
      `Could not construct a legal ${label} candidate: ${strict.errors.map((issue) => issue.message).join(' | ')}`,
    );
    err.code = 'BAD_REQUEST';
    err.validation = strict.errors;
    throw err;
  }

  return {
    key: label,
    label: buildCandidateLabel(label, packageInfo.profile),
    reason,
    patch: strict.patch,
    warnings: filterIntermediateWarnings([
      ...normalizeWarnings,
      ...strict.resolverWarnings,
    ]),
  };
}

function buildTopOverlapDiagnostics(profile, rankedAbilityIds, count = 10) {
  const topRanked = uniqueStrings(rankedAbilityIds).slice(0, count);
  const legalIds = new Set((profile?.legalDomainCards || []).map((row) => row?.id).filter(Boolean));
  const matchedIds = topRanked.filter((id) => legalIds.has(id));
  return {
    topCount: topRanked.length,
    matchedCount: matchedIds.length,
    matchedIds,
    topIds: topRanked,
  };
}

export function buildCharacterAiCandidatesFromRankings(parsed, srdData, opts = {}) {
  const targetLevel = Math.max(1, Math.min(10, Math.round(Number(opts.targetLevel) || 1)));
  const primaryPackage = resolvePackageSuggestion(parsed?.primaryPackage, srdData);
  if (!primaryPackage) {
    const err = new Error('The AI did not return a usable primaryPackage.');
    err.code = 'BAD_REQUEST';
    throw err;
  }

  const primaryInfo = loadPackageProfile(primaryPackage, targetLevel, srdData);
  if (!primaryInfo) {
    const err = new Error('The AI primaryPackage did not resolve to a legal build profile.');
    err.code = 'BAD_REQUEST';
    throw err;
  }

  const alternatePackage = resolvePackageSuggestion(parsed?.alternatePackage, srdData);
  const alternateInfo = alternatePackage ? loadPackageProfile(alternatePackage, targetLevel, srdData) : null;
  const rankedAbilityIds = sanitizeAbilityRanking(parsed?.domainCardRanking, srdData, 50);
  const startingCardRanking = parsed?.startingCardRanking;
  const rankedTypes = sanitizeTypeRanking(parsed?.advancementPickTypeRanking);
  const baseCharacter = parsed?.character && typeof parsed.character === 'object' ? parsed.character : {};

  const primaryOverlap = buildTopOverlapDiagnostics(primaryInfo.profile, rankedAbilityIds, 10);

  const candidates = [];
  candidates.push(
    buildCandidate({
      label: 'keep_class_package',
      reason: 'Keeps the chosen class package and uses the highest-ranked legal cards within it.',
      packageInfo: primaryInfo,
      baseCharacter,
      targetLevel,
      rankedAbilityIds,
      startingCardRanking,
      rankedTypes,
      srdData,
    }),
  );

  const warnings = [];
  if (primaryOverlap.matchedCount < 6) {
    if (alternateInfo) {
      candidates.push(
        buildCandidate({
          label: 'keep_card_preferences',
          reason: 'Adjusts the class package to legalize more of the top-ranked card preferences.',
          packageInfo: alternateInfo,
          baseCharacter,
          targetLevel,
          rankedAbilityIds,
          startingCardRanking,
          rankedTypes,
          srdData,
        }),
      );
    } else {
      warnings.push(
        'The ranked top cards pointed off-domain for the chosen package, but the AI did not return a usable alternatePackage, so only the package-preserving build is available.',
      );
    }
  }

  return {
    mode: candidates.length > 1 ? 'choice' : 'single',
    candidates,
    warnings,
    overlapDiagnostics: {
      primaryPackageTop10: primaryOverlap,
    },
  };
}
