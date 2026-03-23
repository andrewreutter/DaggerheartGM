import { describe, it, expect } from 'vitest';
import { createActionLoop } from '../../../../src/features-v2/engine/action-loop.js';
import { applyMutations, buildTableSnapshot } from '../../../../src/features-v2/engine/table.js';
import { unwrap } from '../../../../src/features-v2/engine/when.js';
import { WildSurge } from '../../../../src/features-v2/abilities/Sage/WildSurge.js';
import {
  mockCharacter,
  mockAdversary,
  mockGameState,
  mockRoll,
  mockAction,
  runIntent,
} from '../helpers.js';

const feat = (id = 'c1') => ({ ...WildSurge, _ownerInstanceId: id });

describe('Wild Surge (Sage)', () => {
  it('onIntent adds Wild Surge static equal to the active die while surge is active', () => {
    const char = mockCharacter({ instanceId: 'c1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const { mutations } = runIntent(feat('c1'), {
      activeElements: [char, adv],
      featureState: { 'Wild Surge': { wildSurgeDie: 3 } },
      action: {
        type: 'attack',
        actorInstanceId: 'c1',
        targetInstanceIds: [adv.instanceId],
        trait: 'Agility',
        range: 'melee',
      },
      actionType: 'attack',
      rolls: mockRoll(),
    });
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addRollStatic',
        payload: expect.objectContaining({ name: 'Wild Surge', value: 3 }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Wild Surge',
          key: 'wildSurgeConsumedThisAction',
          value: true,
        }),
      })
    );
  });

  it('onIntent does not add a modifier when Wild Surge is not active', () => {
    const char = mockCharacter({ instanceId: 'c1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const { mutations } = runIntent(feat('c1'), {
      activeElements: [char, adv],
      featureState: { 'Wild Surge': {} },
      action: {
        type: 'attack',
        actorInstanceId: 'c1',
        targetInstanceIds: [adv.instanceId],
      },
      actionType: 'attack',
      rolls: mockRoll(),
    });
    expect(mutations.some((m) => m.payload?.name === 'Wild Surge')).toBe(false);
  });

  it('increments the die on resolve after an action roll; ends at >6 with extra Stress', () => {
    const char = mockCharacter({ instanceId: 'c1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const gs = mockGameState({
      activeElements: [char, adv],
      _ownerInstanceId: 'c1',
      _featureKey: 'Wild Surge',
      featureState: { 'Wild Surge': { wildSurgeDie: 6 } },
      action: {
        type: 'attack',
        actorInstanceId: 'c1',
        targetInstanceIds: [adv.instanceId],
        trait: 'Agility',
        range: 'melee',
        effects: [],
        appliedEffects: [],
      },
      rolls: mockRoll(),
    });
    const loop = createActionLoop(gs, mockAction({ type: 'attack', actorInstanceId: 'c1' }), [feat('c1')], {});
    loop.runPhase('intent');
    loop.runPhase('resolve');
    const m = [
      ...loop.getPhaseResult('intent').mutations,
      ...loop.getPhaseResult('resolve').mutations,
    ];
    expect(gs.featureState['Wild Surge'].wildSurgeDie).toBeNull();
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'markStress',
        payload: expect.objectContaining({ instanceId: 'c1', amount: 1 }),
      })
    );
  });

  it('onRest drops the form and marks Stress when Wild Surge was active', () => {
    const char = mockCharacter({ instanceId: 'c1' });
    const gs = mockGameState({
      activeElements: [char],
      _ownerInstanceId: 'c1',
      _featureKey: 'Wild Surge',
      featureState: { 'Wild Surge': { wildSurgeDie: 4 } },
      action: {
        type: 'longRest',
        actorInstanceId: 'c1',
        targetInstanceIds: [],
        effects: [],
        appliedEffects: [],
      },
      rolls: undefined,
    });
    const tbl = buildTableSnapshot(gs);
    const restHook = unwrap(WildSurge.hooks.onRest, tbl);
    expect(typeof restHook).toBe('function');
    restHook(tbl);
    const m = applyMutations(tbl);
    expect(gs.featureState['Wild Surge'].wildSurgeDie).toBeNull();
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'markStress',
        payload: expect.objectContaining({ instanceId: 'c1', amount: 1 }),
      })
    );
  });
});
