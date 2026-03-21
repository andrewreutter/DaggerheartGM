import { describe, it, expect } from 'vitest';
import { Otherworldly } from '../../../../src/features-v2/weapon_properties/Otherworldly.js';
import { buildTableSnapshot } from '../../../../src/features-v2/engine/table.js';
import { activateChip, makeChipState } from '../../../../src/features-v2/engine/chip-system.js';
import { runReviewAction, mockCharacter, mockAdversary, mockAction, mockRoll } from '../helpers.js';

describe('Otherworldly', () => {
  it('offers a reviewAction toggle chip on a successful attack', () => {
    const { chips } = runReviewAction(Otherworldly, {
      action: mockAction({ type: 'attack' }),
      rolls: mockRoll({ isSuccess: true }),
    });

    expect(chips).toHaveLength(1);
    const chip = chips[0];
    expect(chip.isToggle).toBe(true);
    expect(chip.placements).toContain('reviewAction');
  });

  it('attaches gated hook to the chip', () => {
    const { chips } = runReviewAction(Otherworldly, {
      action: mockAction({ type: 'attack' }),
      rolls: mockRoll({ isSuccess: true }),
    });

    expect(chips[0]._gatedHookFn).toBeDefined();
    expect(typeof chips[0]._gatedHookFn).toBe('function');
  });

  function setupChipTest() {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const effects = [
      { type: 'damage', target: { instanceId: 'adv-1' }, amount: 5, damageType: 'physical' },
    ];

    const { chips } = runReviewAction(Otherworldly, {
      activeElements: [char, adv],
      action: {
        ...mockAction({ type: 'attack', actorInstanceId: 'char-1' }),
        effects,
      },
      rolls: mockRoll({ isSuccess: true }),
    });

    const table = buildTableSnapshot({
      activeElements: [char, adv],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Otherworldly',
      action: {
        type: 'attack',
        actorInstanceId: 'char-1',
        targetInstanceIds: ['adv-1'],
        effects,
        appliedEffects: [],
      },
      rolls: mockRoll({ isSuccess: true }),
    });

    return { chip: chips[0], table, effects, chipState: makeChipState() };
  }

  it('switches damage type to magic when chip is toggled on', () => {
    const { chip, table, effects, chipState } = setupChipTest();
    activateChip(chip, table, chipState);

    expect(effects[0].damageType).toBe('magic');
  });

  it('restores damage type to physical when chip is toggled off', () => {
    const { chip, table, effects, chipState } = setupChipTest();

    activateChip(chip, table, chipState);
    expect(effects[0].damageType).toBe('magic');

    activateChip(chip, table, chipState);
    expect(effects[0].damageType).toBe('physical');
  });

  it('does not mutate effects during runPhase (hook is gated)', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const effects = [
      { type: 'damage', target: { instanceId: 'adv-1' }, amount: 5, damageType: 'physical' },
    ];

    runReviewAction(Otherworldly, {
      activeElements: [char, adv],
      action: {
        ...mockAction({ type: 'attack', actorInstanceId: 'char-1' }),
        effects,
      },
      rolls: mockRoll({ isSuccess: true }),
    });

    expect(effects[0].damageType).toBe('physical');
  });

  it('does not offer chip on a failed attack', () => {
    const { chips } = runReviewAction(Otherworldly, {
      action: mockAction({ type: 'attack' }),
      rolls: mockRoll({ isSuccess: false }),
    });

    expect(chips).toHaveLength(0);
  });

  it('does not offer chip on a successful non-attack action', () => {
    const { chips } = runReviewAction(Otherworldly, {
      action: mockAction({ type: 'trait' }),
      rolls: mockRoll({ isSuccess: true }),
    });

    expect(chips).toHaveLength(0);
  });

  it('does not offer chip when the feature owner is not the attacker', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const other = mockCharacter({ instanceId: 'char-2' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { chips } = runReviewAction({ ...Otherworldly, _ownerInstanceId: 'char-2' }, {
      activeElements: [char, other, adv],
      action: mockAction({ type: 'attack', actorInstanceId: 'char-1' }),
      rolls: mockRoll({ isSuccess: true }),
    });

    expect(chips).toHaveLength(0);
  });
});
