import { describe, it, expect } from 'vitest';
import { Tusks } from '../../../../src/features-v2/ancestries/Orc.js';
import { runReviewAction, mockTable, mockChipState } from '../helpers.js';
import { applyMutations } from '../../../../src/features-v2/engine/table.js';

describe('Tusks', () => {
  it('shows chip on successful melee attack', () => {
    const result = runReviewAction(Tusks, {
      action: {
        type: 'attack',
        actorInstanceId: 'char-1',
        targetInstanceIds: ['adv-1'],
        range: 'melee',
      },
      rolls: {
        action: {
          hopeDie: { value: 7 },
          fearDie: { value: 4 },
          dice: [],
          statics: [],
          isSuccess: true,
        },
        damage: {
          dice: [{ name: 'weapon', die: 'd8', value: 5 }],
          statics: [],
        },
      },
    });

    expect(result.chips).toHaveLength(1);
    expect(result.chips[0]._featureName).toBe('Tusks');
    expect(result.chips[0].description).toContain('Spend 1 Hope');
    expect(result.chips[0].hopeCost).toBe(1);
    expect(result.chips[0].placements).toContain('reviewAction');
  });

  it('does not show chip on failed attack', () => {
    const result = runReviewAction(Tusks, {
      action: {
        type: 'attack',
        actorInstanceId: 'char-1',
        targetInstanceIds: ['adv-1'],
        range: 'melee',
      },
      rolls: {
        action: {
          hopeDie: { value: 2 },
          fearDie: { value: 4 },
          dice: [],
          statics: [],
          isSuccess: false,
        },
      },
    });

    expect(result.chips).toHaveLength(0);
  });

  it('does not show chip on non-melee attack', () => {
    const result = runReviewAction(Tusks, {
      action: {
        type: 'attack',
        actorInstanceId: 'char-1',
        targetInstanceIds: ['adv-1'],
        range: 'close',
      },
      rolls: {
        action: {
          hopeDie: { value: 7 },
          fearDie: { value: 4 },
          dice: [],
          statics: [],
          isSuccess: true,
        },
      },
    });

    expect(result.chips).toHaveLength(0);
  });

  it('adds 1d6 damage when chip is used', () => {
    const result = runReviewAction(Tusks, {
      action: {
        type: 'attack',
        actorInstanceId: 'char-1',
        targetInstanceIds: ['adv-1'],
        range: 'melee',
      },
      rolls: {
        action: {
          hopeDie: { value: 7 },
          fearDie: { value: 4 },
          dice: [],
          statics: [],
          isSuccess: true,
        },
        damage: {
          dice: [{ name: 'weapon', die: 'd8', value: 4 }],
          statics: [],
        },
      },
    });

    expect(result.chips).toHaveLength(1);
    const chip = result.chips[0];
    
    const table = mockTable({
      action: {
        type: 'attack',
        actorInstanceId: 'char-1',
        targetInstanceIds: ['adv-1'],
        range: 'melee',
      },
      rolls: {
        damage: {
          dice: [],
          statics: [],
        },
      },
    });
    
    chip.onUse(table, mockChipState());
    const mutations = applyMutations(table);
    
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addRollDie',
        payload: expect.objectContaining({
          rollKey: 'damage',
          name: 'Tusks',
          die: 'd6',
        }),
      })
    );
  });
});
