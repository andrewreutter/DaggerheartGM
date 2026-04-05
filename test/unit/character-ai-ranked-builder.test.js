import { describe, expect, it } from 'vitest';
import { buildCharacterAiCandidatesFromRankings } from '../../src/character-ai-ranked-builder.js';
import { validateCharacterAiDraftStrict } from '../../src/character-ai-resolve.js';

function miniSrd() {
  const classes = [
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
      background_questions: [],
      connections: [],
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
      background_questions: [],
      connections: [],
    },
  ];
  const subclasses = [
    {
      id: 'srd-sub-sentinel',
      name: 'Sentinel',
      description: 'Guard',
      spellcast_trait: 'Strength',
      foundation_features: [{ id: 'sent-found', name: 'Shield', type: 'passive', description: 'Shield' }],
      specialization_features: [{ id: 'sent-spec', name: 'Shield Wall', type: 'passive', description: 'Wall' }],
      mastery_features: [{ id: 'sent-master', name: 'Unbroken', type: 'passive', description: 'Unbroken' }],
    },
    {
      id: 'srd-sub-elementalist',
      name: 'Elementalist',
      description: 'Storms',
      spellcast_trait: 'Knowledge',
      foundation_features: [{ id: 'elem-found', name: 'Spark', type: 'passive', description: 'Spark' }],
      specialization_features: [{ id: 'elem-spec', name: 'Stormshape', type: 'passive', description: 'Storm' }],
      mastery_features: [{ id: 'elem-master', name: 'Eye of the Tempest', type: 'passive', description: 'Eye' }],
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
      features: [{ id: 'high-1', name: 'Purposeful Design', type: 'passive', description: 'Privilege' }],
    },
  ];
  const armor = [{ id: 'srd-armor-plate', name: 'Plate Armor', description: 'Heavy', tier: 6 }];
  const weapons = [
    { id: 'srd-wpn-warhammer', name: 'Warhammer', description: 'Hammer', tier: 6, burden: 'One-Handed', primary_or_secondary: 'Primary' },
    { id: 'srd-wpn-round-shield', name: 'Round Shield', description: 'Shield', tier: 6, burden: 'One-Handed', primary_or_secondary: 'Secondary' },
  ];
  const abilities = [
    { id: 'srd-abl-smite', name: 'Thunder Smite', domain: 'Valor', level: 1, description: 'Smite' },
    { id: 'srd-abl-blade', name: 'Blade Dance', domain: 'Blade', level: 1, description: 'Blade' },
    { id: 'srd-abl-hammer', name: 'Hammer Toss', domain: 'Valor', level: 2, description: 'Hammer' },
    { id: 'srd-abl-ward', name: 'Storm Ward', domain: 'Valor', level: 3, description: 'Ward' },
    { id: 'srd-abl-whirl', name: 'Whirlwind Guard', domain: 'Blade', level: 2, description: 'Whirl' },
    { id: 'srd-abl-bulwark', name: 'Bulwark Spin', domain: 'Blade', level: 3, description: 'Spin' },
    { id: 'srd-abl-phalanx', name: 'Storm Phalanx', domain: 'Valor', level: 4, description: 'Phalanx' },
    { id: 'srd-abl-aegis', name: 'Aegis Cyclone', domain: 'Blade', level: 6, description: 'Aegis' },
    { id: 'srd-abl-spark', name: 'Spark Bolt', domain: 'Arcana', level: 1, description: 'Spark' },
    { id: 'srd-abl-gloom', name: 'Gloom Veil', domain: 'Midnight', level: 1, description: 'Gloom' },
    { id: 'srd-abl-step', name: 'Lightning Step', domain: 'Arcana', level: 2, description: 'Step' },
    { id: 'srd-abl-mist', name: 'Midnight Mist', domain: 'Midnight', level: 2, description: 'Mist' },
    { id: 'srd-abl-cage', name: 'Tempest Cage', domain: 'Arcana', level: 3, description: 'Cage' },
    { id: 'srd-abl-shade', name: 'Shade Cloak', domain: 'Midnight', level: 3, description: 'Shade' },
    { id: 'srd-abl-chain', name: 'Chain Lightning', domain: 'Arcana', level: 6, description: 'Chain' },
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

function baseCharacter() {
  return {
    name: 'Spider-ish',
    pronouns: 'he/him',
    description: 'An agile masked hero',
    background: 'Bitten and burdened',
    connectionText: 'I always try to look out for you.',
    ancestryIds: ['srd-anc-faun'],
    communityId: 'srd-com-highborne',
    baseTraits: { agility: 2, strength: 0, finesse: 1, instinct: 1, presence: -1, knowledge: 0 },
    primaryWeaponId: 'srd-wpn-warhammer',
    secondaryWeaponId: 'srd-wpn-round-shield',
    armorId: 'srd-armor-plate',
    experiences: [
      { id: 'e1', name: 'Street Acrobat', score: 2 },
      { id: 'e2', name: 'Neighborhood Hero', score: 2 },
      { id: 'e3', name: 'Science Club', score: 2 },
      { id: 'e4', name: 'Quick Comebacks', score: 2 },
    ],
    experienceBonusChoices: { 'Purposeful Design': 'e1' },
    companion: null,
  };
}

describe('buildCharacterAiCandidatesFromRankings', () => {
  it('builds a single complete legal candidate when the ranked cards mostly fit the primary package', () => {
    const srd = miniSrd();
    const result = buildCharacterAiCandidatesFromRankings(
      {
        justification: 'Storm-touched sentinel with a little spell support.',
        primaryPackage: {
          classId: 'srd-cls-guardian',
          subclassId: 'srd-sub-sentinel',
          multiclassClassId: 'srd-cls-sorcerer',
          multiclassSubclassId: 'srd-sub-elementalist',
          multiclassDomain: 'Arcana',
        },
        alternatePackage: null,
        domainCardRanking: [
          'srd-abl-cage',
          'srd-abl-step',
          'srd-abl-chain',
          'srd-abl-bulwark',
          'srd-abl-ward',
          'srd-abl-whirl',
          'srd-abl-hammer',
          'srd-abl-smite',
          'srd-abl-blade',
        ],
        startingCardRanking: ['srd-abl-smite', 'srd-abl-blade'],
        advancementPickTypeRanking: ['multiclass', 'evasion', 'traits', 'stress', 'hp', 'experience'],
        character: baseCharacter(),
      },
      srd,
      { targetLevel: 6 },
    );

    expect(result.mode).toBe('single');
    expect(result.candidates).toHaveLength(1);
    const candidate = result.candidates[0];
    expect(candidate.key).toBe('keep_class_package');
    const strict = validateCharacterAiDraftStrict(candidate.patch, srd, { targetLevel: 6 });
    expect(strict.ok).toBe(true);
    expect(candidate.patch.advancementChoicesLockedThroughLevel).toBe(6);
  });

  it('names blank tier-entry experience rows when the model only provides the base two experiences', () => {
    const srd = miniSrd();
    const result = buildCharacterAiCandidatesFromRankings(
      {
        justification: 'Storm-touched sentinel with a little spell support.',
        primaryPackage: {
          classId: 'srd-cls-guardian',
          subclassId: 'srd-sub-sentinel',
          multiclassClassId: 'srd-cls-sorcerer',
          multiclassSubclassId: 'srd-sub-elementalist',
          multiclassDomain: 'Arcana',
        },
        alternatePackage: null,
        domainCardRanking: [
          'srd-abl-cage',
          'srd-abl-step',
          'srd-abl-chain',
          'srd-abl-bulwark',
          'srd-abl-ward',
          'srd-abl-whirl',
          'srd-abl-hammer',
          'srd-abl-smite',
          'srd-abl-blade',
        ],
        startingCardRanking: ['srd-abl-smite', 'srd-abl-blade'],
        advancementPickTypeRanking: ['multiclass', 'evasion', 'traits', 'stress', 'hp', 'experience'],
        character: {
          ...baseCharacter(),
          experiences: baseCharacter().experiences.slice(0, 2),
        },
      },
      srd,
      { targetLevel: 6 },
    );

    const candidate = result.candidates[0];
    expect(candidate.patch.experiences[2]).toEqual(
      expect.objectContaining({
        name: 'Experience 3 - choose during play',
        score: 2,
      }),
    );
    expect(candidate.patch.experiences[3]).toEqual(
      expect.objectContaining({
        name: 'Experience 4 - choose during play',
        score: 2,
      }),
    );
  });

  it('returns two candidates when the top-ranked cards point strongly off-domain and an alternate package is provided', () => {
    const srd = miniSrd();
    const result = buildCharacterAiCandidatesFromRankings(
      {
        justification: 'Web-slinging storm mage with a fallback martial chassis.',
        primaryPackage: {
          classId: 'srd-cls-guardian',
          subclassId: 'srd-sub-sentinel',
          multiclassClassId: null,
          multiclassSubclassId: null,
          multiclassDomain: null,
        },
        alternatePackage: {
          classId: 'srd-cls-sorcerer',
          subclassId: 'srd-sub-elementalist',
          multiclassClassId: null,
          multiclassSubclassId: null,
          multiclassDomain: null,
        },
        domainCardRanking: [
          'srd-abl-chain',
          'srd-abl-cage',
          'srd-abl-step',
          'srd-abl-spark',
          'srd-abl-chain',
          'srd-abl-cage',
          'srd-abl-step',
          'srd-abl-spark',
          'srd-abl-chain',
          'srd-abl-cage',
        ],
        startingCardRanking: ['srd-abl-spark'],
        advancementPickTypeRanking: ['evasion', 'traits', 'stress', 'hp', 'experience'],
        character: baseCharacter(),
      },
      srd,
      { targetLevel: 6 },
    );

    expect(result.mode).toBe('choice');
    expect(result.candidates).toHaveLength(2);
    expect(result.overlapDiagnostics.primaryPackageTop10.matchedCount).toBeLessThan(6);
    expect(result.candidates[0].patch.classId).toBe('srd-cls-guardian');
    expect(result.candidates[1].patch.classId).toBe('srd-cls-sorcerer');
  });
});
