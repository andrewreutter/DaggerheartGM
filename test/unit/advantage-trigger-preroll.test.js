import { describe, it, expect } from 'vitest';
import {
  collectAdvantageTriggerStrings,
  buildAdvantageTriggerPrerollChips,
} from '../../src/client/lib/advantage-trigger-preroll.js';
import { mergeV2DeclarativeSheetOverlay } from '../../src/client/lib/v2-declarative-sheet.js';
import { recomputeCharacter } from '../../src/client/lib/character-calc.js';

describe('collectAdvantageTriggerStrings', () => {
  it('returns trimmed strings from string entries', () => {
    expect(
      collectAdvantageTriggerStrings({
        advantageTriggers: [' climb trees ', 'sneak'],
      }),
    ).toEqual(['climb trees', 'sneak']);
  });

  it('unwraps _value objects', () => {
    expect(
      collectAdvantageTriggerStrings({
        advantageTriggers: [{ _value: 'test condition' }],
      }),
    ).toEqual(['test condition']);
  });
});

describe('buildAdvantageTriggerPrerollChips', () => {
  it('builds toggles from merged activeFeatures rows', () => {
    const chips = buildAdvantageTriggerPrerollChips(
      {
        activeFeatures: [
          {
            name: 'Natural Climber',
            advantageTriggers: ['Agility rolls to climb'],
          },
        ],
      },
      {},
    );
    expect(chips).toHaveLength(1);
    expect(chips[0]._advantageTriggerChip).toBe(true);
    expect(chips[0]._featureName).toBe('Natural Climber');
    expect(chips[0].label).toContain('Natural Climber');
    expect(chips[0].label).toContain('Agility rolls to climb');
  });

  it('dedupes same feature+condition across sources', () => {
    const chips = buildAdvantageTriggerPrerollChips(
      {
        activeFeatures: [
          {
            name: 'Echo',
            advantageTriggers: ['hearing'],
          },
          {
            name: 'Echo',
            advantageTriggers: ['hearing'],
          },
        ],
      },
      {},
    );
    expect(chips).toHaveLength(1);
  });

  it('falls back to origin/class resolvers when activeFeatures is absent', () => {
    const chips = buildAdvantageTriggerPrerollChips(
      {
        ancestryFeatures: [{ name: 'Simiah' }],
        communityFeatures: [],
        classFeatures: [],
        subclassFeatures: [],
      },
      {
        resolveOriginFeatureDescriptor: (_el, name) =>
          name === 'Simiah'
            ? { name: 'Simiah', advantageTriggers: ['rolls to hide'] }
            : null,
        resolveClassFeatureDescriptor: () => null,
      },
    );
    expect(chips).toHaveLength(1);
    expect(chips[0]._featureName).toBe('Simiah');
    expect(chips[0].label).toContain('rolls to hide');
  });

  it('includes weapon feature rows when resolver is provided', () => {
    const chips = buildAdvantageTriggerPrerollChips(
      {
        activeFeatures: [],
        ancestryFeatures: [],
        communityFeatures: [],
        classFeatures: [],
        subclassFeatures: [],
        weapons: [{ name: 'Dagger', feature: { name: 'Finesse' } }],
      },
      {
        resolveOriginFeatureDescriptor: () => null,
        resolveClassFeatureDescriptor: () => null,
        resolveWeaponTagDescriptor: (name) =>
          name === 'Finesse' ? { name: 'Finesse', advantageTriggers: ['when thrown'] } : null,
      },
    );
    expect(chips).toHaveLength(1);
    expect(chips[0]._featureName).toBe('Finesse');
  });

  it('exposes Druid beastform SRD keyword advantages after mergeV2DeclarativeSheetOverlay (intent panel parity)', () => {
    const srdData = {
      ancestriesById: {},
      weaponsById: {
        'w-staff': {
          id: 'w-staff',
          name: 'Quarterstaff',
          trait: 'Instinct',
          range: 'Melee',
          damage: 'd10',
          physical_or_magical: 'Physical',
          features: [],
        },
      },
      armorById: {},
      classesById: {
        'srd-cls-druid': {
          id: 'srd-cls-druid',
          name: 'Druid',
          domains: [],
          class_features: [
            { name: 'Beastform', description: 'x' },
            { name: 'Wildtouch', description: 'y' },
          ],
        },
      },
      subclassesById: {},
      communitiesById: {},
      abilitiesById: {},
    };

    const raw = {
      instanceId: 'druid-bf',
      classId: 'srd-cls-druid',
      level: 1,
      baseTraits: { agility: 2, strength: 1, finesse: 1, instinct: 0, presence: 0, knowledge: -1 },
      advancements: {},
      primaryWeaponId: 'w-staff',
      secondaryWeaponId: null,
      armorId: null,
      ancestryIds: [],
      communityId: null,
      abilityIds: [],
      featureState: {
        'classes:srd-cls-druid': {
          activeBeastform: { beastformId: 'srd-bst-agile-scout', viaEvolution: false },
        },
      },
    };

    const recomputed = recomputeCharacter(raw, srdData);
    const merged = mergeV2DeclarativeSheetOverlay(recomputed, raw, srdData, {});

    const beforeMerge = buildAdvantageTriggerPrerollChips(recomputed, {
      resolveOriginFeatureDescriptor: () => null,
      resolveClassFeatureDescriptor: () => null,
    });
    const syntheticRow = merged.activeFeatures?.find((f) => f.id === 'srd-bst-agile-scout-advantages');
    expect(syntheticRow?.advantageTriggers?.length).toBeGreaterThan(0);

    const afterMerge = buildAdvantageTriggerPrerollChips(merged, {
      resolveOriginFeatureDescriptor: () => null,
      resolveClassFeatureDescriptor: () => null,
    });
    expect(afterMerge.length).toBeGreaterThan(beforeMerge.length);
    expect(afterMerge.some((c) => c.label.includes('Agile Scout') && c.label.includes('rolls to sneak'))).toBe(
      true,
    );
  });
});
