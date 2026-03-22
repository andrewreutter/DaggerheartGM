import { describe, it, expect } from 'vitest';
import { Paired } from '../../../../src/features-v2/weapon_properties/Paired.js';
import { runIntent, mockAction, mockCharacter, mockAdversary } from '../helpers.js';

const pairedDamageStatics = (mutations) =>
  mutations.filter(
    (m) =>
      m.type === 'addRollStatic' &&
      m.payload?.rollKey === 'damage' &&
      m.payload?.name === 'Paired'
  );

describe('Paired', () => {
  const char = mockCharacter({
    instanceId: 'char-1',
    weapons: [
      { id: 'w-primary', name: 'Shortsword', tier: 2, range: 'melee', damage: 'd8', trait: 'Agility', feature: [] },
      { id: 'w-secondary', name: 'Small Dagger', tier: 2, range: 'melee', damage: 'd6', trait: 'Finesse', feature: [] },
    ],
  });
  const adv = mockAdversary({ instanceId: 'adv-1' });

  const pairedFeature = { ...Paired, _weaponId: 'w-secondary' };

  it('adds (tier+1) damage static on primary melee attack when feature is on secondary weapon', () => {
    const { mutations } = runIntent(pairedFeature, {
      activeElements: [char, adv],
      action: mockAction({
        type: 'attack',
        actorInstanceId: 'char-1',
        range: 'melee',
        weaponId: 'w-primary',
      }),
    });

    expect(pairedDamageStatics(mutations)).toContainEqual(
      expect.objectContaining({
        type: 'addRollStatic',
        payload: expect.objectContaining({ rollKey: 'damage', name: 'Paired', value: 3 }),
      })
    );
  });

  it('does not apply when attacking with the secondary weapon', () => {
    const { mutations } = runIntent(pairedFeature, {
      activeElements: [char, adv],
      action: mockAction({
        type: 'attack',
        actorInstanceId: 'char-1',
        range: 'melee',
        weaponId: 'w-secondary',
      }),
    });

    expect(pairedDamageStatics(mutations)).toHaveLength(0);
  });

  it('does not apply when weaponId is missing', () => {
    const { mutations } = runIntent(pairedFeature, {
      activeElements: [char, adv],
      action: mockAction({
        type: 'attack',
        actorInstanceId: 'char-1',
        range: 'melee',
        weaponId: null,
      }),
    });

    expect(pairedDamageStatics(mutations)).toHaveLength(0);
  });

  it('does not apply on non-attack actions', () => {
    const { mutations } = runIntent(pairedFeature, {
      activeElements: [char, adv],
      action: mockAction({ type: 'trait', actorInstanceId: 'char-1', weaponId: 'w-primary' }),
    });

    expect(pairedDamageStatics(mutations)).toHaveLength(0);
  });

  it('does not apply when the feature instance is not tied to the secondary weapon', () => {
    const { mutations } = runIntent({ ...Paired, _weaponId: 'w-primary' }, {
      activeElements: [char, adv],
      action: mockAction({
        type: 'attack',
        actorInstanceId: 'char-1',
        range: 'melee',
        weaponId: 'w-primary',
      }),
    });

    expect(pairedDamageStatics(mutations)).toHaveLength(0);
  });
});
