/**
 * V2 declarative sheet: gear passiveStatMods resolve from features-v2 registries when the flag is on.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  computeWeaponModifiers,
  computeArmorModifiers,
  buildV2SheetUnwrapGameState,
} from '../../src/client/lib/character-calc.js';

describe('computeWeaponModifiers (V2 gear registry)', () => {
  const cumbersomeWeapon = {
    name: 'Test Blade',
    feature: { name: 'Cumbersome', description: '-1 to Finesse' },
  };

  beforeEach(() => {
    globalThis.__DH_V2_DECLARATIVE_SHEET__ = true;
  });

  afterEach(() => {
    delete globalThis.__DH_V2_DECLARATIVE_SHEET__;
  });

  it('applies V2 flat passiveStatMods (Cumbersome: -1 finesse)', () => {
    const out = computeWeaponModifiers([cumbersomeWeapon]);
    expect(out.traits.finesse).toBe(-1);
    expect(out.sources.some((s) => s.stat === 'finesse' && s.value === -1)).toBe(true);
  });

  it('matches Phase 1 totals when the V2 flag is off (nested traits shape)', () => {
    delete globalThis.__DH_V2_DECLARATIVE_SHEET__;
    const out = computeWeaponModifiers([cumbersomeWeapon]);
    expect(out.traits.finesse).toBe(-1);
  });
});

describe('computeArmorModifiers (V2 gear + P1 fallback)', () => {
  afterEach(() => {
    delete globalThis.__DH_V2_DECLARATIVE_SHEET__;
  });

  it('with V2 on, Quiet falls back to Phase 1 rollModifiers (V2 has no passiveStatMods)', () => {
    globalThis.__DH_V2_DECLARATIVE_SHEET__ = true;
    const armor = {
      name: 'Tyris Soft Armor',
      features: [{ name: 'Quiet', description: 'You gain a +2 bonus to rolls you make to move silently.' }],
    };
    const result = computeArmorModifiers(armor);
    expect(result.rollModifiers).toHaveLength(1);
    expect(result.rollModifiers[0]).toMatchObject({ name: 'Quiet', score: 2, rollType: 'stealth' });
  });

  it('buildV2SheetUnwrapGameState maps reinforcedActive for Reinforced unwrap', () => {
    const gs = buildV2SheetUnwrapGameState(
      { traits: { presence: 0 }, tier: 2, level: 3 },
      { reinforcedActive: true, featureState: {} }
    );
    expect(gs.featureState.Reinforced?.reinforcedActive).toBe(true);
    expect(gs.activeElements[0].elementType).toBe('character');
  });
});
