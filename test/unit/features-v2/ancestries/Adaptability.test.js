import { describe, it, expect } from 'vitest';
import { Adaptability } from '../../../../src/features-v2/ancestries/Human.js';
import { runReviewOutcome, mockTable, mockChipState } from '../helpers.js';
import { applyMutations } from '../../../../src/features-v2/engine/table.js';

describe('Adaptability', () => {
  it('shows a chip on failed action roll', () => {
    const result = runReviewOutcome(Adaptability, {
      action: {
        type: 'action',
        actorInstanceId: 'char-1',
        traitKey: 'Agility',
      },
      rolls: {
        action: {
          hopeDie: { value: 3 },
          fearDie: { value: 5 },
          dice: [],
          statics: [],
          isSuccess: false,
        },
      },
    });

    expect(result.chips).toHaveLength(1);
    expect(result.chips[0].description).toContain('Mark 1 Stress to reroll');
    expect(result.chips[0].stressCost).toBe(1);
  });


  it('does not show chip on successful roll', () => {
    const result = runReviewOutcome(Adaptability, {
      action: {
        type: 'action',
        actorInstanceId: 'char-1',
        traitKey: 'Agility',
      },
      rolls: {
        action: {
          hopeDie: { value: 8 },
          fearDie: { value: 4 },
          dice: [],
          statics: [],
          isSuccess: true,
        },
      },
    });

    expect(result.chips).toHaveLength(0);
  });

  it('rerolls action when chip is used', () => {
    const result = runReviewOutcome(Adaptability, {
      action: {
        type: 'action',
        actorInstanceId: 'char-1',
        traitKey: 'Agility',
      },
      rolls: {
        action: {
          hopeDie: { value: 3 },
          fearDie: { value: 5 },
          dice: [],
          statics: [],
          isSuccess: false,
        },
      },
    });

    expect(result.chips).toHaveLength(1);
    const chip = result.chips[0];
    
    const table = mockTable({
      action: {
        type: 'action',
        actorInstanceId: 'char-1',
        traitKey: 'Agility',
      },
      rolls: {
        action: {
          hopeDie: { value: 3 },
          fearDie: { value: 5 },
          dice: [],
          statics: [],
        },
      },
    });
    
    chip.onUse(table, mockChipState());
    const mutations = applyMutations(table);
    
    // Should reroll both Hope and Fear dice
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'rerollDie',
        payload: { rollKey: 'action', dieType: 'hopeDie' }
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'rerollDie',
        payload: { rollKey: 'action', dieType: 'fearDie' }
      })
    );
  });
});
