import { describe, it, expect } from 'vitest';
import { buildTableSnapshot, applyMutations } from '../../../../src/features-v2/engine/table.js';
import {
  collectChips,
  activateChip,
  deductChipCosts,
  makeChipState,
} from '../../../../src/features-v2/engine/chip-system.js';
import { ShieldAura } from '../../../../src/features-v2/abilities/Splendor/ShieldAura.js';
import { mockCharacter, mockAdversary, mockGameState, mockAction, runReviewOutcome } from '../helpers.js';

describe('Splendor — Shield Aura', () => {
  const feat = { ...ShieldAura, _ownerInstanceId: 's1' };

  it('card marks Stress, sets ward id, and queues actionLoop', () => {
    const seraph = mockCharacter({ instanceId: 's1', tokenX: 0, tokenY: 0 });
    const ally = mockCharacter({ instanceId: 'a1', name: 'Ally', tokenX: 8, tokenY: 0 });
    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [seraph, ally],
        _ownerInstanceId: 's1',
        _featureKey: 'Shield Aura',
        featureState: { 'Shield Aura': {} },
        action: {
          type: 'free',
          actorInstanceId: 's1',
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
    const m = activateChip(main, tbl, makeChipState(), { selectedTargetIds: ['a1'] });
    deductChipCosts(main, tbl);
    const fromCost = applyMutations(tbl);
    const all = [...m, ...fromCost];
    expect(all).toContainEqual(
      expect.objectContaining({
        type: 'markStress',
        payload: expect.objectContaining({ instanceId: 's1', amount: 1 }),
      })
    );
    expect(all).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Shield Aura',
          key: 'shieldAuraTargetId',
          value: 'a1',
        }),
      })
    );
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({ title: 'Shield Aura' }),
      })
    );
  });

  it('onReviewOutcome applies extra threshold when ward uses armor vs physical damage', () => {
    const seraph = mockCharacter({ instanceId: 's1', tokenX: 0, tokenY: 0 });
    const ally = mockCharacter({ instanceId: 'a1', tokenX: 8, tokenY: 0 });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations, loop } = runReviewOutcome(feat, {
      featureState: { 'Shield Aura': { shieldAuraTargetId: 'a1' } },
      activeElements: [seraph, ally, adv],
      actionType: 'attack',
      action: {
        ...mockAction({ type: 'attack', actorInstanceId: 'adv-1', targetInstanceIds: ['a1'] }),
        effects: [
          {
            type: 'damage',
            target: { instanceId: 'a1', elementType: 'character', name: 'Ally' },
            amount: 2,
            damageType: 'physical',
            useArmor: true,
          },
        ],
        useArmorByTargetId: { a1: true },
      },
    });

    const dmg = loop.gameState.action.effects.find((e) => e.type === 'damage');
    expect(dmg?.amount).toBe(1);
    expect(mutations).toContainEqual(expect.objectContaining({ type: 'addNarration' }));
  });

  it('onReviewOutcome clears aura when no HP remain marked', () => {
    const seraph = mockCharacter({ instanceId: 's1', tokenX: 0, tokenY: 0 });
    const ally = mockCharacter({ instanceId: 'a1', tokenX: 8, tokenY: 0 });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations } = runReviewOutcome(feat, {
      featureState: { 'Shield Aura': { shieldAuraTargetId: 'a1' } },
      activeElements: [seraph, ally, adv],
      actionType: 'attack',
      action: {
        ...mockAction({ type: 'attack', actorInstanceId: 'adv-1', targetInstanceIds: ['a1'] }),
        effects: [
          {
            type: 'damage',
            target: { instanceId: 'a1', elementType: 'character', name: 'Ally' },
            amount: 1,
            damageType: 'physical',
            useArmor: true,
          },
        ],
        useArmorByTargetId: { a1: true },
      },
    });

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Shield Aura',
          key: 'shieldAuraTargetId',
          value: null,
        }),
      })
    );
  });

  it('onRest (long rest) clears shieldAuraTargetId', () => {
    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [mockCharacter({ instanceId: 's1' })],
        _ownerInstanceId: 's1',
        _featureKey: 'Shield Aura',
        featureState: { 'Shield Aura': { shieldAuraTargetId: 'a1' } },
        action: {
          type: 'longRest',
          actorInstanceId: 's1',
          targetInstanceIds: [],
          effects: [],
          appliedEffects: [],
        },
        rolls: undefined,
      })
    );
    ShieldAura.hooks.onRest(tbl);
    const m = applyMutations(tbl);
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Shield Aura',
          key: 'shieldAuraTargetId',
          value: null,
        }),
      })
    );
  });
});
