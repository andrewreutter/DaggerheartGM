import { describe, it, expect } from 'vitest';
import { createActionLoop } from '../../../../src/features-v2/engine/action-loop.js';
import { Adept, HonedExpertise, SchoolOfKnowledgeRow } from '../../../../src/features-v2/subclasses/SchoolOfKnowledge.js';
import { mockCharacter, mockAdversary, mockGameState, mockAction, mockRoll } from '../helpers.js';

function annotate(feat) {
  return {
    ...feat,
    _ownerInstanceId: 'char-1',
    _sourceScopeKey: 'SchoolOfKnowledge',
    _sourceObject: SchoolOfKnowledgeRow,
  };
}

describe('School of Knowledge — Adept', () => {
  it('onReviewAction marks Stress, doubles Experience static, refunds Hope when armed', () => {
    const c = mockCharacter({
      instanceId: 'char-1',
      experiences: [{ id: 'exp-1', name: 'Scholar' }],
    });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const gs = mockGameState({
      activeElements: [c, adv],
      featureState: { SchoolOfKnowledge: { adeptUseStress: true } },
      rolls: mockRoll({
        action: {
          hopeDie: { value: 5 },
          fearDie: { value: 4 },
          isSuccess: true,
          statics: [{ name: 'Scholar', value: 2 }],
        },
      }),
    });
    const loop = createActionLoop(
      gs,
      mockAction({ type: 'attack', actorInstanceId: 'char-1', targetInstanceIds: ['adv-1'] }),
      [annotate(Adept)]
    );
    const ra = loop.runPhase('reviewAction');
    expect(ra.mutations).toContainEqual(
      expect.objectContaining({
        type: 'markStress',
        payload: expect.objectContaining({ instanceId: 'char-1', amount: 1 }),
      })
    );
    expect(ra.mutations).toContainEqual(
      expect.objectContaining({
        type: 'addRollStatic',
        payload: expect.objectContaining({
          rollKey: 'action',
          name: 'Adept (double Experience)',
          value: 2,
        }),
      })
    );
    expect(ra.mutations).toContainEqual(
      expect.objectContaining({
        type: 'gainHope',
        payload: expect.objectContaining({ instanceId: 'char-1', amount: 1 }),
      })
    );
  });

  it('onReviewAction does nothing when Adept not armed', () => {
    const c = mockCharacter({
      instanceId: 'char-1',
      experiences: [{ id: 'exp-1', name: 'Scholar' }],
    });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const gs = mockGameState({
      activeElements: [c, adv],
      featureState: { SchoolOfKnowledge: {} },
      rolls: mockRoll({
        action: {
          statics: [{ name: 'Scholar', value: 2 }],
        },
      }),
    });
    const loop = createActionLoop(
      gs,
      mockAction({ type: 'attack', actorInstanceId: 'char-1', targetInstanceIds: ['adv-1'] }),
      [annotate(Adept)]
    );
    const ra = loop.runPhase('reviewAction');
    expect(ra.mutations.filter((m) => m.type === 'markStress')).toHaveLength(0);
  });
});

describe('School of Knowledge — Honed Expertise', () => {
  it('gainHope on d6 roll ≥ 5 when an Experience was used', () => {
    const c = mockCharacter({
      instanceId: 'char-1',
      experiences: [{ id: 'exp-1', name: 'Scholar' }],
    });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const gs = mockGameState({
      _rng: () => 0.99,
      activeElements: [c, adv],
      featureState: { SchoolOfKnowledge: {} },
      rolls: mockRoll({
        action: {
          statics: [{ name: 'Scholar', value: 2 }],
        },
      }),
    });
    const loop = createActionLoop(
      gs,
      mockAction({ type: 'attack', actorInstanceId: 'char-1', targetInstanceIds: ['adv-1'] }),
      [annotate(HonedExpertise)]
    );
    const ra = loop.runPhase('reviewAction');
    expect(ra.mutations).toContainEqual(
      expect.objectContaining({
        type: 'gainHope',
        payload: expect.objectContaining({ instanceId: 'char-1', amount: 1 }),
      })
    );
    expect(ra.mutations).toContainEqual(
      expect.objectContaining({
        type: 'rollDie',
        payload: expect.objectContaining({ notation: 'd6' }),
      })
    );
  });

  it('does not grant Hope when d6 is below 5', () => {
    const c = mockCharacter({
      instanceId: 'char-1',
      experiences: [{ id: 'exp-1', name: 'Scholar' }],
    });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const gs = mockGameState({
      _rng: () => 0,
      activeElements: [c, adv],
      featureState: { SchoolOfKnowledge: {} },
      rolls: mockRoll({
        action: {
          statics: [{ name: 'Scholar', value: 2 }],
        },
      }),
    });
    const loop = createActionLoop(
      gs,
      mockAction({ type: 'attack', actorInstanceId: 'char-1', targetInstanceIds: ['adv-1'] }),
      [annotate(HonedExpertise)]
    );
    const ra = loop.runPhase('reviewAction');
    expect(ra.mutations.filter((m) => m.type === 'gainHope')).toHaveLength(0);
  });

  it('does not fire when Adept consumed the roll', () => {
    const c = mockCharacter({
      instanceId: 'char-1',
      experiences: [{ id: 'exp-1', name: 'Scholar' }],
    });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const gs = mockGameState({
      _rng: () => 0.99,
      activeElements: [c, adv],
      featureState: { SchoolOfKnowledge: { adeptConsumedThisRoll: true } },
      rolls: mockRoll({
        action: {
          statics: [{ name: 'Scholar', value: 2 }],
        },
      }),
    });
    const loop = createActionLoop(
      gs,
      mockAction({ type: 'attack', actorInstanceId: 'char-1', targetInstanceIds: ['adv-1'] }),
      [annotate(HonedExpertise)]
    );
    const ra = loop.runPhase('reviewAction');
    expect(ra.mutations.filter((m) => m.type === 'gainHope')).toHaveLength(0);
  });
});
