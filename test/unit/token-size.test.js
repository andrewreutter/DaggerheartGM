import { describe, it, expect } from 'vitest';
import {
  TOKEN_SIZE_MIN,
  TOKEN_SIZE_MAX,
  roundTokenSizeMultiplier,
  getTokenSizeMultipliers,
  getTokenFootprintFt,
  computeTokenRenderPx,
  buildTokenSizeUpdate,
  buildTokenSizeLinkToggleUpdate,
} from '../../src/client/lib/token-size.js';

describe('roundTokenSizeMultiplier', () => {
  it('rounds to the nearest 0.1 step', () => {
    expect(roundTokenSizeMultiplier(1.45)).toBe(1.5);
    expect(roundTokenSizeMultiplier(1.44)).toBe(1.4);
  });

  it('clamps to [MIN, MAX]', () => {
    expect(roundTokenSizeMultiplier(0)).toBe(TOKEN_SIZE_MIN);
    expect(roundTokenSizeMultiplier(-5)).toBe(TOKEN_SIZE_MIN);
    expect(roundTokenSizeMultiplier(999)).toBe(TOKEN_SIZE_MAX);
  });

  it('defaults invalid input to 1', () => {
    expect(roundTokenSizeMultiplier(undefined)).toBe(1);
    expect(roundTokenSizeMultiplier(NaN)).toBe(1);
    expect(roundTokenSizeMultiplier('abc')).toBe(1);
  });
});

describe('getTokenSizeMultipliers', () => {
  it('defaults to width=1, length=1, linked=true for missing/invalid source', () => {
    expect(getTokenSizeMultipliers(null)).toEqual({ width: 1, length: 1, linked: true });
    expect(getTokenSizeMultipliers(undefined)).toEqual({ width: 1, length: 1, linked: true });
    expect(getTokenSizeMultipliers({})).toEqual({ width: 1, length: 1, linked: true });
  });

  it('reads and rounds explicit fields', () => {
    expect(getTokenSizeMultipliers({ tokenSizeWidth: 1.44, tokenSizeLength: 2, tokenSizeLinked: false })).toEqual({
      width: 1.4,
      length: 2,
      linked: false,
    });
  });

  it('treats tokenSizeLinked !== false as linked', () => {
    expect(getTokenSizeMultipliers({ tokenSizeLinked: undefined }).linked).toBe(true);
    expect(getTokenSizeMultipliers({ tokenSizeLinked: true }).linked).toBe(true);
    expect(getTokenSizeMultipliers({ tokenSizeLinked: false }).linked).toBe(false);
  });
});

describe('getTokenFootprintFt', () => {
  it('returns the default 2.5/2.5 footprint for a default-sized token', () => {
    expect(getTokenFootprintFt(null)).toEqual({ halfWidth: 2.5, halfLength: 2.5 });
    expect(getTokenFootprintFt({})).toEqual({ halfWidth: 2.5, halfLength: 2.5 });
  });

  it('scales footprint by the size multipliers', () => {
    expect(getTokenFootprintFt({ tokenSizeWidth: 2, tokenSizeLength: 0.5 })).toEqual({
      halfWidth: 5,
      halfLength: 1.25,
    });
  });
});

describe('computeTokenRenderPx', () => {
  it('reproduces the base size exactly for default-sized tokens', () => {
    expect(computeTokenRenderPx(40, null)).toEqual({ widthPx: 40, heightPx: 40 });
  });

  it('scales width/height independently', () => {
    expect(computeTokenRenderPx(40, { tokenSizeWidth: 1.5, tokenSizeLength: 2 })).toEqual({
      widthPx: 60,
      heightPx: 80,
    });
  });

  it('floors at 1px', () => {
    expect(computeTokenRenderPx(0, { tokenSizeWidth: 1, tokenSizeLength: 1 })).toEqual({
      widthPx: 1,
      heightPx: 1,
    });
  });
});

describe('buildTokenSizeUpdate', () => {
  it('when linked, changing width also updates length', () => {
    const current = { tokenSizeWidth: 1, tokenSizeLength: 1, tokenSizeLinked: true };
    expect(buildTokenSizeUpdate(current, { axis: 'width', value: 2 })).toEqual({
      tokenSizeWidth: 2,
      tokenSizeLength: 2,
    });
  });

  it('when linked, changing length also updates width', () => {
    const current = { tokenSizeWidth: 1, tokenSizeLength: 1, tokenSizeLinked: true };
    expect(buildTokenSizeUpdate(current, { axis: 'length', value: 3 })).toEqual({
      tokenSizeWidth: 3,
      tokenSizeLength: 3,
    });
  });

  it('when unlinked, only patches the changed axis', () => {
    const current = { tokenSizeWidth: 1, tokenSizeLength: 1, tokenSizeLinked: false };
    expect(buildTokenSizeUpdate(current, { axis: 'width', value: 2 })).toEqual({ tokenSizeWidth: 2 });
    expect(buildTokenSizeUpdate(current, { axis: 'length', value: 3 })).toEqual({ tokenSizeLength: 3 });
  });
});

describe('buildTokenSizeLinkToggleUpdate', () => {
  it('turning link on snaps length to width', () => {
    const current = { tokenSizeWidth: 1.5, tokenSizeLength: 3, tokenSizeLinked: false };
    expect(buildTokenSizeLinkToggleUpdate(current, true)).toEqual({
      tokenSizeLinked: true,
      tokenSizeWidth: 1.5,
      tokenSizeLength: 1.5,
    });
  });

  it('turning link off only flips the flag', () => {
    const current = { tokenSizeWidth: 1.5, tokenSizeLength: 3, tokenSizeLinked: true };
    expect(buildTokenSizeLinkToggleUpdate(current, false)).toEqual({ tokenSizeLinked: false });
  });
});
