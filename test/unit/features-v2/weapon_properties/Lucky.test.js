import { describe, it, expect } from 'vitest';
import { Lucky } from '../../../../src/features-v2/weapon_properties/Lucky.js';
import { runReviewAction, mockRoll, mockAction, mockCharacter, mockAdversary, mockChipState } from '../helpers.js';
import { collectChips, activateChip } from '../../../../src/features-v2/engine/chip-system.js';
import { buildTableSnapshot } from '../../../../src/features-v2/engine/table.js';
import { mockGameState } from '../helpers.js';

describe('Lucky', () => {
  it('offers a reviewAction chip when attack fails', () => {
    const { chips } = runReviewAction(Lucky, {
      action: mockAction({ type: 'attack' }),
      rolls: mockRoll({ isSuccess: false }),
    });

    const chip = chips.find((c) => c.placements?.includes('reviewAction'));
    expect(chip).toBeDefined();
    expect(chip.stressCost).toBe(1);
  });

  it('does not offer a chip when attack succeeds', () => {
    const { chips } = runReviewAction(Lucky, {
      action: mockAction({ type: 'attack' }),
      rolls: mockRoll({ isSuccess: true }),
    });

    expect(chips.filter((c) => c.placements?.includes('reviewAction'))).toHaveLength(0);
  });

  it('does not offer a chip on non-attack actions', () => {
    const { chips } = runReviewAction(Lucky, {
      action: mockAction({ type: 'trait' }),
      rolls: mockRoll({ isSuccess: false }),
    });

    expect(chips.filter((c) => c.placements?.includes('reviewAction'))).toHaveLength(0);
  });

  it('does not offer a chip when the owner is not acting', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const other = mockCharacter({ instanceId: 'char-2' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { chips } = runReviewAction({ ...Lucky, _ownerInstanceId: 'char-2' }, {
      activeElements: [char, other, adv],
      action: mockAction({ type: 'attack', actorInstanceId: 'char-1' }),
      rolls: mockRoll({ isSuccess: false }),
    });

    expect(chips.filter((c) => c.placements?.includes('reviewAction'))).toHaveLength(0);
  });

  it('queues action roll reroll when chip is activated', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const table = buildTableSnapshot(
      mockGameState({
        activeElements: [char, adv],
        _ownerInstanceId: 'char-1',
        rolls: mockRoll({ isSuccess: false }),
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
      [{ ...Lucky, _ownerInstanceId: 'char-1' }],
      'reviewAction',
      table
    );

    expect(chips.length).toBeGreaterThan(0);
    const chip = chips[0];
    const chipState = mockChipState();
    const mutations = activateChip(chip, table, chipState);

    expect(mutations).toContainEqual(
      expect.objectContaining({ type: 'rerollDie' })
    );
  });
});
