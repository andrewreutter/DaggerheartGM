import { describe, it, expect } from 'vitest';
import {
  getGmTotMEmptyMapHint,
  getPlayerTotMEmptyMapHint,
  isPrepBuildStepDone,
  isPrepInviteStepDone,
  isPrepPlayStepDone,
  isPrepSessionActive,
} from '../../src/client/lib/battle-map-totm-hint.js';

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

describe('isPrepBuildStepDone', () => {
  it('is true when map has art', () => {
    expect(isPrepBuildStepDone({ mapConfigHasImage: true, maps: [], activeElements: [] })).toBe(true);
  });

  it('is false when a map row exists but has no image', () => {
    expect(isPrepBuildStepDone({ mapConfigHasImage: false, maps: [{ id: 'm1' }], activeElements: [] })).toBe(
      false,
    );
  });

  it('is true when a map row has a mapImageUrl', () => {
    expect(
      isPrepBuildStepDone({
        mapConfigHasImage: false,
        maps: [{ id: 'm1', mapImageUrl: 'https://example.com/map.png' }],
        activeElements: [],
      }),
    ).toBe(true);
  });

  it('is true when encounter content exists without map art', () => {
    expect(
      isPrepBuildStepDone({
        mapConfigHasImage: false,
        maps: [],
        activeElements: [{ elementType: 'adversary' }],
      }),
    ).toBe(true);
  });

  it('is true when a countdown exists', () => {
    expect(
      isPrepBuildStepDone({
        mapConfigHasImage: false,
        maps: [],
        activeElements: [],
        sessionCountdowns: [{ id: 'c1' }],
      }),
    ).toBe(true);
  });

  it('is true for notes', () => {
    expect(
      isPrepBuildStepDone({
        mapConfigHasImage: false,
        maps: [],
        activeElements: [{ elementType: 'note' }],
      }),
    ).toBe(true);
  });

  it('is false when empty and no map', () => {
    expect(isPrepBuildStepDone({ mapConfigHasImage: false, maps: [], activeElements: [] })).toBe(false);
  });

  it('does not treat characters alone as build-complete', () => {
    expect(
      isPrepBuildStepDone({
        mapConfigHasImage: false,
        maps: [],
        activeElements: [{ elementType: 'character' }],
      }),
    ).toBe(false);
  });
});

describe('isPrepInviteStepDone', () => {
  it('is true with invite link', () => {
    expect(isPrepInviteStepDone({ inviteLink: { token: 'abc' } })).toBe(true);
  });

  it('is false without invite link (players alone do not count)', () => {
    expect(isPrepInviteStepDone({ inviteLink: null })).toBe(false);
  });
});

describe('isPrepPlayStepDone / isPrepSessionActive', () => {
  it('tracks sessionStarted like prep mode', () => {
    expect(isPrepPlayStepDone({ sessionStarted: true })).toBe(true);
    expect(isPrepPlayStepDone({ sessionStarted: false })).toBe(false);
    expect(isPrepSessionActive({ sessionStarted: true })).toBe(true);
    expect(isPrepSessionActive({ sessionStarted: false })).toBe(false);
  });
});
