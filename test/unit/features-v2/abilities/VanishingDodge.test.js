import { describe, it, expect } from 'vitest';
import { createActionLoop } from '../../../../src/features-v2/engine/action-loop.js';
import { buildTableSnapshot, applyMutations } from '../../../../src/features-v2/engine/table.js';
import { collectChips, activateChip, deductChipCosts, makeChipState } from '../../../../src/features-v2/engine/chip-system.js';
import { VanishingDodge } from '../../../../src/features-v2/abilities/Midnight/VanishingDodge.js';
import {
  mockCharacter,
  mockAdversary,
  mockGameState,
  mockAdversaryAttackRoll,
  mockAction,
  runIntent,
} from '../helpers.js';

function baseVsAdvAttack(rollOverrides = {}) {
  const char = mockCharacter({ instanceId: 'c1', tokenX: 0, tokenY: 0 });
  const atk = mockAdversary({ instanceId: 'a1', tokenX: 25, tokenY: 0 });
  return mockGameState({
    activeElements: [char, atk],
    _ownerInstanceId: 'c1',
    _featureKey: 'Vanishing Dodge',
    featureState: { 'Vanishing Dodge': {} },
    currentActorInstanceId: 'a1',
    action: {
      type: 'attack',
      actorInstanceId: 'a1',
      targetInstanceIds: ['c1'],
      effects: [],
    },
    rolls: mockAdversaryAttackRoll({
      isSuccess: false,
      damage: { dice: [{ name: 'w', die: 'd8', value: 3 }] },
      ...rollOverrides,
    }),
  });
}

describe('Midnight — Vanishing Dodge', () => {
  it('offers reviewAction chip on failed physical attack vs owner', () => {
    const gs = baseVsAdvAttack();
    const loop = createActionLoop(gs, mockAction({ type: 'attack', actorInstanceId: 'a1', targetInstanceIds: ['c1'] }), [
      { ...VanishingDodge, _ownerInstanceId: 'c1' },
    ]);
    loop.setRolls(gs.rolls);
    loop.runPhase('reviewAction');
    const tbl = buildTableSnapshot({
      ...loop.gameState,
      _ownerInstanceId: 'c1',
      _featureKey: 'Vanishing Dodge',
    });
    const chips = collectChips([{ ...VanishingDodge, _ownerInstanceId: 'c1' }], 'reviewAction', tbl);
    expect(chips.map((c) => c.name)).toContain('Vanishing Dodge');
    expect(chips.find((c) => c.name === 'Vanishing Dodge')?.hopeCost).toBe(1);
  });

  it('does not offer chip when the attack succeeds', () => {
    const gs = baseVsAdvAttack();
    gs.rolls = mockAdversaryAttackRoll({
      isSuccess: true,
      damage: { dice: [{ name: 'w', die: 'd8', value: 3 }] },
    });
    const loop = createActionLoop(gs, mockAction({ type: 'attack', actorInstanceId: 'a1', targetInstanceIds: ['c1'] }), [
      { ...VanishingDodge, _ownerInstanceId: 'c1' },
    ]);
    loop.setRolls(gs.rolls);
    loop.runPhase('reviewAction');
    const tbl = buildTableSnapshot({
      ...loop.gameState,
      _ownerInstanceId: 'c1',
      _featureKey: 'Vanishing Dodge',
    });
    const chips = collectChips([{ ...VanishingDodge, _ownerInstanceId: 'c1' }], 'reviewAction', tbl);
    expect(chips.filter((c) => c.name === 'Vanishing Dodge')).toHaveLength(0);
  });

  it('does not offer chip when damage is magic', () => {
    const gs = baseVsAdvAttack();
    gs.rolls = mockAdversaryAttackRoll({
      isSuccess: false,
      damage: { dice: [{ name: 'w', die: 'd8', value: 3, damageType: 'magic' }] },
    });
    const loop = createActionLoop(gs, mockAction({ type: 'attack', actorInstanceId: 'a1', targetInstanceIds: ['c1'] }), [
      { ...VanishingDodge, _ownerInstanceId: 'c1' },
    ]);
    loop.setRolls(gs.rolls);
    loop.runPhase('reviewAction');
    const tbl = buildTableSnapshot({
      ...loop.gameState,
      _ownerInstanceId: 'c1',
      _featureKey: 'Vanishing Dodge',
    });
    const chips = collectChips([{ ...VanishingDodge, _ownerInstanceId: 'c1' }], 'reviewAction', tbl);
    expect(chips.filter((c) => c.name === 'Vanishing Dodge')).toHaveLength(0);
  });

  it('onUse spends Hope, adds Hidden, move request, and arms clear-on-intent flag', () => {
    const gs = baseVsAdvAttack();
    const loop = createActionLoop(gs, mockAction({ type: 'attack', actorInstanceId: 'a1', targetInstanceIds: ['c1'] }), [
      { ...VanishingDodge, _ownerInstanceId: 'c1' },
    ]);
    loop.setRolls(gs.rolls);
    loop.runPhase('reviewAction');
    const tbl = buildTableSnapshot({
      ...loop.gameState,
      _ownerInstanceId: 'c1',
      _featureKey: 'Vanishing Dodge',
    });
    const chip = collectChips([{ ...VanishingDodge, _ownerInstanceId: 'c1' }], 'reviewAction', tbl).find(
      (c) => c.name === 'Vanishing Dodge'
    );
    const fromUse = activateChip(chip, tbl, makeChipState());
    deductChipCosts(chip, tbl);
    const mutations = [...fromUse, ...applyMutations(tbl)];
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'spendHope',
        payload: expect.objectContaining({ instanceId: 'c1', amount: 1 }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addCondition',
        payload: expect.objectContaining({ instanceId: 'c1', condition: 'Hidden' }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'move',
        payload: expect.objectContaining({ instanceId: 'c1' }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Vanishing Dodge',
          key: 'vanishingDodgeActive',
          value: true,
        }),
      })
    );
  });

  it('onIntent clears Hidden and flag when owner makes an action roll', () => {
    const { mutations } = runIntent(
      { ...VanishingDodge, _ownerInstanceId: 'char-1' },
      {
        featureState: { 'Vanishing Dodge': { vanishingDodgeActive: true } },
        actionType: 'attack',
        action: { actorInstanceId: 'char-1', targetInstanceIds: ['adv-1'] },
      }
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'removeCondition',
        payload: expect.objectContaining({ instanceId: 'char-1', condition: 'Hidden' }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Vanishing Dodge',
          key: 'vanishingDodgeActive',
          value: false,
        }),
      })
    );
  });
});
