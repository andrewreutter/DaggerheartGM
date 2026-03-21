import { describe, it, expect } from 'vitest';
import { Quick } from '../../../../src/features-v2/weapon_properties/Quick.js';
import { runReviewAction, mockRoll, mockAction, mockCharacter, mockAdversary } from '../helpers.js';
import { collectChips, activateChip, makeChipState } from '../../../../src/features-v2/engine/chip-system.js';
import { buildTableSnapshot } from '../../../../src/features-v2/engine/table.js';
import { mockGameState } from '../helpers.js';

describe('Quick', () => {
  it('offers a reviewAction chip when acting on an attack', () => {
    const { chips } = runReviewAction(Quick, {
      action: mockAction({ type: 'attack' }),
      rolls: mockRoll(),
    });

    const reviewChips = chips.filter((c) => c.placements?.includes('reviewAction'));
    expect(reviewChips).toHaveLength(1);
    expect(reviewChips[0].stressCost).toBe(1);
    expect(reviewChips[0].isToggle).toBe(true);
  });

  it('chip onUse adds narration when toggled on', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const state = mockGameState({
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
    });
    const table = buildTableSnapshot(state);
    const chips = collectChips(
      [{ ...Quick, _ownerInstanceId: 'char-1' }],
      'reviewAction',
      table
    );

    expect(chips.length).toBeGreaterThan(0);
    const chipState = makeChipState();
    const mutations = activateChip(chips[0], table, chipState);

    expect(mutations).toContainEqual(
      expect.objectContaining({ type: 'addNarration' })
    );
  });

  it('does not offer a chip on non-attack actions', () => {
    const { chips } = runReviewAction(Quick, {
      action: mockAction({ type: 'trait' }),
      actionType: 'trait',
      rolls: mockRoll(),
    });

    expect(chips.filter((c) => c.placements?.includes('reviewAction'))).toHaveLength(0);
  });

  it('does not offer a chip when the owner is not acting', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const other = mockCharacter({ instanceId: 'char-2' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { chips } = runReviewAction({ ...Quick, _ownerInstanceId: 'char-2' }, {
      activeElements: [char, other, adv],
      action: mockAction({ type: 'attack', actorInstanceId: 'char-1' }),
      rolls: mockRoll(),
    });

    expect(chips.filter((c) => c.placements?.includes('reviewAction'))).toHaveLength(0);
  });
});
