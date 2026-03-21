import { describe, it, expect } from 'vitest';
import { Greedy } from '../../../../src/features-v2/weapon_properties/Greedy.js';
import { runIntent, mockAction, mockCharacter, mockAdversary } from '../helpers.js';

describe('Greedy', () => {
  it('offers an intent toggle chip on an attack action', () => {
    const { chips } = runIntent(Greedy, {
      action: mockAction({ type: 'attack' }),
    });

    expect(chips).toHaveLength(1);
    const chip = chips[0];
    expect(chip.isToggle).toBe(true);
    expect(chip.placements).toContain('intent');
    expect(chip.temporaryStatMods).toEqual({ proficiency: 1 });
  });

  it('does not offer a chip on a non-attack action', () => {
    const { chips } = runIntent(Greedy, {
      action: mockAction({ type: 'trait' }),
    });

    expect(chips.filter((c) => c.placements?.includes('intent'))).toHaveLength(0);
  });

  it('does not offer a chip when the feature owner is not acting', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const other = mockCharacter({ instanceId: 'char-2' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { chips } = runIntent({ ...Greedy, _ownerInstanceId: 'char-2' }, {
      activeElements: [char, other, adv],
      action: mockAction({ type: 'attack', actorInstanceId: 'char-1' }),
    });

    expect(chips.filter((c) => c.placements?.includes('intent'))).toHaveLength(0);
  });
});
