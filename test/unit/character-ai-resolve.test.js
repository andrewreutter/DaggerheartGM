import { describe, it, expect } from 'vitest';
import {
  resolveCharacterAiDraft,
  normalizeLookupKey,
  buildLookupMaps,
  resolveToId,
  parseSuggestedTraits,
  isValidTraitAssignment,
  validateCharacterAiDraftStrict,
} from '../../src/character-ai-resolve.js';

function miniSrd() {
  const classes = [
    {
      id: 'srd-cls-bard',
      name: 'Bard',
      domains: ['Grace', 'Codex'],
      subclasses: ['Wordsmith'],
      suggested_traits: '0, -1, +1, 0, +2, +1',
      class_features: [
        { name: 'Rally', description: 'Rally text' },
        { name: 'Hold Them Off', description: 'HTO text' },
      ],
    },
    {
      id: 'srd-cls-fighter',
      name: 'Fighter',
      domains: ['Valor', 'Blade'],
      subclasses: ['Warrior'],
      suggested_traits: '0, -1, +1, 0, +2, +1',
    },
  ];
  const subclasses = [
    { id: 'srd-sub-wordsmith', name: 'Wordsmith' },
    { id: 'srd-sub-troubadour', name: 'Troubadour' },
    { id: 'srd-sub-warrior', name: 'Warrior' },
  ];
  const ancestries = [{ id: 'srd-anc-faun', name: 'Faun' }];
  const communities = [{ id: 'srd-com-highborne', name: 'Highborne' }];
  const armor = [{ id: 'srd-armor-leather', name: 'Leather Armor', tier: 1 }];
  const weapons = [
    { id: 'srd-wpn-rapier', name: 'Rapier', tier: 1, burden: 'One-Handed', primary_or_secondary: 'Primary' },
    { id: 'srd-wpn-longbow', name: 'Longbow', tier: 1, burden: 'Two-Handed', primary_or_secondary: 'Primary' },
    { id: 'srd-wpn-dagger', name: 'Dagger', tier: 1, burden: 'One-Handed', primary_or_secondary: 'Secondary' },
  ];
  const abilities = [
    { id: 'srd-abl-1', name: 'Healing Touch', domain: 'Grace', level: 1 },
    { id: 'srd-abl-2', name: 'Scan', domain: 'Codex', level: 1 },
    { id: 'srd-abl-3', name: 'Wrong Domain', domain: 'Arcana', level: 1 },
    { id: 'srd-abl-4', name: 'Too High', domain: 'Grace', level: 2 },
    { id: 'srd-abl-5', name: 'Bigger Heal', domain: 'Grace', level: 3 },
    { id: 'srd-abl-valor', name: 'Forceful Push', domain: 'Valor', level: 1 },
  ];
  const buildById = (arr) => Object.fromEntries(arr.map((x) => [x.id, x]));
  return {
    classes,
    subclasses,
    ancestries,
    communities,
    armor,
    weapons,
    abilities,
    classesById: buildById(classes),
    subclassesById: buildById(subclasses),
    ancestriesById: buildById(ancestries),
    communitiesById: buildById(communities),
    armorById: buildById(armor),
    weaponsById: buildById(weapons),
    abilitiesById: buildById(abilities),
  };
}

describe('character-ai-resolve', () => {
  it('normalizes lookup keys', () => {
    expect(normalizeLookupKey('  The   Bard  ')).toBe('the bard');
  });

  it('resolves fuzzy names to ids', () => {
    const maps = buildLookupMaps([{ id: 'x', name: 'Bard' }]);
    const w = [];
    expect(resolveToId('bard', maps, { warn: (m) => w.push(m), kind: 'class' })).toBe('x');
    expect(w).toHaveLength(0);
  });

  it('warns on unknown srd- id', () => {
    const maps = buildLookupMaps([{ id: 'srd-cls-bard', name: 'Bard' }]);
    const w = [];
    expect(resolveToId('srd-cls-wizard', maps, { warn: (m) => w.push(m), kind: 'class' })).toBe(null);
    expect(w.some((x) => x.includes('Unknown'))).toBe(true);
  });

  it('resolves subclass name when valid for class', () => {
    const srd = miniSrd();
    const { patch, warnings } = resolveCharacterAiDraft(
      {
        classId: 'Bard',
        subclassId: 'Wordsmith',
      },
      srd,
    );
    expect(patch.classId).toBe('srd-cls-bard');
    expect(patch.subclassId).toBe('srd-sub-wordsmith');
    expect(warnings.some((w) => w.includes('not valid'))).toBe(false);
  });

  it('clears mismatched subclass for class', () => {
    const srd = miniSrd();
    const { patch, warnings } = resolveCharacterAiDraft(
      {
        classId: 'srd-cls-bard',
        subclassId: 'srd-sub-troubadour',
      },
      srd,
    );
    expect(patch.subclassId).toBeNull();
    expect(warnings.some((w) => w.includes('not valid'))).toBe(true);
  });

  it('falls back to suggested traits when invalid', () => {
    const srd = miniSrd();
    const { patch, warnings } = resolveCharacterAiDraft(
      {
        classId: 'Bard',
        baseTraits: { agility: 3, strength: 0, finesse: 0, instinct: 0, presence: 0, knowledge: 0 },
      },
      srd,
    );
    expect(isValidTraitAssignment(patch.baseTraits)).toBe(true);
    expect(warnings.some((w) => w.includes('suggested spread'))).toBe(true);
  });

  it('warns when a domain card belongs to a different domain than the class', () => {
    const srd = miniSrd();
    const { patch, warnings } = resolveCharacterAiDraft(
      {
        classId: 'srd-cls-bard',
        abilityIds: ['Forceful Push', 'Scan'],
      },
      srd,
    );
    expect(patch.abilityIds[0]).toBeNull();
    expect(patch.abilityIds[1]).toBe('srd-abl-2');
    expect(warnings.some((w) => w.includes('Valor') && w.includes('level1DomainCards'))).toBe(true);
  });

  it('rejects duplicate domain cards', () => {
    const srd = miniSrd();
    const { patch, warnings } = resolveCharacterAiDraft(
      {
        classId: 'srd-cls-bard',
        abilityIds: ['Healing Touch', 'healing touch'],
      },
      srd,
    );
    expect(patch.abilityIds[0]).toBe('srd-abl-1');
    expect(patch.abilityIds[1]).toBeNull();
    expect(warnings.some((w) => w.includes('Duplicate'))).toBe(true);
  });

  it('clears secondary when primary is two-handed', () => {
    const srd = miniSrd();
    const { patch, warnings } = resolveCharacterAiDraft(
      {
        classId: 'srd-cls-bard',
        primaryWeaponId: 'Longbow',
        secondaryWeaponId: 'Dagger',
      },
      srd,
    );
    expect(patch.primaryWeaponId).toBe('srd-wpn-longbow');
    expect(patch.secondaryWeaponId).toBeNull();
    expect(warnings.some((w) => w.includes('two-handed'))).toBe(true);
  });

  it('maps experience bonus choice by experience name', () => {
    const srd = miniSrd();
    const expId = 'exp-a';
    const { patch } = resolveCharacterAiDraft(
      {
        classId: 'srd-cls-bard',
        experiences: [{ id: expId, name: 'Stealth', score: 2 }],
        experienceBonusChoices: { 'Purposeful Design': 'stealth' },
      },
      srd,
    );
    expect(patch.experienceBonusChoices['Purposeful Design']).toBe(expId);
  });

  it('parseSuggestedTraits matches CharacterForm pool', () => {
    const t = parseSuggestedTraits('0, -1, +1, 0, +2, +1');
    expect(isValidTraitAssignment(t)).toBe(true);
  });

  it('merges sheetDisplayNames for weapons and abilities when keys match resolved ids', () => {
    const srd = miniSrd();
    const { patch, warnings } = resolveCharacterAiDraft(
      {
        classId: 'srd-cls-bard',
        subclassId: 'Wordsmith',
        primaryWeaponId: 'srd-wpn-rapier',
        secondaryWeaponId: 'srd-wpn-dagger',
        abilityIds: ['srd-abl-1', 'srd-abl-2'],
        sheetDisplayNames: {
          weapons: {
            'slot-primary:srd-wpn-rapier': 'Needle',
            'orphan-key': 'Bad',
          },
          abilities: {
            'ability-srd-abl-1': 'Bandage',
            'ability-srd-abl-999': 'Nope',
          },
        },
      },
      srd,
    );
    expect(patch.sheetDisplayNames?.weapons?.['slot-primary:srd-wpn-rapier']).toBe('Needle');
    expect(patch.sheetDisplayNames?.weapons?.orphan).toBeUndefined();
    expect(patch.sheetDisplayNames?.abilities?.['ability-srd-abl-1']).toBe('Bandage');
    expect(warnings.some((w) => w.includes('orphan-key'))).toBe(true);
    expect(warnings.some((w) => w.includes('srd-abl-999'))).toBe(true);
  });

  it('merges sheetDisplayNames.features for squashed keys and rejects unknown keys', () => {
    const srd = miniSrd();
    const { patch, warnings } = resolveCharacterAiDraft(
      {
        classId: 'srd-cls-bard',
        subclassId: 'Wordsmith',
        abilityIds: ['srd-abl-1', 'srd-abl-2'],
        sheetDisplayNames: {
          features: {
            feat__bard__rally: 'Song of Courage',
            'made-up-key': 'Nope',
          },
        },
      },
      srd,
    );
    expect(patch.sheetDisplayNames?.features?.feat__bard__rally).toBe('Song of Courage');
    expect(patch.sheetDisplayNames?.features?.['made-up-key']).toBeUndefined();
    expect(warnings.some((w) => w.includes('made-up-key'))).toBe(true);
  });

  it('normalizes hyphenated sheetDisplayNames.features keys to underscore slugs', () => {
    const srd = miniSrd();
    const { patch, warnings } = resolveCharacterAiDraft(
      {
        classId: 'srd-cls-bard',
        subclassId: 'Wordsmith',
        abilityIds: ['srd-abl-1', 'srd-abl-2'],
        sheetDisplayNames: {
          features: {
            'feat__bard__hold-them-off': 'Pinned',
          },
        },
      },
      srd,
    );
    expect(patch.sheetDisplayNames?.features?.feat__bard__hold_them_off).toBe('Pinned');
    expect(warnings.filter((w) => w.includes('sheetDisplayNames.features')).length).toBe(0);
  });

  it('warns when domain ability id is used in experience advancement pick', () => {
    const srd = miniSrd();
    const { warnings } = resolveCharacterAiDraft(
      {
        classId: 'srd-cls-bard',
        subclassId: 'Wordsmith',
        level: 2,
        abilityIds: ['srd-abl-1', 'srd-abl-2'],
        experiences: [
          { id: 'e1', name: 'A', score: 2 },
          { id: 'e2', name: 'B', score: 2 },
          { id: 'e3', name: 'C', score: 2 },
        ],
        advancements: {
          '2': {
            domainCardId: 'srd-abl-4',
            picks: [{ type: 'experience', experienceIds: ['srd-abl-1', 'e1'] }, { type: 'hp' }],
          },
        },
      },
      srd,
    );
    expect(warnings.some((w) => w.includes('looks like a domain ability id') && w.includes('experience pick (first id)'))).toBe(
      true,
    );
  });

  it('warns when domain ability id is used in experienceBonusChoices', () => {
    const srd = miniSrd();
    const { warnings } = resolveCharacterAiDraft(
      {
        classId: 'srd-cls-bard',
        experiences: [{ id: 'exp-a', name: 'Stealth', score: 2 }],
        experienceBonusChoices: { 'Purposeful Design': 'srd-abl-1' },
      },
      srd,
    );
    expect(
      warnings.some((w) => w.includes('looks like a domain ability id') && w.includes('experienceBonusChoices')),
    ).toBe(true);
  });

  it('resolves multiclass class, subclass, and two-domain pick', () => {
    const srd = miniSrd();
    const { patch } = resolveCharacterAiDraft(
      {
        classId: 'Bard',
        subclassId: 'Wordsmith',
        multiclassClassId: 'Fighter',
        multiclassSubclassId: 'Warrior',
        multiclassDomain: 'Valor',
      },
      srd,
    );
    expect(patch.multiclassClassId).toBe('srd-cls-fighter');
    expect(patch.multiclassSubclassId).toBe('srd-sub-warrior');
    expect(patch.multiclassDomain).toBe('Valor');
  });

  it('clears illegal per-level domainCardId (wrong domain)', () => {
    const srd = miniSrd();
    const { patch, warnings } = resolveCharacterAiDraft(
      {
        classId: 'srd-cls-bard',
        subclassId: 'Wordsmith',
        level: 2,
        abilityIds: ['srd-abl-1', 'srd-abl-2'],
        experiences: [
          { id: 'e1', name: 'A', score: 2 },
          { id: 'e2', name: 'B', score: 2 },
          { id: 'e3', name: 'C', score: 2 },
        ],
        advancements: {
          '2': {
            domainCardId: 'srd-abl-3',
            picks: [{ type: 'hp' }, { type: 'stress' }],
          },
        },
      },
      srd,
    );
    expect(patch.advancements['2'].domainCardId).toBeUndefined();
    expect(warnings.some((w) => w.includes('not on this character'))).toBe(true);
  });

  it('resolves level 3 advancements and locks choices when complete', () => {
    const srd = miniSrd();
    const { patch, warnings } = resolveCharacterAiDraft(
      {
        classId: 'srd-cls-bard',
        subclassId: 'Wordsmith',
        level: 3,
        abilityIds: ['srd-abl-1', 'srd-abl-2'],
        experiences: [
          { id: 'e1', name: 'A', score: 2 },
          { id: 'e2', name: 'B', score: 2 },
          { id: 'e3', name: 'C', score: 2 },
        ],
        advancements: {
          '2': {
            domainCardId: 'srd-abl-4',
            picks: [{ type: 'hp' }, { type: 'stress' }],
          },
          '3': {
            domainCardId: 'srd-abl-5',
            picks: [{ type: 'evasion' }, { type: 'traits', traits: ['agility', 'strength'] }],
          },
        },
      },
      srd,
    );
    expect(patch.level).toBe(3);
    expect(patch.advancements['2'].domainCardId).toBe('srd-abl-4');
    expect(patch.advancements['3'].domainCardId).toBe('srd-abl-5');
    expect(patch.advancementChoicesLockedThroughLevel).toBe(3);
    expect(warnings.filter((w) => w.startsWith('Advancement incomplete:')).length).toBe(0);
  });

  it('clamps draft level to API targetLevel', () => {
    const srd = miniSrd();
    const { patch, warnings } = resolveCharacterAiDraft(
      {
        classId: 'srd-cls-bard',
        subclassId: 'Wordsmith',
        level: 9,
        abilityIds: ['srd-abl-1', 'srd-abl-2'],
      },
      srd,
      { targetLevel: 2 },
    );
    expect(patch.level).toBe(2);
    expect(warnings.some((w) => w.includes('exceeds requested target'))).toBe(true);
  });

  it('accepts sheetDisplayNames.abilities for domain cards gained via advancements', () => {
    const srd = miniSrd();
    const { patch } = resolveCharacterAiDraft(
      {
        classId: 'srd-cls-bard',
        subclassId: 'Wordsmith',
        level: 2,
        abilityIds: ['srd-abl-1', 'srd-abl-2'],
        experiences: [
          { id: 'e1', name: 'A', score: 2 },
          { id: 'e2', name: 'B', score: 2 },
          { id: 'e3', name: 'C', score: 2 },
        ],
        advancements: {
          '2': {
            domainCardId: 'srd-abl-4',
            picks: [{ type: 'hp' }, { type: 'stress' }],
          },
        },
        sheetDisplayNames: {
          abilities: {
            'ability-srd-abl-4': 'Patch Up+',
          },
        },
      },
      srd,
    );
    expect(patch.sheetDisplayNames?.abilities?.['ability-srd-abl-4']).toBe('Patch Up+');
  });

  it('strict validation reports illegal domain cards as errors', () => {
    const srd = miniSrd();
    const out = validateCharacterAiDraftStrict(
      {
        classId: 'srd-cls-bard',
        subclassId: 'Wordsmith',
        ancestryIds: ['srd-anc-faun'],
        communityId: 'srd-com-highborne',
        primaryWeaponId: 'srd-wpn-rapier',
        armorId: 'srd-armor-leather',
        abilityIds: ['srd-abl-valor', 'srd-abl-2'],
      },
      srd,
    );
    expect(out.ok).toBe(false);
    expect(out.errors.some((issue) => issue.path === 'abilityIds.0')).toBe(true);
  });

  it('strict validation reports incomplete advancements as errors', () => {
    const srd = miniSrd();
    const out = validateCharacterAiDraftStrict(
      {
        classId: 'srd-cls-bard',
        subclassId: 'Wordsmith',
        ancestryIds: ['srd-anc-faun'],
        communityId: 'srd-com-highborne',
        primaryWeaponId: 'srd-wpn-rapier',
        armorId: 'srd-armor-leather',
        level: 3,
        abilityIds: ['srd-abl-1', 'srd-abl-2'],
        experiences: [
          { id: 'e1', name: 'A', score: 2 },
          { id: 'e2', name: 'B', score: 2 },
          { id: 'e3', name: 'C', score: 2 },
        ],
        advancements: {
          '2': {
            domainCardId: 'srd-abl-4',
            picks: [{ type: 'hp' }, { type: 'stress' }],
          },
        },
      },
      srd,
    );
    expect(out.ok).toBe(false);
    expect(out.errors.some((issue) => issue.code === 'advancement_incomplete' && issue.path === 'advancements.3')).toBe(true);
  });

  it('strict validation keeps nickname cleanup as warnings, not mechanical errors', () => {
    const srd = miniSrd();
    const out = validateCharacterAiDraftStrict(
      {
        classId: 'srd-cls-bard',
        subclassId: 'Wordsmith',
        ancestryIds: ['srd-anc-faun'],
        communityId: 'srd-com-highborne',
        primaryWeaponId: 'srd-wpn-rapier',
        armorId: 'srd-armor-leather',
        abilityIds: ['srd-abl-1', 'srd-abl-2'],
        sheetDisplayNames: {
          features: {
            'made-up-key': 'Nope',
          },
        },
      },
      srd,
    );
    expect(out.errors.some((issue) => issue.path === 'character' && issue.message.includes('made-up-key'))).toBe(false);
    expect(out.warnings.some((issue) => issue.message.includes('made-up-key'))).toBe(true);
  });
});
