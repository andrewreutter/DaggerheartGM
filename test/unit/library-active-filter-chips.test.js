import { describe, it, expect } from 'vitest';
import {
  getActiveLibraryFilterChipSpecs,
  applyLibraryFilterChipClear,
  formatIncludesForChipLabel,
} from '../../src/client/lib/library-active-filter-chips.js';
import { LIBRARY_DEFAULT_INCLUDES } from '../../src/client/lib/library-default-filters.js';

describe('formatIncludesForChipLabel', () => {
  it('maps empty to All', () => {
    expect(formatIncludesForChipLabel([])).toBe('All');
  });

  it('maps legacy includes to the active single-select mode label', () => {
    expect(formatIncludesForChipLabel(['own', 'hod'])).toBe('Mine');
  });
});

describe('getActiveLibraryFilterChipSpecs', () => {
  it('shows search text in the label', () => {
    const specs = getActiveLibraryFilterChipSpecs(
      { includes: [...LIBRARY_DEFAULT_INCLUDES], tiers: [], types: [], extraTypes: [], search: '  dragon  ' },
      'adversaries'
    );
    expect(specs).toEqual([expect.objectContaining({ kind: 'resetSearch', label: 'Search: "dragon"' })]);
  });

  it('does not chip default Mine+SRD sources', () => {
    const specs = getActiveLibraryFilterChipSpecs(
      { includes: ['own', 'srd'], tiers: [], types: [], extraTypes: [], search: '' },
      'adversaries'
    );
    expect(specs.some(s => s.kind === 'resetIncludes')).toBe(false);
  });

  it('shows Source with current value when includes differ from default', () => {
    const specs = getActiveLibraryFilterChipSpecs(
      { includes: [], tiers: [], types: [], extraTypes: [], search: '' },
      'adversaries'
    );
    expect(specs).toEqual([expect.objectContaining({ kind: 'resetIncludes', label: 'Source: All' })]);
  });

  it('returns one Tier chip listing selected tier', () => {
    const specs = getActiveLibraryFilterChipSpecs(
      {
        includes: [...LIBRARY_DEFAULT_INCLUDES],
        tiers: [2],
        types: [],
        extraTypes: [],
        search: '',
      },
      'adversaries'
    );
    expect(specs.filter(s => s.kind === 'resetTier')).toHaveLength(1);
    expect(specs.find(s => s.kind === 'resetTier').label).toBe('Tier: 2');
  });

  it('merges scaled-up into the Tier chip for adversaries', () => {
    const specs = getActiveLibraryFilterChipSpecs(
      {
        includes: [...LIBRARY_DEFAULT_INCLUDES],
        tiers: [2],
        types: [],
        extraTypes: [],
        search: '',
        includeScaledUp: true,
      },
      'adversaries'
    );
    expect(specs.map(s => s.kind)).toEqual(['resetTier']);
    expect(specs.find(s => s.kind === 'resetTier').label).toBe('Tier: 2 (scaled up)');
  });

  it('uses Level label and value for abilities', () => {
    const specs = getActiveLibraryFilterChipSpecs(
      { includes: [...LIBRARY_DEFAULT_INCLUDES], tiers: [3], types: [], extraTypes: [], search: '' },
      'abilities'
    );
    expect(specs.find(s => s.kind === 'resetTier').label).toBe('Level: 3');
  });

  it('includes type row value when set (single-select)', () => {
    const specs = getActiveLibraryFilterChipSpecs(
      {
        includes: [...LIBRARY_DEFAULT_INCLUDES],
        tiers: [],
        types: ['solo'],
        extraTypes: [],
        search: '',
      },
      'adversaries'
    );
    expect(specs.find(s => s.kind === 'resetType').label).toBe('Role: Solo');
  });

  it('formats features scope type chip labels with spaces', () => {
    const specs = getActiveLibraryFilterChipSpecs(
      {
        includes: [...LIBRARY_DEFAULT_INCLUDES],
        tiers: [],
        types: ['weapon_properties'],
        extraTypes: [],
        search: '',
      },
      'features'
    );
    expect(specs.find(s => s.kind === 'resetType').label).toBe('Scope: Weapon Properties');
  });
});

describe('applyLibraryFilterChipClear', () => {
  it('dispatches setFilter to reset each dimension', () => {
    const calls = [];
    const setFilter = (k, v) => calls.push([k, v]);

    applyLibraryFilterChipClear({ kind: 'resetSearch' }, setFilter);
    applyLibraryFilterChipClear({ kind: 'resetIncludes' }, setFilter);
    applyLibraryFilterChipClear({ kind: 'resetTier' }, setFilter);
    applyLibraryFilterChipClear({ kind: 'resetType' }, setFilter);
    applyLibraryFilterChipClear({ kind: 'resetExtraType' }, setFilter);
    applyLibraryFilterChipClear({ kind: 'resetIncludeScaled' }, setFilter);

    expect(calls).toEqual([
      ['search', ''],
      ['includes', [...LIBRARY_DEFAULT_INCLUDES]],
      ['tier', null],
      ['type', null],
      ['extraType', null],
      ['includeScaledUp', false],
    ]);
  });
});
