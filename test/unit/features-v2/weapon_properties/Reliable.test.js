import { describe, it, expect } from 'vitest';
import { Reliable } from '../../../../src/features-v2/weapon_properties/Reliable.js';
import { runIntent, mockAction, mockCharacter, mockAdversary } from '../helpers.js';

const reliableMutations = (mutations) =>
  mutations.filter((m) => m.type === 'addRollStatic' && m.payload?.name === 'Reliable');

describe('Reliable', () => {
  it('adds +1 static to the action roll on an attack', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations } = runIntent(Reliable, {
      activeElements: [char, adv],
      action: mockAction({ type: 'attack', actorInstanceId: 'char-1' }),
    });

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addRollStatic',
        payload: expect.objectContaining({ rollKey: 'action', name: 'Reliable', value: 1 }),
      })
    );
  });

  it('does not add a bonus when the owner is not acting', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const other = mockCharacter({ instanceId: 'char-2' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations } = runIntent({ ...Reliable, _ownerInstanceId: 'char-2' }, {
      activeElements: [char, other, adv],
      action: mockAction({ type: 'attack', actorInstanceId: 'char-1' }),
    });

    expect(reliableMutations(mutations)).toHaveLength(0);
  });

  it('does not add a bonus on a non-attack action (e.g. trait roll)', () => {
    const char = mockCharacter({ instanceId: 'char-1' });

    const { mutations } = runIntent(Reliable, {
      activeElements: [char],
      action: mockAction({ type: 'trait', actorInstanceId: 'char-1' }),
    });

    expect(reliableMutations(mutations)).toHaveLength(0);
  });
});
