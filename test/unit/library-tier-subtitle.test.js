import { describe, it, expect } from 'vitest';
import {
  libraryTierSubtitleText,
  libraryTierBodyLine,
  showLibraryTierShield,
} from '../../src/client/lib/library-tier-subtitle.js';

describe('libraryTierSubtitleText', () => {
  it('matches adversary Tier + role', () => {
    expect(libraryTierSubtitleText({ tier: 3, role: 'elite' }, 'adversaries')).toBe('Tier 3 elite');
  });

  it('matches environment Tier + type', () => {
    expect(libraryTierSubtitleText({ tier: 1, type: 'exploration' }, 'environments')).toBe('Tier 1 exploration');
  });

  it('matches weapon line with slot and damage type', () => {
    expect(
      libraryTierSubtitleText(
        { tier: 2, primary_or_secondary: 'Primary', physical_or_magical: 'Physical' },
        'weapons',
      ),
    ).toBe('Tier 2 · Primary · Physical');
  });

  it('is Tier only for armor', () => {
    expect(libraryTierSubtitleText({ tier: 2 }, 'armor')).toBe('Tier 2');
  });
});

describe('libraryTierBodyLine', () => {
  it('strips Tier N for adversary role line', () => {
    expect(libraryTierBodyLine({ tier: 3, role: 'elite' }, 'adversaries')).toBe('elite');
  });

  it('strips Tier N and leading dot for weapons', () => {
    expect(
      libraryTierBodyLine(
        { tier: 2, primary_or_secondary: 'Primary', physical_or_magical: 'Physical' },
        'weapons',
      ),
    ).toBe('Primary · Physical');
  });

  it('returns empty when subtitle is only Tier N (armor)', () => {
    expect(libraryTierBodyLine({ tier: 2 }, 'armor')).toBe('');
  });
});

describe('showLibraryTierShield', () => {
  it('is true when tier is set and collection is not characters', () => {
    expect(showLibraryTierShield('adversaries', { tier: 2 })).toBe(true);
  });

  it('is false for characters', () => {
    expect(showLibraryTierShield('characters', { tier: 2 })).toBe(false);
  });

  it('is false when tier is missing', () => {
    expect(showLibraryTierShield('adversaries', { name: 'X' })).toBe(false);
  });
});
