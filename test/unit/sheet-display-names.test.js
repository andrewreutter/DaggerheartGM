import { describe, it, expect } from 'vitest';
import {
  formatSheetDisplayLabel,
  getSheetDisplayLabelParts,
  splitDisplayNameForSheetParen,
  getWeaponSheetLabel,
  getWeaponSheetDisplayKey,
  patchSheetDisplayNames,
  makeFeatureSheetDisplayKey,
  finalizeFeatureSheetDisplayKeys,
  slugForFeatureSheetKey,
  getFeatureSheetLabelParts,
} from '../../src/client/lib/sheet-display-names.js';
import { buildWeaponRollText } from '../../src/client/lib/weapon-roll-text.js';

describe('formatSheetDisplayLabel', () => {
  it('returns original when custom empty or matches', () => {
    expect(formatSheetDisplayLabel('Longsword', '')).toBe('Longsword');
    expect(formatSheetDisplayLabel('Longsword', null)).toBe('Longsword');
    expect(formatSheetDisplayLabel('Longsword', 'Longsword')).toBe('Longsword');
  });

  it('formats custom with parenthetical original', () => {
    expect(formatSheetDisplayLabel('Longsword', 'Flame')).toBe('Flame (Longsword)');
  });

  it('trims whitespace', () => {
    expect(formatSheetDisplayLabel('Rally', '  Nick  ')).toBe('Nick (Rally)');
  });
});

describe('getSheetDisplayLabelParts', () => {
  it('returns parenthetical null when no custom', () => {
    expect(getSheetDisplayLabelParts('Rally', '')).toEqual({ primary: 'Rally', parenthetical: null });
  });

  it('returns primary and original when customized', () => {
    expect(getSheetDisplayLabelParts('Longsword', 'Blade')).toEqual({
      primary: 'Blade',
      parenthetical: 'Longsword',
    });
  });
});

describe('splitDisplayNameForSheetParen', () => {
  it('splits character prefix and parenthetical original', () => {
    expect(splitDisplayNameForSheetParen('Aria Blade (Longsword)', 'Aria')).toEqual({
      base: 'Aria Blade',
      parenthetical: 'Longsword',
      suffix: '',
    });
  });

  it('preserves suffix after closing paren', () => {
    expect(
      splitDisplayNameForSheetParen("Aria Blade (Longsword) with Ranger's Focus attempt", 'Aria'),
    ).toEqual({
      base: 'Aria Blade',
      parenthetical: 'Longsword',
      suffix: " with Ranger's Focus attempt",
    });
  });

  it('handles subfeature title after paren', () => {
    expect(splitDisplayNameForSheetParen('Aria Nick (Rally): Clever', 'Aria')).toEqual({
      base: 'Aria Nick',
      parenthetical: 'Rally',
      suffix: ': Clever',
    });
  });

  it('returns unsplit when attacker name not prefix', () => {
    expect(splitDisplayNameForSheetParen('Blade (Longsword)', 'Aria')).toEqual({
      base: 'Blade (Longsword)',
      parenthetical: null,
      suffix: '',
    });
  });
});

describe('getWeaponSheetDisplayKey', () => {
  it('uses weapon.id when set', () => {
    expect(getWeaponSheetDisplayKey({ id: 'wep_0', name: 'X' }, {})).toBe('wep_0');
  });

  it('falls back to slot-primary when primary and id missing', () => {
    expect(
      getWeaponSheetDisplayKey(
        { name: 'Y', isPrimary: true },
        { primaryWeaponId: 'srd-wpn-longsword' },
      ),
    ).toBe('slot-primary:srd-wpn-longsword');
  });
});

describe('getWeaponSheetLabel', () => {
  it('applies weapons map', () => {
    const el = {
      sheetDisplayNames: { weapons: { wep_0: 'Blade' } },
      primaryWeaponId: 'srd-x',
    };
    const w = { id: 'wep_0', name: 'Longsword' };
    expect(getWeaponSheetLabel(el, w)).toBe('Blade (Longsword)');
  });
});

describe('makeFeatureSheetDisplayKey', () => {
  it('prefixes slugged source and feature', () => {
    expect(makeFeatureSheetDisplayKey('Bard', 'Rally')).toBe('feat__bard__rally');
    expect(slugForFeatureSheetKey('  Foo Bar  ')).toBe('foo_bar');
  });
});

describe('finalizeFeatureSheetDisplayKeys', () => {
  it('adds hash suffix when slug base collides for different pairs', () => {
    const m = finalizeFeatureSheetDisplayKeys([
      { sourceName: 'A-B', featureName: 'Rally' },
      { sourceName: 'A B', featureName: 'Rally' },
    ]);
    expect(m.size).toBe(2);
    const keys = [...m.values()];
    expect(keys[0]).not.toBe(keys[1]);
    expect(keys.every((k) => /^feat__a_b__rally__[0-9a-f]{6}$/.test(k))).toBe(true);
  });
});

describe('getFeatureSheetLabelParts squashed fallback', () => {
  it('resolves custom label via feat__ key when guide key is absent from map', () => {
    const el = {
      classFeatures: [{ name: 'Rally', description: '', source: 'Bard', sourceType: 'class' }],
      beastformFeatures: [],
      subclassFeatures: [],
      ancestryFeatures: [],
      communityFeatures: [],
      activeFeatures: [],
      sheetDisplayNames: { features: { feat__bard__rally: 'Encore' } },
    };
    const parts = getFeatureSheetLabelParts(el, 'class-Rally-0', 'Rally', 'Bard');
    expect(parts).toEqual({ primary: 'Encore', parenthetical: 'Rally' });
  });
});

describe('patchSheetDisplayNames', () => {
  it('adds and removes keys', () => {
    let bag = patchSheetDisplayNames(undefined, 'features', 'class-Rally-0', 'Nick');
    expect(bag.features['class-Rally-0']).toBe('Nick');
    bag = patchSheetDisplayNames(bag, 'features', 'class-Rally-0', '');
    expect(bag).toBeUndefined();
  });
});

describe('buildWeaponRollText display vs tag', () => {
  it('uses display weapon name in opening segment', () => {
    const rollText = buildWeaponRollText(
      'Aria',
      'Blade (Longsword)',
      'agility',
      2,
      null,
      'd8 phy',
      null,
      { agility: 2 },
      3,
      {},
      {},
      null,
    );
    expect(rollText.startsWith('Aria Blade (Longsword) Hope [d12] Fear [d12]')).toBe(true);
    expect(rollText).toContain('damage [d8]');
  });
});
