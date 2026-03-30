import { describe, it, expect } from 'vitest';
import { buildCharacterTrayTokenEntries } from '../../src/client/lib/character-tray-tokens.js';
import { DEFAULT_LEGACY_MAP_ID } from '../../src/client/lib/map-table-state.js';

const char = (id, name, opts = {}) => ({
  instanceId: id,
  elementType: 'character',
  name,
  tokenX: opts.tokenX ?? null,
  tokenY: opts.tokenY ?? null,
  mapId: opts.mapId,
});

describe('buildCharacterTrayTokenEntries', () => {
  it('orders unplaced, then active map proxies, then other-map proxies', () => {
    const active = 'map-a';
    const mine = () => false;
    const rows = [
      char('1', 'Zed', { tokenX: 1, tokenY: 1, mapId: 'map-b' }),
      char('2', 'Ann', { tokenX: null }),
      char('3', 'Bob', { tokenX: 2, tokenY: 2, mapId: active }),
      char('4', 'Cara', { tokenX: 3, tokenY: 1, mapId: 'map-b' }),
    ];
    const out = buildCharacterTrayTokenEntries(rows, active, mine);
    expect(out.map((x) => x.element.name)).toEqual(['Ann', 'Bob', 'Cara', 'Zed']);
    expect(out[0].isProxy).toBe(false);
    expect(out[1].isProxy && !out[1].isOtherMapShelf).toBe(true);
    expect(out[2].isOtherMapShelf).toBe(true);
    expect(out[3].isOtherMapShelf).toBe(true);
  });

  it('treats legacy null mapId as default map id for grouping', () => {
    const rows = [
      char('1', 'A', { tokenX: 1, tokenY: 1, mapId: null }),
      char('2', 'B', { tokenX: 2, tokenY: 2, mapId: 'other' }),
    ];
    const outDefault = buildCharacterTrayTokenEntries(rows, DEFAULT_LEGACY_MAP_ID, () => false);
    expect(outDefault[0].element.name).toBe('A');
    expect(outDefault[0].isOtherMapShelf).toBe(false);
    expect(outDefault[1].isOtherMapShelf).toBe(true);
  });
});
