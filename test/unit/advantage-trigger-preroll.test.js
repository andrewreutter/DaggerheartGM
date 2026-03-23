import { describe, it, expect } from 'vitest';
import {
  collectAdvantageTriggerStrings,
  buildAdvantageTriggerPrerollChips,
} from '../../src/client/lib/advantage-trigger-preroll.js';

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
});
