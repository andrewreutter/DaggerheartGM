import { describe, it, expect } from 'vitest';
import { Persuasive } from '../../../../src/features-v2/weapon_properties/Persuasive.js';
import { collectChips, activateChip } from '../../../../src/features-v2/engine/chip-system.js';
import { buildTableSnapshot } from '../../../../src/features-v2/engine/table.js';
import { runIntent, mockAction, mockCharacter, mockAdversary, mockGameState, mockChipState } from '../helpers.js';

describe('Persuasive', () => {
  it('offers an intent chip on Presence rolls', () => {
    const { chips } = runIntent(Persuasive, {
      action: mockAction({ type: 'trait', traitKey: 'Presence' }),
    });

    const intentChips = chips.filter((c) => c.placements?.includes('intent'));
    expect(intentChips.length).toBeGreaterThan(0);
    expect(intentChips[0].stressCost).toBe(1);
  });

  it('queues addRollStatic mutation when chip is activated', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const table = buildTableSnapshot(
      mockGameState({
        activeElements: [char],
        _ownerInstanceId: 'char-1',
        action: {
          type: 'trait',
          actorInstanceId: 'char-1',
          targetInstanceIds: [],
          trait: 'Presence',
          range: null,
          effects: [],
          appliedEffects: [],
        },
      })
    );

    const chips = collectChips(
      [{ ...Persuasive, _ownerInstanceId: 'char-1' }],
      'intent',
      table
    );

    expect(chips.length).toBeGreaterThan(0);
    const chipState = mockChipState();
    const mutations = activateChip(chips[0], table, chipState);

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addRollStatic',
        payload: expect.objectContaining({ rollKey: 'action', name: 'Persuasive', value: 2 }),
      })
    );
  });

  it('does not offer a chip on non-Presence rolls', () => {
    const { chips } = runIntent(Persuasive, {
      action: mockAction({ type: 'trait', traitKey: 'Agility' }),
    });

    const intentChips = chips.filter((c) => c.placements?.includes('intent'));
    expect(intentChips).toHaveLength(0);
  });

  it('does not offer a chip when the owner is not acting', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const other = mockCharacter({ instanceId: 'char-2' });

    const { chips } = runIntent(
      { ...Persuasive, _ownerInstanceId: 'char-2' },
      {
        activeElements: [char, other],
        action: mockAction({ type: 'trait', traitKey: 'Presence', actorInstanceId: 'char-1' }),
      }
    );

    const intentChips = chips.filter((c) => c.placements?.includes('intent'));
    expect(intentChips).toHaveLength(0);
  });
});
