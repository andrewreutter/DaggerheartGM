import { describe, it, expect } from 'vitest';
import { Otherworldly } from '../../../../src/features-v2/weapon_properties/Otherworldly.js';
import { runReviewAction, mockRoll, mockAction, mockCharacter, mockAdversary, mockTable } from '../helpers.js';

describe('Otherworldly', () => {
  it('shows toggle chip on successful attack', () => {
    const { chips } = runReviewAction(Otherworldly, {
      action: mockAction({ type: 'attack' }),
      rolls: mockRoll({ isSuccess: true }),
    });

    const toggleChip = chips.find((c) => c.isToggle);
    expect(toggleChip).toBeDefined();
    expect(toggleChip.placements).toContain('reviewAction');
  });

  it('hook changes damage type to magic when called directly', () => {
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const effects = [
      { type: 'damage', target: adv, amount: 5, damageType: 'physical' },
    ];

    const table = mockTable({
      action: {
        type: 'attack',
        actorInstanceId: 'char-1',
        targetInstanceIds: ['adv-1'],
        trait: 'Agility',
        range: 'melee',
        effects,
        appliedEffects: [],
      },
      rolls: mockRoll({ isSuccess: true }),
    });

    Otherworldly.hooks.onReviewAction(table);

    expect(effects[0].damageType).toBe('magic');
  });

  it('does not show chip on failed attack', () => {
    const { chips } = runReviewAction(Otherworldly, {
      action: mockAction({ type: 'attack' }),
      rolls: mockRoll({ isSuccess: false }),
    });

    const toggleChip = chips.find((c) => c.isToggle);
    expect(toggleChip).toBeUndefined();
  });

  it('does not show chip on non-attack action', () => {
    const { chips } = runReviewAction(Otherworldly, {
      action: mockAction({ type: 'trait' }),
      rolls: mockRoll({ isSuccess: true }),
    });

    const toggleChip = chips.find((c) => c.isToggle);
    expect(toggleChip).toBeUndefined();
  });

  it('does not show chip when not acting', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const other = mockCharacter({ instanceId: 'char-2' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { chips } = runReviewAction({ ...Otherworldly, _ownerInstanceId: 'char-2' }, {
      activeElements: [char, other, adv],
      action: mockAction({ type: 'attack', actorInstanceId: 'char-1' }),
      rolls: mockRoll({ isSuccess: true }),
    });

    const toggleChip = chips.find((c) => c.isToggle);
    expect(toggleChip).toBeUndefined();
  });
});
