import { describe, it, expect } from 'vitest';
import { Reloading } from '../../../../src/features-v2/weapon_properties/Reloading.js';
import { runResolve, mockRoll, mockAction, mockCharacter, mockAdversary } from '../helpers.js';

describe('Reloading', () => {
  it('marks 1 Stress on the attacker when d6 rolls a 1', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations } = runResolve(Reloading, {
      activeElements: [char, adv],
      action: mockAction({ type: 'attack', actorInstanceId: 'char-1' }),
      rolls: mockRoll(),
      _rng: () => 0, // d6: floor(0 * 6) + 1 = 1
    });

    expect(mutations).toContainEqual(
      expect.objectContaining({ type: 'markStress', payload: { instanceId: 'char-1', amount: 1 } })
    );
  });

  it('does not mark Stress when d6 rolls above 1', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations } = runResolve(Reloading, {
      activeElements: [char, adv],
      action: mockAction({ type: 'attack', actorInstanceId: 'char-1' }),
      rolls: mockRoll(),
      _rng: () => 1 / 6, // d6 rolls 2
    });

    expect(mutations.filter((m) => m.type === 'markStress')).toHaveLength(0);
  });

  it('triggers regardless of whether the attack succeeded or failed', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations } = runResolve(Reloading, {
      activeElements: [char, adv],
      action: mockAction({ type: 'attack', actorInstanceId: 'char-1' }),
      rolls: mockRoll({ isSuccess: false }),
      _rng: () => 0, // d6 rolls 1
    });

    expect(mutations).toContainEqual(
      expect.objectContaining({ type: 'markStress', payload: { instanceId: 'char-1', amount: 1 } })
    );
  });

  it('does not trigger when the feature owner is not the attacker', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const other = mockCharacter({ instanceId: 'char-2' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations } = runResolve({ ...Reloading, _ownerInstanceId: 'char-2' }, {
      activeElements: [char, other, adv],
      action: mockAction({ type: 'attack', actorInstanceId: 'char-1' }),
      rolls: mockRoll(),
      _rng: () => 0,
    });

    expect(mutations.filter((m) => m.type === 'markStress')).toHaveLength(0);
  });
});
