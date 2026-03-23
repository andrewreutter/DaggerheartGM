import { describe, it, expect } from 'vitest';
import { applyMutations, buildTableSnapshot } from '../../../../src/features-v2/engine/table.js';
import { loadCharacterFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { MythicDust } from '../../../../src/features-v2/consumables/MythicDust.js';
import registry from '../../../../src/features-v2/registry.js';
import { mockCharacter, mockGameState, mockRoll, runIntent } from '../helpers.js';

describe('Consumables — Mythic Dust', () => {
  it('loads from inventory by SRD id', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Mythic Dust', id: 'srd-cns-mythic-dust' }],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: 'Mythic Dust',
        description: MythicDust.description,
        _source: 'consumable',
        _consumableId: 'srd-cns-mythic-dust',
      })
    );
  });

  it('onUse queues setFeatureState for pending application', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const gs = mockGameState({
      activeElements: [char],
      _ownerInstanceId: char.instanceId,
      _featureKey: 'Mythic Dust',
    });
    const table = buildTableSnapshot(gs);
    MythicDust.onUse(table);
    const mutations = applyMutations(table);
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Mythic Dust',
          key: 'mythicDustPendingApply',
          value: true,
        }),
      })
    );
  });

  it('onIntent binds dust to the first magic weapon attack and clears pending (no damage roll yet)', () => {
    const char = mockCharacter({
      instanceId: 'char-1',
      weapons: [{ id: 'w-mag', name: 'Staff', damage: 'd8 mag', trait: 'presence', range: 'melee' }],
    });
    const r = mockRoll();
    const { mutations } = runIntent(
      { ...MythicDust, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char],
        featureState: {
          'Mythic Dust': { mythicDustPendingApply: true },
        },
        action: {
          type: 'attack',
          traitKey: 'Presence',
          weaponId: 'w-mag',
        },
        rolls: { action: r.action, damage: undefined },
      }
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Mythic Dust',
          key: 'mythicDustWeaponId',
          value: 'w-mag',
        }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Mythic Dust',
          key: 'mythicDustPendingApply',
          value: false,
        }),
      })
    );
    expect(mutations.filter((m) => m.type === 'addRollDie')).toHaveLength(0);
  });

  it('onIntent does not bind when the weapon deals physical damage', () => {
    const char = mockCharacter({
      instanceId: 'char-1',
      weapons: [{ id: 'w-phy', name: 'Sword', damage: 'd8 phy', trait: 'agility', range: 'melee' }],
    });
    const r = mockRoll();
    const { mutations } = runIntent(
      { ...MythicDust, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char],
        featureState: {
          'Mythic Dust': { mythicDustPendingApply: true },
        },
        action: {
          type: 'attack',
          traitKey: 'Agility',
          weaponId: 'w-phy',
        },
        rolls: { action: r.action, damage: undefined },
      }
    );
    expect(mutations.filter((m) => m.type === 'setFeatureState')).toHaveLength(0);
  });

  it('onIntent adds d12 to damage and clears coated weapon when a damage roll matches', () => {
    const char = mockCharacter({
      instanceId: 'char-1',
      weapons: [{ id: 'w-mag', name: 'Staff', damage: 'd8 mag', trait: 'presence', range: 'melee' }],
    });
    const { mutations } = runIntent(
      { ...MythicDust, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char],
        featureState: {
          'Mythic Dust': { mythicDustWeaponId: 'w-mag' },
        },
        action: {
          type: 'attack',
          traitKey: 'Presence',
          weaponId: 'w-mag',
        },
        rolls: mockRoll(),
      }
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addRollDie',
        payload: expect.objectContaining({
          rollKey: 'damage',
          name: 'Mythic Dust',
          die: 'd12',
        }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Mythic Dust',
          key: 'mythicDustWeaponId',
          value: null,
        }),
      })
    );
  });

  it('binds and adds d12 in one intent when pending apply and damage roll are both present', () => {
    const char = mockCharacter({
      instanceId: 'char-1',
      weapons: [{ id: 'w-mag', name: 'Staff', damage: 'd8 mag', trait: 'presence', range: 'melee' }],
    });
    const { mutations } = runIntent(
      { ...MythicDust, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char],
        featureState: {
          'Mythic Dust': { mythicDustPendingApply: true },
        },
        action: {
          type: 'attack',
          traitKey: 'Presence',
          weaponId: 'w-mag',
        },
        rolls: mockRoll(),
      }
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addRollDie',
        payload: expect.objectContaining({
          rollKey: 'damage',
          name: 'Mythic Dust',
          die: 'd12',
        }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          key: 'mythicDustWeaponId',
          value: 'w-mag',
        }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          key: 'mythicDustWeaponId',
          value: null,
        }),
      })
    );
  });
});
