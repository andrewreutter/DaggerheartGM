import { describe, it, expect } from 'vitest';
import { getGmTotMEmptyMapHint, getPlayerTotMEmptyMapHint } from '../../src/client/lib/battle-map-totm-hint.js';

describe('getGmTotMEmptyMapHint', () => {
  it('is false while table state is not ready', () => {
    expect(
      getGmTotMEmptyMapHint({
        tableStateReady: false,
        mapConfigHasImage: false,
      }),
    ).toBe(false);
  });

  it('is false when a map image is set', () => {
    expect(
      getGmTotMEmptyMapHint({
        tableStateReady: true,
        mapConfigHasImage: true,
      }),
    ).toBe(false);
  });

  it('is true when ready and there is no map art', () => {
    expect(
      getGmTotMEmptyMapHint({
        tableStateReady: true,
        mapConfigHasImage: false,
      }),
    ).toBe(true);
  });
});

describe('getPlayerTotMEmptyMapHint', () => {
  it('matches GM rule: ready and no map art', () => {
    expect(
      getPlayerTotMEmptyMapHint({
        tableStateReady: true,
        mapConfigHasImage: false,
      }),
    ).toBe(true);
  });
});
