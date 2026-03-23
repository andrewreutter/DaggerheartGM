import { describe, it, expect } from 'vitest';
import { applyDeclarativeFeatures, loadCharacterFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { GemOfPrecision } from '../../../../src/features-v2/items/GemOfPrecision.js';
import registry from '../../../../src/features-v2/registry.js';
import { mockCharacter } from '../helpers.js';

describe('Items — Gem of Precision', () => {
  it('loads from inventory by SRD id', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ id: 'srd-itm-gem-of-precision', name: 'Gem of Precision' }],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: 'Gem of Precision',
        _source: 'item',
        _itemId: 'srd-itm-gem-of-precision',
        weaponTraitOverrides: GemOfPrecision.weaponTraitOverrides,
      })
    );
  });

  it('declarative merge maps primary weapon to Finesse by default', () => {
    const char = mockCharacter({
      inventory: [{ id: 'srd-itm-gem-of-precision' }],
      primaryWeaponId: 'w-primary',
    });
    const feats = loadCharacterFeatures(char, registry);
    const decl = applyDeclarativeFeatures(feats, char, {}, registry);
    expect(decl.weaponTraitOverrides).toEqual({ 'w-primary': 'Finesse' });
  });

  it('uses featureState attachedWeaponId when set', () => {
    const char = mockCharacter({
      inventory: [{ id: 'srd-itm-gem-of-precision' }],
      primaryWeaponId: 'w-primary',
      secondaryWeaponId: 'w-secondary',
      featureState: {
        'Gem of Precision': { attachedWeaponId: 'w-secondary' },
      },
    });
    const feats = loadCharacterFeatures(char, registry);
    const decl = applyDeclarativeFeatures(feats, char, {}, registry);
    expect(decl.weaponTraitOverrides).toEqual({ 'w-secondary': 'Finesse' });
  });
});
