import { describe, it, expect } from 'vitest';
import {
  buildSessionStartBannerActionText,
  collectSessionStartHookLabels,
} from '../../src/client/lib/session-start-preview.js';
import { v2ClassSubclassFeatureDescriptorsByName } from '../../src/client/lib/v2-class-subclass-feature-descriptors.js';

describe('collectSessionStartHookLabels', () => {
  it('returns empty when V2 data is missing', () => {
    expect(
      collectSessionStartHookLabels(
        [{ elementType: 'character', instanceId: 'a', name: 'Zed', activeFeatures: [{ type: 'class', name: 'Seraph' }] }],
        {
          v2Registry: null,
          srdData: null,
          v2ClassSubclassFeatureDescriptorsByName: {},
          getV2OriginFeatureDescriptor: () => undefined,
        }
      )
    ).toEqual([]);
  });

  it('recomputes activeFeatures from a raw element (no pre-computed activeFeatures) and finds Seraph Prayer Dice', () => {
    // Raw `activeElements` (server/SSE) never carry `activeFeatures` — this must be recomputed
    // internally from `classId` + `srdData`, not read directly off the element.
    const srdData = {
      ancestriesById: {},
      weaponsById: {},
      armorById: {},
      classesById: {
        'srd-cls-seraph': {
          id: 'srd-cls-seraph',
          name: 'Seraph',
          hope_feature: { name: 'Life Support', description: 'x' },
          domains: [],
          class_features: [{ name: 'Prayer Dice', description: 'Roll d4s at session start.' }],
        },
      },
      subclassesById: {},
      communitiesById: {},
    };
    const rawSeraph = {
      elementType: 'character',
      instanceId: 'seraph1',
      name: 'Zed',
      classId: 'srd-cls-seraph',
      level: 1,
      baseTraits: { agility: 0, strength: 0, finesse: 0, instinct: 0, presence: 0, knowledge: 1 },
      traits: { agility: 0, strength: 0, finesse: 0, instinct: 0, presence: 0, knowledge: 1 },
      evasion: 10,
      armorScore: 0,
      maxHp: 6,
      maxStress: 6,
      maxHope: 6,
      maxArmor: 0,
      armorThresholds: { major: 5, severe: 7 },
      weapons: [],
      proficiency: 1,
      // No `activeFeatures` field — matches what the server actually sends.
    };
    expect(rawSeraph.activeFeatures).toBeUndefined();

    const labels = collectSessionStartHookLabels([rawSeraph], {
      v2Registry: {},
      srdData,
      v2ClassSubclassFeatureDescriptorsByName,
      getV2OriginFeatureDescriptor: () => undefined,
    });
    expect(labels).toContain('Zed — Prayer Dice');
  });
});

describe('buildSessionStartBannerActionText', () => {
  it('includes baseline bullets and hook placeholder', () => {
    const text = buildSessionStartBannerActionText([], {
      v2Registry: null,
      srdData: null,
      v2ClassSubclassFeatureDescriptorsByName: {},
      getV2OriginFeatureDescriptor: () => undefined,
    });
    expect(text).toContain('Nothing changes on the table until you press Acknowledge');
    expect(text).toContain('session-frequency');
    expect(text).toContain('No character session-start hooks');
  });
});
