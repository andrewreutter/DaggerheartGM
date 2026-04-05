import { describe, expect, it } from 'vitest';
import {
  buildCompactCharacterAiCatalog,
  fetchCharacterBuildProfile,
} from '../../src/character-ai-build-profile.js';

function miniSrd() {
  const classes = [
    {
      id: 'srd-cls-bard',
      name: 'Bard',
      description: 'Grace and Codex performer',
      domains: ['Grace', 'Codex'],
      subclasses: ['Wordsmith'],
      suggested_traits: '0, -1, +1, 0, +2, +1',
      starting_hp: 5,
      starting_evasion: 10,
      hope_feature: { name: 'Make a Scene', description: 'Scene' },
      class_features: [{ id: 'bard-rally', name: 'Rally', type: 'passive', description: 'Rally' }],
    },
    {
      id: 'srd-cls-sorcerer',
      name: 'Sorcerer',
      description: 'Arcana and Midnight storm mage',
      domains: ['Arcana', 'Midnight'],
      subclasses: ['Elementalist'],
      suggested_traits: '0, -1, +1, 0, +2, +1',
      starting_hp: 5,
      starting_evasion: 10,
      hope_feature: { name: 'Arcane Pulse', description: 'Pulse' },
      class_features: [{ id: 'sorc-cast', name: 'Channel', type: 'passive', description: 'Channel' }],
    },
    {
      id: 'srd-cls-guardian',
      name: 'Guardian',
      description: 'Valor and Blade defender',
      domains: ['Valor', 'Blade'],
      subclasses: ['Sentinel'],
      suggested_traits: '0, -1, +1, 0, +2, +1',
      starting_hp: 7,
      starting_evasion: 11,
      hope_feature: { name: 'Stand Fast', description: 'Stand' },
      class_features: [{ id: 'guard-wall', name: 'Bulwark', type: 'passive', description: 'Bulwark' }],
    },
  ];
  const subclasses = [
    {
      id: 'srd-sub-wordsmith',
      name: 'Wordsmith',
      description: 'Words',
      spellcast_trait: 'Presence',
      foundation_features: [{ id: 'ws-found', name: 'Poetry', type: 'passive', description: 'Poetry' }],
      specialization_features: [],
      mastery_features: [],
    },
    {
      id: 'srd-sub-elementalist',
      name: 'Elementalist',
      description: 'Elements',
      spellcast_trait: 'Knowledge',
      foundation_features: [{ id: 'elem-found', name: 'Spark', type: 'passive', description: 'Spark' }],
      specialization_features: [],
      mastery_features: [],
    },
    {
      id: 'srd-sub-sentinel',
      name: 'Sentinel',
      description: 'Guard',
      spellcast_trait: 'Strength',
      foundation_features: [{ id: 'sent-found', name: 'Shield', type: 'passive', description: 'Shield' }],
      specialization_features: [],
      mastery_features: [],
    },
  ];
  const ancestries = [
    {
      id: 'srd-anc-faun',
      name: 'Faun',
      description: 'Faun',
      features: [{ id: 'faun-1', name: 'Lucky', type: 'passive', description: 'Luck' }],
    },
  ];
  const communities = [
    {
      id: 'srd-com-highborne',
      name: 'Highborne',
      description: 'High',
      features: [{ id: 'high-1', name: 'Privilege', type: 'passive', description: 'Privilege' }],
    },
  ];
  const armor = [
    { id: 'srd-armor-leather', name: 'Leather Armor', description: 'Light', tier: 1 },
    { id: 'srd-armor-plate', name: 'Plate Armor', description: 'Heavy', tier: 6 },
  ];
  const weapons = [
    { id: 'srd-wpn-rapier', name: 'Rapier', description: 'Rapier', tier: 1, burden: 'One-Handed', primary_or_secondary: 'Primary' },
    { id: 'srd-wpn-longbow', name: 'Longbow', description: 'Bow', tier: 1, burden: 'Two-Handed', primary_or_secondary: 'Primary' },
    { id: 'srd-wpn-dagger', name: 'Dagger', description: 'Dagger', tier: 1, burden: 'One-Handed', primary_or_secondary: 'Secondary' },
  ];
  const abilities = [
    { id: 'srd-abl-heal', name: 'Healing Touch', domain: 'Grace', level: 1, description: 'Heal' },
    { id: 'srd-abl-scan', name: 'Scan', domain: 'Codex', level: 1, description: 'Scan' },
    { id: 'srd-abl-dispel', name: 'Dispel', domain: 'Codex', level: 2, description: 'Dispel' },
    { id: 'srd-abl-spark', name: 'Spark Bolt', domain: 'Arcana', level: 1, description: 'Spark' },
    { id: 'srd-abl-static', name: 'Static Field', domain: 'Arcana', level: 3, description: 'Static' },
    { id: 'srd-abl-chain', name: 'Chain Lightning', domain: 'Arcana', level: 6, description: 'Chain' },
    { id: 'srd-abl-gloom', name: 'Gloom Veil', domain: 'Midnight', level: 1, description: 'Gloom' },
    { id: 'srd-abl-smite', name: 'Thunder Smite', domain: 'Valor', level: 1, description: 'Smite' },
    { id: 'srd-abl-slash', name: 'Blade Dance', domain: 'Blade', level: 1, description: 'Slash' },
  ];
  const buildById = (arr) => Object.fromEntries(arr.map((row) => [row.id, row]));
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

describe('character-ai-build-profile', () => {
  it('builds a compact catalog with a ranking-ready domain card index', () => {
    const catalog = buildCompactCharacterAiCatalog(miniSrd(), { targetLevel: 6 });
    expect(catalog.classes.some((row) => row.name === 'Bard')).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(catalog, 'abilitiesIndex')).toBe(false);
    expect(catalog.domainCardIndex.some((row) => row.id === 'srd-abl-chain' && row.domain === 'Arcana')).toBe(true);
  });

  it('starting ability options only come from the class domains', () => {
    const profile = fetchCharacterBuildProfile(
      {
        classId: 'srd-cls-bard',
        subclassId: 'srd-sub-wordsmith',
        targetLevel: 6,
      },
      miniSrd(),
    );
    expect(profile.ok).toBe(true);
    expect(profile.startingAbilityOptions.map((row) => row.id)).toEqual(['srd-abl-heal', 'srd-abl-scan']);
    expect(profile.legalDomainCards.map((row) => row.id)).toEqual(['srd-abl-heal', 'srd-abl-scan', 'srd-abl-dispel']);
    expect(profile.groupedDomainCards.map((row) => row.domain)).toEqual(['Codex', 'Grace']);
  });

  it('advancement rows respect multiclass spell caps', () => {
    const profile = fetchCharacterBuildProfile(
      {
        classId: 'srd-cls-bard',
        subclassId: 'srd-sub-wordsmith',
        targetLevel: 6,
        multiclassClassId: 'srd-cls-sorcerer',
        multiclassSubclassId: 'srd-sub-elementalist',
        multiclassDomain: 'Arcana',
      },
      miniSrd(),
    );
    expect(profile.ok).toBe(true);
    const level2Ids = profile.advancementRows['2'].domainCardOptions.map((row) => row.id);
    const level6Ids = profile.advancementRows['6'].domainCardOptions.map((row) => row.id);
    expect(level2Ids.includes('srd-abl-static')).toBe(false);
    expect(level6Ids.includes('srd-abl-static')).toBe(true);
    expect(level6Ids.includes('srd-abl-chain')).toBe(false);
  });

  it('includes shared advancement band budgets alongside row-level pick types', () => {
    const profile = fetchCharacterBuildProfile(
      {
        classId: 'srd-cls-bard',
        subclassId: 'srd-sub-wordsmith',
        targetLevel: 6,
      },
      miniSrd(),
    );
    expect(profile.ok).toBe(true);
    expect(profile.advancementRows['2'].band).toBe('A');
    expect(profile.advancementRows['5'].band).toBe('B');
    expect(profile.advancementBandBudgets).toEqual([
      expect.objectContaining({
        band: 'A',
        levels: [2, 3, 4],
        pickTypeBudgets: expect.objectContaining({ experience: 1, domain_card: 1, multiclass: 0 }),
      }),
      expect.objectContaining({
        band: 'B',
        levels: [5, 6],
        pickTypeBudgets: expect.objectContaining({ proficiency: 1, subclass_upgrade: 1, multiclass: 1 }),
      }),
    ]);
    expect(profile.guidance.advancementBudgetNote).toContain('advancementBandBudgets');
  });

  it('multiclass profile only exposes the selected multiclass domain', () => {
    const profile = fetchCharacterBuildProfile(
      {
        classId: 'srd-cls-bard',
        subclassId: 'srd-sub-wordsmith',
        targetLevel: 6,
        multiclassClassId: 'srd-cls-sorcerer',
        multiclassSubclassId: 'srd-sub-elementalist',
        multiclassDomain: 'Arcana',
      },
      miniSrd(),
    );
    expect(profile.ok).toBe(true);
    expect(profile.multiclass.domainOptions.every((row) => row.domain === 'Arcana')).toBe(true);
  });

  it('dedupes row options within each level profile', () => {
    const srd = miniSrd();
    srd.abilities.push({ id: 'srd-abl-heal', name: 'Healing Touch', domain: 'Grace', level: 1, description: 'Duplicate' });
    const profile = fetchCharacterBuildProfile(
      {
        classId: 'srd-cls-bard',
        subclassId: 'srd-sub-wordsmith',
        targetLevel: 3,
      },
      srd,
    );
    const ids = profile.advancementRows['2'].domainCardOptions.map((row) => row.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
