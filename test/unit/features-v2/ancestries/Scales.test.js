import { describe, it, expect } from 'vitest';
import { Scales } from '../../../../src/features-v2/ancestries/Drakona.js';
import { buildTableSnapshot } from '../../../../src/features-v2/engine/table.js';
import { activateChip, makeChipState } from '../../../../src/features-v2/engine/chip-system.js';
import { runReviewOutcome, mockCharacter, mockAdversary } from '../helpers.js';

describe('Scales', () => {
  it('has a gated onReviewOutcome hook and no onUse on chip', () => {
    expect(typeof Scales.hooks.onReviewOutcome).toBe('function');
    expect(Scales.chips).toHaveLength(1);
  });

  it('shows a toggle chip during review when taking Severe damage (3+ HP)', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const result = runReviewOutcome(Scales, {
      activeElements: [char, adv],
      _ownerInstanceId: 'char-1',
      action: {
        actorInstanceId: 'adv-1',
        targetInstanceIds: ['char-1'],
        effects: [
          { stat: 'currentHP', target: char, amount: 3, source: adv },
        ],
      },
    });

    expect(result.chips).toHaveLength(1);
    expect(result.chips[0]._featureName).toBe('Scales');
    expect(result.chips[0].stressCost).toBe(1);
    expect(result.chips[0].isToggle).toBe(true);
    expect(result.chips[0].placements).toContain('reviewOutcome');
  });

  it('attaches gated hook to the chip', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const result = runReviewOutcome(Scales, {
      activeElements: [char, adv],
      _ownerInstanceId: 'char-1',
      action: {
        actorInstanceId: 'adv-1',
        targetInstanceIds: ['char-1'],
        effects: [
          { stat: 'currentHP', target: char, amount: 3, source: adv },
        ],
      },
    });

    expect(result.chips[0]._gatedHookFn).toBeDefined();
    expect(typeof result.chips[0]._gatedHookFn).toBe('function');
  });

  it('shows chip for damage exceeding 3 HP', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const result = runReviewOutcome(Scales, {
      activeElements: [char, adv],
      _ownerInstanceId: 'char-1',
      action: {
        actorInstanceId: 'adv-1',
        targetInstanceIds: ['char-1'],
        effects: [
          { stat: 'currentHP', target: char, amount: 5, source: adv },
        ],
      },
    });

    expect(result.chips).toHaveLength(1);
  });

  it('does not show chip when damage is less than 3 HP', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const result = runReviewOutcome(Scales, {
      activeElements: [char, adv],
      _ownerInstanceId: 'char-1',
      action: {
        actorInstanceId: 'adv-1',
        targetInstanceIds: ['char-1'],
        effects: [
          { stat: 'currentHP', target: char, amount: 2, source: adv },
        ],
      },
    });

    expect(result.chips).toHaveLength(0);
  });

  it('does not show chip when character is not the target', () => {
    const char1 = mockCharacter({ instanceId: 'char-1' });
    const char2 = mockCharacter({ instanceId: 'char-2' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const result = runReviewOutcome(Scales, {
      activeElements: [char1, char2, adv],
      _ownerInstanceId: 'char-1',
      action: {
        actorInstanceId: 'adv-1',
        targetInstanceIds: ['char-2'],
        effects: [
          { stat: 'currentHP', target: char2, amount: 3, source: adv },
        ],
      },
    });

    expect(result.chips).toHaveLength(0);
  });

  // ---------------------------------------------------------------------------
  // Gated hook via activateChip
  // ---------------------------------------------------------------------------

  function setupChipTest(damageAmount) {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const effects = [
      { stat: 'currentHP', target: char, amount: damageAmount, source: adv },
    ];

    const { chips } = runReviewOutcome(Scales, {
      activeElements: [char, adv],
      _ownerInstanceId: 'char-1',
      action: {
        actorInstanceId: 'adv-1',
        targetInstanceIds: ['char-1'],
        effects,
      },
    });

    const table = buildTableSnapshot({
      activeElements: [char, adv],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Scales',
      action: {
        type: 'attack',
        actorInstanceId: 'adv-1',
        targetInstanceIds: ['char-1'],
        effects,
        appliedEffects: [],
      },
    });

    return { chip: chips[0], table, effects, chipState: makeChipState() };
  }

  it('reduces HP loss by 1 when chip is activated', () => {
    const { chip, table, effects, chipState } = setupChipTest(4);
    activateChip(chip, table, chipState);

    expect(effects[0].amount).toBe(3);
  });

  it('restores original HP loss when toggled off', () => {
    const { chip, table, effects, chipState } = setupChipTest(4);

    activateChip(chip, table, chipState);
    expect(effects[0].amount).toBe(3);

    activateChip(chip, table, chipState);
    expect(effects[0].amount).toBe(4);
  });

  it('does not mutate effects during runPhase (hook is gated)', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const effects = [
      { stat: 'currentHP', target: char, amount: 5, source: adv },
    ];

    runReviewOutcome(Scales, {
      activeElements: [char, adv],
      _ownerInstanceId: 'char-1',
      action: {
        actorInstanceId: 'adv-1',
        targetInstanceIds: ['char-1'],
        effects,
      },
    });

    expect(effects[0].amount).toBe(5);
  });
});
