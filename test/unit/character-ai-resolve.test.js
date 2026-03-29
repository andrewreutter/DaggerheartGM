import { describe, it, expect } from 'vitest';
import {
  resolveCharacterAiDraft,
  normalizeLookupKey,
  buildLookupMaps,
  resolveToId,
  parseSuggestedTraits,
  isValidTraitAssignment,
} from '../../src/character-ai-resolve.js';

function miniSrd() {
  const classes = [
    {
      id: 'srd-cls-bard',
      name: 'Bard',
      domains: ['Grace', 'Codex'],
      subclasses: ['Wordsmith'],
      suggested_traits: '0, -1, +1, 0, +2, +1',
    },
  ];
  const subclasses = [
    { id: 'srd-sub-wordsmith', name: 'Wordsmith' },
    { id: 'srd-sub-troubadour', name: 'Troubadour' },
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
});
