import { describe, it, expect } from 'vitest';
import { buildMapStripTileTokenSignature } from '../../src/client/lib/map-strip-tile-signature.js';

const charOnMap1 = {
  instanceId: 'c1',
  elementType: 'character',
  mapId: 'map1',
  tokenX: 5,
  tokenY: 10,
  name: 'Fenn',
  currentHp: 3,
};

const advOnMap2 = {
  instanceId: 'a1',
  elementType: 'adversary',
  mapId: 'map2',
  tokenX: 1,
  tokenY: 1,
  name: 'Goblin',
  currentHp: 2,
};

const unplacedChar = {
  instanceId: 'c2',
  elementType: 'character',
  mapId: 'map1',
  tokenX: null,
  tokenY: null,
  name: 'Unplaced',
};

describe('buildMapStripTileTokenSignature', () => {
  it('returns empty string for a null stripMapId or non-array input', () => {
    expect(buildMapStripTileTokenSignature([charOnMap1], null)).toBe('');
    expect(buildMapStripTileTokenSignature(undefined, 'map1')).toBe('');
  });

  it('only includes tokens placed on the given map', () => {
    const sig1 = buildMapStripTileTokenSignature([charOnMap1, advOnMap2], 'map1');
    expect(sig1).toContain('c1');
    expect(sig1).not.toContain('a1');

    const sig2 = buildMapStripTileTokenSignature([charOnMap1, advOnMap2], 'map2');
    expect(sig2).toContain('a1');
    expect(sig2).not.toContain('c1');
  });

  it('excludes unplaced tokens (null tokenX/tokenY) and non-token element types', () => {
    const sig = buildMapStripTileTokenSignature([unplacedChar, { elementType: 'environment', mapId: 'map1' }], 'map1');
    expect(sig).toBe('');
  });

  it('is stable across calls for the same inputs (order-independent identity, value-based)', () => {
    const a = [charOnMap1, advOnMap2];
    const b = [{ ...charOnMap1 }, { ...advOnMap2 }];
    expect(buildMapStripTileTokenSignature(a, 'map1')).toBe(buildMapStripTileTokenSignature(b, 'map1'));
  });

  it('changes when a relevant field on an on-map token changes', () => {
    const sigBefore = buildMapStripTileTokenSignature([charOnMap1], 'map1');
    const moved = { ...charOnMap1, tokenX: 6 };
    const sigAfter = buildMapStripTileTokenSignature([moved], 'map1');
    expect(sigBefore).not.toBe(sigAfter);
  });

  it('does not change when an unrelated token on a different map changes', () => {
    const sigBefore = buildMapStripTileTokenSignature([charOnMap1, advOnMap2], 'map1');
    const advMoved = { ...advOnMap2, tokenX: 99 };
    const sigAfter = buildMapStripTileTokenSignature([charOnMap1, advMoved], 'map1');
    expect(sigBefore).toBe(sigAfter);
  });
});
