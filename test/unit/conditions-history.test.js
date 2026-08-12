import { describe, it, expect } from 'vitest';
import {
  addConditionsHistoryEntry,
  removeConditionsHistoryEntry,
  filterConditionsSuggestions,
} from '../../src/client/lib/conditions-history.js';

describe('addConditionsHistoryEntry', () => {
  it('trims and prepends a new entry', () => {
    expect(addConditionsHistoryEntry(['Vulnerable'], '  Hidden  ')).toEqual(['Hidden', 'Vulnerable']);
  });

  it('dedupes case-insensitively and moves to front (MRU)', () => {
    expect(addConditionsHistoryEntry(['Vulnerable', 'Hidden'], 'vulnerable')).toEqual([
      'vulnerable',
      'Hidden',
    ]);
  });

  it('caps length at max', () => {
    const list = Array.from({ length: 5 }, (_, i) => `c${i}`);
    expect(addConditionsHistoryEntry(list, 'new', 3)).toEqual(['new', 'c0', 'c1']);
  });

  it('ignores empty/whitespace entries', () => {
    expect(addConditionsHistoryEntry(['A'], '   ')).toEqual(['A']);
    expect(addConditionsHistoryEntry(null, '')).toEqual([]);
  });
});

describe('removeConditionsHistoryEntry', () => {
  it('removes by case-insensitive match', () => {
    expect(removeConditionsHistoryEntry(['Hidden', 'Vulnerable'], 'hidden')).toEqual(['Vulnerable']);
  });

  it('returns a copy when entry missing', () => {
    const list = ['A'];
    const next = removeConditionsHistoryEntry(list, 'B');
    expect(next).toEqual(['A']);
    expect(next).not.toBe(list);
  });
});

describe('filterConditionsSuggestions', () => {
  const list = ['Vulnerable', 'Hidden', 'Restrained', 'Hidden Ally'];

  it('filters by substring and excludes applied chips', () => {
    expect(filterConditionsSuggestions(list, 'hid', ['Hidden'])).toEqual(['Hidden Ally']);
  });

  it('caps results', () => {
    expect(filterConditionsSuggestions(list, '', [], 2)).toEqual(['Vulnerable', 'Hidden']);
  });

  it('returns all when query empty (minus excludes)', () => {
    expect(filterConditionsSuggestions(list, '', ['Vulnerable', 'Restrained'])).toEqual([
      'Hidden',
      'Hidden Ally',
    ]);
  });
});
