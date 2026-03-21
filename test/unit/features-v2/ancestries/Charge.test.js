import { describe, it, expect } from 'vitest';
import { runReviewAction, mockTable, mockChipState, mockCharacter, mockAdversary } from '../helpers.js';
import { Charge } from '../../../../src/features-v2/ancestries/Firbolg.js';
import { applyMutations } from '../../../../src/features-v2/engine/table.js';

describe('Charge', () => {
  // Charge is an Agility Trait Roll to MOVE from Far/Very Far into Melee.
  // There is no attack target — the chip fires after a successful roll when
  // adversaries are now in Melee range and the character's prior position
  // was Far or Very Far from at least one of them.

  const successRolls = {
    action: {
      hopeDie: { value: 8 },
      fearDie: { value: 5 },
      dice: [],
      statics: [],
      isSuccess: true,
    },
  };

  // char at origin; adv in melee range (3 ft); char was 50 ft away → 'far'
  const char = mockCharacter({ instanceId: 'char-1', tokenX: 0, tokenY: 0 });
  const advMelee = mockAdversary({ instanceId: 'adv-1', tokenX: 3, tokenY: 0 });
  const farPrior = { _previousPositions: { 'char-1': { tokenX: 50, tokenY: 0 } } };

  const baseOverrides = {
    activeElements: [char, advMelee],
    actionType: 'trait',
    action: { traitKey: 'Agility' },
    rolls: successRolls,
    ...farPrior,
  };

  it('shows chip after successful Agility trait roll when adversary is now in Melee and was previously Far', () => {
    const result = runReviewAction(Charge, baseOverrides);
    expect(result.chips).toHaveLength(1);
    expect(result.chips[0]._featureName).toBe('Charge');
    expect(result.chips[0].stressCost).toBe(1);
    expect(result.chips[0].placements).toContain('reviewAction');
  });

  it('does not show chip when roll is not successful', () => {
    const result = runReviewAction(Charge, {
      ...baseOverrides,
      rolls: {
        action: { ...successRolls.action, isSuccess: false },
      },
    });
    expect(result.chips).toHaveLength(0);
  });

  it('does not show chip when trait is not Agility', () => {
    const result = runReviewAction(Charge, {
      ...baseOverrides,
      action: { traitKey: 'Strength' },
    });
    expect(result.chips).toHaveLength(0);
  });

  it('does not show chip when action type is not trait', () => {
    const result = runReviewAction(Charge, {
      ...baseOverrides,
      actionType: 'attack',
    });
    expect(result.chips).toHaveLength(0);
  });

  it('does not show chip when not acting', () => {
    const result = runReviewAction(Charge, {
      ...baseOverrides,
      action: { actorInstanceId: 'char-2', traitKey: 'Agility' },
    });
    expect(result.chips).toHaveLength(0);
  });

  it('does not show chip when no adversaries are in Melee range', () => {
    const advFar = mockAdversary({ instanceId: 'adv-1', tokenX: 60, tokenY: 0 }); // far, not melee
    const result = runReviewAction(Charge, {
      ...baseOverrides,
      activeElements: [char, advFar],
    });
    expect(result.chips).toHaveLength(0);
  });

  it('does not show chip when no prior position is recorded', () => {
    const result = runReviewAction(Charge, {
      ...baseOverrides,
      _previousPositions: undefined,
    });
    expect(result.chips).toHaveLength(0);
  });

  it('does not show chip when prior position was only Close (not Far/Very Far)', () => {
    const result = runReviewAction(Charge, {
      ...baseOverrides,
      _previousPositions: { 'char-1': { tokenX: 15, tokenY: 0 } }, // 12 ft from adv-1 at (3,0) → close
    });
    expect(result.chips).toHaveLength(0);
  });

  it('shows chip when prior position was Very Far', () => {
    const result = runReviewAction(Charge, {
      ...baseOverrides,
      _previousPositions: { 'char-1': { tokenX: 160, tokenY: 0 } }, // 157 ft from adv-1 at (3,0) → veryFar
    });
    expect(result.chips).toHaveLength(1);
  });

  it('queues addDamageRoll targeting all melee-range adversaries when chip is used', () => {
    const advMelee2 = mockAdversary({ instanceId: 'adv-2', name: 'Goblin 2', tokenX: 4, tokenY: 0 });
    const advDistant = mockAdversary({ instanceId: 'adv-3', name: 'Archer', tokenX: 80, tokenY: 0 });

    const result = runReviewAction(Charge, {
      ...baseOverrides,
      activeElements: [char, advMelee, advMelee2, advDistant],
    });

    expect(result.chips).toHaveLength(1);
    const chip = result.chips[0];

    const table = mockTable({
      activeElements: [char, advMelee, advMelee2, advDistant],
      actionType: 'trait',
      action: {
        type: 'trait',
        actorInstanceId: 'char-1',
        targetInstanceIds: [],
        trait: 'Agility',
        effects: [],
      },
      rolls: { damage: { dice: [], statics: [] } },
      ...farPrior,
    });

    chip.onUse(table, mockChipState());
    const mutations = applyMutations(table);

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addDamageRoll',
        payload: expect.objectContaining({
          name: 'Charge',
          dice: '1d12',
          damageType: 'physical',
          targetInstanceIds: expect.arrayContaining(['adv-1', 'adv-2']),
        }),
      })
    );

    // Distant adversary should NOT be targeted
    const damageRoll = mutations.find((m) => m.type === 'addDamageRoll');
    expect(damageRoll.payload.targetInstanceIds).not.toContain('adv-3');
  });
});
