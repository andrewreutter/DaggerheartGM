import { describe, it, expect } from 'vitest';
import { FelineInstincts } from '../../../../src/features-v2/ancestries/Katari.js';
import { runReviewAction, mockTable, mockChipState } from '../helpers.js';
import { applyMutations } from '../../../../src/features-v2/engine/table.js';

describe('Feline Instincts', () => {
  it('shows a chip on Agility roll', () => {
    const result = runReviewAction(FelineInstincts, {
      action: {
        type: 'trait',
        actorInstanceId: 'char-1',
        traitKey: 'Agility',
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

    expect(result.chips).toHaveLength(1);
    expect(result.chips[0].description).toContain('Spend 2 Hope to reroll your Hope Die');
    expect(result.chips[0].hopeCost).toBe(2);
  });

  it('does not show chip on non-Agility roll', () => {
    const result = runReviewAction(FelineInstincts, {
      action: {
        type: 'trait',
        actorInstanceId: 'char-1',
        traitKey: 'Strength',
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

  it('does not show chip when not acting', () => {
    const result = runReviewAction(FelineInstincts, {
      action: {
        type: 'trait',
        actorInstanceId: 'char-2',
        traitKey: 'Agility',
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

  it('rerolls hope die when chip is used', () => {
    const result = runReviewAction(FelineInstincts, {
      action: {
        type: 'trait',
        actorInstanceId: 'char-1',
        traitKey: 'Agility',
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

    expect(result.chips).toHaveLength(1);
    const chip = result.chips[0];
    
    const table = mockTable({
      action: {
        type: 'trait',
        actorInstanceId: 'char-1',
        traitKey: 'Agility',
      },
      rolls: {
        action: {
          hopeDie: { value: 7 },
          fearDie: { value: 4 },
          dice: [],
          statics: [],
        },
      },
    });
    
    chip.onUse(table, mockChipState());
    const mutations = applyMutations(table);
    
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'rerollDie',
        payload: { rollKey: 'action', dieType: 'hopeDie' }
      })
    );
  });
});
