import { describe, it, expect } from 'vitest';
import { wrapHomeFeatureShotIndex } from '../../src/client/components/HomeFeatureShots.jsx';

describe('wrapHomeFeatureShotIndex', () => {
  it('advances forward and wraps from the last slide to the first', () => {
    expect(wrapHomeFeatureShotIndex(0, 6, 1)).toBe(1);
    expect(wrapHomeFeatureShotIndex(5, 6, 1)).toBe(0);
  });

  it('steps backward and wraps from the first slide to the last', () => {
    expect(wrapHomeFeatureShotIndex(0, 6, -1)).toBe(5);
    expect(wrapHomeFeatureShotIndex(2, 6, -1)).toBe(1);
  });

  it('clamps a direct select through modulo without changing the requested slide', () => {
    expect(wrapHomeFeatureShotIndex(3, 6, 0)).toBe(3);
    expect(wrapHomeFeatureShotIndex(8, 6, 0)).toBe(2);
  });

  it('returns 0 when the shot list is empty or not a positive length', () => {
    expect(wrapHomeFeatureShotIndex(2, 0, 1)).toBe(0);
    expect(wrapHomeFeatureShotIndex(2, -3, 1)).toBe(0);
    expect(wrapHomeFeatureShotIndex(2, Number.NaN, 1)).toBe(0);
  });
});
