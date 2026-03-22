import { describe, it, expect } from 'vitest';
import { Fearless } from '../../../../src/features-v2/ancestries/Infernis.js';
import { runReviewAction, mockTable, mockChipState } from '../helpers.js';
import { applyMutations } from '../../../../src/features-v2/engine/table.js';

describe('Fearless', () => {
  it('shows a chip on action roll with fear die', () => {
    const result = runReviewAction(Fearless, {
      action: {
        type: 'action',
        actorInstanceId: 'char-1',
        traitKey: 'Agility',
      },
      rolls: {
        action: {
          fearDie: { value: 8 },
          hopeDie: { value: 4 },
          dice: [],
          statics: [],
          isSuccess: true,
        },
      },
    });

    // NOTE: V2 API cannot distinguish "rolling with Fear" vs "rolling with Hope"
    // This is a best-effort implementation - chip appears on any roll with a fearDie
    expect(result.chips).toHaveLength(1);
    expect(result.chips[0].description).toContain('Mark 2 Stress to change Fear into Hope');
    expect(result.chips[0].stressCost).toBe(2);
  });

  it('does not show chip when not acting', () => {
    const result = runReviewAction(Fearless, {
      action: {
        type: 'action',
        actorInstanceId: 'char-2',
        traitKey: 'Agility',
      },
      rolls: {
        action: {
          fearDie: { value: 8 },
          hopeDie: { value: 4 },
          dice: [],
          statics: [],
          isSuccess: true,
        },
      },
    });

    expect(result.chips).toHaveLength(0);
  });

  it('sets roll outcome to hope when chip is used', () => {
    const result = runReviewAction(Fearless, {
      action: {
        type: 'action',
        actorInstanceId: 'char-1',
        traitKey: 'Agility',
      },
      rolls: {
        action: {
          fearDie: { value: 8 },
          hopeDie: { value: 4 },
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
        type: 'action',
        actorInstanceId: 'char-1',
        traitKey: 'Agility',
      },
      rolls: {
        action: {
          fearDie: { value: 8 },
          hopeDie: { value: 4 },
          dice: [],
          statics: [],
        },
      },
    });

    chip.onUse(table, mockChipState());
    const mutations = applyMutations(table);

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setRollOutcome',
        payload: { rollKey: 'action', outcome: 'hope' },
      })
    );
  });
});
