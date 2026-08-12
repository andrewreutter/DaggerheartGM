import { describe, it, expect } from 'vitest';
import {
  CONDITION_SYMBOLS,
  conditionSymbolAtIndex,
  conditionSymbolForName,
  conditionMarks,
} from '../../src/client/lib/condition-symbols.js';

describe('conditionSymbolAtIndex', () => {
  it('starts with an asterisk', () => {
    expect(conditionSymbolAtIndex(0)).toBe('*');
    expect(CONDITION_SYMBOLS[0]).toBe('*');
  });

  it('rotates through the list and wraps', () => {
    expect(conditionSymbolAtIndex(1)).toBe('†');
    expect(conditionSymbolAtIndex(CONDITION_SYMBOLS.length)).toBe('*');
    expect(conditionSymbolAtIndex(CONDITION_SYMBOLS.length + 1)).toBe('†');
  });

  it('falls back to asterisk for invalid indexes', () => {
    expect(conditionSymbolAtIndex(-1)).toBe('*');
    expect(conditionSymbolAtIndex(NaN)).toBe('*');
  });
});

describe('conditionSymbolForName', () => {
  it('is stable for the same name regardless of list position or casing', () => {
    const vulnerable = conditionSymbolForName('Vulnerable');
    expect(conditionSymbolForName('vulnerable')).toBe(vulnerable);
    expect(conditionSymbolForName('  Vulnerable  ')).toBe(vulnerable);
    expect(conditionMarks(['Hidden', 'Vulnerable'])[1].symbol).toBe(vulnerable);
    expect(conditionMarks(['Vulnerable'])[0].symbol).toBe(vulnerable);
  });

  it('returns a palette glyph and falls back to asterisk for empty names', () => {
    expect(CONDITION_SYMBOLS).toContain(conditionSymbolForName('On Fire'));
    expect(conditionSymbolForName('')).toBe('*');
    expect(conditionSymbolForName('   ')).toBe('*');
  });
});

describe('conditionMarks', () => {
  it('pairs each condition with the name-stable glyph', () => {
    const marks = conditionMarks('Vulnerable, Hidden, Restrained');
    expect(marks.map((m) => m.name)).toEqual(['Vulnerable', 'Hidden', 'Restrained']);
    expect(marks.map((m) => m.symbol)).toEqual([
      conditionSymbolForName('Vulnerable'),
      conditionSymbolForName('Hidden'),
      conditionSymbolForName('Restrained'),
    ]);
  });

  it('accepts an already-normalized list', () => {
    expect(conditionMarks(['Vulnerable', 'Hidden']).map((m) => m.name)).toEqual([
      'Vulnerable',
      'Hidden',
    ]);
  });

  it('returns empty for missing conditions', () => {
    expect(conditionMarks('')).toEqual([]);
    expect(conditionMarks(null)).toEqual([]);
    expect(conditionMarks(undefined)).toEqual([]);
  });
});
