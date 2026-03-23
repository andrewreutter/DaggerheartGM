import { describe, it, expect } from 'vitest';
import { applyMutations, buildTableSnapshot } from '../../../../src/features-v2/engine/table.js';
import { loadCharacterFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { ImprovedGrindletoothVenom } from '../../../../src/features-v2/consumables/ImprovedGrindletoothVenom.js';
import registry from '../../../../src/features-v2/registry.js';
import { mockCharacter, mockGameState, mockRoll, runIntent } from '../helpers.js';

describe('Consumables — Improved Grindletooth Venom', () => {
  it('loads from inventory by SRD id', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Improved Grindletooth Venom', id: 'srd-cns-improved-grindletooth-venom' }],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: 'Improved Grindletooth Venom',
        description: ImprovedGrindletoothVenom.description,
        _source: 'consumable',
        _consumableId: 'srd-cns-improved-grindletooth-venom',
      })
    );
  });

  it('onUse queues setFeatureState for pending application', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const gs = mockGameState({
      activeElements: [char],
      _ownerInstanceId: char.instanceId,
      _featureKey: 'Improved Grindletooth Venom',
    });
    const table = buildTableSnapshot(gs);
    ImprovedGrindletoothVenom.onUse(table);
    const mutations = applyMutations(table);
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Improved Grindletooth Venom',
          key: 'improvedGrindletoothVenomPendingApply',
          value: true,
        }),
      })
    );
  });

  it('onIntent binds venom to the first physical weapon attack and clears pending (no damage roll yet)', () => {
    const char = mockCharacter({
      instanceId: 'char-1',
      weapons: [{ id: 'w-phy', name: 'Sword', damage: 'd8 phy', trait: 'agility', range: 'melee' }],
    });
    const r = mockRoll();
    const { mutations } = runIntent(
      { ...ImprovedGrindletoothVenom, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char],
        featureState: {
          'Improved Grindletooth Venom': { improvedGrindletoothVenomPendingApply: true },
        },
        action: {
          type: 'attack',
          traitKey: 'Agility',
          weaponId: 'w-phy',
        },
        rolls: { action: r.action, damage: undefined },
      }
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Improved Grindletooth Venom',
          key: 'improvedGrindletoothVenomWeaponId',
          value: 'w-phy',
        }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Improved Grindletooth Venom',
          key: 'improvedGrindletoothVenomPendingApply',
          value: false,
        }),
      })
    );
    expect(mutations.filter((m) => m.type === 'addRollDie')).toHaveLength(0);
  });

  it('onIntent does not bind when the weapon deals magic damage', () => {
    const char = mockCharacter({
      instanceId: 'char-1',
      weapons: [{ id: 'w-mag', name: 'Staff', damage: 'd8 mag', trait: 'presence', range: 'melee' }],
    });
    const r = mockRoll();
    const { mutations } = runIntent(
      { ...ImprovedGrindletoothVenom, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char],
        featureState: {
          'Improved Grindletooth Venom': { improvedGrindletoothVenomPendingApply: true },
        },
        action: {
          type: 'attack',
          traitKey: 'Presence',
          weaponId: 'w-mag',
        },
        rolls: { action: r.action, damage: undefined },
      }
    );
    expect(mutations.filter((m) => m.type === 'setFeatureState')).toHaveLength(0);
  });

  it('onIntent adds d8 to damage and clears coated weapon when a damage roll matches', () => {
    const char = mockCharacter({
      instanceId: 'char-1',
      weapons: [{ id: 'w-phy', name: 'Sword', damage: 'd8 phy', trait: 'agility', range: 'melee' }],
    });
    const { mutations } = runIntent(
      { ...ImprovedGrindletoothVenom, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char],
        featureState: {
          'Improved Grindletooth Venom': { improvedGrindletoothVenomWeaponId: 'w-phy' },
        },
        action: {
          type: 'attack',
          traitKey: 'Agility',
          weaponId: 'w-phy',
        },
        rolls: mockRoll(),
      }
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addRollDie',
        payload: expect.objectContaining({
          rollKey: 'damage',
          name: 'Improved Grindletooth Venom',
          die: 'd8',
        }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Improved Grindletooth Venom',
          key: 'improvedGrindletoothVenomWeaponId',
          value: null,
        }),
      })
    );
  });

  it('binds and adds d8 in one intent when pending apply and damage roll are both present', () => {
    const char = mockCharacter({
      instanceId: 'char-1',
      weapons: [{ id: 'w-phy', name: 'Sword', damage: 'd8 phy', trait: 'agility', range: 'melee' }],
    });
    const { mutations } = runIntent(
      { ...ImprovedGrindletoothVenom, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char],
        featureState: {
          'Improved Grindletooth Venom': { improvedGrindletoothVenomPendingApply: true },
        },
        action: {
          type: 'attack',
          traitKey: 'Agility',
          weaponId: 'w-phy',
        },
        rolls: mockRoll(),
      }
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addRollDie',
        payload: expect.objectContaining({
          rollKey: 'damage',
          name: 'Improved Grindletooth Venom',
          die: 'd8',
        }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          key: 'improvedGrindletoothVenomWeaponId',
          value: 'w-phy',
        }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          key: 'improvedGrindletoothVenomWeaponId',
          value: null,
        }),
      })
    );
  });
});
