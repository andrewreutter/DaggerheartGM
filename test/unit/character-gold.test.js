import { describe, it, expect } from 'vitest';
import {
  goldToSlots,
  isGoldOverSrdCap,
  formatGold,
  addGoldPlace,
  GOLD_PLACE,
  parseGoldInput,
} from '../../src/client/lib/character-gold.js';

describe('goldToSlots', () => {
  it('maps ones/tens/hundreds to handfuls/bags/chests', () => {
    expect(goldToSlots(465)).toEqual({ chests: 4, bags: 6, handfuls: 5 });
    expect(goldToSlots(0)).toEqual({ chests: 0, bags: 0, handfuls: 0 });
    expect(goldToSlots(9)).toEqual({ chests: 0, bags: 0, handfuls: 9 });
    expect(goldToSlots(10)).toEqual({ chests: 0, bags: 1, handfuls: 0 });
    expect(goldToSlots(100)).toEqual({ chests: 1, bags: 0, handfuls: 0 });
  });

  it('floors negatives and non-integers to 0 / integer gold', () => {
    expect(goldToSlots(-3)).toEqual({ chests: 0, bags: 0, handfuls: 0 });
    expect(goldToSlots(12.9)).toEqual({ chests: 0, bags: 1, handfuls: 2 });
    expect(goldToSlots(null)).toEqual({ chests: 0, bags: 0, handfuls: 0 });
  });

  it('allows more than 9 chests (no hundred-digit ceiling)', () => {
    expect(goldToSlots(1234)).toEqual({ chests: 12, bags: 3, handfuls: 4 });
  });
});

describe('isGoldOverSrdCap', () => {
  it('is false at 1 chest and true above', () => {
    expect(isGoldOverSrdCap(199)).toBe(false);
    expect(isGoldOverSrdCap(100)).toBe(false);
    expect(isGoldOverSrdCap(200)).toBe(true);
    expect(isGoldOverSrdCap(465)).toBe(true);
  });
});

describe('formatGold', () => {
  it('joins only non-zero denominations and always includes handfuls when empty', () => {
    expect(formatGold(465)).toBe('4 chests, 6 bags, 5 handfuls');
    expect(formatGold(100)).toBe('1 chest');
    expect(formatGold(1)).toBe('1 handful');
    expect(formatGold(0)).toBe('0 handfuls');
    expect(formatGold(20)).toBe('2 bags');
  });
});

describe('addGoldPlace', () => {
  it('adds and subtracts place values with ordinary carry/borrow, floored at 0', () => {
    expect(addGoldPlace(9, GOLD_PLACE.handfuls, 1)).toBe(10);
    expect(addGoldPlace(10, GOLD_PLACE.handfuls, -1)).toBe(9);
    expect(addGoldPlace(0, GOLD_PLACE.bags, -1)).toBe(0);
    expect(addGoldPlace(5, GOLD_PLACE.chests, 1)).toBe(105);
  });
});

describe('parseGoldInput', () => {
  it('reads a digit string as a non-negative integer', () => {
    expect(parseGoldInput('187')).toBe(187);
    expect(parseGoldInput('0')).toBe(0);
    expect(parseGoldInput('005')).toBe(5);
  });

  it('strips non-digits and treats empty as 0', () => {
    expect(parseGoldInput('')).toBe(0);
    expect(parseGoldInput('  ')).toBe(0);
    expect(parseGoldInput('1a8b7')).toBe(187);
    expect(parseGoldInput(null)).toBe(0);
  });
});
