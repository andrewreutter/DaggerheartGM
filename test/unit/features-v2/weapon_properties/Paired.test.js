import { describe, it, expect } from 'vitest';
import { Paired } from '../../../../src/features-v2/weapon_properties/Paired.js';
import { runIntent, mockRoll, mockAction, mockCharacter, mockAdversary } from '../helpers.js';

describe('Paired', () => {
  it('adds +2 damage static on a melee attack', () => {
    const { mutations } = runIntent(Paired, {
      action: mockAction({ type: 'attack', range: 'melee' }),
      rolls: mockRoll(),
    });

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addRollStatic',
        payload: expect.objectContaining({ rollKey: 'damage', name: 'Paired', value: 2 }),
      })
    );
  });

  it('does not add damage on a non-melee attack', () => {
    const { mutations } = runIntent(Paired, {
      action: mockAction({ type: 'attack', range: 'close' }),
      rolls: mockRoll(),
    });

    const pairedMutations = mutations.filter(
      (m) => m.type === 'addRollStatic' && m.payload?.name === 'Paired'
    );
    expect(pairedMutations).toHaveLength(0);
  });

  it('does not add damage on a non-attack action', () => {
    const { mutations } = runIntent(Paired, {
      action: mockAction({ type: 'trait', range: 'melee' }),
      rolls: mockRoll(),
    });

    const pairedMutations = mutations.filter(
      (m) => m.type === 'addRollStatic' && m.payload?.name === 'Paired'
    );
    expect(pairedMutations).toHaveLength(0);
  });

  it('does not add damage when the feature owner is not the attacker', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const other = mockCharacter({ instanceId: 'char-2' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations } = runIntent({ ...Paired, _ownerInstanceId: 'char-2' }, {
      activeElements: [char, other, adv],
      action: mockAction({ type: 'attack', actorInstanceId: 'char-1', range: 'melee' }),
      rolls: mockRoll(),
    });

    const pairedMutations = mutations.filter(
      (m) => m.type === 'addRollStatic' && m.payload?.name === 'Paired'
    );
    expect(pairedMutations).toHaveLength(0);
  });
});
