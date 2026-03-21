import { describe, it, expect } from 'vitest';
import { Lifestealing } from '../../../../src/features-v2/weapon_properties/Lifestealing.js';
import { runResolve, mockRoll, mockAction, mockCharacter, mockAdversary } from '../helpers.js';

describe('Lifestealing', () => {
  it('clears 1 HP from the attacker when d6 rolls a 6 on a successful attack', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    // _rng returns 5/6 → face = floor(5/6 * 6) + 1 = 6
    const { mutations } = runResolve(Lifestealing, {
      activeElements: [char, adv],
      action: mockAction({ type: 'attack' }),
      rolls: mockRoll({ isSuccess: true }),
      _rng: () => 5 / 6,
    });

    expect(mutations).toContainEqual(
      expect.objectContaining({ type: 'rollDie', payload: expect.objectContaining({ notation: 'd6' }) })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({ type: 'clearHP', payload: { instanceId: 'char-1', amount: 1 } })
    );
  });

  it('does not clear HP when d6 rolls a non-6 result', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    // _rng returns 0 → face = 1
    const { mutations } = runResolve(Lifestealing, {
      activeElements: [char, adv],
      action: mockAction({ type: 'attack' }),
      rolls: mockRoll({ isSuccess: true }),
      _rng: () => 0,
    });

    expect(mutations.filter((m) => m.type === 'clearHP')).toHaveLength(0);
  });

  it('does not fire on a failed attack', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations } = runResolve(Lifestealing, {
      activeElements: [char, adv],
      action: mockAction({ type: 'attack' }),
      rolls: mockRoll({ isSuccess: false }),
      _rng: () => 5 / 6,
    });

    expect(mutations.filter((m) => m.type === 'clearHP')).toHaveLength(0);
  });

  it('does not fire on a successful non-attack action', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations } = runResolve(Lifestealing, {
      activeElements: [char, adv],
      action: mockAction({ type: 'trait', actorInstanceId: 'char-1' }),
      rolls: mockRoll({ isSuccess: true }),
      _rng: () => 5 / 6,
    });

    expect(mutations.filter((m) => m.type === 'clearHP')).toHaveLength(0);
  });

  it('does not fire when the character is not the acting entity', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const other = mockCharacter({ instanceId: 'char-2' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations } = runResolve({ ...Lifestealing, _ownerInstanceId: 'char-2' }, {
      activeElements: [char, other, adv],
      action: mockAction({ type: 'attack', actorInstanceId: 'char-1' }),
      rolls: mockRoll({ isSuccess: true }),
      _rng: () => 5 / 6,
    });

    expect(mutations.filter((m) => m.type === 'clearHP')).toHaveLength(0);
  });
});
