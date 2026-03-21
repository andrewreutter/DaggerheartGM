import { describe, it, expect } from 'vitest';
import { ThickSkin } from '../../../../src/features-v2/ancestries/Dwarf.js';
import { buildTableSnapshot } from '../../../../src/features-v2/engine/table.js';
import { activateChip, makeChipState } from '../../../../src/features-v2/engine/chip-system.js';
import { runReviewOutcome, mockCharacter, mockAdversary } from '../helpers.js';

describe('ThickSkin', () => {
  it('has a gated onReviewOutcome hook and no onUse on chip', () => {
    expect(typeof ThickSkin.hooks.onReviewOutcome).toBe('function');
    expect(ThickSkin.chips).toHaveLength(1);
  });

  it('shows a toggle chip during review when taking Minor damage (1 HP)', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const result = runReviewOutcome(ThickSkin, {
      activeElements: [char, adv],
      _ownerInstanceId: 'char-1',
      action: {
        actorInstanceId: 'adv-1',
        targetInstanceIds: ['char-1'],
        effects: [
          { stat: 'currentHP', target: char, amount: 1, source: adv },
        ],
      },
    });

    expect(result.chips).toHaveLength(1);
    expect(result.chips[0]._featureName).toBe('Thick Skin');
    expect(result.chips[0].stressCost).toBe(2);
    expect(result.chips[0].isToggle).toBe(true);
    expect(result.chips[0].placements).toContain('reviewOutcome');
  });

  it('attaches gated hook to the chip', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const result = runReviewOutcome(ThickSkin, {
      activeElements: [char, adv],
      _ownerInstanceId: 'char-1',
      action: {
        actorInstanceId: 'adv-1',
        targetInstanceIds: ['char-1'],
        effects: [
          { stat: 'currentHP', target: char, amount: 1, source: adv },
        ],
      },
    });

    expect(result.chips[0]._gatedHookFn).toBeDefined();
    expect(typeof result.chips[0]._gatedHookFn).toBe('function');
  });

  it('does not show chip when damage is greater than 1 HP (not Minor)', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const result = runReviewOutcome(ThickSkin, {
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

  it('does not show chip when damage is 0 HP', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const result = runReviewOutcome(ThickSkin, {
      activeElements: [char, adv],
      _ownerInstanceId: 'char-1',
      action: {
        actorInstanceId: 'adv-1',
        targetInstanceIds: ['char-1'],
        effects: [
          { stat: 'currentHP', target: char, amount: 0, source: adv },
        ],
      },
    });

    expect(result.chips).toHaveLength(0);
  });

  it('does not show chip when character is not the target', () => {
    const char1 = mockCharacter({ instanceId: 'char-1' });
    const char2 = mockCharacter({ instanceId: 'char-2' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const result = runReviewOutcome(ThickSkin, {
      activeElements: [char1, char2, adv],
      _ownerInstanceId: 'char-1',
      action: {
        actorInstanceId: 'adv-1',
        targetInstanceIds: ['char-2'],
        effects: [
          { stat: 'currentHP', target: char2, amount: 1, source: adv },
        ],
      },
    });

    expect(result.chips).toHaveLength(0);
  });

  // ---------------------------------------------------------------------------
  // Gated hook via activateChip
  // ---------------------------------------------------------------------------

  function setupChipTest() {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const effects = [
      { stat: 'currentHP', target: char, amount: 1, source: adv },
    ];

    const { chips } = runReviewOutcome(ThickSkin, {
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
      _featureKey: 'Thick Skin',
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

  it('sets damage to 0 when chip is activated', () => {
    const { chip, table, effects, chipState } = setupChipTest();
    activateChip(chip, table, chipState);

    expect(effects[0].amount).toBe(0);
  });

  it('restores original damage when toggled off', () => {
    const { chip, table, effects, chipState } = setupChipTest();

    activateChip(chip, table, chipState);
    expect(effects[0].amount).toBe(0);

    activateChip(chip, table, chipState);
    expect(effects[0].amount).toBe(1);
  });

  it('does not mutate effects during runPhase (hook is gated)', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const effects = [
      { stat: 'currentHP', target: char, amount: 1, source: adv },
    ];

    runReviewOutcome(ThickSkin, {
      activeElements: [char, adv],
      _ownerInstanceId: 'char-1',
      action: {
        actorInstanceId: 'adv-1',
        targetInstanceIds: ['char-1'],
        effects,
      },
    });

    expect(effects[0].amount).toBe(1);
  });
});
