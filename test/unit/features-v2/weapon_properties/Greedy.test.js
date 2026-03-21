import { describe, it, expect } from 'vitest';
import { Greedy } from '../../../../src/features-v2/weapon_properties/Greedy.js';
import { runIntent, mockAction, mockCharacter, mockAdversary } from '../helpers.js';

describe('Greedy', () => {
  it('shows a toggle chip on attack actions', () => {
    const { chips } = runIntent(Greedy, {
      action: mockAction({ type: 'attack' }),
    });

    expect(chips).toHaveLength(1);
    expect(chips[0].isToggle).toBe(true);
    expect(chips[0].temporaryStatMods).toEqual({ proficiency: 1 });
  });

  it('does not show chip on non-attack actions', () => {
    const { chips } = runIntent(Greedy, {
      action: mockAction({ type: 'trait' }),
    });

    expect(chips).toHaveLength(0);
  });

  it('does not show chip when the owner is not acting', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const other = mockCharacter({ instanceId: 'char-2' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { chips } = runIntent({ ...Greedy, _ownerInstanceId: 'char-2' }, {
      activeElements: [char, other, adv],
      action: mockAction({ type: 'attack', actorInstanceId: 'char-1' }),
    });

    expect(chips).toHaveLength(0);
  });
});
