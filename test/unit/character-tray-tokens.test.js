import { describe, it, expect } from 'vitest';
import { buildCharacterTrayTokenEntries, buildBoardTrayTokenEntries } from '../../src/client/lib/character-tray-tokens.js';
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

const board = (id, opts = {}) => ({
  instanceId: id,
  elementType: 'boardToken',
  tokenKind: 'companion',
  parentInstanceId: opts.parentInstanceId ?? 'parent-1',
  tokenX: opts.tokenX ?? null,
  tokenY: opts.tokenY ?? null,
  mapId: opts.mapId,
});

describe('buildBoardTrayTokenEntries', () => {
  // Regression test: a companion boardToken placed on the map used to disappear from the tray
  // entirely instead of showing as a dim proxy like a placed character does.
  it('shows a placed companion as a dim proxy on the active map instead of dropping it from the tray', () => {
    const active = 'map-a';
    const rows = [board('c1', { tokenX: 5, tokenY: 5, mapId: active })];
    const out = buildBoardTrayTokenEntries(rows, active, () => true);
    expect(out).toHaveLength(1);
    expect(out[0].isProxy).toBe(true);
    expect(out[0].isOtherMapShelf).toBe(false);
    expect(out[0].isMyCharacter).toBe(true);
  });

  it('marks a companion placed on a different map as an other-map-shelf proxy', () => {
    const rows = [board('c1', { tokenX: 5, tokenY: 5, mapId: 'map-b' })];
    const out = buildBoardTrayTokenEntries(rows, 'map-a', () => false);
    expect(out[0].isProxy).toBe(true);
    expect(out[0].isOtherMapShelf).toBe(true);
  });

  it('shows an unplaced companion as a non-proxy tray entry', () => {
    const rows = [board('c1', { tokenX: null })];
    const out = buildBoardTrayTokenEntries(rows, 'map-a', () => true);
    expect(out[0].isProxy).toBe(false);
    expect(out[0].isOtherMapShelf).toBe(false);
  });

  it('orders unplaced, then active-map proxies, then other-map proxies', () => {
    const active = 'map-a';
    const rows = [
      board('unplaced', { tokenX: null }),
      board('other-map', { tokenX: 1, tokenY: 1, mapId: 'map-b' }),
      board('active-map', { tokenX: 2, tokenY: 2, mapId: active }),
    ];
    const out = buildBoardTrayTokenEntries(rows, active, () => false);
    expect(out.map((x) => x.element.instanceId)).toEqual(['unplaced', 'active-map', 'other-map']);
  });
});
