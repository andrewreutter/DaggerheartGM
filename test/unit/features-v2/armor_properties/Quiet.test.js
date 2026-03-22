import { describe, it, expect } from 'vitest';
import { Quiet } from '../../../../src/features-v2/armor_properties/Quiet.js';
import {
  runIntent,
  mockCharacter,
  mockAdversary,
  mockAction,
  mockGameState,
  mockChipState,
} from '../helpers.js';
import { collectChips, activateChip } from '../../../../src/features-v2/engine/chip-system.js';
import { buildTableSnapshot } from '../../../../src/features-v2/engine/table.js';

describe('Quiet', () => {
  it('has a single chip for the intent phase', () => {
    expect(Array.isArray(Quiet.chips)).toBe(true);
    expect(Quiet.chips).toHaveLength(1);
  });

  it('the chip adds +2 static when the owner activates it during a roll', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { chips } = runIntent(Quiet, {
      activeElements: [char, adv],
      action: {
        ...mockAction({ type: 'action', actorInstanceId: 'char-1' }),
        effects: [],
      },
      actionType: 'action',
    });

    // A chip should be offered to the acting character
    expect(chips.length).toBeGreaterThan(0);
    const chip = chips[0];
    expect(chip.placements).toContain('intent');
  });

  it('chip onUse queues addRollStatic with name Quiet and value 2', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const table = buildTableSnapshot(
      mockGameState({
        activeElements: [char, adv],
        _ownerInstanceId: 'char-1',
        action: {
          type: 'action',
          actorInstanceId: 'char-1',
          targetInstanceIds: ['adv-1'],
          trait: 'Agility',
          range: 'melee',
          effects: [],
          appliedEffects: [],
        },
      })
    );

    const chips = collectChips([{ ...Quiet, _ownerInstanceId: 'char-1' }], 'intent', table);

    expect(chips.length).toBeGreaterThan(0);
    const chip = chips[0];
    const chipState = mockChipState();
    const mutations = activateChip(chip, table, chipState);

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addRollStatic',
        payload: expect.objectContaining({ name: 'Quiet', value: 2 }),
      })
    );
  });

  it('does not offer chip to non-acting character', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const other = mockCharacter({ instanceId: 'char-2' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    // char-2 owns the Quiet feature, but char-1 is acting
    const { chips } = runIntent(
      { ...Quiet, _ownerInstanceId: 'char-2' },
      {
        activeElements: [char, other, adv],
        action: {
          ...mockAction({ type: 'action', actorInstanceId: 'char-1' }),
          effects: [],
        },
        actionType: 'action',
      }
    );

    expect(chips.filter((c) => c.placements?.includes('intent'))).toHaveLength(0);
  });
});
