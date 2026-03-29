import { describe, it, expect } from 'vitest';
import { coerceEnvironmentType, coerceEnvironmentTier } from '../../src/client/lib/environment-coerce.js';

describe('coerceEnvironmentType', () => {
  it('defaults undefined/empty to exploration', () => {
    expect(coerceEnvironmentType(undefined)).toBe('exploration');
    expect(coerceEnvironmentType('')).toBe('exploration');
  });

  it('does not treat the string "undefined" as valid', () => {
    expect(coerceEnvironmentType('undefined')).toBe('exploration');
  });

  it('normalizes known aliases', () => {
    expect(coerceEnvironmentType('EVENT')).toBe('event');
  });
});

describe('coerceEnvironmentTier', () => {
  it('parses valid tiers', () => {
    expect(coerceEnvironmentTier(2)).toBe(2);
    expect(coerceEnvironmentTier('3')).toBe(3);
  });

  it('returns null for out-of-range tier', () => {
    expect(coerceEnvironmentTier(99)).toBeNull();
  });
});
