import { describe, it, expect } from 'vitest';
import { Dueling } from '../../../../src/features-v2/weapon_properties/Dueling.js';
import { runIntent, mockAction, mockCharacter, mockAdversary, mockRoll } from '../helpers.js';

describe('Dueling', () => {
  it('adds advantage die when only attacker and target are within Close range of the target', () => {
    const char = mockCharacter({ instanceId: 'char-1', tokenX: 0, tokenY: 0 });
    const adv = mockAdversary({ instanceId: 'adv-1', tokenX: 5, tokenY: 0 });

    const { mutations } = runIntent(Dueling, {
      activeElements: [char, adv],
      action: mockAction({ type: 'attack', range: 'melee' }),
      rolls: mockRoll(),
    });

    expect(mutations).toContainEqual(
      expect.objectContaining({ type: 'addAdvantageDie', payload: { rollKey: 'action', name: 'Dueling' } })
    );
  });

  it('does not add advantage when a third creature is within Close range of the target', () => {
    const char = mockCharacter({ instanceId: 'char-1', tokenX: 0, tokenY: 0 });
    const adv = mockAdversary({ instanceId: 'adv-1', tokenX: 5, tokenY: 0 });
    const extra = mockAdversary({ instanceId: 'adv-2', tokenX: 20, tokenY: 0 });

    const { mutations } = runIntent(Dueling, {
      activeElements: [char, adv, extra],
      action: mockAction({ type: 'attack', range: 'melee' }),
      rolls: mockRoll(),
    });

    expect(mutations.filter((m) => m.type === 'addAdvantageDie')).toHaveLength(0);
  });

  it('does not add advantage when the feature owner is not acting', () => {
    const char = mockCharacter({ instanceId: 'char-1', tokenX: 0, tokenY: 0 });
    const other = mockCharacter({ instanceId: 'char-2', tokenX: 50, tokenY: 0 });
    const adv = mockAdversary({ instanceId: 'adv-1', tokenX: 5, tokenY: 0 });

    const { mutations } = runIntent({ ...Dueling, _ownerInstanceId: 'char-2' }, {
      activeElements: [char, other, adv],
      action: mockAction({ type: 'attack', actorInstanceId: 'char-1', range: 'melee' }),
      rolls: mockRoll(),
    });

    expect(mutations.filter((m) => m.type === 'addAdvantageDie')).toHaveLength(0);
  });
});
