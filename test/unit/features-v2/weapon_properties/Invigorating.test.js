import { describe, it, expect } from 'vitest';
import { Invigorating } from '../../../../src/features-v2/weapon_properties/Invigorating.js';
import { runResolve, mockRoll, mockAction, mockCharacter, mockAdversary } from '../helpers.js';

describe('Invigorating', () => {
  it('clears 1 Stress on the attacker when d4 rolls a 4 on a successful attack', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations } = runResolve(Invigorating, {
      activeElements: [char, adv],
      action: mockAction({ type: 'attack', actorInstanceId: 'char-1' }),
      rolls: mockRoll({ isSuccess: true }),
      _rng: () => 3 / 4, // d4: floor(3/4 * 4) + 1 = 4
    });

    expect(mutations).toContainEqual(
      expect.objectContaining({ type: 'clearStress', payload: { instanceId: 'char-1', amount: 1 } })
    );
  });

  it('does not clear Stress when d4 rolls below 4', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations } = runResolve(Invigorating, {
      activeElements: [char, adv],
      action: mockAction({ type: 'attack', actorInstanceId: 'char-1' }),
      rolls: mockRoll({ isSuccess: true }),
      _rng: () => 0, // d4 rolls 1
    });

    expect(mutations.filter((m) => m.type === 'clearStress')).toHaveLength(0);
  });

  it('does not trigger when the attack fails', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations } = runResolve(Invigorating, {
      activeElements: [char, adv],
      action: mockAction({ type: 'attack', actorInstanceId: 'char-1' }),
      rolls: mockRoll({ isSuccess: false }),
      _rng: () => 3 / 4,
    });

    expect(mutations.filter((m) => m.type === 'clearStress')).toHaveLength(0);
  });

  it('does not trigger on a successful non-attack action', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations } = runResolve(Invigorating, {
      activeElements: [char, adv],
      action: mockAction({ type: 'trait', actorInstanceId: 'char-1' }),
      rolls: mockRoll({ isSuccess: true }),
      _rng: () => 3 / 4,
    });

    expect(mutations.filter((m) => m.type === 'clearStress')).toHaveLength(0);
  });

  it('does not trigger when the feature owner is not the attacker', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const other = mockCharacter({ instanceId: 'char-2' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations } = runResolve({ ...Invigorating, _ownerInstanceId: 'char-2' }, {
      activeElements: [char, other, adv],
      action: mockAction({ type: 'attack', actorInstanceId: 'char-1' }),
      rolls: mockRoll({ isSuccess: true }),
      _rng: () => 3 / 4,
    });

    expect(mutations.filter((m) => m.type === 'clearStress')).toHaveLength(0);
  });
});
