import { describe, it, expect } from 'vitest';
import { Quick } from '../../../../src/features-v2/weapon_properties/Quick.js';
import { runReviewAction, mockRoll, mockAction, mockCharacter, mockAdversary } from '../helpers.js';

describe('Quick', () => {
  it('offers a reviewAction chip on attacks', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { chips } = runReviewAction(Quick, {
      activeElements: [char, adv],
      action: mockAction({ type: 'attack', actorInstanceId: 'char-1', targetInstanceIds: ['adv-1'] }),
      rolls: mockRoll(),
    });

    const reviewChips = chips.filter((c) => c.placements?.includes('reviewAction'));
    expect(reviewChips.length).toBeGreaterThan(0);
    expect(reviewChips[0].stressCost).toBe(1);
  });

  it('does not offer a chip on non-attack actions', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { chips } = runReviewAction(Quick, {
      activeElements: [char, adv],
      action: mockAction({ type: 'trait', actorInstanceId: 'char-1' }),
      rolls: mockRoll(),
    });

    const reviewChips = chips.filter((c) => c.placements?.includes('reviewAction'));
    expect(reviewChips).toHaveLength(0);
  });

  it('does not offer a chip when the owner is not acting', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const other = mockCharacter({ instanceId: 'char-2' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { chips } = runReviewAction(
      { ...Quick, _ownerInstanceId: 'char-2' },
      {
        activeElements: [char, other, adv],
        action: mockAction({ type: 'attack', actorInstanceId: 'char-1', targetInstanceIds: ['adv-1'] }),
        rolls: mockRoll(),
      }
    );

    const reviewChips = chips.filter((c) => c.placements?.includes('reviewAction'));
    expect(reviewChips).toHaveLength(0);
  });
});
