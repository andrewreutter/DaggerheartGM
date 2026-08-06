import { describe, it, expect } from 'vitest';
import { decomposeD100Digits, buildD100Groups } from '../../src/client/lib/dice-color-groups.js';

describe('decomposeD100Digits', () => {
  it('decomposes 1 → tensDigit 0, onesDigit 1', () => {
    expect(decomposeD100Digits(1)).toEqual({ tensDigit: 0, onesDigit: 1 });
  });

  it('decomposes 9 → tensDigit 0, onesDigit 9', () => {
    expect(decomposeD100Digits(9)).toEqual({ tensDigit: 0, onesDigit: 9 });
  });

  it('decomposes 10 → tensDigit 1, onesDigit 0', () => {
    expect(decomposeD100Digits(10)).toEqual({ tensDigit: 1, onesDigit: 0 });
  });

  it('decomposes 50 → tensDigit 5, onesDigit 0', () => {
    expect(decomposeD100Digits(50)).toEqual({ tensDigit: 5, onesDigit: 0 });
  });

  it('decomposes 99 → tensDigit 9, onesDigit 9', () => {
    expect(decomposeD100Digits(99)).toEqual({ tensDigit: 9, onesDigit: 9 });
  });

  it('decomposes 100 → tensDigit 0, onesDigit 0 (the "00"+"0" face convention)', () => {
    expect(decomposeD100Digits(100)).toEqual({ tensDigit: 0, onesDigit: 0 });
  });

  it('handles string input by coercing to number', () => {
    expect(decomposeD100Digits('37')).toEqual({ tensDigit: 3, onesDigit: 7 });
  });
});

describe('buildD100Groups', () => {
  it('returns two groups for a single-die array', () => {
    const groups = buildD100Groups([57]);
    expect(groups).toHaveLength(2);
    expect(groups[0].sides).toBe(100);
    expect(groups[1].sides).toBe(10);
  });

  it('each group qty matches the number of values passed', () => {
    const groups = buildD100Groups([10, 30, 100]);
    expect(groups[0].qty).toBe(3);
    expect(groups[1].qty).toBe(3);
  });

  it('tens group values are the correct tens digits', () => {
    const groups = buildD100Groups([10, 57, 100]);
    expect(groups[0].values).toEqual([1, 5, 0]);
  });

  it('ones group values are the correct ones digits', () => {
    const groups = buildD100Groups([10, 57, 100]);
    expect(groups[1].values).toEqual([0, 7, 0]);
  });

  it('passes the label option to both groups', () => {
    const groups = buildD100Groups([42], { label: 'Percentile' });
    expect(groups[0].label).toBe('Percentile');
    expect(groups[1].label).toBe('Percentile');
  });

  it('defaults label to null when not specified', () => {
    const groups = buildD100Groups([42]);
    expect(groups[0].label).toBeNull();
    expect(groups[1].label).toBeNull();
  });

  it('produces matching-length tens and ones arrays for multi-die inputs', () => {
    const values = [1, 20, 99, 100, 50];
    const groups = buildD100Groups(values);
    expect(groups[0].values).toHaveLength(values.length);
    expect(groups[1].values).toHaveLength(values.length);
  });
});
