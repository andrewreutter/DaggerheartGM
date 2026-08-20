import { describe, it, expect } from 'vitest';
import {
  isAdversaryDefeated,
  effectiveEvasion,
  isWingsOfLightFlying,
  getPendingV2DeferToggleNext,
  formatArmorChipTooltip,
  formatStatModsTooltip,
  extractGmFeatureWhenClause,
  dedupeAbilitiesById,
  formatTargetSummary,
  parseAllCountdownValues,
  DIFFICULTY_SLIDER_NAMED_TICKS,
  difficultySliderTickPercent,
  getDifficultyLabel,
  isDifficultyOnBandMarker,
  difficultyLabelLines,
  DIFFICULTY_BANDS,
  difficultySliderTrackInsetCss,
} from '../../src/client/lib/helpers.js';

describe('isAdversaryDefeated', () => {
  it('returns true when hp_max > 0 and currentHp <= 0', () => {
    expect(isAdversaryDefeated({ hp_max: 6, currentHp: 0 })).toBe(true);
    expect(isAdversaryDefeated({ hp_max: 1, currentHp: 0 })).toBe(true);
  });

  it('returns false when currentHp > 0', () => {
    expect(isAdversaryDefeated({ hp_max: 6, currentHp: 1 })).toBe(false);
    expect(isAdversaryDefeated({ hp_max: 6, currentHp: 6 })).toBe(false);
  });

  it('returns false when hp_max is 0 (no HP track)', () => {
    expect(isAdversaryDefeated({ hp_max: 0, currentHp: 0 })).toBe(false);
  });

  it('defaults currentHp to hp_max when omitted', () => {
    expect(isAdversaryDefeated({ hp_max: 6 })).toBe(false);
    expect(isAdversaryDefeated({ hp_max: 0 })).toBe(false);
  });
});

describe('isWingsOfLightFlying', () => {
  it('is true when V2 framework toggle key is set on WingedSentinel', () => {
    expect(
      isWingsOfLightFlying({
        featureState: {
          WingedSentinel: { '_v2t:Wings of Light::Flying::card': true },
        },
      }),
    ).toBe(true);
  });

  it('is false when not flying', () => {
    expect(isWingsOfLightFlying({})).toBe(false);
    expect(
      isWingsOfLightFlying({
        featureState: { WingedSentinel: { '_v2t:Wings of Light::Flying::card': false } },
      }),
    ).toBe(false);
  });
});

describe('getPendingV2DeferToggleNext', () => {
  it('returns tentative next state for matching _v2Defer* banner', () => {
    const pending = [
      {
        _action: true,
        _v2DeferUntilBannerAck: true,
        _v2DeferFeatureName: 'Wings of Light',
        _v2DeferChipName: 'Flight',
        _v2DeferToggleNext: true,
        _attackerInstanceId: 'c1',
      },
    ];
    expect(getPendingV2DeferToggleNext(pending, 'c1', 'Wings of Light', 'Flight')).toBe(true);
    expect(getPendingV2DeferToggleNext(pending, 'c2', 'Wings of Light', 'Flight')).toBe(undefined);
  });

  it('supports legacy Wings of Light Flight banner fields', () => {
    const pending = [
      {
        _action: true,
        _wingsOfLightFlightDefer: true,
        _wingsOfLightFlightNext: false,
        _attackerInstanceId: 'c1',
      },
    ];
    expect(getPendingV2DeferToggleNext(pending, 'c1', 'Wings of Light', 'Flight')).toBe(false);
  });
});

describe('effectiveEvasion', () => {
  const srdData = {
    beastformsById: {
      'srd-bst-agile-scout': {
        id: 'srd-bst-agile-scout',
        name: 'Agile Scout',
        evasion_bonus: 'Evasion +2',
      },
    },
  };

  it('adds beastform evasion from SRD when srdData is passed (id-only activeBeastform)', () => {
    const el = {
      classId: 'srd-cls-druid',
      evasion: 9,
      activeBeastform: { beastformId: 'srd-bst-agile-scout', name: 'Agile Scout' },
    };
    expect(effectiveEvasion(el, srdData)).toBe(11);
  });

  it('does not double-count beastform when recompute folded it into evasion (flag)', () => {
    const el = {
      classId: 'srd-cls-druid',
      evasion: 11,
      evasionIncludesActiveBeastformBonus: true,
      activeBeastform: { beastformId: 'srd-bst-agile-scout', name: 'Agile Scout' },
    };
    expect(effectiveEvasion(el, srdData)).toBe(11);
  });

  it('still adds active evasion modifiers after beastform', () => {
    const el = {
      classId: 'srd-cls-druid',
      evasion: 10,
      activeBeastform: { beastformId: 'srd-bst-agile-scout', name: 'Agile Scout' },
      activeModifiers: [{ type: 'evasion', value: 5, id: 'x' }],
    };
    expect(effectiveEvasion(el, srdData)).toBe(17);
  });
});

describe('formatArmorChipTooltip', () => {
  it('lists weapon sources for armor score', () => {
    const el = {
      weaponMods: {
        armorScore: 2,
        sources: [
          { stat: 'armor score', feature: 'Bonded', weapon: 'Spear', value: 2 },
        ],
      },
    };
    expect(formatArmorChipTooltip(el)).toBe('Bonded (Spear): +2 to Armor Score');
  });

  it('returns empty when no armor score bonus', () => {
    expect(formatArmorChipTooltip({ weaponMods: {} })).toBe('');
  });
});

describe('formatStatModsTooltip', () => {
  it('describes ancestry max HP bonus', () => {
    expect(formatStatModsTooltip({ ancestryMods: { maxHp: 2 } }, 'maxHp')).toBe('Ancestry: +2 to Max HP');
  });

  it('describes ancestry max Stress bonus', () => {
    expect(formatStatModsTooltip({ ancestryMods: { maxStress: 1 } }, 'maxStress')).toBe('Ancestry: +1 to Max Stress');
  });

  it('returns empty when no matching bonus', () => {
    expect(formatStatModsTooltip({}, 'maxHp')).toBe('');
  });
});

describe('extractGmFeatureWhenClause', () => {
  it('returns text after When until comma (Acid Bath)', () => {
    const d =
      'When the Burrower takes Severe damage, all creatures within Close range are bathed in their acidic blood.';
    expect(extractGmFeatureWhenClause(d)).toBe('the Burrower takes Severe damage');
  });

  it('falls back to first line excerpt when no When clause', () => {
    expect(extractGmFeatureWhenClause('The Burrower can be spotlighted up to three times.')).toBe(
      'The Burrower can be spotlighted up to three times.',
    );
  });
});

describe('dedupeAbilitiesById', () => {
  it('keeps first occurrence per id and drops duplicates', () => {
    const a = { id: 'x', name: 'First' };
    const b = { id: 'x', name: 'Dup' };
    const c = { id: 'y', name: 'Other' };
    expect(dedupeAbilitiesById([a, b, c])).toEqual([a, c]);
  });

  it('skips entries without id', () => {
    expect(dedupeAbilitiesById([{ name: 'No id' }, { id: 'z', name: 'Z' }])).toEqual([{ id: 'z', name: 'Z' }]);
  });
});

describe('parseAllCountdownValues', () => {
  it('parses integer, Loop integer, Loop dice, and bare dice', () => {
    expect(parseAllCountdownValues('Countdown (8)')).toMatchObject([
      { value: 8, label: 'Countdown', looping: 'none', startFormula: '8' },
    ]);
    expect(parseAllCountdownValues('Progress Countdown (4)')).toMatchObject([
      { value: 4, label: 'Progress Countdown', looping: 'none', startFormula: '4' },
    ]);
    expect(parseAllCountdownValues('Countdown (Loop 4)')).toMatchObject([
      { value: 4, label: 'Countdown', looping: 'reset', startFormula: '4' },
    ]);
    expect(parseAllCountdownValues('Countdown (Loop 1d4)')).toMatchObject([
      { value: null, label: 'Countdown', looping: 'reset', startFormula: '1d4' },
    ]);
    expect(parseAllCountdownValues('Countdown (1d6)')).toMatchObject([
      { value: null, label: 'Countdown', looping: 'none', startFormula: '1d6' },
    ]);
  });

  it('keeps the word before Countdown as the label', () => {
    expect(parseAllCountdownValues('Fear Countdown (Loop 2d6+1)')).toMatchObject([
      { value: null, label: 'Fear Countdown', looping: 'reset', startFormula: '2d6+1' },
    ]);
  });
});

describe('difficulty slider SRD bands', () => {
  it('names Easy / Average / Hard at the SRD 10 / 15 / 20 benchmarks', () => {
    expect(DIFFICULTY_SLIDER_NAMED_TICKS.map((t) => ({ value: t.value, label: t.label }))).toEqual([
      { value: 10, label: 'Easy' },
      { value: 15, label: 'Average' },
      { value: 20, label: 'Hard' },
    ]);
    expect(getDifficultyLabel(10)).toBe('Easy');
    expect(getDifficultyLabel(15)).toBe('Average');
    expect(getDifficultyLabel(20)).toBe('Hard');
  });

  it('places ticks by position along the 5–30 slider', () => {
    expect(difficultySliderTickPercent(5)).toBe(0);
    expect(difficultySliderTickPercent(30)).toBe(100);
    expect(difficultySliderTickPercent(15)).toBe(40);
  });

  it('treats exact SRD band values as markers and in-between DCs as off-marker', () => {
    expect(isDifficultyOnBandMarker(10)).toBe(true);
    expect(isDifficultyOnBandMarker(15)).toBe(true);
    expect(isDifficultyOnBandMarker(30)).toBe(true);
    expect(isDifficultyOnBandMarker(12)).toBe(false);
    expect(isDifficultyOnBandMarker(17)).toBe(false);
  });

  it('uses Very E. / Very H. on the end-band buttons', () => {
    expect(DIFFICULTY_BANDS.find((b) => b.value === 5).shortLabel).toBe('Very E.');
    expect(DIFFICULTY_BANDS.find((b) => b.value === 25).shortLabel).toBe('Very H.');
  });

  it('splits two-word difficulty labels for the DC column', () => {
    expect(difficultyLabelLines(15)).toEqual(['Average']);
    expect(difficultyLabelLines(5)).toEqual(['Very', 'Easy']);
    expect(difficultyLabelLines(25)).toEqual(['Very', 'Hard']);
    expect(difficultyLabelLines(30)).toEqual(['Nearly', 'Impossible']);
  });

  it('insets the slider track by half a 6-col band so thumbs sit on button centers', () => {
    expect(difficultySliderTrackInsetCss()).toBe('calc((100% - 0.625rem) / 12)');
  });
});

describe('formatTargetSummary', () => {
  it('omits HP for companion targets and shows stress only', () => {
    expect(formatTargetSummary({
      type: 'companion',
      maxHp: 0,
      currentHp: 0,
      maxStress: 3,
      currentStress: 1,
      conditions: '',
    })).toEqual({ hp: '', stress: '1/3 Stress', conditions: '' });
  });
});
