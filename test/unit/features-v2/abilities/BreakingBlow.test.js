import { describe, it, expect } from 'vitest';
import { collectChips, activateChip, deductChipCosts, makeChipState } from '../../../../src/features-v2/engine/chip-system.js';
import { buildTableSnapshot, applyMutations } from '../../../../src/features-v2/engine/table.js';
import { BreakingBlow } from '../../../../src/features-v2/abilities/Bone/BreakingBlow.js';
import { mockCharacter, mockAdversary, mockGameState, mockRoll, runReviewAction, runResolve } from '../helpers.js';

describe('Bone — Breaking Blow', () => {
  it('offers a reviewAction chip on a successful attack with a target', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const gs = mockGameState({
      activeElements: [char, adv],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Breaking Blow',
      featureState: { 'Breaking Blow': {} },
      rolls: mockRoll({ isSuccess: true }),
      action: {
        type: 'attack',
        actorInstanceId: 'char-1',
        targetInstanceIds: ['adv-1'],
        effects: [],
      },
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...BreakingBlow, _ownerInstanceId: 'char-1' }], 'reviewAction', tbl);
    const bb = chips.find((c) => c.name === 'Breaking Blow');
    expect(bb).toBeDefined();
    expect(bb.stressCost).toBe(1);
    expect(bb.placements).toContain('reviewAction');
  });

  it('prime chip marks Stress and sets pending target id', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const gs = mockGameState({
      activeElements: [char, adv],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Breaking Blow',
      featureState: { 'Breaking Blow': {} },
      rolls: mockRoll({ isSuccess: true }),
      action: {
        type: 'attack',
        actorInstanceId: 'char-1',
        targetInstanceIds: ['adv-1'],
        effects: [],
      },
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...BreakingBlow, _ownerInstanceId: 'char-1' }], 'reviewAction', tbl);
    const bb = chips.find((c) => c.name === 'Breaking Blow');
    deductChipCosts(bb, tbl);
    const fromUse = activateChip(bb, tbl, makeChipState());
    const m = [...fromUse, ...applyMutations(tbl)];
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'markStress',
        payload: expect.objectContaining({ instanceId: 'char-1', amount: 1 }),
      })
    );
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Breaking Blow',
          key: 'breakingBlowPendingTargetId',
          value: 'adv-1',
        }),
      })
    );
  });

  it('onReviewAction adds 2d12 and clears primed state when attacking the primed target', () => {
    const { mutations } = runReviewAction(
      { ...BreakingBlow, _ownerInstanceId: 'char-1' },
      {
        featureState: {
          'Breaking Blow': { breakingBlowPrimedTargetId: 'adv-1' },
        },
        rolls: mockRoll({
          isSuccess: true,
          damageDice: [{ name: 'weapon', die: 'd8', value: 3 }],
        }),
        action: {
          type: 'attack',
          actorInstanceId: 'char-1',
          targetInstanceIds: ['adv-1'],
          effects: [],
        },
        actionType: 'attack',
      }
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addRollDie',
        payload: expect.objectContaining({
          rollKey: 'damage',
          name: 'Breaking Blow',
          die: '2d12',
        }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          key: 'breakingBlowPrimedTargetId',
          value: null,
        }),
      })
    );
  });

  it('onReviewAction does not add damage when no primed target', () => {
    const { mutations } = runReviewAction(
      { ...BreakingBlow, _ownerInstanceId: 'char-1' },
      {
        featureState: { 'Breaking Blow': {} },
        rolls: mockRoll({ isSuccess: true, damageDice: [{ name: 'weapon', die: 'd8', value: 3 }] }),
        action: {
          type: 'attack',
          actorInstanceId: 'char-1',
          targetInstanceIds: ['adv-1'],
          effects: [],
        },
        actionType: 'attack',
      }
    );
    expect(mutations.filter((m) => m.type === 'addRollDie')).toHaveLength(0);
  });

  it('onReviewAction does not add damage when attacking a different target than primed', () => {
    const { mutations } = runReviewAction(
      { ...BreakingBlow, _ownerInstanceId: 'char-1' },
      {
        featureState: {
          'Breaking Blow': { breakingBlowPrimedTargetId: 'adv-1' },
        },
        rolls: mockRoll({ isSuccess: true, damageDice: [{ name: 'weapon', die: 'd8', value: 3 }] }),
        action: {
          type: 'attack',
          actorInstanceId: 'char-1',
          targetInstanceIds: ['adv-2'],
          effects: [],
        },
        activeElements: [
          mockCharacter({ instanceId: 'char-1' }),
          mockAdversary({ instanceId: 'adv-1' }),
          mockAdversary({ instanceId: 'adv-2' }),
        ],
        actionType: 'attack',
      }
    );
    expect(mutations.filter((m) => m.type === 'addRollDie')).toHaveLength(0);
  });

  it('onResolve moves pending prime to primed after marking Stress', () => {
    const { mutations } = runResolve(
      { ...BreakingBlow, _ownerInstanceId: 'char-1' },
      {
        featureState: {
          'Breaking Blow': { breakingBlowPendingTargetId: 'adv-1' },
        },
        action: {
          type: 'attack',
          actorInstanceId: 'char-1',
          targetInstanceIds: ['adv-1'],
          effects: [],
        },
        actionType: 'attack',
      }
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          key: 'breakingBlowPrimedTargetId',
          value: 'adv-1',
        }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          key: 'breakingBlowPendingTargetId',
          value: null,
        }),
      })
    );
  });
});
