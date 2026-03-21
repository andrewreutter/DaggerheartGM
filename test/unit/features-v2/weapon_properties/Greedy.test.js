import { describe, it, expect } from 'vitest';
import { Greedy } from '../../../../src/features-v2/weapon_properties/Greedy.js';
import { runIntent, mockAction, mockCharacter, mockAdversary, mockChipState } from '../helpers.js';
import { collectChips, activateChip } from '../../../../src/features-v2/engine/chip-system.js';
import { buildTableSnapshot } from '../../../../src/features-v2/engine/table.js';
import { mockGameState } from '../helpers.js';

describe('Greedy', () => {
  it('offers an intent toggle chip when acting on an attack', () => {
    const { chips } = runIntent(Greedy, {
      action: mockAction({ type: 'attack' }),
    });

    expect(chips.length).toBeGreaterThan(0);
    const chip = chips[0];
    expect(chip.isToggle).toBe(true);
    expect(chip.placements).toContain('intent');
  });

  it('chip has temporaryStatMods proficiency: 1', () => {
    const { chips } = runIntent(Greedy, {
      action: mockAction({ type: 'attack' }),
    });

    const chip = chips[0];
    expect(chip.temporaryStatMods).toEqual({ proficiency: 1 });
  });

  it('does not offer chip on non-attack actions', () => {
    const { chips } = runIntent(Greedy, {
      action: mockAction({ type: 'trait' }),
    });

    expect(chips.filter((c) => c.placements?.includes('intent'))).toHaveLength(0);
  });

  it('does not offer chip when the character is not acting', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const other = mockCharacter({ instanceId: 'char-2' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { chips } = runIntent({ ...Greedy, _ownerInstanceId: 'char-2' }, {
      activeElements: [char, other, adv],
      action: mockAction({ type: 'attack', actorInstanceId: 'char-1' }),
    });

    expect(chips.filter((c) => c.placements?.includes('intent'))).toHaveLength(0);
  });

  it('queues addTemporaryStatMod mutation when chip is toggled on', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const table = buildTableSnapshot(
      mockGameState({
        activeElements: [char, adv],
        _ownerInstanceId: 'char-1',
        action: {
          type: 'attack',
          actorInstanceId: 'char-1',
          targetInstanceIds: ['adv-1'],
          trait: 'Agility',
          range: 'melee',
          effects: [],
          appliedEffects: [],
        },
      })
    );

    const chips = collectChips(
      [{ ...Greedy, _ownerInstanceId: 'char-1' }],
      'intent',
      table
    );

    expect(chips.length).toBeGreaterThan(0);
    const chip = chips[0];
    const chipState = mockChipState();
    const mutations = activateChip(chip, table, chipState);

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addTemporaryStatMod',
        payload: expect.objectContaining({ instanceId: 'char-1', stat: 'proficiency', value: 1 }),
      })
    );
  });
});
