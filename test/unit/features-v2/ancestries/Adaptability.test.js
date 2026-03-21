import { describe, it, expect } from 'vitest';
import { Adaptability } from '../../../../src/features-v2/ancestries/Human.js';
import { runReviewAction, mockTable, mockChipState, mockCharacter, mockAdversary } from '../helpers.js';
import { applyMutations } from '../../../../src/features-v2/engine/table.js';

const charWithExperience = mockCharacter({
  instanceId: 'char-1',
  experiences: [{ id: 'exp-scholar', name: 'Scholar' }],
});

describe('Adaptability', () => {
  it('shows chip when an experience was used on a failed roll', () => {
    const result = runReviewAction(Adaptability, {
      activeElements: [charWithExperience, mockAdversary()],
      action: {
        type: 'action',
        actorInstanceId: 'char-1',
        traitKey: 'Knowledge',
      },
      rolls: {
        action: {
          hopeDie: { value: 3 },
          fearDie: { value: 5 },
          dice: [],
          statics: [{ name: 'Scholar', value: 2 }],
          isSuccess: false,
        },
      },
    });

    expect(result.chips).toHaveLength(1);
    expect(result.chips[0].description).toContain('Mark 1 Stress to reroll');
    expect(result.chips[0].stressCost).toBe(1);
  });

  it('does not show chip on failed roll when no experience was used', () => {
    const result = runReviewAction(Adaptability, {
      activeElements: [charWithExperience, mockAdversary()],
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

    expect(result.chips).toHaveLength(0);
  });

  it('does not show chip on successful roll even when experience was used', () => {
    const result = runReviewAction(Adaptability, {
      activeElements: [charWithExperience, mockAdversary()],
      action: {
        type: 'action',
        actorInstanceId: 'char-1',
        traitKey: 'Knowledge',
      },
      rolls: {
        action: {
          hopeDie: { value: 8 },
          fearDie: { value: 4 },
          dice: [],
          statics: [{ name: 'Scholar', value: 2 }],
          isSuccess: true,
        },
      },
    });

    expect(result.chips).toHaveLength(0);
  });

  it('rerolls both Hope and Fear dice when chip is used', () => {
    const result = runReviewAction(Adaptability, {
      activeElements: [charWithExperience, mockAdversary()],
      action: {
        type: 'action',
        actorInstanceId: 'char-1',
        traitKey: 'Knowledge',
      },
      rolls: {
        action: {
          hopeDie: { value: 3 },
          fearDie: { value: 5 },
          dice: [],
          statics: [{ name: 'Scholar', value: 2 }],
          isSuccess: false,
        },
      },
    });

    expect(result.chips).toHaveLength(1);
    const chip = result.chips[0];

    const table = mockTable({
      activeElements: [charWithExperience, mockAdversary()],
      action: {
        type: 'action',
        actorInstanceId: 'char-1',
        traitKey: 'Knowledge',
      },
      rolls: {
        action: {
          hopeDie: { value: 3 },
          fearDie: { value: 5 },
          dice: [],
          statics: [{ name: 'Scholar', value: 2 }],
        },
      },
    });

    chip.onUse(table, mockChipState());
    const mutations = applyMutations(table);

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'rerollDie',
        payload: { rollKey: 'action', dieType: 'hopeDie' },
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'rerollDie',
        payload: { rollKey: 'action', dieType: 'fearDie' },
      })
    );
  });
});
