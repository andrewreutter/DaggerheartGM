import { describe, it, expect } from 'vitest';
import { LockedOn } from '../../../../src/features-v2/weapon_properties/LockedOn.js';
import { createActionLoop } from '../../../../src/features-v2/engine/action-loop.js';
import { mockGameState, mockCharacter, mockAdversary, mockAction, mockRoll } from '../helpers.js';

describe('Locked On', () => {
  it('arms a lock on the target after a successful attack', () => {
    const char = mockCharacter({
      instanceId: 'char-1',
      primaryWeapon: { id: 'w1', name: 'Shard', tier: '1' },
      weapons: [{ id: 'w1', name: 'Shard', tier: '1', damage: 'd8' }],
    });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const gs = mockGameState({
      activeElements: [char, adv],
      _ownerInstanceId: 'char-1',
      featureState: {},
    });
    const feature = { ...LockedOn, _ownerInstanceId: 'char-1' };

    const loop = createActionLoop(
      gs,
      mockAction({ type: 'attack', actorInstanceId: 'char-1', targetInstanceIds: ['adv-1'], weaponId: 'w1' }),
      [feature]
    );
    loop.setRolls(mockRoll({ isSuccess: true }));
    loop.runPhase('resolve');

    expect(gs.featureState['Locked On']?.lockedOnArmed).toBe(true);
    expect(gs.featureState['Locked On']?.lockedOnTargetId).toBe('adv-1');
  });

  it('adds a large action static on the next primary-weapon attack against the same target', () => {
    const char = mockCharacter({
      instanceId: 'char-1',
      primaryWeapon: { id: 'w1', name: 'Shard', tier: '1' },
      weapons: [{ id: 'w1', name: 'Shard', tier: '1', damage: 'd8' }],
    });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const gs = mockGameState({
      activeElements: [char, adv],
      _ownerInstanceId: 'char-1',
      featureState: {
        'Locked On': {
          lockedOnArmed: true,
          lockedOnTargetId: 'adv-1',
        },
      },
    });
    const feature = { ...LockedOn, _ownerInstanceId: 'char-1' };

    const loop = createActionLoop(
      gs,
      mockAction({ type: 'attack', actorInstanceId: 'char-1', targetInstanceIds: ['adv-1'], weaponId: 'w1' }),
      [feature]
    );
    loop.setRolls(mockRoll({ isSuccess: true }));

    const intent = loop.runPhase('intent');

    expect(intent.mutations.some((m) => m.type === 'addRollStatic' && m.payload?.name === 'Locked On')).toBe(
      true
    );
  });

  it('does not add a static when attacking with a non-primary weapon', () => {
    const char = mockCharacter({
      instanceId: 'char-1',
      primaryWeapon: { id: 'w1', name: 'Shard', tier: '1' },
      secondaryWeapon: { id: 'w2', name: 'Off', tier: '1' },
      weapons: [
        { id: 'w1', name: 'Shard', tier: '1', damage: 'd8' },
        { id: 'w2', name: 'Off', tier: '1', damage: 'd6' },
      ],
    });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const gs = mockGameState({
      activeElements: [char, adv],
      _ownerInstanceId: 'char-1',
      featureState: {
        'Locked On': {
          lockedOnArmed: true,
          lockedOnTargetId: 'adv-1',
        },
      },
    });
    const feature = { ...LockedOn, _ownerInstanceId: 'char-1' };

    const loop = createActionLoop(
      gs,
      mockAction({ type: 'attack', actorInstanceId: 'char-1', targetInstanceIds: ['adv-1'], weaponId: 'w2' }),
      [feature]
    );
    loop.setRolls(mockRoll({ isSuccess: true }));

    const intent = loop.runPhase('intent');

    expect(intent.mutations.filter((m) => m.type === 'addRollStatic')).toHaveLength(0);
  });
});
