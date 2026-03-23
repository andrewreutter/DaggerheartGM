/**
 * character-calc gear: passiveStatMods resolve only from `src/features-v2` weapon_properties / armor_properties.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import {
  computeWeaponModifiers,
  computeArmorModifiers,
  buildV2SheetUnwrapGameState,
} from '../../src/client/lib/character-calc.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('computeWeaponModifiers (V2 gear registry)', () => {
  const cumbersomeWeapon = {
    name: 'Test Blade',
    feature: { name: 'Cumbersome', description: '-1 to Finesse' },
  };

  it('applies V2 flat passiveStatMods (Cumbersome: -1 finesse)', () => {
    const out = computeWeaponModifiers([cumbersomeWeapon]);
    expect(out.traits.finesse).toBe(-1);
    expect(out.sources.some((s) => s.stat === 'finesse' && s.value === -1)).toBe(true);
  });

});

describe('computeArmorModifiers (V2 armor_properties only)', () => {
  it('Quiet: stealth roll modifier from V2 passiveStatMods', () => {
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

describe('character-calc (no Phase 1 registry)', () => {
  it('does not import ../../features/ or phase1-game-table-registry', () => {
    const path = join(__dirname, '../../src/client/lib/character-calc.js');
    const src = readFileSync(path, 'utf8');
    expect(src).not.toContain('../../features/');
    expect(src).not.toContain('phase1-game-table-registry');
  });
});
