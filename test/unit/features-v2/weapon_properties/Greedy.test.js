import { describe, it, expect } from 'vitest';
import { Greedy } from '../../../../src/features-v2/weapon_properties/Greedy.js';
import { runIntent, mockRoll, mockAction } from '../helpers.js';

describe('Greedy', () => {
  it('shows a toggle chip during intent on attack actions', () => {
    const { chips } = runIntent(Greedy, {
      action: mockAction({ type: 'attack' }),
      rolls: mockRoll(),
    });

    expect(chips).toHaveLength(1);
    expect(chips[0].isToggle).toBe(true);
    expect(chips[0].temporaryStatMods).toEqual({ proficiency: 1 });
  });

  it('does not show chip on non-attack actions', () => {
    const { chips } = runIntent(Greedy, {
      action: mockAction({ type: 'trait' }),
      rolls: mockRoll(),
    });

    expect(chips).toHaveLength(0);
  });
});
