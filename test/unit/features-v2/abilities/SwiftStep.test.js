import { describe, it, expect } from 'vitest';
import { createActionLoop } from '../../../../src/features-v2/engine/action-loop.js';
import { SwiftStep } from '../../../../src/features-v2/abilities/Bone/SwiftStep.js';
import {
  mockCharacter,
  mockAdversary,
  mockGameState,
  mockAdversaryAttackRoll,
  mockAction,
} from '../helpers.js';

function loopAgainstChar(opts = {}) {
  const { currentStress = 2, isSuccess = false, rollsOverride } = opts;
  const char = mockCharacter({
    instanceId: 'c1',
    tokenX: 0,
    tokenY: 0,
    currentStress,
    maxStress: 6,
    hope: 2,
    maxHope: 6,
  });
  const atk = mockAdversary({ instanceId: 'a1', tokenX: 5, tokenY: 0 });
  const gs = mockGameState({
    activeElements: [char, atk],
    _ownerInstanceId: 'c1',
    _featureKey: 'Swift Step',
    featureState: {},
    action: {
      type: 'attack',
      actorInstanceId: 'a1',
      targetInstanceIds: ['c1'],
      effects: [],
    },
    rolls: mockAdversaryAttackRoll({
      isSuccess,
      ...rollsOverride,
    }),
  });
  const loop = createActionLoop(
    gs,
    mockAction({ type: 'attack', actorInstanceId: 'a1', targetInstanceIds: ['c1'] }),
    [{ ...SwiftStep, _ownerInstanceId: 'c1' }]
  );
  loop.setRolls(gs.rolls);
  return loop;
}

describe('Bone — Swift Step', () => {
  it('onReviewAction clears 1 Stress when a failed attack targets you and you have marked Stress', () => {
    const loop = loopAgainstChar({ currentStress: 2, isSuccess: false });
    const ra = loop.runPhase('reviewAction');
    expect(ra.mutations).toContainEqual(
      expect.objectContaining({
        type: 'clearStress',
        payload: expect.objectContaining({ instanceId: 'c1', amount: 1 }),
      })
    );
    expect(ra.mutations.filter((m) => m.type === 'gainHope')).toHaveLength(0);
  });

  it('onReviewAction gains 1 Hope when the attack fails and you have no Stress to clear', () => {
    const loop = loopAgainstChar({ currentStress: 0, isSuccess: false });
    const ra = loop.runPhase('reviewAction');
    expect(ra.mutations).toContainEqual(
      expect.objectContaining({
        type: 'gainHope',
        payload: expect.objectContaining({ instanceId: 'c1', amount: 1 }),
      })
    );
    expect(ra.mutations.filter((m) => m.type === 'clearStress')).toHaveLength(0);
  });

  it('does nothing when the attack succeeds', () => {
    const loop = loopAgainstChar({ currentStress: 2, isSuccess: true });
    const ra = loop.runPhase('reviewAction');
    expect(ra.mutations.filter((m) => m.type === 'clearStress' || m.type === 'gainHope')).toHaveLength(0);
  });
});
