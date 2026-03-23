import { describe, it, expect } from 'vitest';
import { applyDeclarativeFeatures, loadCharacterFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { GemOfAudacity } from '../../../../src/features-v2/items/GemOfAudacity.js';
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

describe('Items — Gem of Audacity', () => {
  it('loads from inventory by SRD id', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ id: 'srd-itm-gem-of-audacity', name: 'Gem of Audacity' }],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: 'Gem of Audacity',
        _source: 'item',
        _itemId: 'srd-itm-gem-of-audacity',
      })
    );
    const row = feats.find((f) => f.name === 'Gem of Audacity');
    expect(row.weaponTraitOverrides).toBe(GemOfAudacity.weaponTraitOverrides);
  });

  it('declarative overlay maps primary weapon to Presence', () => {
    const char = mockCharacter({
      inventory: [{ id: 'srd-itm-gem-of-audacity' }],
      primaryWeaponId: 'w-phy',
      primaryWeapon: phyMelee,
      weapons: [phyMelee],
    });
    const feats = loadCharacterFeatures(char, registry);
    const decl = applyDeclarativeFeatures(feats, char, {}, registry);
    expect(decl.weaponTraitOverrides).toEqual({ 'w-phy': 'Presence' });
  });
});
