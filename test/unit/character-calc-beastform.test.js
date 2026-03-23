import { describe, it, expect } from 'vitest';
import { recomputeCharacter } from '../../src/client/lib/character-calc.js';

const BASE = {
  level: 1,
  baseTraits: { agility: 2, strength: 1, finesse: 1, instinct: 0, presence: 0, knowledge: -1 },
};

const EMPTY_SRD = {
  classesById: {},
  subclassesById: {},
  ancestriesById: {},
  communitiesById: {},
  armorById: {},
  weaponsById: {},
  abilitiesById: {},
  beastformsById: {},
};

describe('recomputeCharacter — beastformFeatures', () => {
  it('adds beastformFeatures for Druid with activeBeastform (SRD fallback when API map empty)', () => {
    const data = {
      ...BASE,
      classId: 'srd-cls-druid',
      activeBeastform: { id: 'srd-bst-agile-scout', name: 'Agile Scout' },
    };
    const srdData = {
      ...EMPTY_SRD,
      classesById: {
        'srd-cls-druid': {
          name: 'Druid',
          class_features: [{ name: 'Beastform', description: 'x' }],
        },
      },
    };
    const out = recomputeCharacter(data, srdData);
    expect(out.beastformFeatures?.length).toBeGreaterThan(0);
    expect(out.beastformFeatures[0]).toMatchObject({
      sourceType: 'beastform',
      source: 'Agile Scout',
      name: 'Agile',
    });
    expect(out.beastformFeatures[0].id).toBeTruthy();
  });

  it('prefers srdData.beastformsById over generated fallback', () => {
    const data = {
      ...BASE,
      classId: 'srd-cls-druid',
      activeBeastform: { beastformId: 'srd-bst-agile-scout' },
    };
    const srdData = {
      ...EMPTY_SRD,
      classesById: {
        'srd-cls-druid': {
          name: 'Druid',
          class_features: [{ name: 'Beastform', description: 'x' }],
        },
      },
      beastformsById: {
        'srd-bst-agile-scout': {
          id: 'srd-bst-agile-scout',
          name: 'Agile Scout',
          features: [{ id: 'custom-id', name: 'Custom', description: 'from api' }],
        },
      },
    };
    const out = recomputeCharacter(data, srdData);
    expect(out.beastformFeatures).toEqual([
      expect.objectContaining({
        id: 'custom-id',
        name: 'Custom',
        description: 'from api',
        sourceType: 'beastform',
        source: 'Agile Scout',
      }),
    ]);
  });

  it('does not add beastformFeatures for non-Druid', () => {
    const data = {
      ...BASE,
      classId: 'srd-cls-bard',
      activeBeastform: { id: 'srd-bst-agile-scout' },
    };
    const srdData = {
      ...EMPTY_SRD,
      classesById: { 'srd-cls-bard': { name: 'Bard', class_features: [] } },
    };
    const out = recomputeCharacter(data, srdData);
    expect(out.beastformFeatures).toEqual([]);
  });

  it('adds beastformFeatures from V2 scoped featureState when legacy activeBeastform is absent', () => {
    const data = {
      ...BASE,
      classId: 'srd-cls-druid',
      featureState: {
        'classes:srd-cls-druid': {
          activeBeastform: { beastformId: 'srd-bst-stalking-arachnid', viaEvolution: false },
        },
      },
    };
    const srdData = {
      ...EMPTY_SRD,
      classesById: {
        'srd-cls-druid': {
          name: 'Druid',
          class_features: [{ name: 'Beastform', description: 'x' }],
        },
      },
    };
    const out = recomputeCharacter(data, srdData);
    expect(out.beastformFeatures?.map((f) => f.name)).toEqual(['Venomous Bite', 'Webslinger']);
    expect(out.beastformFeatures?.[0]?.source).toBe('Stalking Arachnid');
  });

  it('clears beastformFeatures when not transformed', () => {
    const data = {
      ...BASE,
      classId: 'srd-cls-druid',
      beastformFeatures: [{ name: 'stale', description: 'x', sourceType: 'beastform', source: 'x', id: 'stale' }],
    };
    const srdData = {
      ...EMPTY_SRD,
      classesById: {
        'srd-cls-druid': {
          name: 'Druid',
          class_features: [{ name: 'Beastform', description: 'x' }],
        },
      },
    };
    const out = recomputeCharacter(data, srdData);
    expect(out.beastformFeatures).toEqual([]);
  });

  it('adds active beastform evasion_bonus to result.evasion for Druid', () => {
    const data = {
      ...BASE,
      classId: 'srd-cls-druid',
      activeBeastform: { id: 'srd-bst-agile-scout', name: 'Agile Scout' },
    };
    const srdData = {
      ...EMPTY_SRD,
      classesById: {
        'srd-cls-druid': {
          name: 'Druid',
          starting_evasion: 10,
          class_features: [{ name: 'Beastform', description: 'x' }],
        },
      },
      beastformsById: {
        'srd-bst-agile-scout': {
          id: 'srd-bst-agile-scout',
          name: 'Agile Scout',
          evasion_bonus: 'Evasion +2',
          features: [{ id: 'x', name: 'Agile', description: 'd' }],
        },
      },
    };
    const out = recomputeCharacter(data, srdData);
    expect(out.evasion).toBe(12);
    expect(out.evasionIncludesActiveBeastformBonus).toBe(true);
  });
});
