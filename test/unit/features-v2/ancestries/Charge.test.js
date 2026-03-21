import { describe, it, expect } from 'vitest';
import { runReviewAction, mockTable, mockChipState, mockCharacter, mockAdversary } from '../helpers.js';
import { Charge } from '../../../../src/features-v2/ancestries/Firbolg.js';
import { applyMutations } from '../../../../src/features-v2/engine/table.js';

describe('Charge', () => {
  const baseAction = {
    type: 'attack',
    actorInstanceId: 'char-1',
    targetInstanceIds: ['adv-1'],
    traitKey: 'Agility',
    range: 'melee',
  };

  const successRolls = {
    action: {
      hopeDie: { value: 8 },
      fearDie: { value: 5 },
      dice: [],
      statics: [],
      isSuccess: true,
    },
  };

  it('shows chip during reviewAction phase on successful Agility attack roll with melee range', () => {
    const result = runReviewAction(Charge, {
      action: baseAction,
      rolls: successRolls,
    });

    expect(result.chips).toHaveLength(1);
    expect(result.chips[0]._featureName).toBe('Charge');
    expect(result.chips[0].stressCost).toBe(1);
    expect(result.chips[0].placements).toContain('reviewAction');
  });

  it('does not show chip when roll is not successful', () => {
    const result = runReviewAction(Charge, {
      action: baseAction,
      rolls: {
        action: { ...successRolls.action, hopeDie: { value: 3 }, fearDie: { value: 2 }, isSuccess: false },
      },
    });

    expect(result.chips).toHaveLength(0);
  });

  it('does not show chip when trait is not Agility', () => {
    const result = runReviewAction(Charge, {
      action: { ...baseAction, traitKey: 'Strength' },
      rolls: successRolls,
    });

    expect(result.chips).toHaveLength(0);
  });

  it('does not show chip when range is not melee', () => {
    const result = runReviewAction(Charge, {
      action: { ...baseAction, range: 'close' },
      rolls: successRolls,
    });

    expect(result.chips).toHaveLength(0);
  });

  it('does not show chip when not acting', () => {
    const result = runReviewAction(Charge, {
      action: { ...baseAction, actorInstanceId: 'char-2' },
      rolls: successRolls,
    });

    expect(result.chips).toHaveLength(0);
  });

  it('queues addDamageRoll targeting melee-range adversaries when chip is used', () => {
    const char = mockCharacter({ instanceId: 'char-1', tokenX: 0, tokenY: 0 });
    const advClose = mockAdversary({ instanceId: 'adv-1', name: 'Goblin', tokenX: 5, tokenY: 0 });
    const advFar = mockAdversary({ instanceId: 'adv-2', name: 'Archer', tokenX: 100, tokenY: 0 });

    const result = runReviewAction(Charge, {
      activeElements: [char, advClose, advFar],
      action: { ...baseAction, targetInstanceIds: ['adv-1'] },
      rolls: { ...successRolls, damage: { dice: [], statics: [] } },
    });

    expect(result.chips).toHaveLength(1);
    const chip = result.chips[0];

    const table = mockTable({
      activeElements: [char, advClose, advFar],
      action: {
        type: 'attack',
        actorInstanceId: 'char-1',
        targetInstanceIds: ['adv-1'],
        trait: 'Agility',
        range: 'melee',
        effects: [],
      },
      rolls: { damage: { dice: [], statics: [] } },
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
          targetInstanceIds: ['adv-1'],
        }),
      })
    );
  });

  it('falls back to action targets when no adversaries are in melee range', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const result = runReviewAction(Charge, {
      activeElements: [char, adv],
      action: baseAction,
      rolls: { ...successRolls, damage: { dice: [], statics: [] } },
    });

    expect(result.chips).toHaveLength(1);
    const chip = result.chips[0];

    const table = mockTable({
      activeElements: [char, adv],
      action: {
        type: 'attack',
        actorInstanceId: 'char-1',
        targetInstanceIds: ['adv-1'],
        trait: 'Agility',
        range: 'melee',
        effects: [],
      },
      rolls: { damage: { dice: [], statics: [] } },
    });

    chip.onUse(table, mockChipState());
    const mutations = applyMutations(table);

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addDamageRoll',
        payload: expect.objectContaining({
          name: 'Charge',
          targetInstanceIds: ['adv-1'],
        }),
      })
    );
  });
});
