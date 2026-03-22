import { describe, it, expect } from 'vitest';
import {
  createActionLoop,
  dispatchStateChangeHooks,
  dispatchSceneEndHooks,
  dispatchTokenMoveHooks,
} from '../../../../src/features-v2/engine/action-loop.js';
import { when, isActing } from '../../../../src/features-v2/engine/when.js';
import { Reinforced } from '../../../../src/features-v2/armor_properties/Reinforced.js';
import { mockGameState, mockCharacter, mockAdversary, mockAction } from '../helpers.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFeature(overrides = {}) {
  return {
    name: overrides.name ?? 'Test Feature',
    _ownerInstanceId: overrides._ownerInstanceId ?? 'char-1',
    chips: overrides.chips ?? [],
    hooks: overrides.hooks ?? {},
    ...overrides,
  };
}

function makeLoop(featureOverrides = {}, gameOverrides = {}, actionOverrides = {}) {
  const char = mockCharacter({ instanceId: 'char-1' });
  const adv = mockAdversary({ instanceId: 'adv-1' });

  const gameState = mockGameState({
    activeElements: [char, adv],
    _ownerInstanceId: 'char-1',
    ...gameOverrides,
  });

  const action = mockAction({
    type: 'attack',
    actorInstanceId: 'char-1',
    targetInstanceIds: ['adv-1'],
    ...actionOverrides,
  });

  const feature = makeFeature({ _ownerInstanceId: 'char-1', ...featureOverrides });

  return createActionLoop(gameState, action, [feature]);
}

// ---------------------------------------------------------------------------
// Phase progression
// ---------------------------------------------------------------------------

describe('createActionLoop()', () => {
  it('carries useArmorByTargetId from gameState.action into the loop snapshot', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const gameState = mockGameState({
      activeElements: [char, adv],
      _ownerInstanceId: 'char-1',
      action: {
        type: 'attack',
        actorInstanceId: 'char-1',
        targetInstanceIds: ['adv-1'],
        trait: 'Agility',
        range: 'melee',
        effects: [],
        appliedEffects: [],
        useArmorByTargetId: { 'adv-1': true },
      },
    });
    const feature = makeFeature({
      hooks: {
        onReviewOutcome: (table) => {
          expect(table.action.useArmorByTargetId).toEqual({ 'adv-1': true });
        },
      },
    });
    const loop = createActionLoop(
      gameState,
      mockAction({ actorInstanceId: 'char-1', targetInstanceIds: ['adv-1'] }),
      [feature]
    );
    loop.runPhase('reviewOutcome');
  });

  it('carries reactionContext from actionConfig into the loop snapshot', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const gameState = mockGameState({
      activeElements: [char, adv],
      _ownerInstanceId: 'char-1',
    });
    const feature = makeFeature({
      hooks: {
        onIntent: (table) => {
          expect(table.action.reactionContext).toEqual({ kind: 'leaveMelee', moverInstanceId: 'adv-1' });
          expect(table.action.isLeaveMeleeReaction).toBe(true);
        },
      },
    });
    const loop = createActionLoop(
      gameState,
      mockAction({
        type: 'reaction',
        actorInstanceId: 'char-1',
        targetInstanceIds: ['adv-1'],
        traitKey: 'Agility',
        reactionContext: { kind: 'leaveMelee', moverInstanceId: 'adv-1' },
      }),
      [feature]
    );
    loop.runPhase('intent');
  });

  it('returns a loop object with runPhase and getPhaseResult', () => {
    const loop = makeLoop();
    expect(typeof loop.runPhase).toBe('function');
    expect(typeof loop.getPhaseResult).toBe('function');
  });

  it('runPhase returns an object with chips, mutations, narrations', () => {
    const loop = makeLoop();
    const result = loop.runPhase('intent');
    expect(result).toHaveProperty('chips');
    expect(result).toHaveProperty('mutations');
    expect(result).toHaveProperty('narrations');
    expect(result.phase).toBe('intent');
  });

  it('getPhaseResult returns null before the phase runs', () => {
    const loop = makeLoop();
    expect(loop.getPhaseResult('intent')).toBeNull();
  });

  it('getPhaseResult returns results after the phase runs', () => {
    const loop = makeLoop();
    loop.runPhase('intent');
    expect(loop.getPhaseResult('intent')).not.toBeNull();
  });

  it('can run all three phases independently', () => {
    const loop = makeLoop();
    const intent = loop.runPhase('intent');
    const reviewOutcome = loop.runPhase('reviewOutcome');
    const resolve = loop.runPhase('resolve');
    expect(intent.phase).toBe('intent');
    expect(reviewOutcome.phase).toBe('reviewOutcome');
    expect(resolve.phase).toBe('resolve');
  });
});

// ---------------------------------------------------------------------------
// Hook execution
// ---------------------------------------------------------------------------

describe('Hook execution', () => {
  it('calls onIntent during the intent phase', () => {
    const calls = [];
    const feature = makeFeature({
      hooks: { onIntent: (table) => calls.push('intent') },
    });

    const char = mockCharacter({ instanceId: 'char-1' });
    const loop = createActionLoop(
      mockGameState({ activeElements: [char], _ownerInstanceId: 'char-1' }),
      mockAction({ actorInstanceId: 'char-1' }),
      [feature]
    );
    loop.runPhase('intent');
    expect(calls).toContain('intent');
  });

  it('calls onReviewOutcome during the review outcome phase', () => {
    const calls = [];
    const feature = makeFeature({
      hooks: { onReviewOutcome: (table) => calls.push('reviewOutcome') },
    });

    const char = mockCharacter({ instanceId: 'char-1' });
    const loop = createActionLoop(
      mockGameState({ activeElements: [char] }),
      mockAction(),
      [feature]
    );
    loop.runPhase('reviewOutcome');
    expect(calls).toContain('reviewOutcome');
  });

  it('calls onResolve during the resolve phase', () => {
    const calls = [];
    const feature = makeFeature({
      hooks: { onResolve: (table) => calls.push('resolve') },
    });

    const char = mockCharacter({ instanceId: 'char-1' });
    const loop = createActionLoop(
      mockGameState({ activeElements: [char] }),
      mockAction(),
      [feature]
    );
    loop.runPhase('resolve');
    expect(calls).toContain('resolve');
  });

  it('does not run lifecycle hooks during resolveAction (chips only)', () => {
    const calls = [];
    const feature = makeFeature({
      hooks: {
        onIntent: () => calls.push('intent'),
        onReviewAction: () => calls.push('reviewAction'),
        onReviewOutcome: () => calls.push('reviewOutcome'),
        onResolve: () => calls.push('onResolve'),
      },
    });

    const char = mockCharacter({ instanceId: 'char-1' });
    const loop = createActionLoop(
      mockGameState({ activeElements: [char], _ownerInstanceId: 'char-1' }),
      mockAction({ actorInstanceId: 'char-1' }),
      [feature]
    );
    loop.runPhase('resolveAction');
    expect(calls).toHaveLength(0);
  });

  it('does NOT call onIntent when wrapped in when(isActing) and I am not acting', () => {
    const calls = [];
    const feature = makeFeature({
      _ownerInstanceId: 'char-1',
      hooks: {
        onIntent: when(isActing, (table) => calls.push('intent')),
      },
    });

    const char = mockCharacter({ instanceId: 'char-1' });
    // actorInstanceId is adv-1, so char-1 is NOT acting
    const loop = createActionLoop(
      mockGameState({ activeElements: [char], _ownerInstanceId: 'char-1' }),
      mockAction({ actorInstanceId: 'adv-1', targetInstanceIds: ['char-1'] }),
      [feature]
    );
    loop.runPhase('intent');
    expect(calls).toHaveLength(0);
  });

  it('DOES call onIntent when wrapped in when(isActing) and I am acting', () => {
    const calls = [];
    const feature = makeFeature({
      _ownerInstanceId: 'char-1',
      hooks: {
        onIntent: when(isActing, (table) => calls.push('intent')),
      },
    });

    const char = mockCharacter({ instanceId: 'char-1' });
    const loop = createActionLoop(
      mockGameState({ activeElements: [char], _ownerInstanceId: 'char-1' }),
      mockAction({ actorInstanceId: 'char-1' }),
      [feature]
    );
    loop.runPhase('intent');
    expect(calls).toContain('intent');
  });

  it('queues mutations from hook execution', () => {
    const feature = makeFeature({
      _ownerInstanceId: 'char-1',
      hooks: {
        onIntent: when(isActing, (table) => {
          table.me.markStress(1);
        }),
      },
    });

    const char = mockCharacter({ instanceId: 'char-1' });
    const loop = createActionLoop(
      mockGameState({ activeElements: [char], _ownerInstanceId: 'char-1' }),
      mockAction({ actorInstanceId: 'char-1' }),
      [feature]
    );
    const result = loop.runPhase('intent');
    expect(result.mutations).toContainEqual(
      expect.objectContaining({ type: 'markStress' })
    );
  });
});

// ---------------------------------------------------------------------------
// Chip collection during phases
// ---------------------------------------------------------------------------

describe('Chip collection during phases', () => {
  it('collects intent chips during the intent phase', () => {
    const feature = makeFeature({
      _ownerInstanceId: 'char-1',
      chips: [
        { description: 'An intent chip', placements: ['intent'] },
      ],
    });

    const char = mockCharacter({ instanceId: 'char-1' });
    const loop = createActionLoop(
      mockGameState({ activeElements: [char] }),
      mockAction(),
      [feature]
    );
    const result = loop.runPhase('intent');
    expect(result.chips).toHaveLength(1);
    expect(result.chips[0].description).toBe('An intent chip');
  });

  it('does not collect review outcome chips during intent phase', () => {
    const feature = makeFeature({
      chips: [{ description: 'A review outcome chip', placements: ['reviewOutcome'] }],
    });

    const char = mockCharacter({ instanceId: 'char-1' });
    const loop = createActionLoop(
      mockGameState({ activeElements: [char] }),
      mockAction(),
      [feature]
    );
    const result = loop.runPhase('intent');
    expect(result.chips).toHaveLength(0);
  });

  it('collects chips from multiple features', () => {
    const f1 = makeFeature({ name: 'F1', chips: [{ description: 'chip1', placements: ['reviewOutcome'] }] });
    const f2 = makeFeature({ name: 'F2', chips: [{ description: 'chip2', placements: ['reviewOutcome'] }] });

    const char = mockCharacter({ instanceId: 'char-1' });
    const loop = createActionLoop(
      mockGameState({ activeElements: [char] }),
      mockAction(),
      [f1, f2]
    );
    const result = loop.runPhase('reviewOutcome');
    expect(result.chips).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Rest and session-start loops
// ---------------------------------------------------------------------------

describe('Rest and session-start action loops', () => {
  it('calls onRest hook during shortRest intent phase', () => {
    const calls = [];
    const feature = makeFeature({
      hooks: { onRest: (table) => calls.push(table.action?.type) },
    });

    const char = mockCharacter({ instanceId: 'char-1' });
    const loop = createActionLoop(
      mockGameState({ activeElements: [char] }),
      mockAction({ type: 'shortRest', actorInstanceId: 'char-1' }),
      [feature]
    );
    loop.runPhase('intent');
    expect(calls).toContain('shortRest');
  });

  it('calls onSessionStart hook during sessionStart resolve phase', () => {
    const calls = [];
    const feature = makeFeature({
      hooks: { onSessionStart: (table) => calls.push('session') },
    });

    const char = mockCharacter({ instanceId: 'char-1' });
    const loop = createActionLoop(
      mockGameState({ activeElements: [char] }),
      mockAction({ type: 'sessionStart', actorInstanceId: 'char-1' }),
      [feature]
    );
    loop.runPhase('resolve');
    expect(calls).toContain('session');
  });
});

// ---------------------------------------------------------------------------
// setRolls / setEffects
// ---------------------------------------------------------------------------

describe('loop.setRolls() and loop.setEffects()', () => {
  it('setRolls makes roll data accessible in subsequent phases', () => {
    const seenValues = [];
    const feature = makeFeature({
      hooks: {
        onReviewOutcome: (table) => {
          seenValues.push(table.rolls?.action?.isSuccess);
        },
      },
    });

    const char = mockCharacter({ instanceId: 'char-1' });
    const loop = createActionLoop(
      mockGameState({ activeElements: [char], rolls: undefined }),
      mockAction(),
      [feature]
    );

    loop.setRolls({
      action: { hopeDie: { value: 10 }, fearDie: { value: 3 }, dice: [], statics: [], isSuccess: true, isCritical: false },
      damage: { dice: [], statics: [] },
    });

    loop.runPhase('reviewOutcome');
    expect(seenValues).toContain(true);
  });

  it('setEffects makes effects available in onReviewOutcome', () => {
    const seenEffects = [];
    const feature = makeFeature({
      hooks: {
        onReviewOutcome: (table) => {
          seenEffects.push(...(table.action?.effects ?? []));
        },
      },
    });

    const char = mockCharacter({ instanceId: 'char-1' });
    const loop = createActionLoop(
      mockGameState({ activeElements: [char] }),
      mockAction(),
      [feature]
    );

    const effects = [{ stat: 'currentHP', target: 'char-1', amount: 4 }];
    loop.setEffects(effects);
    loop.runPhase('reviewOutcome');
    expect(seenEffects).toHaveLength(1);
    expect(seenEffects[0].stat).toBe('currentHP');
  });
});

// ---------------------------------------------------------------------------
// dispatchStateChangeHooks
// ---------------------------------------------------------------------------

describe('dispatchStateChangeHooks()', () => {
  it('runs onStateChange and returns setFeatureState mutations from hooks', () => {
    const char = mockCharacter({
      instanceId: 'c1',
      currentArmor: 2,
    });
    const gameState = mockGameState({
      activeElements: [char],
      featureState: { Reinforced: { reinforcedActive: true } },
    });

    const batch = [{ type: 'clearArmor', payload: { instanceId: 'c1', amount: 1 } }];

    const { mutations } = dispatchStateChangeHooks(
      gameState,
      [{ ...Reinforced, _ownerInstanceId: 'c1' }],
      batch
    );

    expect(
      mutations.some(
        (m) =>
          m.type === 'setFeatureState' &&
          m.payload.featureKey === 'Reinforced' &&
          m.payload.key === 'reinforcedActive' &&
          m.payload.value === false
      )
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// dispatchTokenMoveHooks
// ---------------------------------------------------------------------------

describe('dispatchTokenMoveHooks()', () => {
  it('returns empty mutations when moverInstanceId is missing', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const gameState = mockGameState({ activeElements: [char] });
    const { mutations } = dispatchTokenMoveHooks(gameState, [makeFeature()], {});
    expect(mutations).toHaveLength(0);
  });

  it('runs onTokenMove with table.me = feature owner and table.tokenMove.mover set', () => {
    const char = mockCharacter({ instanceId: 'char-1', tokenX: 0, tokenY: 0 });
    const advMoved = mockAdversary({ instanceId: 'adv-1', tokenX: 30, tokenY: 0, difficulty: 13 });
    const gameState = {
      fear: 0,
      mapConfig: null,
      activeElements: [char, advMoved],
      featureState: {},
      _previousPositions: { 'adv-1': { tokenX: 4, tokenY: 0 } },
    };

    let meId;
    let moverId;
    const feature = makeFeature({
      hooks: {
        onTokenMove: (table) => {
          meId = table.me?.instanceId;
          moverId = table.tokenMove?.mover?.instanceId;
        },
      },
    });

    dispatchTokenMoveHooks(gameState, [feature], { moverInstanceId: 'adv-1' });
    expect(meId).toBe('char-1');
    expect(moverId).toBe('adv-1');
  });

  it('includes tokenMove in table.mutationBatch', () => {
    const char = mockCharacter({ instanceId: 'char-1', tokenX: 0, tokenY: 0 });
    const advMoved = mockAdversary({ instanceId: 'adv-1', tokenX: 30, tokenY: 0 });
    const gameState = {
      fear: 0,
      activeElements: [char, advMoved],
      featureState: {},
      _previousPositions: { 'adv-1': { tokenX: 4, tokenY: 0 } },
    };

    const batches = [];
    const feature = makeFeature({
      hooks: {
        onTokenMove: (table) => {
          batches.push([...table.mutationBatch]);
        },
      },
    });

    dispatchTokenMoveHooks(gameState, [feature], { moverInstanceId: 'adv-1' });
    expect(batches[0]).toContainEqual(
      expect.objectContaining({ type: 'tokenMove', payload: { moverInstanceId: 'adv-1' } })
    );
  });
});

// ---------------------------------------------------------------------------
// dispatchSceneEndHooks
// ---------------------------------------------------------------------------

describe('dispatchSceneEndHooks()', () => {
  it('runs onSceneEnd and exposes sceneEnd in table.mutationBatch', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const gameState = mockGameState({ activeElements: [char] });

    let batch;
    const feature = makeFeature({
      hooks: {
        onSceneEnd: (table) => {
          batch = [...table.mutationBatch];
        },
      },
    });

    dispatchSceneEndHooks(gameState, [feature]);
    expect(batch).toContainEqual(expect.objectContaining({ type: 'sceneEnd', payload: {} }));
  });

  it('queues feature state mutations from onSceneEnd', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const gameState = mockGameState({
      activeElements: [char],
      featureState: { 'Test Feature': { unstoppableActive: true } },
    });

    const feature = makeFeature({
      name: 'Test Feature',
      hooks: {
        onSceneEnd: (table) => {
          table.feature.set('unstoppableActive', false);
        },
      },
    });

    const { mutations } = dispatchSceneEndHooks(gameState, [feature]);
    expect(
      mutations.some(
        (m) =>
          m.type === 'setFeatureState' &&
          m.payload.key === 'unstoppableActive' &&
          m.payload.value === false
      )
    ).toBe(true);
  });
});
