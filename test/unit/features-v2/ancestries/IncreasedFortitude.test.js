import { describe, it, expect } from 'vitest';
import { IncreasedFortitude } from '../../../../src/features-v2/ancestries/Dwarf.js';
import { buildTableSnapshot } from '../../../../src/features-v2/engine/table.js';
import { activateChip, makeChipState } from '../../../../src/features-v2/engine/chip-system.js';
import { runReviewAction, mockCharacter, mockAdversary } from '../helpers.js';

describe('Increased Fortitude', () => {
  it('has the correct name and description', () => {
    expect(IncreasedFortitude.name).toBe('Increased Fortitude');
    expect(IncreasedFortitude.description).toMatch(/halve incoming physical damage/i);
  });

  it('has a hook and a chip (no onUse on chip)', () => {
    expect(typeof IncreasedFortitude.hooks.onReviewAction).toBe('function');
    expect(IncreasedFortitude.chips).toHaveLength(1);
  });

  // ---------------------------------------------------------------------------
  // Chip visibility (when() conditions)
  // ---------------------------------------------------------------------------

  it('shows a toggle chip during reviewAction when taking physical damage', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const result = runReviewAction(IncreasedFortitude, {
      activeElements: [char, adv],
      _ownerInstanceId: 'char-1',
      action: {
        actorInstanceId: 'adv-1',
        targetInstanceIds: ['char-1'],
        effects: [
          { type: 'damage', target: char, amount: 6, source: adv, damageType: 'physical' },
        ],
      },
    });

    expect(result.chips).toHaveLength(1);
    expect(result.chips[0]._featureName).toBe('Increased Fortitude');
    expect(result.chips[0].hopeCost).toBe(3);
    expect(result.chips[0].isToggle).toBe(true);
    expect(result.chips[0].placements).toContain('reviewAction');
  });

  it('attaches gated hook to the chip', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const result = runReviewAction(IncreasedFortitude, {
      activeElements: [char, adv],
      _ownerInstanceId: 'char-1',
      action: {
        actorInstanceId: 'adv-1',
        targetInstanceIds: ['char-1'],
        effects: [
          { type: 'damage', target: char, amount: 6, source: adv, damageType: 'physical' },
        ],
      },
    });

    expect(result.chips[0]._gatedHookFn).toBeDefined();
    expect(typeof result.chips[0]._gatedHookFn).toBe('function');
  });

  it('does not show chip when character is not the target', () => {
    const char1 = mockCharacter({ instanceId: 'char-1' });
    const char2 = mockCharacter({ instanceId: 'char-2' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const result = runReviewAction(IncreasedFortitude, {
      activeElements: [char1, char2, adv],
      _ownerInstanceId: 'char-1',
      action: {
        actorInstanceId: 'adv-1',
        targetInstanceIds: ['char-2'],
        effects: [
          { type: 'damage', target: char2, amount: 6, source: adv, damageType: 'physical' },
        ],
      },
    });

    expect(result.chips).toHaveLength(0);
  });

  it('does not show chip for non-physical damage', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const result = runReviewAction(IncreasedFortitude, {
      activeElements: [char, adv],
      _ownerInstanceId: 'char-1',
      action: {
        actorInstanceId: 'adv-1',
        targetInstanceIds: ['char-1'],
        effects: [
          { type: 'damage', target: char, amount: 6, source: adv, damageType: 'magic' },
        ],
      },
    });

    expect(result.chips).toHaveLength(0);
  });

  it('does not show chip when damage is 0', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const result = runReviewAction(IncreasedFortitude, {
      activeElements: [char, adv],
      _ownerInstanceId: 'char-1',
      action: {
        actorInstanceId: 'adv-1',
        targetInstanceIds: ['char-1'],
        effects: [
          { type: 'damage', target: char, amount: 0, source: adv, damageType: 'physical' },
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
      { type: 'damage', target: char, amount: damageAmount, source: adv, damageType: 'physical' },
    ];

    const { chips } = runReviewAction(IncreasedFortitude, {
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
      _featureKey: 'Increased Fortitude',
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

  it('halves damage when toggled on (rounds up)', () => {
    const { chip, table, effects, chipState } = setupChipTest(7);
    activateChip(chip, table, chipState);

    expect(effects[0].amount).toBe(4);
  });

  it('halves even damage correctly', () => {
    const { chip, table, effects, chipState } = setupChipTest(6);
    activateChip(chip, table, chipState);

    expect(effects[0].amount).toBe(3);
  });

  it('restores original damage when toggled off', () => {
    const { chip, table, effects, chipState } = setupChipTest(7);

    activateChip(chip, table, chipState);
    expect(effects[0].amount).toBe(4); // 7 / 2 = 3.5, rounds up to 4

    activateChip(chip, table, chipState);
    expect(effects[0].amount).toBe(7); // Restores original
  });

  it('survives repeated toggle cycles', () => {
    const { chip, table, effects, chipState } = setupChipTest(10);

    activateChip(chip, table, chipState);
    expect(effects[0].amount).toBe(5);

    activateChip(chip, table, chipState);
    expect(effects[0].amount).toBe(10);

    activateChip(chip, table, chipState);
    expect(effects[0].amount).toBe(5);

    activateChip(chip, table, chipState);
    expect(effects[0].amount).toBe(10);
  });

  // ---------------------------------------------------------------------------
  // Hook does not run ungated during runPhase
  // ---------------------------------------------------------------------------

  it('does not mutate effects during runPhase (hook is gated)', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const effects = [
      { type: 'damage', target: char, amount: 10, source: adv, damageType: 'physical' },
    ];

    runReviewAction(IncreasedFortitude, {
      activeElements: [char, adv],
      _ownerInstanceId: 'char-1',
      action: {
        actorInstanceId: 'adv-1',
        targetInstanceIds: ['char-1'],
        effects,
      },
    });

    expect(effects[0].amount).toBe(10);
  });
});
