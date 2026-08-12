import { describe, it, expect } from 'vitest';
import {
  addConditionsHistoryEntry,
  removeConditionsHistoryEntry,
  filterConditionsSuggestions,
  collectLiveConditionNames,
  mergeConditionSuggestionLists,
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

describe('collectLiveConditionNames', () => {
  it('collects unique names from characters, adversaries, and companions', () => {
    expect(
      collectLiveConditionNames([
        { elementType: 'character', conditions: 'Vulnerable, Hidden', companion: { conditions: 'Restrained' } },
        { elementType: 'adversary', conditions: 'vulnerable, On Fire' },
        { elementType: 'mapImage', conditions: 'Ignored' },
      ]),
    ).toEqual(['Vulnerable', 'Hidden', 'Restrained', 'On Fire']);
  });

  it('returns empty when nothing is applied', () => {
    expect(collectLiveConditionNames([])).toEqual([]);
    expect(collectLiveConditionNames(null)).toEqual([]);
  });
});

describe('mergeConditionSuggestionLists', () => {
  it('keeps history order and appends live-only names', () => {
    expect(mergeConditionSuggestionLists(['Hidden', 'Vulnerable'], ['Vulnerable', 'On Fire'])).toEqual([
      'Hidden',
      'Vulnerable',
      'On Fire',
    ]);
  });
});
