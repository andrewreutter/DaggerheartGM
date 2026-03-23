import { describe, it, expect } from 'vitest';
import { buildTableSnapshot } from '../../../../src/features-v2/engine/table.js';
import { applyDeclarativeFeatures, loadCharacterFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { FlickerflyPendant } from '../../../../src/features-v2/items/FlickerflyPendant.js';
import registry from '../../../../src/features-v2/registry.js';
import { mockCharacter, mockGameState } from '../helpers.js';

const phyMelee = {
  id: 'w-phy',
  name: 'Sword',
  damage: 'd8+2 phy',
  tier: 1,
  trait: 'agility',
  range: 'melee',
};

const magMelee = {
  id: 'w-mag',
  name: 'Sword (Magical)',
  damage: 'd8+2 mag',
  tier: 1,
  trait: 'agility',
  range: 'melee',
  _otherworldly: 'magical',
};

describe('Items — Flickerfly Pendant', () => {
  it('loads from inventory by SRD id', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ id: 'srd-itm-flickerfly-pendant', name: 'Flickerfly Pendant' }],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: 'Flickerfly Pendant',
        _source: 'item',
        _itemId: 'srd-itm-flickerfly-pendant',
        computeWeaponRenderHints: FlickerflyPendant.computeWeaponRenderHints,
      })
    );
  });

  it('declarative hints set physical melee weapons to Very Close', () => {
    const char = mockCharacter({
      inventory: [{ id: 'srd-itm-flickerfly-pendant' }],
      primaryWeapon: phyMelee,
      weapons: [phyMelee, magMelee],
    });
    const feats = loadCharacterFeatures(char, registry);
    const decl = applyDeclarativeFeatures(feats, char, {}, registry);
    expect(decl.weaponRenderHints['w-phy']).toEqual({ range: 'veryClose' });
    expect(decl.weaponRenderHints['w-mag']).toBeUndefined();
  });

  it('merged weaponRenderHints produce Very Close on table.me for physical melee only', () => {
    const char = mockCharacter({
      instanceId: 'c1',
      inventory: [{ id: 'srd-itm-flickerfly-pendant' }],
      primaryWeapon: phyMelee,
      weapons: [phyMelee, magMelee],
    });
    const feats = loadCharacterFeatures(char, registry);
    const decl = applyDeclarativeFeatures(feats, char, {}, registry);
    const merged = { ...char, weaponRenderHints: decl.weaponRenderHints };
    const table = buildTableSnapshot(mockGameState({ character: merged, _ownerInstanceId: 'c1' }));
    expect(table.me.primaryWeapon.range).toBe('veryClose');
    const mag = table.me.weapons.find((w) => w.id === 'w-mag');
    expect(mag?.range).toBe('melee');
  });
});
