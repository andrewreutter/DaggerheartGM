import { describe, it, expect } from 'vitest';
import { loadCharacterFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { ChargingQuiver } from '../../../../src/features-v2/items/ChargingQuiver.js';
import registry from '../../../../src/features-v2/registry.js';
import { runIntent, mockCharacter, mockAdversary, mockRoll } from '../helpers.js';

const shortbow = {
  id: 'w-shortbow',
  name: 'Shortbow',
  damage: 'd8',
  tier: 1,
  trait: 'agility',
  range: 'Far',
};

const longsword = {
  id: 'w-sword',
  name: 'Longsword',
  damage: 'd8',
  tier: 1,
  trait: 'strength',
  range: 'Melee',
};

describe('Items — Charging Quiver', () => {
  it('loads from inventory by SRD id', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ id: 'srd-itm-charging-quiver', name: 'Charging Quiver' }],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: 'Charging Quiver',
        _source: 'item',
        _itemId: 'srd-itm-charging-quiver',
        hooks: ChargingQuiver.hooks,
      })
    );
  });

  it('adds a damage static equal to tier on a successful bow attack', () => {
    const { mutations } = runIntent(
      { ...ChargingQuiver, _ownerInstanceId: 'c1' },
      {
        activeElements: [
          mockCharacter({
            instanceId: 'c1',
            tier: 3,
            primaryWeapon: shortbow,
            weapons: [shortbow],
          }),
          mockAdversary({ instanceId: 'adv-1' }),
        ],
        _ownerInstanceId: 'c1',
        action: {
          type: 'attack',
          actorInstanceId: 'c1',
          targetInstanceIds: ['adv-1'],
          weaponId: 'w-shortbow',
        },
        rolls: mockRoll({ isSuccess: true }),
      }
    );

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addRollStatic',
        payload: expect.objectContaining({
          rollKey: 'damage',
          name: 'Charging Quiver',
          value: 3,
        }),
      })
    );
  });

  it('does not add damage bonus when the attack misses', () => {
    const { mutations } = runIntent(
      { ...ChargingQuiver, _ownerInstanceId: 'c1' },
      {
        activeElements: [
          mockCharacter({
            instanceId: 'c1',
            tier: 3,
            primaryWeapon: shortbow,
            weapons: [shortbow],
          }),
          mockAdversary({ instanceId: 'adv-1' }),
        ],
        _ownerInstanceId: 'c1',
        action: {
          type: 'attack',
          actorInstanceId: 'c1',
          weaponId: 'w-shortbow',
        },
        rolls: mockRoll({ isSuccess: false }),
      }
    );

    expect(mutations.filter((m) => m.type === 'addRollStatic')).toHaveLength(0);
  });

  it('does not add damage bonus for non-bow melee weapons', () => {
    const { mutations } = runIntent(
      { ...ChargingQuiver, _ownerInstanceId: 'c1' },
      {
        activeElements: [
          mockCharacter({
            instanceId: 'c1',
            tier: 2,
            primaryWeapon: longsword,
            weapons: [longsword],
          }),
          mockAdversary({ instanceId: 'adv-1' }),
        ],
        _ownerInstanceId: 'c1',
        action: {
          type: 'attack',
          actorInstanceId: 'c1',
          weaponId: 'w-sword',
        },
        rolls: mockRoll({ isSuccess: true }),
      }
    );

    expect(mutations.filter((m) => m.type === 'addRollStatic')).toHaveLength(0);
  });
});
