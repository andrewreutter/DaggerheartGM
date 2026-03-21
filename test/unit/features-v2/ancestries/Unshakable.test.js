import { describe, it, expect } from 'vitest';
import { Unshakable } from '../../../../src/features-v2/ancestries/Firbolg.js';
import { runReviewOutcome, mockCharacter, mockAdversary } from '../helpers.js';

// RNG helpers: _rng is injected into gameState and used by table.rollDie().
// Math.floor(rng() * 6) + 1 must equal the target face.
const rngRolling6 = () => 5 / 6; // floor(5/6 * 6) + 1 = 5 + 1 = 6
const rngRolling1 = () => 0;     // floor(0 * 6) + 1 = 0 + 1 = 1

describe('Unshakable', () => {
  it('has the correct name and description', () => {
    expect(Unshakable.name).toBe('Unshakable');
    expect(Unshakable.description).toMatch(/mark a Stress/i);
    expect(Unshakable.description).toMatch(/d6/i);
  });

  it('has an onReviewOutcome hook and no chips', () => {
    expect(typeof Unshakable.hooks?.onReviewOutcome).toBe('function');
    expect(Unshakable.chips).toBeUndefined();
  });

  it('cancels the stress effect when the d6 rolls a 6', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const stressEffect = { stat: 'currentStress', target: char, amount: 1 };

    runReviewOutcome(Unshakable, {
      _rng: rngRolling6,
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

  it('does not cancel stress when the d6 rolls less than 6', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const stressEffect = { stat: 'currentStress', target: char, amount: 1 };

    runReviewOutcome(Unshakable, {
      _rng: rngRolling1,
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

  it('queues a rollDie mutation with the correct notation and total', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const stressEffect = { stat: 'currentStress', target: char, amount: 1 };

    const result = runReviewOutcome(Unshakable, {
      _rng: rngRolling6,
      activeElements: [char, adv],
      _ownerInstanceId: 'char-1',
      action: {
        actorInstanceId: 'adv-1',
        targetInstanceIds: ['char-1'],
        effects: [stressEffect],
      },
    });

    expect(result.mutations).toContainEqual(
      expect.objectContaining({
        type: 'rollDie',
        payload: expect.objectContaining({ notation: 'd6', total: 6 }),
      })
    );
  });

  it('does not roll when no stress is incoming for the owner', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    let rngCalled = false;

    const result = runReviewOutcome(Unshakable, {
      _rng: () => { rngCalled = true; return 0; },
      activeElements: [char, adv],
      _ownerInstanceId: 'char-1',
      action: {
        actorInstanceId: 'adv-1',
        targetInstanceIds: ['char-1'],
        effects: [],
      },
    });

    expect(rngCalled).toBe(false);
    expect(result.mutations.some((m) => m.type === 'rollDie')).toBe(false);
  });

  it('does not roll when stress targets a different character', () => {
    const char1 = mockCharacter({ instanceId: 'char-1' });
    const char2 = mockCharacter({ instanceId: 'char-2' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const stressEffect = { stat: 'currentStress', target: char2, amount: 1 };
    let rngCalled = false;

    runReviewOutcome(Unshakable, {
      _rng: () => { rngCalled = true; return 0; },
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
