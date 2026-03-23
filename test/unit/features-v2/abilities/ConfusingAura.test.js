import { describe, it, expect } from 'vitest';
import {
  collectChips,
  activateChip,
  makeChipState,
  deductChipCosts,
} from '../../../../src/features-v2/engine/chip-system.js';
import { ConfusingAura } from '../../../../src/features-v2/abilities/Arcana/ConfusingAura.js';
import {
  mockGameState,
  mockCharacter,
  mockAdversary,
  mockRoll,
  mockAction,
  mockAdversaryAttackRoll,
  runReviewAction,
} from '../helpers.js';
import { buildTableSnapshot, applyMutations } from '../../../../src/features-v2/engine/table.js';
import { unwrap } from '../../../../src/features-v2/engine/when.js';

const feat = { ...ConfusingAura, _ownerInstanceId: 'char-1' };

describe('Arcana — Confusing Aura', () => {
  it('card chip is long rest and queues Spellcast (14) with awaiting flag', () => {
    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [mockCharacter({ instanceId: 'char-1', spellcastTrait: 'presence' })],
        _ownerInstanceId: 'char-1',
        _featureKey: 'Confusing Aura',
        featureState: { 'Confusing Aura': {} },
        action: { type: 'free', actorInstanceId: 'char-1', targetInstanceIds: [], effects: [], appliedEffects: [] },
        rolls: undefined,
      })
    );
    const chips = collectChips([feat], 'card', tbl);
    const cast = chips.find((c) => c.name === 'Confusing Aura');
    expect(cast?.frequency).toBe('longRest');
    const m = [...activateChip(cast, tbl, makeChipState()), ...applyMutations(tbl)];
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({
          title: 'Confusing Aura',
          difficulty: 14,
        }),
      })
    );
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({ key: 'cauAwaitingSpellcast', value: true }),
      })
    );
  });

  it('onReviewAction after successful Spellcast sets pending Stress choice (no layers until confirmed)', () => {
    const { mutations } = runReviewAction(feat, {
      featureState: { 'Confusing Aura': { cauAwaitingSpellcast: true } },
      actionType: 'spellcast',
      action: mockAction({ type: 'spellcast', actorInstanceId: 'char-1', targetInstanceIds: [] }),
      rolls: mockRoll({ isSuccess: true }),
    });
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({ key: 'cauExtraStressPending', value: true }),
      })
    );
    expect(mutations.some((m) => m.payload?.key === 'confusingAuraLayers')).toBe(false);
  });

  it('Additional layers chip sets total layers to 1 + chosen Stress and clears pending', () => {
    const char = mockCharacter({
      instanceId: 'char-1',
      currentStress: 0,
      maxStress: 6,
      spellcastTrait: 'presence',
    });
    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [char],
        _ownerInstanceId: 'char-1',
        _featureKey: 'Confusing Aura',
        featureState: { 'Confusing Aura': { cauExtraStressPending: true } },
        action: { type: 'free', actorInstanceId: 'char-1', targetInstanceIds: [], effects: [], appliedEffects: [] },
        rolls: undefined,
      })
    );
    const chips = collectChips([feat], 'card', tbl);
    const extra = chips.find((c) => c.name === 'Additional layers');
    expect(extra).toBeDefined();
    const fromUse = activateChip(extra, tbl, makeChipState(), { selectedId: '2' });
    deductChipCosts(extra, tbl);
    const m = [...fromUse, ...applyMutations(tbl)];
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({ key: 'confusingAuraLayers', value: 3 }),
      })
    );
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({ key: 'cauExtraStressPending', value: false }),
      })
    );
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'markStress',
        payload: expect.objectContaining({ instanceId: 'char-1', amount: 2 }),
      })
    );
  });

  it('when any layer die is 5+, removes one layer and zeroes pending damage to you', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const effects = [
      {
        type: 'damage',
        target: char,
        amount: 7,
        source: adv,
        damageType: 'physical',
      },
    ];
    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [char, adv],
        _ownerInstanceId: 'char-1',
        _featureKey: 'Confusing Aura',
        featureState: { 'Confusing Aura': { confusingAuraLayers: 2 } },
        _rng: () => 0.99,
        action: {
          type: 'attack',
          actorInstanceId: adv.instanceId,
          targetInstanceIds: [char.instanceId],
          effects,
          appliedEffects: [],
        },
        rolls: mockAdversaryAttackRoll({ isSuccess: true }),
      })
    );
    const hookFn = unwrap(ConfusingAura.hooks.onReviewAction, tbl);
    hookFn(tbl);
    const m = applyMutations(tbl);
    expect(effects[0].amount).toBe(0);
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({ key: 'confusingAuraLayers', value: 1 }),
      })
    );
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'addNarration',
        payload: expect.objectContaining({ text: expect.stringMatching(/Confusing Aura:/) }),
      })
    );
  });

  it('when all layer dice are 4 or lower, clears aura and leaves damage', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const effects = [
      {
        type: 'damage',
        target: char,
        amount: 4,
        source: adv,
        damageType: 'physical',
      },
    ];
    let call = 0;
    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [char, adv],
        _ownerInstanceId: 'char-1',
        _featureKey: 'Confusing Aura',
        featureState: { 'Confusing Aura': { confusingAuraLayers: 2 } },
        _rng: () => {
          call += 1;
          return call === 1 ? 0.5 : 0.5;
        },
        action: {
          type: 'attack',
          actorInstanceId: adv.instanceId,
          targetInstanceIds: [char.instanceId],
          effects,
          appliedEffects: [],
        },
        rolls: mockAdversaryAttackRoll({ isSuccess: true }),
      })
    );
    const hookFn = unwrap(ConfusingAura.hooks.onReviewAction, tbl);
    hookFn(tbl);
    const m = applyMutations(tbl);
    expect(effects[0].amount).toBe(4);
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({ key: 'confusingAuraLayers', value: null }),
      })
    );
  });

  it('does not intercept when no active layers', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const effects = [
      {
        type: 'damage',
        target: char,
        amount: 5,
        source: adv,
        damageType: 'physical',
      },
    ];
    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [char, adv],
        _ownerInstanceId: 'char-1',
        _featureKey: 'Confusing Aura',
        featureState: { 'Confusing Aura': {} },
        action: {
          type: 'attack',
          actorInstanceId: adv.instanceId,
          targetInstanceIds: [char.instanceId],
          effects,
          appliedEffects: [],
        },
        rolls: mockAdversaryAttackRoll({ isSuccess: true }),
      })
    );
    const hookFn = unwrap(ConfusingAura.hooks.onReviewAction, tbl);
    expect(hookFn).toBeUndefined();
    const m = applyMutations(tbl);
    expect(effects[0].amount).toBe(5);
    expect(m.filter((x) => x.type === 'rollDie')).toHaveLength(0);
  });
});
