import { describe, it, expect } from 'vitest';
import {
  advancementLevelToBand,
  countAutomaticProficiencyBonuses,
  isDoubleSlotAdvancementType,
  countPicksOfTypeInBand,
  remainingSlotsForType,
  maxMulticlassDomainCardLevel,
  canTakeMulticlass,
  deriveSubclassUnlockSteps,
  maxSelectableDomainCardLevelForRow,
  countMulticlassPicksGlobally,
  advancementTypesAvailableForLevelRow,
  firstMulticlassAdvancementLevel,
  effectiveMulticlassBudgetForBand,
  effectiveSubclassUpgradeBudgetForBand,
  describeSubclassUpgradeMulticlassCrossout,
  expectedExperienceRowCount,
  advancementRowHasMeaningfulContent,
  isDomainSlotDirectEditLocked,
  isValidDomainTradeReplacement,
  buildDomainTradeReplacementOptions,
  describeMulticlassSubclassUpgradeCrossout,
  isDomainLevelingToolsUnlocked,
  experienceRowIndexForTierEntryLevel,
  isAdvancementPickFullyResolved,
  missingLevelAdvancementChoices,
  traitMarksFromSiblingPicksOnLevelRow,
  dedupeTraitPicksAcrossLevelRow,
  formatAdvancementRowCollapsedSummary,
  countSubclassUpgradePicksBefore,
  formatSubclassUpgradeAdvancementOptionLabel,
  hasAdvancementTrackingFilled,
  listOrderedBandSlotFills,
  tryAssignAdvancementPickAtFocusLevel,
  tryClearBandSlotAtOrdinal,
  clearMulticlassPicksFromAdvancementsUpToLevel,
  buildBandSlotDisplayCells,
  traitMarkLevelByKeyExcludingPick,
  pickTraitKeyWithScorePreference,
  randomizeLevelAdvancementChoices,
  hasAdvancementChoicesLockField,
  isAdvancementLockedThroughCurrentLevel,
  isCurrentCharacterLevelAdvancementRowEditable,
} from '../../src/client/lib/advancement-rules.js';

describe('advancement lock helpers', () => {
  it('treats missing lock field as satisfied (legacy saves)', () => {
    expect(hasAdvancementChoicesLockField({ level: 3 })).toBe(false);
    expect(isAdvancementLockedThroughCurrentLevel({ level: 3 })).toBe(true);
    expect(isCurrentCharacterLevelAdvancementRowEditable({ level: 3 })).toBe(true);
  });

  it('gates completion until lockedThrough >= level', () => {
    const row = {
      level: 4,
      advancementChoicesLockedThroughLevel: 3,
      advancements: {},
    };
    expect(hasAdvancementChoicesLockField(row)).toBe(true);
    expect(isAdvancementLockedThroughCurrentLevel(row)).toBe(false);
    expect(isCurrentCharacterLevelAdvancementRowEditable(row)).toBe(true);
  });

  it('marks locked when lockedThrough >= level', () => {
    const row = { level: 4, advancementChoicesLockedThroughLevel: 4, advancements: {} };
    expect(isAdvancementLockedThroughCurrentLevel(row)).toBe(true);
    expect(isCurrentCharacterLevelAdvancementRowEditable(row)).toBe(false);
  });
});

describe('advancement-rules', () => {
  it('formatAdvancementRowCollapsedSummary lists picks, domain card, trade, tier experience', () => {
    const abilitiesById = {
      'a-old': { name: 'Old Spark' },
      'a-new': { name: 'New Bolt' },
      'a-dom': { name: 'Fireball' },
    };
    const lines = formatAdvancementRowCollapsedSummary({
      adv: {
        picks: [
          { type: 'hp' },
          { type: 'traits', traits: ['agility', 'strength'] },
        ],
        domainCardId: 'a-dom',
        domainTrade: { fromId: 'a-old', toId: 'a-new' },
      },
      experiences: [],
      abilitiesById,
      tierExperienceName: 'River guide',
    });
    expect(lines).toEqual([
      'Tier experience: River guide',
      'Pick 1: +1 Max HP',
      'Pick 2: Agility · Strength',
      'New domain card: Fireball',
      'Trade: Old Spark → New Bolt',
    ]);
  });

  it('formatAdvancementRowCollapsedSummary uses Pick 1–2 for double-slot types', () => {
    const lines = formatAdvancementRowCollapsedSummary({
      adv: {
        picks: [{ type: 'proficiency' }, null],
      },
      experiences: [],
      abilitiesById: {},
    });
    expect(lines).toEqual(['Pick 1–2: +1 Proficiency (both picks)']);
  });

  it('formatAdvancementRowCollapsedSummary names domain_card advancement pick when abilityId set', () => {
    const abilitiesById = { 'abl-x': { name: 'Hex' } };
    const lines = formatAdvancementRowCollapsedSummary({
      adv: {
        picks: [{ type: 'domain_card', abilityId: 'abl-x' }, { type: 'hp' }],
      },
      experiences: [],
      abilitiesById,
    });
    expect(lines).toEqual([
      'Pick 1: Additional domain: Hex',
      'Pick 2: +1 Max HP',
    ]);
  });

  it('countSubclassUpgradePicksBefore counts lower levels then earlier sibling picks', () => {
    const advancements = {
      3: { picks: [{ type: 'subclass_upgrade' }, { type: 'hp' }] },
      5: { picks: [{ type: 'stress' }, { type: 'subclass_upgrade' }] },
    };
    expect(countSubclassUpgradePicksBefore(advancements, 3, 0)).toBe(0);
    expect(countSubclassUpgradePicksBefore(advancements, 3, 1)).toBe(1);
    expect(countSubclassUpgradePicksBefore(advancements, 5, 0)).toBe(1);
    // Level 5 pick 2: one prior upgrade on level 3; sibling pick 1 is stress, not counted
    expect(countSubclassUpgradePicksBefore(advancements, 5, 1)).toBe(1);
  });

  it('formatSubclassUpgradeAdvancementOptionLabel lists specialization then mastery feature names', () => {
    const subclass = {
      specialization_features: [{ name: 'Maestro' }],
      mastery_features: [{ name: 'Virtuoso' }],
    };
    const adv = { 4: { picks: [{ type: 'subclass_upgrade' }, null] } };
    expect(
      formatSubclassUpgradeAdvancementOptionLabel({
        subclass,
        advancements: adv,
        advancementLevel: 4,
        pickIndex: 0,
        multiclassClassId: null,
      }),
    ).toBe('Subclass upgrade to Specialization - Maestro');
    expect(
      formatSubclassUpgradeAdvancementOptionLabel({
        subclass,
        advancements: adv,
        advancementLevel: 4,
        pickIndex: 1,
        multiclassClassId: null,
      }),
    ).toBe('Subclass upgrade to Mastery - Virtuoso');
  });

  it('formatAdvancementRowCollapsedSummary strips subclass_upgrade to tier + feature names', () => {
    const subclass = {
      specialization_features: [{ name: 'Maestro' }],
      mastery_features: [{ name: 'Virtuoso' }],
    };
    const advancements = { 4: { picks: [{ type: 'subclass_upgrade' }, null] } };
    const lines = formatAdvancementRowCollapsedSummary({
      adv: { picks: [{ type: 'subclass_upgrade' }, { type: 'hp' }] },
      experiences: [],
      abilitiesById: {},
      advancementLevel: 4,
      advancements,
      subclass,
      multiclassClassId: null,
    });
    expect(lines).toEqual([
      'Pick 1: Specialization - Maestro',
      'Pick 2: +1 Max HP',
    ]);
  });

  it('formatSubclassUpgradeAdvancementOptionLabel warns when multiclass blocks second tier unlock', () => {
    const subclass = {
      specialization_features: [{ name: 'S' }],
      mastery_features: [{ name: 'M' }],
    };
    const advancements = {
      5: { picks: [{ type: 'subclass_upgrade' }, null] },
    };
    const label = formatSubclassUpgradeAdvancementOptionLabel({
      subclass,
      advancements,
      advancementLevel: 5,
      pickIndex: 1,
      multiclassClassId: 'srd-cls-rogue',
    });
    expect(label).toContain('multiclass');
  });

  it('traitMarksFromSiblingPicksOnLevelRow excludes self pick index', () => {
    const picks = [
      { type: 'traits', traits: ['agility', 'strength'] },
      { type: 'traits', traits: ['instinct'] },
    ];
    expect(traitMarksFromSiblingPicksOnLevelRow(picks, 0)).toEqual(['instinct']);
    expect(traitMarksFromSiblingPicksOnLevelRow(picks, 1)).toEqual(['agility', 'strength']);
  });

  it('traitMarkLevelByKeyExcludingPick maps traits to levels from other picks in band', () => {
    const advancements = {
      3: { picks: [{ type: 'traits', traits: ['agility', 'finesse'] }] },
      4: {
        picks: [
          { type: 'traits', traits: ['strength', 'instinct'] },
          { type: 'traits', traits: ['presence', 'knowledge'] },
        ],
      },
    };
    expect(traitMarkLevelByKeyExcludingPick(advancements, 4, 'A', 4, 0)).toEqual({
      agility: 3,
      finesse: 3,
      presence: 4,
      knowledge: 4,
    });
    expect(traitMarkLevelByKeyExcludingPick(advancements, 4, 'A', 4, 1)).toEqual({
      agility: 3,
      finesse: 3,
      strength: 4,
      instinct: 4,
    });
  });

  it('dedupeTraitPicksAcrossLevelRow keeps first pick’s traits and strips duplicates from later picks', () => {
    const picks = [
      { type: 'traits', traits: ['agility', 'strength'] },
      { type: 'traits', traits: ['agility', 'presence'] },
    ];
    const out = dedupeTraitPicksAcrossLevelRow(picks);
    expect(out[0].traits).toEqual(['agility', 'strength']);
    expect(out[1].traits).toEqual(['presence']);
  });

  it('missingLevelAdvancementChoices lists gaps per level row', () => {
    const data = { level: 2, advancements: {} };
    const m = missingLevelAdvancementChoices(data);
    expect(m.length).toBe(1);
    expect(m[0]).toMatch(/Level 2/);
    expect(m[0]).toMatch(/domain card/);
    expect(m[0]).toMatch(/advancement pick 1/);
  });

  it('isAdvancementPickFullyResolved: domain_card requires pick.abilityId (separate from per-level domainCardId)', () => {
    expect(isAdvancementPickFullyResolved({ type: 'domain_card' }, {}, undefined)).toBe(false);
    expect(isAdvancementPickFullyResolved({ type: 'domain_card', abilityId: 'z' }, {}, undefined)).toBe(true);
  });

  it('isDomainLevelingToolsUnlocked: only after level increases above session baseline', () => {
    expect(isDomainLevelingToolsUnlocked(1, 1)).toBe(false);
    expect(isDomainLevelingToolsUnlocked(5, 5)).toBe(false);
    expect(isDomainLevelingToolsUnlocked(2, 1)).toBe(true);
    expect(isDomainLevelingToolsUnlocked(6, 5)).toBe(true);
  });

  it('experienceRowIndexForTierEntryLevel maps tier-achievement levels to experience row indices', () => {
    expect(experienceRowIndexForTierEntryLevel(2)).toBe(2);
    expect(experienceRowIndexForTierEntryLevel(5)).toBe(3);
    expect(experienceRowIndexForTierEntryLevel(8)).toBe(4);
    expect(experienceRowIndexForTierEntryLevel(3)).toBe(null);
  });

  it('advancementLevelToBand', () => {
    expect(advancementLevelToBand(2)).toBe('A');
    expect(advancementLevelToBand(4)).toBe('A');
    expect(advancementLevelToBand(5)).toBe('B');
    expect(advancementLevelToBand(7)).toBe('B');
    expect(advancementLevelToBand(8)).toBe('C');
  });

  it('countAutomaticProficiencyBonuses at tier entries', () => {
    expect(countAutomaticProficiencyBonuses(1)).toBe(0);
    expect(countAutomaticProficiencyBonuses(2)).toBe(1);
    expect(countAutomaticProficiencyBonuses(4)).toBe(1);
    expect(countAutomaticProficiencyBonuses(5)).toBe(2);
    expect(countAutomaticProficiencyBonuses(8)).toBe(3);
  });

  it('isDoubleSlotAdvancementType', () => {
    expect(isDoubleSlotAdvancementType('proficiency')).toBe(true);
    expect(isDoubleSlotAdvancementType('multiclass')).toBe(true);
    expect(isDoubleSlotAdvancementType('hp')).toBe(false);
  });

  it('countPicksOfTypeInBand and remainingSlotsForType', () => {
    const adv = {
      2: { picks: [{ type: 'evasion' }] },
      3: { picks: [{ type: 'stress' }, { type: 'stress' }] },
      5: { picks: [{ type: 'hp' }] },
    };
    expect(countPicksOfTypeInBand(adv, 4, 'A', 'evasion')).toBe(1);
    expect(countPicksOfTypeInBand(adv, 4, 'A', 'stress')).toBe(2);
    expect(remainingSlotsForType(adv, 4, 3, 'evasion')).toBe(0);
    expect(remainingSlotsForType(adv, 4, 3, 'stress')).toBe(0);
    // Band B evasion budget is 1 (SLOT_BUDGET_PER_BAND); no evasion picks in band B in this fixture
    expect(remainingSlotsForType(adv, 5, 5, 'evasion')).toBe(1);
  });

  it('countPicksOfTypeInBand / remainingSlotsForType count sibling picks when ignoreLevel + sameLevelPartial', () => {
    const adv = {
      2: { picks: [{ type: 'stress' }] },
      3: { picks: [{ type: 'hp' }, { type: 'stress' }] },
    };
    const partial0 = { picks: adv[3].picks, excludePickIndex: 0 };
    const partial1 = { picks: adv[3].picks, excludePickIndex: 1 };
    // Band A stress cap 2: lvl2 has 1; lvl3 pick1 excludes pick0 → sibling stress counts → 2 used → pick 0 cannot take stress
    expect(remainingSlotsForType(adv, 4, 3, 'stress', 3, partial0)).toBe(0);
    // Excluding pick1: sibling is hp; only lvl2 stress → 1 used → pick1 can still be stress
    expect(remainingSlotsForType(adv, 4, 3, 'stress', 3, partial1)).toBe(1);
    expect(countPicksOfTypeInBand(adv, 4, 'A', 'stress', 3, partial0)).toBe(2);
    expect(countPicksOfTypeInBand(adv, 4, 'A', 'stress', 3, partial1)).toBe(1);
  });

  it('deriveSubclassUnlockSteps: multiclass with no subclass_upgrade picks uses legacy capped at specialization', () => {
    expect(
      deriveSubclassUnlockSteps({
        advancements: {},
        level: 7,
        tier: 3,
        multiclassClassId: 'srd-cls-rogue',
      }),
    ).toBe(1);
  });

  it('advancementTypesAvailableForLevelRow excludes Tier-3-only options on levels 2–4', () => {
    const t3 = advancementTypesAvailableForLevelRow({ advancementLevel: 3, characterLevel: 5 });
    expect(t3).not.toContain('subclass_upgrade');
    expect(t3).not.toContain('proficiency');
    expect(t3).not.toContain('multiclass');
    const t5 = advancementTypesAvailableForLevelRow({ advancementLevel: 5, characterLevel: 5 });
    expect(t5).toContain('subclass_upgrade');
    expect(t5).toContain('proficiency');
  });

  it('maxMulticlassDomainCardLevel is ceil(level/2)', () => {
    expect(maxMulticlassDomainCardLevel(5)).toBe(3);
    expect(maxMulticlassDomainCardLevel(6)).toBe(3);
    expect(maxMulticlassDomainCardLevel(7)).toBe(4);
    expect(maxMulticlassDomainCardLevel(10)).toBe(5);
  });

  it('maxSelectableDomainCardLevelForRow applies half-level only to multiclass domain', () => {
    expect(maxSelectableDomainCardLevelForRow(5, 5, 'Arcana', 'Arcana')).toBe(3);
    expect(maxSelectableDomainCardLevelForRow(5, 5, 'Bone', 'Arcana')).toBe(5);
  });

  it('canTakeMulticlass is level gate only (per-tier limits use remainingSlotsForType)', () => {
    expect(canTakeMulticlass(4)).toBe(false);
    expect(canTakeMulticlass(5)).toBe(true);
    expect(canTakeMulticlass(10)).toBe(true);
  });

  it('deriveSubclassUnlockSteps legacy fallback and picks', () => {
    expect(
      deriveSubclassUnlockSteps({ advancements: {}, level: 7, tier: 3, multiclassClassId: null }),
    ).toBe(2);
    expect(
      deriveSubclassUnlockSteps({ advancements: {}, level: 3, tier: 2, multiclassClassId: null }),
    ).toBe(1);
    expect(
      deriveSubclassUnlockSteps({
        advancements: { 2: { picks: [{ type: 'subclass_upgrade' }] } },
        level: 10,
        tier: 4,
        multiclassClassId: null,
      }),
    ).toBe(1);
    expect(
      deriveSubclassUnlockSteps({
        advancements: {
          2: { picks: [{ type: 'subclass_upgrade' }] },
          5: { picks: [{ type: 'subclass_upgrade' }] },
        },
        level: 10,
        tier: 4,
        multiclassClassId: null,
      }),
    ).toBe(2);
    expect(
      deriveSubclassUnlockSteps({
        advancements: {
          2: { picks: [{ type: 'subclass_upgrade' }] },
          5: { picks: [{ type: 'subclass_upgrade' }] },
        },
        level: 10,
        tier: 4,
        multiclassClassId: 'srd-cls-rogue',
      }),
    ).toBe(1);
    // Book leveling rows filled but no subclass_upgrade → no spec/mastery (preview matches form)
    expect(
      deriveSubclassUnlockSteps({
        advancements: {
          2: { domainCardId: 'dc1', picks: [{ type: 'hp' }, { type: 'stress' }] },
        },
        level: 7,
        tier: 3,
        multiclassClassId: null,
      }),
    ).toBe(0);
    expect(
      deriveSubclassUnlockSteps({
        advancements: {
          5: { picks: [{ type: 'multiclass' }, { type: 'hp' }] },
        },
        level: 7,
        tier: 3,
        multiclassClassId: 'srd-cls-rogue',
      }),
    ).toBe(0);
  });

  it('hasAdvancementTrackingFilled detects domain card, trade, or picks', () => {
    expect(hasAdvancementTrackingFilled({}, 5)).toBe(false);
    expect(hasAdvancementTrackingFilled({ 2: { picks: [null, null] } }, 5)).toBe(false);
    expect(hasAdvancementTrackingFilled({ 2: { domainCardId: 'x' } }, 5)).toBe(true);
    expect(hasAdvancementTrackingFilled({ 3: { domainTrade: { fromId: 'a', toId: 'b' } } }, 5)).toBe(true);
    expect(hasAdvancementTrackingFilled({ 4: { picks: [{ type: 'hp' }] } }, 5)).toBe(true);
  });

  it('countMulticlassPicksGlobally and remainingSlotsForType (per tier column)', () => {
    const adv = { 5: { picks: [{ type: 'multiclass' }, { type: 'hp' }] } };
    expect(countMulticlassPicksGlobally(adv, 6)).toBe(1);
    // Band B: one multiclass slot, already taken at level 5
    expect(remainingSlotsForType(adv, 6, 6, 'multiclass')).toBe(0);
    expect(remainingSlotsForType({}, 6, 6, 'multiclass')).toBe(1);
    // Tier 4 column still available while Tier 3 multiclass exists
    expect(remainingSlotsForType(adv, 10, 8, 'multiclass')).toBe(1);
    const advBoth = {
      5: { picks: [{ type: 'multiclass' }, { type: 'hp' }] },
      8: { picks: [{ type: 'multiclass' }, { type: 'hp' }] },
    };
    expect(remainingSlotsForType(advBoth, 10, 8, 'multiclass')).toBe(0);
    expect(remainingSlotsForType(advBoth, 10, 6, 'multiclass')).toBe(0);
  });

  it('countMulticlassPicksGlobally counts sibling multiclass when row is ignored with sameLevelPartial', () => {
    const adv = { 5: { picks: [{ type: 'multiclass' }, { type: 'hp' }] } };
    const partialPick1 = { picks: adv[5].picks, excludePickIndex: 1 };
    expect(countMulticlassPicksGlobally(adv, 6, 5, partialPick1)).toBe(1);
    expect(remainingSlotsForType(adv, 6, 5, 'multiclass', 5, partialPick1)).toBe(0);
  });

  it('clearMulticlassPicksFromAdvancementsUpToLevel clears multiclass rows only', () => {
    const adv = {
      5: { picks: [{ type: 'multiclass' }, { type: 'hp' }] },
      6: { picks: [{ type: 'hp' }, { type: 'stress' }] },
    };
    const out = clearMulticlassPicksFromAdvancementsUpToLevel(adv, 7);
    expect(out[5].picks).toEqual([null, null]);
    expect(out[6].picks).toEqual(adv[6].picks);
  });

  it('advancementTypesAvailableForLevelRow gates multiclass by level only (still listed after multiclass taken — assign uses remainingSlots)', () => {
    const t5 = advancementTypesAvailableForLevelRow({ advancementLevel: 5, characterLevel: 5 });
    expect(t5).toContain('multiclass');
    const t4 = advancementTypesAvailableForLevelRow({ advancementLevel: 4, characterLevel: 5 });
    expect(t4).not.toContain('multiclass');
    const afterMc = advancementTypesAvailableForLevelRow({ advancementLevel: 6, characterLevel: 6 });
    expect(afterMc).toContain('multiclass');
  });

  it('firstMulticlassAdvancementLevel and subclass upgrade cross-out in that band', () => {
    const adv = {
      5: { picks: [{ type: 'multiclass' }, { type: 'hp' }] },
    };
    expect(firstMulticlassAdvancementLevel(adv, 7)).toBe(5);
    // Band B allows 1 subclass_upgrade pick; multiclass in B uses that slot (cross-out) → 0 left
    expect(effectiveSubclassUpgradeBudgetForBand(adv, 7, 'B')).toBe(0);
    expect(effectiveSubclassUpgradeBudgetForBand(adv, 7, 'A')).toBe(0);
    // One subclass_upgrade already in band B + cross-out → no slots left
    const adv2 = {
      5: { picks: [{ type: 'multiclass' }, { type: 'subclass_upgrade' }] },
    };
    expect(remainingSlotsForType(adv2, 7, 6, 'subclass_upgrade')).toBe(0);
  });

  it('multiclass at level 8 cross-out applies to band C only', () => {
    const adv = {
      8: { picks: [{ type: 'multiclass' }, { type: 'hp' }] },
    };
    expect(firstMulticlassAdvancementLevel(adv, 10)).toBe(8);
    expect(effectiveSubclassUpgradeBudgetForBand(adv, 10, 'C')).toBe(0);
    expect(effectiveSubclassUpgradeBudgetForBand(adv, 10, 'B')).toBe(1);
  });

  it('multiclass in both Tier 3 and Tier 4 crosses out subclass upgrade in each band', () => {
    const adv = {
      5: { picks: [{ type: 'multiclass' }, { type: 'hp' }] },
      8: { picks: [{ type: 'multiclass' }, { type: 'hp' }] },
    };
    expect(effectiveSubclassUpgradeBudgetForBand(adv, 10, 'B')).toBe(0);
    expect(effectiveSubclassUpgradeBudgetForBand(adv, 10, 'C')).toBe(0);
  });

  it('subclass upgrade in a tier column crosses out multiclass for that band (symmetric to multiclass)', () => {
    const adv = {
      5: { picks: [{ type: 'subclass_upgrade' }, { type: 'hp' }] },
    };
    expect(effectiveMulticlassBudgetForBand(adv, 7, 'B')).toBe(0);
    expect(remainingSlotsForType(adv, 7, 6, 'multiclass')).toBe(0);
    expect(effectiveMulticlassBudgetForBand(adv, 7, 'C')).toBe(1);
    expect(remainingSlotsForType(adv, 10, 8, 'multiclass')).toBe(1);
    const cross = describeSubclassUpgradeMulticlassCrossout(adv, 7, 'B');
    expect(cross?.subclassUpgradeLevel).toBe(5);
    expect(describeSubclassUpgradeMulticlassCrossout(adv, 7, 'C')).toBe(null);
  });

  it('expectedExperienceRowCount matches 2 + tier entries', () => {
    expect(expectedExperienceRowCount(1)).toBe(2);
    expect(expectedExperienceRowCount(2)).toBe(3);
    expect(expectedExperienceRowCount(4)).toBe(3);
    expect(expectedExperienceRowCount(5)).toBe(4);
    expect(expectedExperienceRowCount(10)).toBe(5);
  });

  it('advancementRowHasMeaningfulContent', () => {
    expect(advancementRowHasMeaningfulContent(null)).toBe(false);
    expect(advancementRowHasMeaningfulContent({ picks: [] })).toBe(false);
    expect(advancementRowHasMeaningfulContent({ domainCardId: 'x' })).toBe(true);
    expect(advancementRowHasMeaningfulContent({ picks: [{ type: 'hp' }] })).toBe(true);
  });

  it('isDomainSlotDirectEditLocked when next level row has content', () => {
    expect(
      isDomainSlotDirectEditLocked({
        acquiredAtLevel: 1,
        characterLevel: 2,
        advancements: { 2: { picks: [{ type: 'hp' }] } },
      }),
    ).toBe(true);
    expect(
      isDomainSlotDirectEditLocked({
        acquiredAtLevel: 1,
        characterLevel: 2,
        advancements: { 2: { picks: [] } },
      }),
    ).toBe(false);
  });

  it('isValidDomainTradeReplacement enforces level and domains', () => {
    const oldA = { id: 'a', level: 3, domain: 'Grace' };
    const newOk = { id: 'b', level: 2, domain: 'Grace' };
    const newHigh = { id: 'c', level: 4, domain: 'Grace' };
    const doms = ['Grace'];
    expect(
      isValidDomainTradeReplacement({
        oldAbility: oldA,
        newAbility: newOk,
        characterLevel: 5,
        multiclassDomain: null,
        domainsAllowed: doms,
      }),
    ).toBe(true);
    expect(
      isValidDomainTradeReplacement({
        oldAbility: oldA,
        newAbility: newHigh,
        characterLevel: 5,
        multiclassDomain: null,
        domainsAllowed: doms,
      }),
    ).toBe(false);
    expect(
      isValidDomainTradeReplacement({
        oldAbility: oldA,
        newAbility: { id: 'd', level: 2, domain: 'Arcana' },
        characterLevel: 5,
        multiclassDomain: null,
        domainsAllowed: doms,
      }),
    ).toBe(false);
  });

  it('buildDomainTradeReplacementOptions: empty fromId returns []', () => {
    const srdData = { abilities: [], abilitiesById: {} };
    expect(
      buildDomainTradeReplacementOptions({
        fromId: null,
        srdData,
        domainsAllowed: ['Grace'],
        characterLevel: 5,
        multiclassDomain: null,
        ownedDomainAbilityIds: ['x'],
      }),
    ).toEqual([]);
  });

  it('buildDomainTradeReplacementOptions excludes other owned cards and valid replacements', () => {
    const a = { id: 'a', level: 3, domain: 'Grace' };
    const b = { id: 'b', level: 2, domain: 'Grace' };
    const c = { id: 'c', level: 4, domain: 'Grace' };
    const srdData = {
      abilities: [a, b, c],
      abilitiesById: { a, b, c },
    };
    const out = buildDomainTradeReplacementOptions({
      fromId: 'a',
      srdData,
      domainsAllowed: ['Grace'],
      characterLevel: 5,
      multiclassDomain: null,
      ownedDomainAbilityIds: ['a', 'z'],
    });
    expect(out.map((x) => x.id)).toEqual(['b']);
  });

  it('describeMulticlassSubclassUpgradeCrossout is per band column', () => {
    const adv = { 5: { picks: [{ type: 'multiclass' }, { type: 'hp' }] } };
    const d = describeMulticlassSubclassUpgradeCrossout(adv, 6, 'B');
    expect(d?.multiclassLevel).toBe(5);
    expect(d?.band).toBe('B');
    expect(describeMulticlassSubclassUpgradeCrossout(adv, 6, 'C')).toBeNull();
    expect(describeMulticlassSubclassUpgradeCrossout({}, 6, 'B')).toBeNull();
  });

  it('listOrderedBandSlotFills orders by level and pick index', () => {
    const adv = {
      2: { picks: [{ type: 'hp' }, { type: 'stress' }] },
      3: { picks: [{ type: 'traits', traits: ['agility', 'strength'] }, null] },
    };
    expect(listOrderedBandSlotFills(adv, 4, 'A', 'hp')).toEqual([{ level: 2, pickIndex: 0 }]);
    expect(listOrderedBandSlotFills(adv, 4, 'A', 'stress')).toEqual([{ level: 2, pickIndex: 1 }]);
  });

  it('tryAssignAdvancementPickAtFocusLevel fills double-slot proficiency', () => {
    const next = tryAssignAdvancementPickAtFocusLevel({}, 6, 5, 'proficiency');
    expect(next['5'].picks[0].type).toBe('proficiency');
    expect(next['5'].picks[1]).toBeNull();
    expect(tryAssignAdvancementPickAtFocusLevel(next, 6, 5, 'hp')).toBeNull();
  });

  it('tryClearBandSlotAtOrdinal compacts picks after clear', () => {
    const adv = {
      2: { picks: [{ type: 'hp' }, { type: 'stress' }] },
    };
    const cleared = tryClearBandSlotAtOrdinal(adv, 4, 'A', 'hp', 0);
    expect(cleared['2'].picks[0]?.type).toBe('stress');
    expect(cleared['2'].picks[1]).toBeNull();
  });

  it('buildBandSlotDisplayCells duplicates level for proficiency row', () => {
    const adv = {
      5: { picks: [{ type: 'proficiency' }, null] },
    };
    const cells = buildBandSlotDisplayCells(adv, 6, 'B', 'proficiency');
    expect(cells).toHaveLength(2);
    expect(cells[0].level).toBe(5);
    expect(cells[1].level).toBe(5);
  });

  it('buildBandSlotDisplayCells returns no placeholder cells when multiclass slot is crossed out by subclass upgrade', () => {
    const adv = {
      5: { picks: [{ type: 'subclass_upgrade' }, { type: 'hp' }] },
    };
    expect(buildBandSlotDisplayCells(adv, 7, 'B', 'multiclass')).toEqual([]);
  });

  it('pickTraitKeyWithScorePreference chooses sole highest trait score', () => {
    const traits = { agility: 3, strength: 0, finesse: 0, instinct: 0, presence: 0, knowledge: 0 };
    expect(
      pickTraitKeyWithScorePreference(
        ['agility', 'strength', 'finesse'],
        traits,
        () => 0,
      ),
    ).toBe('agility');
  });

  it('pickTraitKeyWithScorePreference uses tie-breaker to unique min when max ties', () => {
    const traits = { agility: 2, strength: 2, finesse: 0, instinct: 0, presence: 0, knowledge: 0 };
    expect(
      pickTraitKeyWithScorePreference(
        ['agility', 'strength', 'finesse'],
        traits,
        () => 0,
      ),
    ).toBe('finesse');
  });

  it('randomizeLevelAdvancementChoices chooses highest spell-level domain card', () => {
    const abilitiesById = {
      low: { id: 'low', name: 'Low', level: 1, domain: 'Arcana' },
      high: { id: 'high', name: 'High', level: 3, domain: 'Arcana' },
    };
    const formData = {
      level: 3,
      traits: { agility: 0, strength: 0, finesse: 0, instinct: 0, presence: 0, knowledge: 0 },
      experiences: [
        { id: 'e1', name: 'a', score: 2 },
        { id: 'e2', name: 'b', score: 2 },
      ],
      advancements: {},
      abilityIds: ['x1', 'x2'],
    };
    const out = randomizeLevelAdvancementChoices({
      formData,
      characterLevel: 3,
      srdData: { abilitiesById },
      abilityOptionsForRow: [abilitiesById.low, abilitiesById.high],
      occupiedDomainCardIds: new Set(['x1', 'x2']),
      getTradeReplacementOptions: () => [],
      tradeFromIds: [],
      rng: () => 0.6,
    });
    expect(out.advancements['3'].domainCardId).toBe('high');
  });

  it('randomizeLevelAdvancementChoices names tier-entry experience at level 2', () => {
    const experiences = [
      { id: 'e0', name: 'A', score: 2 },
      { id: 'e1', name: 'B', score: 2 },
      { id: 'e2', name: '', score: 2, tierEntryAuto: true },
    ];
    const formData = {
      level: 2,
      traits: {},
      experiences,
      advancements: {},
    };
    const out = randomizeLevelAdvancementChoices({
      formData,
      characterLevel: 2,
      srdData: { abilitiesById: {} },
      abilityOptionsForRow: [],
      occupiedDomainCardIds: new Set(),
      getTradeReplacementOptions: () => [],
      tradeFromIds: [],
      rng: () => 0.6,
    });
    expect(out.experiences?.[2]?.name).toBe('Experience 3 - choose during play');
    expect(out.experiences?.[2]?.tierEntryAuto).toBeUndefined();
  });
});
