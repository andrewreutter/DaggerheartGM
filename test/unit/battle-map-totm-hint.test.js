import { describe, it, expect } from 'vitest';
import { getGmTotMEmptyMapHint, getPlayerTotMEmptyMapHint } from '../../src/client/lib/battle-map-totm-hint.js';

describe('getGmTotMEmptyMapHint', () => {
  it('is false while table state is not ready', () => {
    expect(
      getGmTotMEmptyMapHint({
        tableStateReady: false,
        mapConfigHasImage: false,
        characterCount: 0,
        adversaryCount: 0,
      }),
    ).toBe(false);
  });

  it('is true when ready, no map art, and no combatants', () => {
    expect(
      getGmTotMEmptyMapHint({
        tableStateReady: true,
        mapConfigHasImage: false,
        characterCount: 0,
        adversaryCount: 0,
      }),
    ).toBe(true);
  });

  it('is false when any character exists on the table', () => {
    expect(
      getGmTotMEmptyMapHint({
        tableStateReady: true,
        mapConfigHasImage: false,
        characterCount: 1,
        adversaryCount: 0,
      }),
    ).toBe(false);
  });

  it('is false when any adversary exists on the table', () => {
    expect(
      getGmTotMEmptyMapHint({
        tableStateReady: true,
        mapConfigHasImage: false,
        characterCount: 0,
        adversaryCount: 2,
      }),
    ).toBe(false);
  });
});

describe('getPlayerTotMEmptyMapHint', () => {
  it('matches GM rule: no combatants, no map, ready', () => {
    expect(
      getPlayerTotMEmptyMapHint({
        tableStateReady: true,
        mapConfigHasImage: false,
        characterCount: 0,
        adversaryCount: 0,
      }),
    ).toBe(true);
  });
});
