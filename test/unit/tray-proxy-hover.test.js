import { describe, it, expect } from 'vitest';
import {
  trayProxyShouldSnapBullseye,
  bullseyeFtForPlacedTokenHover,
  shouldPinTokenOnClick,
} from '../../src/client/lib/tray-proxy-hover.js';

describe('trayProxyShouldSnapBullseye', () => {
  it('snaps only for active-map proxies (not unplaced or other-map shelf)', () => {
    expect(trayProxyShouldSnapBullseye({ isProxy: true, isOtherMapShelf: false })).toBe(true);
    expect(trayProxyShouldSnapBullseye({ isProxy: false, isOtherMapShelf: false })).toBe(false);
    expect(trayProxyShouldSnapBullseye({ isProxy: true, isOtherMapShelf: true })).toBe(false);
    expect(trayProxyShouldSnapBullseye({})).toBe(false);
  });
});

describe('bullseyeFtForPlacedTokenHover', () => {
  it('returns null when the token is not placed or footprint is missing', () => {
    expect(bullseyeFtForPlacedTokenHover({ instanceId: 'a', tokenX: null, tokenY: null }, { halfWidth: 2.5, halfLength: 2.5 })).toBeNull();
    expect(bullseyeFtForPlacedTokenHover({ instanceId: 'a', tokenX: 10, tokenY: 20 }, null)).toBeNull();
    expect(bullseyeFtForPlacedTokenHover(null, { halfWidth: 2.5, halfLength: 2.5 })).toBeNull();
  });

  it('snaps to token center with altitude and excludeInstanceId (same shape as map hover)', () => {
    const snap = bullseyeFtForPlacedTokenHover(
      { instanceId: 'tok-1', tokenX: 10, tokenY: 20, altitude: 15 },
      { halfWidth: 2.5, halfLength: 5 },
    );
    expect(snap).toEqual({
      x: 12.5,
      y: 25,
      altitude: 15,
      excludeInstanceId: 'tok-1',
    });
  });

  it('defaults altitude to 0 when unset', () => {
    const snap = bullseyeFtForPlacedTokenHover(
      { instanceId: 'tok-2', tokenX: 0, tokenY: 0 },
      { halfWidth: 2.5, halfLength: 2.5 },
    );
    expect(snap.altitude).toBe(0);
  });
});

describe('shouldPinTokenOnClick', () => {
  it('does not pin tray adversaries (hover overlay owns that surface)', () => {
    expect(shouldPinTokenOnClick({ fromTray: true, elementType: 'adversary' })).toBe(false);
  });

  it('still allows pin for map tokens and non-adversary tray tokens', () => {
    expect(shouldPinTokenOnClick({ fromTray: false, elementType: 'adversary' })).toBe(true);
    expect(shouldPinTokenOnClick({ fromTray: true, elementType: 'character' })).toBe(true);
    expect(shouldPinTokenOnClick({ fromTray: true, elementType: 'boardToken' })).toBe(true);
    expect(shouldPinTokenOnClick({})).toBe(true);
  });
});
