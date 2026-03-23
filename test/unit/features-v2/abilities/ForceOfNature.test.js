import { describe, it, expect } from 'vitest';
import { dispatchStateChangeHooks } from '../../../../src/features-v2/engine/action-loop.js';
import { applyMutations, buildTableSnapshot } from '../../../../src/features-v2/engine/table.js';
import {
  collectChips,
  activateChip,
  deductChipCosts,
  makeChipState,
} from '../../../../src/features-v2/engine/chip-system.js';
import { ForceOfNature } from '../../../../src/features-v2/abilities/Sage/ForceOfNature.js';
import {
  mockCharacter,
  mockAdversary,
  mockGameState,
  mockRoll,
  runIntent,
  runReviewAction,
  runResolve,
} from '../helpers.js';

const feat = { ...ForceOfNature, _ownerInstanceId: 'char-1' };

/** Fresh bag each call — `table.feature.set` mutates nested state; a shared object breaks test order. */
function activeTransformed() {
  return {
    featureState: { 'Force of Nature': { forceOfNatureActive: true } },
  };
}

describe('Sage — Force of Nature', () => {
  it('card activation marks Stress, sets spirit form, and posts action loop', () => {
    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [mockCharacter({ instanceId: 'char-1' }), mockAdversary()],
        _ownerInstanceId: 'char-1',
        _featureKey: 'Force of Nature',
        featureState: { 'Force of Nature': {} },
        action: {
          type: 'free',
          actorInstanceId: 'char-1',
          targetInstanceIds: [],
          effects: [],
          appliedEffects: [],
        },
        rolls: undefined,
      })
    );
    const chips = collectChips([feat], 'card', tbl);
    const main = chips[0];
    expect(main?.stressCost).toBe(1);
    const m = activateChip(main, tbl, makeChipState());
    deductChipCosts(main, tbl);
    const after = [...m, ...applyMutations(tbl)];
    expect(after).toContainEqual(
      expect.objectContaining({
        type: 'markStress',
        payload: expect.objectContaining({ instanceId: 'char-1', amount: 1 }),
      })
    );
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Force of Nature',
          key: 'forceOfNatureActive',
          value: true,
        }),
      })
    );
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({
          instanceId: 'char-1',
          title: 'Force of Nature',
        }),
      })
    );
  });

  it('onIntent spends 1 Hope before an action roll while transformed', () => {
    const char = mockCharacter({ instanceId: 'char-1', hope: 3 });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const { mutations } = runIntent(feat, {
      activeElements: [char, adv],
      ...activeTransformed(),
      action: {
        type: 'attack',
        actorInstanceId: 'char-1',
        targetInstanceIds: [adv.instanceId],
        trait: 'Agility',
        range: 'melee',
        effects: [],
        appliedEffects: [],
      },
      actionType: 'attack',
      rolls: mockRoll(),
    });
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'spendHope',
        payload: expect.objectContaining({ instanceId: 'char-1', amount: 1 }),
      })
    );
  });

  it('onIntent reverts the form when Hope is insufficient for the required spend', () => {
    const char = mockCharacter({ instanceId: 'char-1', hope: 0 });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const { mutations } = runIntent(feat, {
      activeElements: [char, adv],
      ...activeTransformed(),
      action: {
        type: 'attack',
        actorInstanceId: 'char-1',
        targetInstanceIds: [adv.instanceId],
        trait: 'Agility',
        range: 'melee',
        effects: [],
        appliedEffects: [],
      },
      actionType: 'attack',
      rolls: mockRoll(),
    });
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Force of Nature',
          key: 'forceOfNatureActive',
          value: false,
        }),
      })
    );
    expect(mutations.some((m) => m.type === 'spendHope')).toBe(false);
  });

  it('onIntent does not spend Hope when not transformed', () => {
    const char = mockCharacter({ instanceId: 'char-1', hope: 3 });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const { mutations } = runIntent(feat, {
      activeElements: [char, adv],
      featureState: { 'Force of Nature': { forceOfNatureActive: false } },
      action: {
        type: 'attack',
        actorInstanceId: 'char-1',
        targetInstanceIds: [adv.instanceId],
        trait: 'Agility',
        range: 'melee',
        effects: [],
        appliedEffects: [],
      },
      actionType: 'attack',
      rolls: mockRoll(),
    });
    expect(mutations.some((m) => m.type === 'spendHope')).toBe(false);
  });

  it('onReviewAction adds +10 to damage on a successful attack with a damage roll', () => {
    const char = mockCharacter({ instanceId: 'char-1', tokenX: 0, tokenY: 0 });
    const adv = mockAdversary({ instanceId: 'adv-1', tokenX: 10, tokenY: 0 });
    const { mutations } = runReviewAction(feat, {
      activeElements: [char, adv],
      ...activeTransformed(),
      rolls: mockRoll({ isSuccess: true }),
      action: {
        type: 'attack',
        actorInstanceId: 'char-1',
        targetInstanceIds: [adv.instanceId],
        trait: 'Agility',
        range: 'melee',
        effects: [],
        appliedEffects: [],
      },
      actionType: 'attack',
    });
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addRollStatic',
        payload: expect.objectContaining({
          rollKey: 'damage',
          name: 'Force of Nature',
          value: 10,
        }),
      })
    );
  });

  it('onReviewAction does not add +10 when the action roll fails', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const { mutations } = runReviewAction(feat, {
      activeElements: [char, adv],
      ...activeTransformed(),
      rolls: mockRoll({ isSuccess: false }),
      action: {
        type: 'attack',
        actorInstanceId: 'char-1',
        targetInstanceIds: [adv.instanceId],
        trait: 'Agility',
        range: 'melee',
        effects: [],
        appliedEffects: [],
      },
      actionType: 'attack',
    });
    expect(mutations.some((m) => m.payload?.name === 'Force of Nature')).toBe(false);
  });

  it('onResolve clears an Armor Slot when a creature within Close range is defeated by this hit', () => {
    const char = mockCharacter({
      instanceId: 'char-1',
      tokenX: 0,
      tokenY: 0,
      currentArmor: 2,
      maxArmor: 3,
    });
    const adv = mockAdversary({
      instanceId: 'adv-1',
      tokenX: 10,
      tokenY: 0,
      currentHp: 2,
      maxHp: 3,
    });
    const { mutations } = runResolve(feat, {
      activeElements: [char, adv],
      ...activeTransformed(),
      rolls: mockRoll({ isSuccess: true }),
      action: {
        type: 'attack',
        actorInstanceId: 'char-1',
        targetInstanceIds: [adv.instanceId],
        trait: 'Agility',
        range: 'melee',
        effects: [
          {
            type: 'damage',
            target: { instanceId: 'adv-1' },
            amount: 2,
            damageType: 'physical',
          },
        ],
        appliedEffects: [],
      },
      actionType: 'attack',
    });
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'clearArmor',
        payload: expect.objectContaining({ instanceId: 'char-1', amount: 1 }),
      })
    );
  });

  it('onResolve does not clear Armor when the target is beyond Close range', () => {
    const char = mockCharacter({ instanceId: 'char-1', tokenX: 0, tokenY: 0 });
    const adv = mockAdversary({
      instanceId: 'adv-1',
      tokenX: 200,
      tokenY: 0,
      currentHp: 2,
      maxHp: 3,
    });
    const { mutations } = runResolve(feat, {
      activeElements: [char, adv],
      ...activeTransformed(),
      rolls: mockRoll({ isSuccess: true }),
      action: {
        type: 'attack',
        actorInstanceId: 'char-1',
        targetInstanceIds: [adv.instanceId],
        trait: 'Agility',
        range: 'melee',
        effects: [
          {
            type: 'damage',
            target: { instanceId: 'adv-1' },
            amount: 3,
            damageType: 'physical',
          },
        ],
        appliedEffects: [],
      },
      actionType: 'attack',
    });
    expect(mutations.some((m) => m.type === 'clearArmor')).toBe(false);
  });

  it('onStateChange removes Restrained when a batch tries to apply it while transformed', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const gs = mockGameState({
      activeElements: [char],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Force of Nature',
      featureState: { 'Force of Nature': { forceOfNatureActive: true } },
      action: null,
      rolls: null,
    });
    const { mutations } = dispatchStateChangeHooks(
      gs,
      [feat],
      [{ type: 'addCondition', payload: { instanceId: 'char-1', condition: 'Restrained' } }]
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'removeCondition',
        payload: expect.objectContaining({ instanceId: 'char-1', condition: 'Restrained' }),
      })
    );
  });
});
