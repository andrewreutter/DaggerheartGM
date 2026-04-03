import { describe, it, expect } from 'vitest';
import {
  computeProficiency,
  scaleWeaponDamageByProficiency,
  collectOwnedDomainAbilityIds,
  collectOwnedDomainAbilityIdsThroughCharacterLevel,
  resolveDomainTradesThroughLevel,
  collectAbilityIds,
  collectVaultAbilityIds,
  recomputeCharacter,
  deriveSubclassUnlockSteps,
  replaceDomainAbilityIdEverywhere,
  isCharacterComplete,
  shouldShowCharacterEditorLevelUp,
  resolveSpellcastTraitFromTraitScores,
  migrateCharacterLevelingData,
  projectCharacterFormToLevel,
} from '../../src/client/lib/character-calc.js';
import { deriveSubclassUnlockSteps as deriveStepsAr } from '../../src/client/lib/advancement-rules.js';

describe('replaceDomainAbilityIdEverywhere', () => {
  it('replaces in abilityIds, advancements, and domainLoadoutIds', () => {
    const data = {
      level: 3,
      abilityIds: ['old1', 'x'],
      domainLoadoutIds: ['old1'],
      advancements: {
        2: {
          domainCardId: 'old1',
          picks: [{ type: 'domain_card', abilityId: 'y' }],
        },
        3: { picks: [{ type: 'domain_card', abilityId: 'old1' }] },
      },
    };
    const next = replaceDomainAbilityIdEverywhere(data, 'old1', 'new1');
    expect(next.abilityIds).toEqual(['new1', 'x']);
    expect(next.domainLoadoutIds).toEqual(['new1']);
    expect(next.advancements['2'].domainCardId).toBe('new1');
    expect(next.advancements['3'].picks[0].abilityId).toBe('new1');
    expect(next.advancements['2'].picks[0].abilityId).toBe('y');
  });
});
import { normalizeDomainLoadoutIds, expectedExperienceRowCount } from '../../src/client/lib/advancement-rules.js';

describe('projectCharacterFormToLevel', () => {
  it('returns clone unchanged when target >= saved level', () => {
    const data = { level: 4, advancements: { 2: { picks: [{ type: 'hp' }] } } };
    const out = projectCharacterFormToLevel(data, 4);
    expect(out.level).toBe(4);
    expect(out.advancements['2']).toBeTruthy();
  });

  it('does not throw when data carries non-JSON fields (e.g. merged table + function)', () => {
    const data = {
      level: 3,
      advancements: { 2: { picks: [{ type: 'hp' }] } },
      onSomething: () => {},
    };
    expect(() => projectCharacterFormToLevel(data, 2)).not.toThrow();
    const out = projectCharacterFormToLevel(data, 2);
    expect(out.level).toBe(2);
  });

  it('strips advancement rows above target and clears multiclass when pick is later', () => {
    const data = {
      level: 7,
      classId: 'c1',
      subclassId: 's1',
      baseTraits: { agility: 2, strength: 1, finesse: 1, instinct: 0, presence: 0, knowledge: -1 },
      abilityIds: ['a1'],
      domainSlotAcquiredLevel: [1],
      advancements: {
        2: { picks: [{ type: 'hp' }] },
        6: { picks: [{ type: 'multiclass' }] },
      },
      multiclassClassId: 'c2',
      multiclassSubclassId: 's2',
      multiclassDomain: 'Arcana',
    };
    const out = projectCharacterFormToLevel(data, 3);
    expect(out.level).toBe(3);
    expect(out.advancements['6']).toBeUndefined();
    expect(out.multiclassClassId).toBeNull();
    expect(out.multiclassSubclassId).toBeNull();
    expect(out.multiclassDomain).toBeNull();
  });
});

describe('character-calc leveling', () => {
  it('computeProficiency includes automatic tier-entry bonuses', () => {
    expect(computeProficiency({}, 1)).toBe(1);
    expect(computeProficiency({}, 2)).toBe(2);
    expect(computeProficiency({}, 5)).toBe(3);
    expect(computeProficiency({}, 8)).toBe(4);
    expect(
      computeProficiency(
        { 3: { picks: [{ type: 'proficiency' }] } },
        5,
      ),
    ).toBe(4);
  });

  it('scaleWeaponDamageByProficiency replaces die count', () => {
    expect(scaleWeaponDamageByProficiency('d8', 3)).toBe('3d8');
    expect(scaleWeaponDamageByProficiency('2d6+1', 4)).toBe('4d6+1');
    expect(scaleWeaponDamageByProficiency('d10 phy', 2)).toBe('2d10 phy');
  });

  it('collectOwnedDomainAbilityIds and loadout cap', () => {
    const data = {
      level: 5,
      abilityIds: ['a', 'b', 'c', 'd', 'e', 'f'],
      advancements: {},
    };
    expect(collectOwnedDomainAbilityIds(data).length).toBe(6);
    expect(normalizeDomainLoadoutIds(collectOwnedDomainAbilityIds(data), ['a', 'b', 'c', 'd', 'e']).length).toBe(5);
    expect(
      collectAbilityIds({ ...data, domainLoadoutIds: ['a', 'b', 'c', 'd', 'e'] }),
    ).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(
      collectVaultAbilityIds({ ...data, domainLoadoutIds: ['a', 'b', 'c', 'd', 'e'] }),
    ).toEqual(['f']);
    expect(collectVaultAbilityIds({ ...data, abilityIds: ['a', 'b', 'c', 'd'] })).toEqual([]);
  });

  it('collectOwnedDomainAbilityIdsThroughCharacterLevel: only slots and rows through cap', () => {
    const data = {
      level: 5,
      abilityIds: ['a', 'b', 'late'],
      domainSlotAcquiredLevel: [1, 1, 5],
      advancements: {
        2: { domainCardId: 'c', picks: [] },
        3: { domainCardId: 'd', picks: [] },
        4: { domainCardId: 'e', picks: [{ type: 'domain_card', abilityId: 'pick4' }] },
        5: { domainCardId: 'f', picks: [] },
      },
    };
    expect(collectOwnedDomainAbilityIdsThroughCharacterLevel(data, 4).sort()).toEqual(
      ['a', 'b', 'c', 'd', 'e', 'pick4'].sort(),
    );
    expect(collectOwnedDomainAbilityIdsThroughCharacterLevel(data, 3).sort()).toEqual(['a', 'b', 'c', 'd'].sort());
    expect(collectOwnedDomainAbilityIdsThroughCharacterLevel(data, 1).sort()).toEqual(['a', 'b'].sort());
  });

  it('collectOwnedDomainAbilityIdsThroughCharacterLevel uses IDs after stored domainTrade', () => {
    const data = {
      level: 3,
      abilityIds: ['old', 'b'],
      domainSlotAcquiredLevel: [1, 1],
      advancements: {
        2: { domainTrade: { fromId: 'old', toId: 'new' }, picks: [] },
      },
    };
    expect(collectOwnedDomainAbilityIdsThroughCharacterLevel(data, 2).sort()).toEqual(['new', 'b'].sort());
  });

  it('resolveDomainTradesThroughLevel chains per-level trades on raw ids', () => {
    const raw = {
      level: 4,
      abilityIds: ['a', 'b'],
      advancements: {
        2: { domainTrade: { fromId: 'a', toId: 'x' }, picks: [] },
        3: { domainTrade: { fromId: 'x', toId: 'y' }, picks: [] },
      },
    };
    const r = resolveDomainTradesThroughLevel(raw, 3);
    expect(r.abilityIds).toEqual(['y', 'b']);
    expect(raw.abilityIds).toEqual(['a', 'b']);
  });
});

describe('recomputeCharacter subclass unlock integration', () => {
  const minimalSrd = {
    classesById: {
      'srd-cls-test': {
        name: 'TestClass',
        domains: ['D'],
        class_features: [],
        subclasses: ['Sub'],
      },
      'srd-cls-b': {
        name: 'Other',
        domains: ['X'],
        class_features: [{ name: 'ExtraClass', description: '' }],
        subclasses: [],
      },
    },
    subclassesById: {
      'srd-sub-test': {
        name: 'Sub',
        spellcast_trait: '',
        foundation_features: [{ name: 'F', description: '' }],
        specialization_features: [{ name: 'S', description: '' }],
        mastery_features: [{ name: 'M', description: '' }],
      },
    },
    ancestriesById: {},
    communitiesById: {},
    armorById: {},
    weaponsById: {},
    abilitiesById: {},
    beastformsById: {},
  };

  it('uses advancement subclass_upgrade picks when present', () => {
    const data = {
      name: 'X',
      level: 7,
      classId: 'srd-cls-test',
      subclassId: 'srd-sub-test',
      ancestryIds: [],
      communityId: null,
      baseTraits: { agility: 2, strength: 1, finesse: 1, instinct: 0, presence: 0, knowledge: -1 },
      advancements: {
        5: { picks: [{ type: 'subclass_upgrade' }] },
      },
      abilityIds: ['x1', 'x2'],
      experiences: [
        { id: 'e1', name: 'a', score: 2 },
        { id: 'e2', name: 'b', score: 2 },
      ],
    };
    const r = recomputeCharacter(data, minimalSrd);
    const names = (r.subclassFeatures || []).map((f) => f.name);
    expect(names).toContain('F');
    expect(names).toContain('S');
    expect(names).not.toContain('M');
  });

  it('activeFeatures attach multiclass SRD class/subclass as source for multiclass rows', () => {
    const srd = {
      ...minimalSrd,
      subclassesById: {
        ...minimalSrd.subclassesById,
        'srd-sub-mc': {
          name: 'McSub',
          spellcast_trait: '',
          foundation_features: [{ name: 'McF', description: '' }],
          specialization_features: [],
          mastery_features: [],
        },
      },
    };
    const data = {
      name: 'X',
      level: 5,
      classId: 'srd-cls-test',
      subclassId: 'srd-sub-test',
      multiclassClassId: 'srd-cls-b',
      multiclassSubclassId: 'srd-sub-mc',
      ancestryIds: [],
      communityId: null,
      baseTraits: { agility: 2, strength: 1, finesse: 1, instinct: 0, presence: 0, knowledge: -1 },
      advancements: {},
      abilityIds: ['x1', 'x2'],
      experiences: [
        { id: 'e1', name: 'a', score: 2 },
        { id: 'e2', name: 'b', score: 2 },
      ],
    };
    const r = recomputeCharacter(data, srd);
    const mcClassFeat = r.activeFeatures.find((f) => f.name === 'ExtraClass' && f.type === 'class');
    expect(mcClassFeat?.source?.name).toBe('Other');
    expect(mcClassFeat?._multiclass).toBe(true);
    const mcSubFeat = r.activeFeatures.find((f) => f.name === 'McF' && f.type === 'subclass');
    expect(mcSubFeat?.source?.name).toBe('McSub');
    expect(mcSubFeat?._multiclassSubclass).toBe(true);
    const primarySubFeat = r.activeFeatures.find((f) => f.name === 'F' && f.type === 'subclass');
    expect(primarySubFeat?.source?.name).toBe('Sub');
    expect(primarySubFeat?._multiclassSubclass).toBeFalsy();
  });

  it('multiclass caps subclass unlock at specialization', () => {
    const data = {
      name: 'X',
      level: 10,
      classId: 'srd-cls-test',
      subclassId: 'srd-sub-test',
      multiclassClassId: 'srd-cls-b',
      ancestryIds: [],
      communityId: null,
      baseTraits: { agility: 2, strength: 1, finesse: 1, instinct: 0, presence: 0, knowledge: -1 },
      advancements: {
        2: { picks: [{ type: 'subclass_upgrade' }, { type: 'subclass_upgrade' }] },
      },
      abilityIds: ['x1', 'x2'],
      experiences: [
        { id: 'e1', name: 'a', score: 2 },
        { id: 'e2', name: 'b', score: 2 },
      ],
    };
    const r = recomputeCharacter(data, minimalSrd);
    const names = (r.subclassFeatures || []).map((f) => f.name);
    expect(names).toContain('F');
    expect(names).toContain('S');
    expect(names).not.toContain('M');
  });

  it('spellcast trait falls through to multiclass when primary subclass has none', () => {
    const srd = {
      ...minimalSrd,
      subclassesById: {
        'srd-sub-test': {
          name: 'Sub',
          spellcast_trait: '',
          foundation_features: [{ name: 'F', description: '' }],
          specialization_features: [],
          mastery_features: [],
        },
        'srd-sub-mc': {
          name: 'McSub',
          spellcast_trait: 'Instinct',
          foundation_features: [{ name: 'MF', description: '' }],
          specialization_features: [],
          mastery_features: [],
        },
      },
    };
    const data = {
      name: 'X',
      level: 5,
      classId: 'srd-cls-test',
      subclassId: 'srd-sub-test',
      multiclassClassId: 'srd-cls-b',
      multiclassSubclassId: 'srd-sub-mc',
      ancestryIds: [],
      communityId: null,
      baseTraits: { agility: 2, strength: 1, finesse: 1, instinct: 0, presence: 0, knowledge: -1 },
      advancements: {},
      abilityIds: ['x1', 'x2'],
      experiences: [
        { id: 'e1', name: 'a', score: 2 },
        { id: 'e2', name: 'b', score: 2 },
      ],
    };
    const r = recomputeCharacter(data, srd);
    expect(r.spellcastTrait).toBe('instinct');
  });

  it('spellcast uses higher effective trait when both subclasses define spellcast', () => {
    const srd = {
      ...minimalSrd,
      subclassesById: {
        'srd-sub-test': {
          name: 'Sub',
          spellcast_trait: 'Presence',
          foundation_features: [{ name: 'F', description: '' }],
          specialization_features: [],
          mastery_features: [],
        },
        'srd-sub-mc': {
          name: 'McSub',
          spellcast_trait: 'Instinct',
          foundation_features: [{ name: 'MF', description: '' }],
          specialization_features: [],
          mastery_features: [],
        },
      },
    };
    const dataHighInstinct = {
      name: 'X',
      level: 5,
      classId: 'srd-cls-test',
      subclassId: 'srd-sub-test',
      multiclassClassId: 'srd-cls-b',
      multiclassSubclassId: 'srd-sub-mc',
      ancestryIds: [],
      communityId: null,
      baseTraits: { agility: 2, strength: 1, finesse: 1, instinct: 4, presence: 2, knowledge: -1 },
      advancements: {},
      abilityIds: ['x1', 'x2'],
      experiences: [
        { id: 'e1', name: 'a', score: 2 },
        { id: 'e2', name: 'b', score: 2 },
      ],
    };
    expect(recomputeCharacter(dataHighInstinct, srd).spellcastTrait).toBe('instinct');
    const dataHighPresence = { ...dataHighInstinct, baseTraits: { ...dataHighInstinct.baseTraits, instinct: 1, presence: 5 } };
    expect(recomputeCharacter(dataHighPresence, srd).spellcastTrait).toBe('presence');
  });
});

describe('resolveSpellcastTraitFromTraitScores', () => {
  it('compares effective scores including weapon modifiers', () => {
    expect(
      resolveSpellcastTraitFromTraitScores({
        primaryTraitName: 'Presence',
        multiclassTraitName: 'Instinct',
        traits: { presence: 2, instinct: 2 },
        weaponMods: { traits: { presence: 2, instinct: 0 } },
        armorMods: { traits: {} },
        activeBeastform: null,
      }),
    ).toBe('presence');
  });
});

describe('migrateCharacterLevelingData', () => {
  it('strips subclass_upgrade and proficiency from Tier 2 level rows', () => {
    const out = migrateCharacterLevelingData({
      level: 4,
      advancements: {
        2: { picks: [{ type: 'proficiency' }, null] },
        3: { picks: [{ type: 'subclass_upgrade' }] },
        5: { picks: [{ type: 'hp' }] },
      },
    });
    expect(out.advancements['2'].picks[0]).toBeNull();
    expect(out.advancements['3'].picks[0]).toBeNull();
    expect(out.advancements['5'].picks[0].type).toBe('hp');
  });
});

describe('deriveSubclassUnlockSteps export parity', () => {
  it('character-calc re-exports advancement-rules steps', () => {
    expect(deriveSubclassUnlockSteps).toBe(deriveStepsAr);
  });
});

describe('recomputeCharacter experience padding', () => {
  const minimalSrd = {
    classesById: {
      'srd-cls-test': {
        name: 'TestClass',
        domains: ['D'],
        class_features: [],
        subclasses: ['Sub'],
      },
    },
    subclassesById: {
      'srd-sub-test': {
        name: 'Sub',
        spellcast_trait: '',
        foundation_features: [],
        specialization_features: [],
        mastery_features: [],
      },
    },
    ancestriesById: {},
    communitiesById: {},
    armorById: {},
    weaponsById: {},
    abilitiesById: {},
    beastformsById: {},
  };

  it('pads experiences to expected count without truncating', () => {
    const data = {
      name: 'X',
      level: 5,
      classId: 'srd-cls-test',
      subclassId: 'srd-sub-test',
      ancestryIds: [],
      communityId: null,
      baseTraits: { agility: 2, strength: 1, finesse: 1, instinct: 0, presence: 0, knowledge: -1 },
      advancements: {},
      abilityIds: ['a', 'b'],
      experiences: [
        { id: 'e1', name: 'one', score: 2 },
        { id: 'e2', name: 'two', score: 2 },
      ],
    };
    const r = recomputeCharacter(data, minimalSrd);
    expect(r.experiences.length).toBe(expectedExperienceRowCount(5));
    const r2 = recomputeCharacter(r, minimalSrd);
    expect(r2.experiences.length).toBe(r.experiences.length);
  });

  it('does not stack level-up experience +1 modifiers on repeated recompute', () => {
    const data = {
      name: 'X',
      level: 2,
      classId: 'srd-cls-test',
      subclassId: 'srd-sub-test',
      ancestryIds: [],
      communityId: null,
      baseTraits: { agility: 2, strength: 1, finesse: 1, instinct: 0, presence: 0, knowledge: -1 },
      advancements: {
        2: {
          domainCardId: 'd1',
          picks: [
            { type: 'experience', experienceIds: ['e1', 'e2'] },
            { type: 'hp' },
          ],
        },
      },
      abilityIds: ['a', 'b'],
      experiences: [
        { id: 'e1', name: 'one', score: 2 },
        { id: 'e2', name: 'two', score: 2 },
      ],
    };
    const r1 = recomputeCharacter(data, minimalSrd);
    const s1a = r1.experiences.find((e) => e.id === 'e1')?.score;
    const r2 = recomputeCharacter({ ...data, experiences: r1.experiences }, minimalSrd);
    const s2a = r2.experiences.find((e) => e.id === 'e1')?.score;
    expect(s1a).toBe(3);
    expect(s2a).toBe(3);
  });
});

describe('isCharacterComplete experience rows', () => {
  it('requires expected named experiences by level', () => {
    const base = {
      name: 'N',
      classId: 'c',
      subclassId: 's',
      ancestryIds: ['a'],
      communityId: 'co',
      abilityIds: ['x', 'y'],
      experiences: [
        { id: '1', name: 'a', score: 2 },
        { id: '2', name: 'b', score: 2 },
      ],
    };
    expect(isCharacterComplete({ ...base, level: 1 }).complete).toBe(true);
    expect(isCharacterComplete({ ...base, level: 2 }).complete).toBe(false);
    expect(
      isCharacterComplete({
        ...base,
        level: 2,
        experiences: [
          { id: '1', name: 'a', score: 2 },
          { id: '2', name: 'b', score: 2 },
          { id: '3', name: 'c', score: 2 },
        ],
        advancements: {
          2: { domainCardId: 'dom-x', picks: [{ type: 'hp' }, { type: 'stress' }] },
        },
      }).complete,
    ).toBe(true);
  });

  it('requires five distinct loadout slots when more than five domain cards are known', () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f'];
    const base = {
      name: 'N',
      classId: 'c',
      subclassId: 's',
      ancestryIds: ['a'],
      communityId: 'co',
      abilityIds: ids,
      experiences: [
        { id: '1', name: 'a', score: 2 },
        { id: '2', name: 'b', score: 2 },
      ],
    };
    expect(isCharacterComplete({ ...base, level: 1, domainLoadoutIds: [] }).complete).toBe(false);
    expect(
      isCharacterComplete({
        ...base,
        level: 1,
        domainLoadoutIds: ['a', 'b', 'c', 'd', 'e'],
      }).complete,
    ).toBe(true);
  });
});

describe('isCharacterComplete level-up row (advancements + per-level domain card)', () => {
  const base = {
    name: 'N',
    classId: 'c',
    subclassId: 's',
    ancestryIds: ['a'],
    communityId: 'co',
    abilityIds: ['x', 'y'],
    experiences: [
      { id: '1', name: 'a', score: 2 },
      { id: '2', name: 'b', score: 2 },
      { id: '3', name: 'c', score: 2 },
    ],
  };

  it('is incomplete when level 2+ has no advancement row filled', () => {
    const r = isCharacterComplete({ ...base, level: 2, advancements: {} });
    expect(r.complete).toBe(false);
    expect(r.missing.some((m) => m.includes('Level 2'))).toBe(true);
  });

  it('is complete when each level row has two picks and domainCardId', () => {
    expect(
      isCharacterComplete({
        ...base,
        level: 3,
        advancements: {
          2: { domainCardId: 'd1', picks: [{ type: 'hp' }, { type: 'stress' }] },
          3: { domainCardId: 'd2', picks: [{ type: 'evasion' }, { type: 'hp' }] },
        },
      }).complete,
    ).toBe(true);
  });

  it('accepts proficiency as a single pick using both slots', () => {
    expect(
      isCharacterComplete({
        ...base,
        level: 2,
        advancements: {
          2: { domainCardId: 'd1', picks: [{ type: 'proficiency' }, null] },
        },
      }).complete,
    ).toBe(true);
  });
});

describe('isCharacterComplete advancement lock', () => {
  const base = {
    name: 'N',
    classId: 'c',
    subclassId: 's',
    ancestryIds: ['a'],
    communityId: 'co',
    abilityIds: ['x', 'y'],
    experiences: [
      { id: '1', name: 'a', score: 2 },
      { id: '2', name: 'b', score: 2 },
      { id: '3', name: 'c', score: 2 },
    ],
    advancementChoicesLockedThroughLevel: 1,
  };

  it('requires Lock Level Choices when the lock field is present and below current level', () => {
    const r = isCharacterComplete({
      ...base,
      level: 2,
      advancements: {
        2: { domainCardId: 'd1', picks: [{ type: 'hp' }, { type: 'stress' }] },
      },
    });
    expect(r.complete).toBe(false);
    expect(r.missing.some((m) => m.includes('Lock level choices'))).toBe(true);
  });

  it('is complete when lockedThrough is at least current level', () => {
    expect(
      isCharacterComplete({
        ...base,
        level: 2,
        advancementChoicesLockedThroughLevel: 2,
        advancements: {
          2: { domainCardId: 'd1', picks: [{ type: 'hp' }, { type: 'stress' }] },
        },
      }).complete,
    ).toBe(true);
  });
});

describe('shouldShowCharacterEditorLevelUp', () => {
  it('hides when the character is incomplete', () => {
    expect(shouldShowCharacterEditorLevelUp({ level: 1, name: 'Only' }, undefined)).toBe(false);
  });

  it('hides at level 10 even when complete', () => {
    const base = {
      name: 'N',
      classId: 'c',
      subclassId: 's',
      ancestryIds: ['a'],
      communityId: 'co',
      abilityIds: ['x', 'y'],
      experiences: [
        { id: '1', name: 'a', score: 2 },
        { id: '2', name: 'b', score: 2 },
      ],
      level: 10,
    };
    expect(shouldShowCharacterEditorLevelUp(base, undefined)).toBe(false);
  });

  it('shows when complete and level is under 10', () => {
    const base = {
      name: 'N',
      classId: 'c',
      subclassId: 's',
      ancestryIds: ['a'],
      communityId: 'co',
      abilityIds: ['x', 'y'],
      experiences: [
        { id: '1', name: 'a', score: 2 },
        { id: '2', name: 'b', score: 2 },
      ],
      level: 1,
    };
    expect(shouldShowCharacterEditorLevelUp(base, undefined)).toBe(true);
  });
});
