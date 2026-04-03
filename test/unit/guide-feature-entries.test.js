import { describe, it, expect } from 'vitest';
import {
  getOrderedGuideFeatureEntries,
  getOrderedGuideLoadoutEntries,
  resolveLoadoutAbilityFeatRow,
} from '../../src/client/lib/guide-feature-entries.js';

describe('getOrderedGuideFeatureEntries', () => {
  it('uses SRD base row when merged activeFeatures row has hideFromGuideFeatureList', () => {
    const el = {
      subclassFeatures: [{ name: 'Shadow Step', description: 'SRD text', id: 'sub-1' }],
      activeFeatures: [
        {
          name: 'Shadow Step',
          type: 'subclass',
          description: 'Registry duplicate for sheet cards only',
          hideFromGuideFeatureList: true,
          cards: [{ _sheetCardKind: 'x' }],
        },
      ],
    };
    const entries = getOrderedGuideFeatureEntries(el, () => {});
    const sub = entries.find((e) => e.key === 'sub-1');
    expect(sub).toBeDefined();
    expect(sub.row.description).toBe('SRD text');
    expect(sub.row.hideFromGuideFeatureList).toBeUndefined();
  });

  it('matches activeFeatures by multiclass when merging class rows with the same name', () => {
    const el = {
      classFeatures: [
        { name: 'FeatA', description: 'Primary SRD', source: 'Bard', id: 'c1' },
        { name: 'FeatA', description: 'Multiclass SRD', _multiclass: true, source: 'Rogue', id: 'c2' },
      ],
      activeFeatures: [
        { name: 'FeatA', type: 'class', description: 'Merged primary', chips: [] },
        { name: 'FeatA', type: 'class', description: 'Merged mc', chips: [], _multiclass: true },
      ],
    };
    const entries = getOrderedGuideFeatureEntries(el, () => {});
    const primary = entries.find((e) => e.key === 'c1');
    const mc = entries.find((e) => e.key === 'c2');
    expect(primary.row.description).toBe('Merged primary');
    expect(mc.row.description).toBe('Merged mc');
    expect(mc.row.source).toBe('Rogue');
  });

  it('merges subclass row from activeFeatures when present', () => {
    const el = {
      subclassFeatures: [{ name: 'Companion', description: 'SRD', id: 'c1' }],
      activeFeatures: [
        {
          name: 'Companion',
          type: 'subclass',
          description: 'Merged',
          cards: [],
        },
      ],
    };
    const entries = getOrderedGuideFeatureEntries(el, () => {});
    const sub = entries.find((e) => e.key === 'c1');
    expect(sub.row.description).toBe('Merged');
  });

  it('does not unshift hope row when hope feature is hideFromGuideFeatureList', () => {
    const el = {
      classFeatures: [],
      hopeAbilityName: 'Rally',
      activeFeatures: [
        {
          name: 'Rally',
          type: 'class',
          chips: [{ name: 'Rally', placements: ['card'] }],
          hideFromGuideFeatureList: true,
        },
      ],
    };
    const entries = getOrderedGuideFeatureEntries(el, () => true);
    expect(entries.some((e) => e.key === 'hope-Rally')).toBe(false);
  });
});

describe('getOrderedGuideLoadoutEntries / resolveLoadoutAbilityFeatRow', () => {
  it('orders abilities with stable keys ability-{id|index}', () => {
    const el = {
      abilities: [
        { id: 'a1', name: 'Spell A', domain: 'Arcana', type: 'Spell', level: 1 },
        { name: 'Spell B', domain: 'Bone', type: 'Spell', level: 2 },
      ],
      activeFeatures: [],
    };
    const entries = getOrderedGuideLoadoutEntries(el);
    expect(entries).toHaveLength(2);
    expect(entries[0].key).toBe('ability-a1');
    expect(entries[1].key).toBe('ability-1');
    expect(entries[0].kind).toBe('loadout');
    expect(entries[0].ability).toBe(el.abilities[0]);
  });

  it('merges activeFeatures ability row when names match', () => {
    const merged = { name: 'Merged', type: 'ability', description: 'from registry', chips: [] };
    const el = {
      abilities: [{ id: 'x', name: 'Merged', domain: 'Arcana', type: 'Spell', level: 3 }],
      activeFeatures: [merged],
    };
    const row = resolveLoadoutAbilityFeatRow(el, el.abilities[0]);
    expect(row).toBe(merged);
  });
});
