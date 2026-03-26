import { describe, it, expect } from 'vitest';
import {
  traitScoreNumberColorClass,
  traitScoreNumberIsLargeMagnitude,
  traitScoreNumberSizeClassTraitChip,
  traitScoreNumberSizeClassReactionGrid,
  traitScoreNumberSizeClassWeaponBadge,
} from '../../src/client/lib/trait-score-display.js';

describe('traitScoreNumberColorClass', () => {
  it('uses softened red / green (between pale and saturated)', () => {
    expect(traitScoreNumberColorClass(-2)).toContain('text-red-200');
    expect(traitScoreNumberColorClass(-2)).toContain('dh-light:text-red-800');
    expect(traitScoreNumberColorClass(1)).toContain('text-emerald-200');
    expect(traitScoreNumberColorClass(1)).toContain('dh-light:text-emerald-800');
  });

  it('uses neutral for zero', () => {
    expect(traitScoreNumberColorClass(0)).toBe('text-dh');
  });
});

describe('traitScoreNumberIsLargeMagnitude', () => {
  it('is small for 0 and +1 only', () => {
    expect(traitScoreNumberIsLargeMagnitude(0)).toBe(false);
    expect(traitScoreNumberIsLargeMagnitude(1)).toBe(false);
  });

  it('is large for negatives and +2+', () => {
    expect(traitScoreNumberIsLargeMagnitude(-1)).toBe(true);
    expect(traitScoreNumberIsLargeMagnitude(2)).toBe(true);
    expect(traitScoreNumberIsLargeMagnitude(3)).toBe(true);
  });
});

describe('traitScoreNumberSizeClassTraitChip', () => {
  it('makes 0 smaller than +1', () => {
    expect(traitScoreNumberSizeClassTraitChip(0)).toBe('text-lg');
    expect(traitScoreNumberSizeClassTraitChip(1)).toBe('text-xl');
  });

  it('uses 2xl for large magnitudes', () => {
    expect(traitScoreNumberSizeClassTraitChip(-1)).toBe('text-2xl');
    expect(traitScoreNumberSizeClassTraitChip(2)).toBe('text-2xl');
  });
});

describe('traitScoreNumberSizeClassReactionGrid', () => {
  it('tiers 0 / +1 / large for non-compact', () => {
    expect(traitScoreNumberSizeClassReactionGrid(0, false)).toBe('text-[9px]');
    expect(traitScoreNumberSizeClassReactionGrid(1, false)).toBe('text-[10px]');
    expect(traitScoreNumberSizeClassReactionGrid(2, false)).toBe('text-[12px]');
  });
});

describe('traitScoreNumberSizeClassWeaponBadge', () => {
  it('tiers 0 / +1 / large', () => {
    expect(traitScoreNumberSizeClassWeaponBadge(0)).toBe('text-[7px]');
    expect(traitScoreNumberSizeClassWeaponBadge(1)).toBe('text-[8px]');
    expect(traitScoreNumberSizeClassWeaponBadge(2)).toBe('text-[9px]');
  });
});
