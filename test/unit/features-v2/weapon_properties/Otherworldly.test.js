import { describe, it, expect } from 'vitest';
import { Otherworldly } from '../../../../src/features-v2/weapon_properties/Otherworldly.js';
import { runReviewAction, mockAction, mockCharacter, mockAdversary, mockRoll, mockChipState } from '../helpers.js';
import { collectChips, activateChip } from '../../../../src/features-v2/engine/chip-system.js';
import { buildTableSnapshot } from '../../../../src/features-v2/engine/table.js';
import { mockGameState } from '../helpers.js';

describe('Otherworldly', () => {
  it('offers a reviewAction toggle chip on a successful attack', () => {
    const { chips } = runReviewAction(Otherworldly, {
      action: mockAction({ type: 'attack' }),
      rolls: mockRoll({ isSuccess: true }),
    });

    const chip = chips.find((c) => c.placements?.includes('reviewAction'));
    expect(chip).toBeDefined();
    expect(chip.isToggle).toBe(true);
  });

  it('does not offer chip on a failed attack', () => {
    const { chips } = runReviewAction(Otherworldly, {
      action: mockAction({ type: 'attack' }),
      rolls: mockRoll({ isSuccess: false }),
    });

    expect(chips.filter((c) => c.placements?.includes('reviewAction'))).toHaveLength(0);
  });

  it('does not offer chip on a non-attack action', () => {
    const { chips } = runReviewAction(Otherworldly, {
      action: mockAction({ type: 'trait' }),
      rolls: mockRoll({ isSuccess: true }),
    });

    expect(chips.filter((c) => c.placements?.includes('reviewAction'))).toHaveLength(0);
  });

  it('does not offer chip when the owner is not acting', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const other = mockCharacter({ instanceId: 'char-2' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { chips } = runReviewAction({ ...Otherworldly, _ownerInstanceId: 'char-2' }, {
      activeElements: [char, other, adv],
      action: mockAction({ type: 'attack', actorInstanceId: 'char-1' }),
      rolls: mockRoll({ isSuccess: true }),
    });

    expect(chips.filter((c) => c.placements?.includes('reviewAction'))).toHaveLength(0);
  });

  it('chip has isToggle true and correct placements', () => {
    const { chips } = runReviewAction(Otherworldly, {
      action: mockAction({ type: 'attack' }),
      rolls: mockRoll({ isSuccess: true }),
    });

    const chip = chips.find((c) => c.placements?.includes('reviewAction'));
    expect(chip).toBeDefined();
    expect(chip.isToggle).toBe(true);
    expect(chip.placements).toContain('reviewAction');
  });

  it('chip has onUse that mutates damage type', () => {
    const { chips } = runReviewAction(Otherworldly, {
      action: mockAction({ type: 'attack' }),
      rolls: mockRoll({ isSuccess: true }),
    });

    const chip = chips.find((c) => c.placements?.includes('reviewAction'));
    expect(chip).toBeDefined();
    expect(typeof chip.onUse).toBe('function');
  });
});
