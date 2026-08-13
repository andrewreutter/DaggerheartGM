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
