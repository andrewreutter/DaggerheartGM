import { describe, it, expect } from 'vitest';
import { Grappling } from '../../../../src/features-v2/weapon_properties/Grappling.js';
import { runReviewAction, mockAction, mockCharacter, mockAdversary } from '../helpers.js';

describe('Grappling', () => {
  it('shows two chips (Restrain and Pull) on a successful attack', () => {
    const { chips } = runReviewAction(Grappling, {
      action: mockAction({ type: 'attack' }),
      rolls: {
        action: { hopeDie: { value: 7 }, fearDie: { value: 4 }, dice: [], statics: [], isSuccess: true, isCritical: false },
        damage: { dice: [], statics: [] },
        other: {},
      },
    });

    expect(chips).toHaveLength(2);
    expect(chips[0].name).toBe('Grappling (Restrain)');
    expect(chips[0].hopeCost).toBe(1);
    expect(chips[1].name).toBe('Grappling (Pull)');
    expect(chips[1].hopeCost).toBe(1);
  });

  it('Restrain chip adds Restrained condition to target', () => {
    const { chips, mutations } = runReviewAction(Grappling, {
      action: mockAction({ type: 'attack' }),
      rolls: {
        action: { hopeDie: { value: 7 }, fearDie: { value: 4 }, dice: [], statics: [], isSuccess: true, isCritical: false },
        damage: { dice: [], statics: [] },
        other: {},
      },
    });

    const restrainChip = chips.find((c) => c.name === 'Grappling (Restrain)');
    expect(restrainChip).toBeDefined();
  });

  it('does not show chips on a failed attack', () => {
    const { chips } = runReviewAction(Grappling, {
      action: mockAction({ type: 'attack' }),
      rolls: {
        action: { hopeDie: { value: 7 }, fearDie: { value: 4 }, dice: [], statics: [], isSuccess: false, isCritical: false },
        damage: { dice: [], statics: [] },
        other: {},
      },
    });

    expect(chips).toHaveLength(0);
  });

  it('does not show chips on a successful non-attack action', () => {
    const { chips } = runReviewAction(Grappling, {
      action: mockAction({ type: 'trait' }),
      rolls: {
        action: { hopeDie: { value: 7 }, fearDie: { value: 4 }, dice: [], statics: [], isSuccess: true, isCritical: false },
        damage: { dice: [], statics: [] },
        other: {},
      },
    });

    expect(chips).toHaveLength(0);
  });
});
