import { describe, it, expect } from 'vitest';
import { Scary } from '../../../../src/features-v2/weapon_properties/Scary.js';
import { runResolve, mockRoll, mockAction, mockCharacter, mockAdversary } from '../helpers.js';

describe('Scary', () => {
  it('marks 1 Stress on the target when the attack succeeds', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations } = runResolve(Scary, {
      activeElements: [char, adv],
      action: mockAction({ type: 'attack', actorInstanceId: 'char-1', targetInstanceIds: ['adv-1'] }),
      rolls: mockRoll({ isSuccess: true }),
    });

    expect(mutations).toContainEqual(
      expect.objectContaining({ type: 'markStress', payload: { instanceId: 'adv-1', amount: 1 } })
    );
  });

  it('does not mark Stress when the attack fails', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations } = runResolve(Scary, {
      activeElements: [char, adv],
      action: mockAction({ type: 'attack', actorInstanceId: 'char-1', targetInstanceIds: ['adv-1'] }),
      rolls: mockRoll({ isSuccess: false }),
    });

    expect(mutations.filter((m) => m.type === 'markStress')).toHaveLength(0);
  });

  it('does not mark Stress on a successful non-attack action', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations } = runResolve(Scary, {
      activeElements: [char, adv],
      action: mockAction({ type: 'trait', actorInstanceId: 'char-1', targetInstanceIds: ['adv-1'] }),
      rolls: mockRoll({ isSuccess: true }),
    });

    expect(mutations.filter((m) => m.type === 'markStress')).toHaveLength(0);
  });

  it('does not trigger when the owner is not the acting character', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const other = mockCharacter({ instanceId: 'char-2' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations } = runResolve({ ...Scary, _ownerInstanceId: 'char-2' }, {
      activeElements: [char, other, adv],
      action: mockAction({ type: 'attack', actorInstanceId: 'char-1', targetInstanceIds: ['adv-1'] }),
      rolls: mockRoll({ isSuccess: true }),
    });

    expect(mutations.filter((m) => m.type === 'markStress')).toHaveLength(0);
  });
});
