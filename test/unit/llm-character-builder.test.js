import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildCharacterAiFromConcept } from '../../src/llm-character-builder.js';

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

function openAiResponse(message, finishReason = 'stop') {
  return {
    ok: true,
    json: async () => ({
      id: 'resp-1',
      model: 'test-model',
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2, prompt_tokens_details: { cached_tokens: 0 } },
      choices: [{ finish_reason: finishReason, message }],
    }),
  };
}

describe('buildCharacterAiFromConcept', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns a single completed candidate from ranked preferences', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
    vi.stubEnv('OPENAI_CHARACTER_MODEL', 'test-character-model');

    const requests = [];
    const responses = [
      openAiResponse(
        {
          content: null,
          tool_calls: [
            {
              id: 'tool-profile-1',
              type: 'function',
              function: {
                name: 'fetch_character_build_profile',
                arguments: JSON.stringify({
                  classId: 'srd-cls-guardian',
                  subclassId: 'srd-sub-sentinel',
                  targetLevel: 6,
                  multiclassClassId: 'srd-cls-sorcerer',
                  multiclassSubclassId: 'srd-sub-elementalist',
                  multiclassDomain: 'Arcana',
                }),
              },
            },
          ],
        },
        'tool_calls',
      ),
      openAiResponse({
        content: JSON.stringify({
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
          rankedCardRationale: [
            { abilityId: 'srd-abl-cage', reason: 'It reads like a web trap that pins foes in place.' },
            { abilityId: 'srd-abl-step', reason: 'It captures Spider-Man style burst movement and repositioning.' },
          ],
          startingCardRanking: ['srd-abl-smite', 'srd-abl-blade'],
          advancementPickTypeRanking: ['multiclass', 'evasion', 'traits', 'stress', 'hp', 'experience'],
          character: {
            ...baseCharacter(),
            sheetDisplayNames: {
              abilities: {
                'ability-srd-abl-smite': 'Web Strike',
                'ability-srd-abl-cage': 'Web Snare',
              },
            },
          },
        }),
      }),
    ];

    const fetchImpl = vi.fn(async (_url, options) => {
      requests.push(JSON.parse(options.body));
      const next = responses.shift();
      if (!next) throw new Error('No more mock responses');
      return next;
    });

    const result = await buildCharacterAiFromConcept('Build a level 6 Thor-like character.', {
      targetLevel: 6,
      srdData: miniSrd(),
      creationContext: 'Test context',
      fetchImpl,
    });

    expect(result.mode).toBe('single');
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].patch.classId).toBe('srd-cls-guardian');
    expect(result.candidates[0].patch.advancementChoicesLockedThroughLevel).toBe(6);
    expect(result.candidates[0].patch.sheetDisplayNames?.abilities?.['ability-srd-abl-smite']).toBe('Web Strike');
    expect(result.rankingRationale).toEqual([
      expect.objectContaining({
        abilityId: 'srd-abl-cage',
        name: 'Tempest Cage',
        reason: 'It reads like a web trap that pins foes in place.',
      }),
      expect.objectContaining({
        abilityId: 'srd-abl-step',
        name: 'Lightning Step',
        reason: 'It captures Spider-Man style burst movement and repositioning.',
      }),
    ]);
    expect(requests[0].tools.map((tool) => tool.function.name)).toEqual([
      'fetch_character_build_profile',
      'validate_character_build_draft',
    ]);
    expect(requests[0].messages[0].content).toContain('rankedCardRationale');
    expect(requests[0].messages[0].content).toContain('character.sheetDisplayNames.abilities');
    expect(requests[0].messages[0].content).toContain('tier-entry experience rows');
  });

  it('returns two candidates when the top-ranked cards fit the alternate package better', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
    vi.stubEnv('OPENAI_CHARACTER_MODEL', 'test-character-model');

    const fetchImpl = vi.fn(async () =>
      openAiResponse({
        content: JSON.stringify({
          justification: 'Storm mage fantasy with a martial fallback.',
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
          startingCardRanking: ['srd-abl-spark', 'srd-abl-gloom'],
          advancementPickTypeRanking: ['evasion', 'traits', 'stress', 'hp', 'experience'],
          character: baseCharacter(),
        }),
      }),
    );

    const result = await buildCharacterAiFromConcept('Build a level 6 Spider-Man-like character.', {
      targetLevel: 6,
      srdData: miniSrd(),
      creationContext: 'Test context',
      fetchImpl,
    });

    expect(result.mode).toBe('choice');
    expect(result.candidates).toHaveLength(2);
    expect(result.overlapDiagnostics.primaryPackageTop10.matchedCount).toBeLessThan(6);
    expect(result.candidates[0].key).toBe('keep_class_package');
    expect(result.candidates[1].key).toBe('keep_card_preferences');
  });

  it('accepts raw validator arguments instead of requiring a nested character field', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
    vi.stubEnv('OPENAI_CHARACTER_MODEL', 'test-character-model');

    const requests = [];
    const responses = [
      openAiResponse(
        {
          content: null,
          tool_calls: [
            {
              id: 'tool-validate-1',
              type: 'function',
              function: {
                name: 'validate_character_build_draft',
                arguments: JSON.stringify({
                  level: 6,
                  classId: 'srd-cls-guardian',
                }),
              },
            },
          ],
        },
        'tool_calls',
      ),
      openAiResponse({
        content: JSON.stringify({
          justification: 'Legal package plus ranked preferences.',
          primaryPackage: {
            classId: 'srd-cls-guardian',
            subclassId: 'srd-sub-sentinel',
            multiclassClassId: null,
            multiclassSubclassId: null,
            multiclassDomain: null,
          },
          alternatePackage: null,
          domainCardRanking: ['srd-abl-bulwark', 'srd-abl-ward', 'srd-abl-whirl', 'srd-abl-hammer', 'srd-abl-smite', 'srd-abl-blade'],
          startingCardRanking: ['srd-abl-smite', 'srd-abl-blade'],
          advancementPickTypeRanking: ['traits', 'evasion', 'hp', 'stress', 'experience'],
          character: baseCharacter(),
        }),
      }),
    ];

    const fetchImpl = vi.fn(async (_url, options) => {
      requests.push(JSON.parse(options.body));
      const next = responses.shift();
      if (!next) throw new Error('No more mock responses');
      return next;
    });

    const result = await buildCharacterAiFromConcept('Build a level 6 guardian.', {
      targetLevel: 6,
      srdData: miniSrd(),
      creationContext: 'Test context',
      fetchImpl,
    });

    expect(result.mode).toBe('single');
    const secondRequestMessages = requests[1].messages;
    const toolMessage = secondRequestMessages.find((msg) => msg.role === 'tool');
    expect(toolMessage.content).toContain('"ok":false');
    expect(toolMessage.content).toContain('Character must resolve to a subclassId');
  });
});
