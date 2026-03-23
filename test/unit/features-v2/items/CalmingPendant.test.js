import { describe, it, expect } from 'vitest';
import { CalmingPendant } from '../../../../src/features-v2/items/CalmingPendant.js';
import { runReviewOutcome, mockCharacter, mockAdversary } from '../helpers.js';

// d6: Math.floor(_rng() * 6) + 1
const rngD6 = (face) => () => (face - 1) / 6 + 0.001;

describe('Calming Pendant', () => {
  it('has the correct name and description', () => {
    expect(CalmingPendant.name).toBe('Calming Pendant');
    expect(CalmingPendant.description).toMatch(/last Stress/i);
    expect(CalmingPendant.description).toMatch(/d6/i);
    expect(CalmingPendant.description).toMatch(/5 or higher/i);
  });

  it('has onReviewOutcome and no chips', () => {
    expect(typeof CalmingPendant.hooks?.onReviewOutcome).toBe('function');
    expect(CalmingPendant.chips).toBeUndefined();
  });

  it('cancels the last stress mark when the d6 is 5', () => {
    const char = mockCharacter({
      instanceId: 'char-1',
      currentStress: 5,
      maxStress: 6,
    });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const stressEffect = { stat: 'currentStress', target: char, amount: 1 };

    runReviewOutcome(CalmingPendant, {
      _rng: rngD6(5),
      activeElements: [char, adv],
      _ownerInstanceId: 'char-1',
      action: {
        actorInstanceId: 'adv-1',
        targetInstanceIds: ['char-1'],
        effects: [stressEffect],
      },
    });

    expect(stressEffect.amount).toBe(0);
  });

  it('cancels the last stress mark when the d6 is 6', () => {
    const char = mockCharacter({
      instanceId: 'char-1',
      currentStress: 5,
      maxStress: 6,
    });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const stressEffect = { stat: 'currentStress', target: char, amount: 1 };

    runReviewOutcome(CalmingPendant, {
      _rng: rngD6(6),
      activeElements: [char, adv],
      _ownerInstanceId: 'char-1',
      action: {
        actorInstanceId: 'adv-1',
        targetInstanceIds: ['char-1'],
        effects: [stressEffect],
      },
    });

    expect(stressEffect.amount).toBe(0);
  });

  it('does not cancel when the d6 is below 5', () => {
    const char = mockCharacter({
      instanceId: 'char-1',
      currentStress: 5,
      maxStress: 6,
    });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const stressEffect = { stat: 'currentStress', target: char, amount: 1 };

    runReviewOutcome(CalmingPendant, {
      _rng: rngD6(4),
      activeElements: [char, adv],
      _ownerInstanceId: 'char-1',
      action: {
        actorInstanceId: 'adv-1',
        targetInstanceIds: ['char-1'],
        effects: [stressEffect],
      },
    });

    expect(stressEffect.amount).toBe(1);
  });

  it('does not roll when stress is not the last box', () => {
    const char = mockCharacter({
      instanceId: 'char-1',
      currentStress: 2,
      maxStress: 6,
    });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const stressEffect = { stat: 'currentStress', target: char, amount: 1 };
    let rngCalled = false;

    const result = runReviewOutcome(CalmingPendant, {
      _rng: () => {
        rngCalled = true;
        return 0;
      },
      activeElements: [char, adv],
      _ownerInstanceId: 'char-1',
      action: {
        actorInstanceId: 'adv-1',
        targetInstanceIds: ['char-1'],
        effects: [stressEffect],
      },
    });

    expect(rngCalled).toBe(false);
    expect(result.mutations.some((m) => m.type === 'rollDie')).toBe(false);
    expect(stressEffect.amount).toBe(1);
  });

  it('does not roll when stress targets a different character', () => {
    const char1 = mockCharacter({ instanceId: 'char-1', currentStress: 5, maxStress: 6 });
    const char2 = mockCharacter({ instanceId: 'char-2', currentStress: 5, maxStress: 6 });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const stressEffect = { stat: 'currentStress', target: char2, amount: 1 };
    let rngCalled = false;

    runReviewOutcome(CalmingPendant, {
      _rng: () => {
        rngCalled = true;
        return 0;
      },
      activeElements: [char1, char2, adv],
      _ownerInstanceId: 'char-1',
      action: {
        actorInstanceId: 'adv-1',
        targetInstanceIds: ['char-2'],
        effects: [stressEffect],
      },
    });

    expect(rngCalled).toBe(false);
    expect(stressEffect.amount).toBe(1);
  });
});
