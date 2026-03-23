import { describe, it, expect } from 'vitest';
import { applyDeclarativeFeatures, loadCharacterFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { GemOfMight } from '../../../../src/features-v2/items/GemOfMight.js';
import registry from '../../../../src/features-v2/registry.js';
import { mockCharacter } from '../helpers.js';

const phyMelee = {
  id: 'w-phy',
  name: 'Sword',
  damage: 'd8+2 phy',
  tier: 1,
  trait: 'Agility',
  range: 'melee',
};

describe('Items — Gem of Might', () => {
  it('loads from inventory by SRD id', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ id: 'srd-itm-gem-of-might', name: 'Gem of Might' }],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: 'Gem of Might',
        _source: 'item',
        _itemId: 'srd-itm-gem-of-might',
      })
    );
    const row = feats.find((f) => f.name === 'Gem of Might');
    expect(row.weaponTraitOverrides).toBe(GemOfMight.weaponTraitOverrides);
  });

  it('declarative overlay maps primary weapon to Strength', () => {
    const char = mockCharacter({
      inventory: [{ id: 'srd-itm-gem-of-might' }],
      primaryWeaponId: 'w-phy',
      primaryWeapon: phyMelee,
      weapons: [phyMelee],
    });
    const feats = loadCharacterFeatures(char, registry);
    const decl = applyDeclarativeFeatures(feats, char, {}, registry);
    expect(decl.weaponTraitOverrides).toEqual({ 'w-phy': 'Strength' });
  });
});
