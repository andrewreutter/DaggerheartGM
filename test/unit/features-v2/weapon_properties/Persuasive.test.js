import { describe, it, expect } from 'vitest';
import { Persuasive } from '../../../../src/features-v2/weapon_properties/Persuasive.js';
import { runIntent, mockAction, mockChipState } from '../helpers.js';
import { collectChips, activateChip } from '../../../../src/features-v2/engine/chip-system.js';
import { buildTableSnapshot } from '../../../../src/features-v2/engine/table.js';
import { mockGameState } from '../helpers.js';

describe('Persuasive', () => {
  it('offers an intent chip on Presence trait rolls', () => {
    const { chips } = runIntent(Persuasive, {
      action: mockAction({ type: 'trait', traitKey: 'Presence' }),
    });
    expect(chips.some((c) => c.name === 'Persuasive bonus')).toBe(true);
    const chip = chips.find((c) => c.name === 'Persuasive bonus');
    expect(chip.stressCost).toBe(1);
  });

  it('does not offer the chip when the roll is not a Presence trait roll', () => {
    const { chips } = runIntent(Persuasive, {
      action: mockAction({ type: 'trait', traitKey: 'Agility' }),
    });
    expect(chips.filter((c) => c.name === 'Persuasive bonus')).toHaveLength(0);
  });

  it('onUse adds a +2 static to the action roll', () => {
    const table = buildTableSnapshot(
      mockGameState({
        action: {
          type: 'trait',
          actorInstanceId: 'char-1',
          targetInstanceIds: ['adv-1'],
          trait: 'Presence',
          range: 'melee',
          effects: [],
          appliedEffects: [],
        },
      })
    );

    const chips = collectChips([{ ...Persuasive, _ownerInstanceId: 'char-1' }], 'intent', table);
    const chip = chips.find((c) => c.name === 'Persuasive bonus');
    expect(chip).toBeDefined();

    const mutations = activateChip(chip, table, mockChipState());
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addRollStatic',
        payload: expect.objectContaining({ rollKey: 'action', name: 'Persuasive', value: 2 }),
      })
    );
  });
});
