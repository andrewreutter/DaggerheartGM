import { describe, it, expect } from 'vitest';
import { buildTableSnapshot, applyMutations } from '../../../../src/features-v2/engine/table.js';
import {
  collectChips,
  activateChip,
  makeChipState,
  deductChipCosts,
} from '../../../../src/features-v2/engine/chip-system.js';
import { GoadThemOn } from '../../../../src/features-v2/abilities/Valor/GoadThemOn.js';
import { HoldTheLine } from '../../../../src/features-v2/abilities/Valor/HoldTheLine.js';
import { Unbreakable } from '../../../../src/features-v2/abilities/Valor/Unbreakable.js';
import { dispatchTokenMoveHooks } from '../../../../src/features-v2/engine/action-loop.js';
import { mockAdversary, mockCharacter, mockGameState, mockRoll, runReviewOutcome } from '../helpers.js';

describe('Valor Tier 4 — Goad Them on', () => {
  it('card has Recall Cost 1 (hopeCost) and queues Presence actionLoop with full taunt instructions', () => {
    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [
          mockCharacter({ instanceId: 'v1', hope: 3, tokenX: 0, tokenY: 0 }),
          mockAdversary({ instanceId: 'adv-1', name: 'Goblin', tokenX: 10, tokenY: 0 }),
        ],
        _ownerInstanceId: 'v1',
        _featureKey: 'Goad Them on',
        action: { type: 'free', actorInstanceId: 'v1', targetInstanceIds: [], effects: [] },
        rolls: undefined,
      })
    );
    const chips = collectChips([{ ...GoadThemOn, _ownerInstanceId: 'v1' }], 'card', tbl);
    const card = chips[0];
    expect(card?.hopeCost).toBe(1);
    const fromUse = activateChip(card, tbl, makeChipState(), { selectedTargetIds: ['adv-1'] });
    deductChipCosts(card, tbl);
    const fromCost = applyMutations(tbl);
    const m = [...fromUse, ...fromCost];
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({
          title: 'Goad Them on',
          trait: 'Presence',
          description: expect.stringContaining('Goblin'),
        }),
      })
    );
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'spendHope',
        payload: expect.objectContaining({ instanceId: 'v1', amount: 1 }),
      })
    );
  });
});

describe('Valor Tier 4 — Hold the Line', () => {
  it('stance card spends 1 Hope and activates defensive stance (actionLoop + feature state)', () => {
    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [mockCharacter({ instanceId: 'v1', hope: 3, tokenX: 0, tokenY: 0 })],
        _ownerInstanceId: 'v1',
        _featureKey: 'Hold the Line',
        action: { type: 'free', actorInstanceId: 'v1', targetInstanceIds: [], effects: [] },
        rolls: undefined,
      })
    );
    const chips = collectChips([{ ...HoldTheLine, _ownerInstanceId: 'v1' }], 'card', tbl);
    const stance = chips.find((c) => c.name === 'Hold the Line');
    expect(stance?.hopeCost).toBe(1);
    const fromUse = activateChip(stance, tbl, makeChipState());
    deductChipCosts(stance, tbl);
    const fromCost = applyMutations(tbl);
    const m = [...fromUse, ...fromCost];
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({ title: 'Hold the Line' }),
      })
    );
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'spendHope',
        payload: expect.objectContaining({ instanceId: 'v1', amount: 1 }),
      })
    );
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({ key: 'holdTheLineActive', value: true }),
      })
    );
  });

  it('onTokenMove pulls adversary to Melee and Restrained when they enter Very Close while stance is active', () => {
    const char = mockCharacter({ instanceId: 'v1', tokenX: 0, tokenY: 0 });
    const advPost = mockAdversary({ instanceId: 'adv-1', tokenX: 8, tokenY: 0 });
    const gameState = {
      fear: 3,
      activeElements: [char, advPost],
      featureState: {
        'Hold the Line': { holdTheLineActive: true, holdTheLineRestrainedIds: [] },
      },
      _previousPositions: { 'adv-1': { tokenX: 25, tokenY: 0 } },
    };

    const { mutations } = dispatchTokenMoveHooks(
      gameState,
      [{ ...HoldTheLine, _ownerInstanceId: 'v1' }],
      { moverInstanceId: 'adv-1' }
    );

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'move',
        payload: expect.objectContaining({ instanceId: 'adv-1' }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addCondition',
        payload: expect.objectContaining({ instanceId: 'adv-1', condition: 'Restrained' }),
      })
    );
  });

  it('onTokenMove clears stance when the character moves', () => {
    const charPost = mockCharacter({
      instanceId: 'v1',
      tokenX: 5,
      tokenY: 0,
      conditions: [],
    });
    const adv = mockAdversary({
      instanceId: 'adv-1',
      tokenX: 4,
      tokenY: 0,
      conditions: ['Restrained'],
    });
    const gameState = {
      fear: 0,
      activeElements: [charPost, adv],
      featureState: {
        'Hold the Line': {
          holdTheLineActive: true,
          holdTheLineRestrainedIds: ['adv-1'],
        },
      },
      _previousPositions: { 'v1': { tokenX: 0, tokenY: 0 } },
    };

    const { mutations } = dispatchTokenMoveHooks(
      gameState,
      [{ ...HoldTheLine, _ownerInstanceId: 'v1' }],
      { moverInstanceId: 'v1' }
    );

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({ key: 'holdTheLineActive', value: false }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'removeCondition',
        payload: expect.objectContaining({ instanceId: 'adv-1', condition: 'Restrained' }),
      })
    );
  });

  it('onReviewOutcome clears stance when acting and Fear exceeds Hope', () => {
    const { mutations } = runReviewOutcome(
      { ...HoldTheLine, _ownerInstanceId: 'v1' },
      {
        activeElements: [mockCharacter({ instanceId: 'v1' }), mockAdversary()],
        featureState: {
          'Hold the Line': { holdTheLineActive: true, holdTheLineRestrainedIds: [] },
        },
        rolls: mockRoll({ hopeValue: 3, fearValue: 9 }),
      }
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({ key: 'holdTheLineActive', value: false }),
      })
    );
  });

  it('GM chip spends 2 Fear and clears stance when active', () => {
    const tbl = buildTableSnapshot(
      mockGameState({
        fear: 4,
        activeElements: [mockCharacter({ instanceId: 'v1', tokenX: 0, tokenY: 0 })],
        _ownerInstanceId: 'v1',
        _featureKey: 'Hold the Line',
        featureState: {
          'Hold the Line': { holdTheLineActive: true, holdTheLineRestrainedIds: [] },
        },
        action: { type: 'free', actorInstanceId: 'v1', targetInstanceIds: [], effects: [] },
        rolls: undefined,
      })
    );
    const chips = collectChips([{ ...HoldTheLine, _ownerInstanceId: 'v1' }], 'card', tbl);
    const gmChip = chips.find((c) => c.name?.startsWith('GM:'));
    const m = activateChip(gmChip, tbl, makeChipState());
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'spendFear',
        payload: expect.objectContaining({ amount: 2 }),
      })
    );
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({ key: 'holdTheLineActive', value: false }),
      })
    );
  });
});

describe('Valor Tier 4 — Unbreakable', () => {
  it('shows reviewOutcome chip when incoming HP loss would force a Death Move', () => {
    const char = mockCharacter({ instanceId: 'v1', currentHp: 2, maxHp: 6 });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const { chips } = runReviewOutcome(
      { ...Unbreakable, _ownerInstanceId: 'v1' },
      {
        activeElements: [char, adv],
        _ownerInstanceId: 'v1',
        action: {
          actorInstanceId: 'adv-1',
          targetInstanceIds: ['v1'],
          effects: [{ stat: 'currentHP', target: char, amount: 3, source: adv }],
        },
      }
    );
    expect(chips).toHaveLength(1);
    expect(chips[0].placements).toContain('reviewOutcome');
  });

  it('does not show chip when damage would not reach Death Move', () => {
    const char = mockCharacter({ instanceId: 'v1', currentHp: 4, maxHp: 6 });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const { chips } = runReviewOutcome(
      { ...Unbreakable, _ownerInstanceId: 'v1' },
      {
        activeElements: [char, adv],
        _ownerInstanceId: 'v1',
        action: {
          actorInstanceId: 'adv-1',
          targetInstanceIds: ['v1'],
          effects: [{ stat: 'currentHP', target: char, amount: 2, source: adv }],
        },
      }
    );
    expect(chips).toHaveLength(0);
  });

  it('onUse cancels lethal HP loss, clears HP from d6 roll, moves card to vault, and narrates', () => {
    const char = mockCharacter({ instanceId: 'v1', currentHp: 2, maxHp: 6 });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const effects = [{ stat: 'currentHP', target: char, amount: 3, source: adv }];
    const gs = mockGameState({
      activeElements: [char, adv],
      _ownerInstanceId: 'v1',
      _featureKey: 'Unbreakable',
      _rng: () => 0.2,
      action: {
        type: 'attack',
        actorInstanceId: 'adv-1',
        targetInstanceIds: ['v1'],
        effects,
      },
      rolls: mockRoll(),
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...Unbreakable, _ownerInstanceId: 'v1' }], 'reviewOutcome', tbl);
    expect(chips).toHaveLength(1);
    const fromUse = activateChip(chips[0], tbl, makeChipState());
    const m = [...fromUse, ...applyMutations(tbl)];
    expect(effects[0].amount).toBe(0);
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'rollDie',
        payload: expect.objectContaining({ notation: 'd6', total: 2 }),
      })
    );
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'clearHP',
        payload: expect.objectContaining({ instanceId: 'v1', amount: 2 }),
      })
    );
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'domainCardMoveToVault',
        payload: expect.objectContaining({ instanceId: 'v1', cardId: 'srd-abl-unbreakable' }),
      })
    );
  });
});
