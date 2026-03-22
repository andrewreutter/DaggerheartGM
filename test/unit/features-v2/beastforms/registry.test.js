import { describe, it, expect } from 'vitest';
import beastforms, { BEASTFORM_ITEMS, beastformsAtOrBelowTier } from '../../../../src/features-v2/beastforms/index.js';

describe('beastforms registry', () => {
  it('exports 24 SRD rows keyed by id', () => {
    expect(BEASTFORM_ITEMS.length).toBe(24);
    expect(Object.keys(beastforms).length).toBe(24);
    expect(beastforms['srd-bst-agile-scout']?.name).toBe('Agile Scout');
  });

  it('beastformsAtOrBelowTier(1) only includes tier-1 forms', () => {
    const list = beastformsAtOrBelowTier(1);
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((b) => b.tier === 1)).toBe(true);
  });

  it('merged Aquatic Scout through Mighty Strider rows expose SRD feature names', () => {
    const aquatic = beastforms['srd-bst-aquatic-scout'];
    expect(aquatic.features).toHaveLength(2);
    expect(aquatic.features[0].name).toBe('Aquatic');
    expect(aquatic.features[1].name).toBe('Fragile');
    expect(aquatic.features[1].id).toBe('srd-bst-aquatic-scout-feat-fragile');

    const spider = beastforms['srd-bst-stalking-arachnid'];
    expect(spider.features.map((f) => f.name)).toEqual(['Venomous Bite', 'Webslinger']);

    const armored = beastforms['srd-bst-armored-sentry'];
    expect(armored.features.map((f) => f.name)).toEqual(['Armored Shell', 'Cannonball']);

    const powerful = beastforms['srd-bst-powerful-beast'];
    expect(powerful.features.map((f) => f.name)).toEqual(['Rampage', 'Thick Hide']);

    const strider = beastforms['srd-bst-mighty-strider'];
    expect(strider.features.map((f) => f.name)).toEqual(['Carrier', 'Trample']);
  });

  it('merge rows (impl-k7nq batch): tier-2/3 SRD feature lists', () => {
    expect(beastforms['srd-bst-striking-serpent'].features.map((f) => f.name)).toEqual([
      'Venomous Strike',
      'Warning Hiss',
    ]);
    expect(beastforms['srd-bst-pouncing-predator'].features.map((f) => f.name)).toEqual([
      'Fleet',
      'Takedown',
    ]);
    expect(beastforms['srd-bst-winged-beast'].features.map((f) => f.name)).toEqual([
      "Bird's-Eye View",
      'Hollow Bones',
    ]);
    expect(beastforms['srd-bst-great-predator'].features.map((f) => f.name)).toEqual([
      'Carrier',
      'Vicious Maul',
    ]);
    expect(beastforms['srd-bst-mighty-lizard'].features.map((f) => f.name)).toEqual([
      'Physical Defense',
      'Snapping Strike',
    ]);
    expect(beastforms['srd-bst-great-winged-beast'].features.map((f) => f.name)).toEqual([
      "Bird's-Eye View",
      'Carrier',
    ]);
    expect(beastforms['srd-bst-aquatic-predator'].features.map((f) => f.name)).toEqual([
      'Aquatic',
      'Vicious Maul',
    ]);
    expect(beastforms['srd-bst-legendary-beast'].features.map((f) => f.name)).toEqual(['Evolved']);
    expect(beastforms['srd-bst-legendary-hybrid'].features.map((f) => f.name)).toEqual([
      'Hybrid Features',
    ]);
  });

  it('merge tier-4 beastform rows (impl-h4qt batch)', () => {
    expect(beastforms['srd-bst-massive-behemoth'].features.map((f) => f.name)).toEqual([
      'Carrier',
      'Demolish',
      'Undaunted',
    ]);
    expect(beastforms['srd-bst-terrible-lizard'].features.map((f) => f.name)).toEqual([
      'Devastating Strikes',
      'Massive Stride',
    ]);
    expect(beastforms['srd-bst-mythic-aerial-hunter'].features.map((f) => f.name)).toEqual([
      'Carrier',
      'Deadly Raptor',
    ]);
    expect(beastforms['srd-bst-epic-aquatic-beast'].features.map((f) => f.name)).toEqual([
      'Ocean Master',
      'Unyielding',
    ]);
    expect(beastforms['srd-bst-mythic-beast'].features.map((f) => f.name)).toEqual(['Evolved']);
    expect(beastforms['srd-bst-mythic-hybrid'].features.map((f) => f.name)).toEqual(['Hybrid Features']);
  });
});
