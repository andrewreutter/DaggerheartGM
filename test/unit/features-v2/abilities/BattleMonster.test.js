import { describe, it, expect } from 'vitest';
import { buildTableSnapshot, applyMutations } from '../../../../src/features-v2/engine/table.js';
import { collectChips, activateChip, deductChipCosts, makeChipState } from '../../../../src/features-v2/engine/chip-system.js';
import { BattleMonster } from '../../../../src/features-v2/abilities/Blade/BattleMonster.js';
import { mockCharacter, mockAdversary, mockGameState, mockRoll, runReviewAction } from '../helpers.js';

const feat = { ...BattleMonster, _ownerInstanceId: 'char-1' };

const baseAttackAction = {
  type: 'attack',
  actorInstanceId: 'char-1',
  targetInstanceIds: ['adv-1'],
  weaponId: 'srd-wpn-longsword',
  effects: [],
};

describe('Blade — Battle Monster', () => {
  it('shows reviewAction chip on a successful weapon attack vs an adversary', () => {
    const { chips } = runReviewAction(feat, {
      action: baseAttackAction,
      rolls: mockRoll({
        action: { isSuccess: true },
        damageDice: [{ name: 'weapon', die: 'd8', value: 4 }],
      }),
    });
    const bm = chips.filter((c) => c.name === 'Battle Monster');
    expect(bm).toHaveLength(1);
    expect(bm[0].placements).toContain('reviewAction');
    expect(bm[0].stressCost).toBe(4);
  });

  it('does not show the chip when the attack misses', () => {
    const { chips } = runReviewAction(feat, {
      action: baseAttackAction,
      rolls: mockRoll({
        action: { isSuccess: false },
        damageDice: [{ name: 'weapon', die: 'd8', value: 3 }],
      }),
    });
    expect(chips.filter((c) => c.name === 'Battle Monster')).toHaveLength(0);
  });

  it('does not show the chip without a weapon attack', () => {
    const { chips } = runReviewAction(feat, {
      action: { ...baseAttackAction, weaponId: null },
      rolls: mockRoll({ action: { isSuccess: true } }),
    });
    expect(chips.filter((c) => c.name === 'Battle Monster')).toHaveLength(0);
  });

  it('disables the chip when fewer than 4 empty Stress boxes remain', () => {
    const self = mockCharacter({ instanceId: 'char-1', currentStress: 3, maxStress: 6 });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const gs = mockGameState({
      activeElements: [self, adv],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Battle Monster',
      action: baseAttackAction,
      rolls: mockRoll({
        action: { isSuccess: true },
        damageDice: [{ name: 'weapon', die: 'd8', value: 4 }],
      }),
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([feat], 'reviewAction', tbl);
    const bm = chips.find((c) => c.name === 'Battle Monster');
    expect(bm).toBeDefined();
    expect(typeof bm.isDisabled).toBe('function');
    expect(bm.disabled).toBe(true);
  });

  it('deductChipCosts + activateChip: marks 4 Stress, strips damage die, marks target HP equal to attacker marked HP', () => {
    const self = mockCharacter({
      instanceId: 'char-1',
      currentHp: 3,
      maxHp: 6,
      currentStress: 0,
      maxStress: 6,
    });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const gs = mockGameState({
      activeElements: [self, adv],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Battle Monster',
      action: baseAttackAction,
      rolls: mockRoll({
        action: { isSuccess: true },
        damageDice: [{ name: 'weapon', die: 'd8', value: 7 }],
      }),
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([feat], 'reviewAction', tbl);
    const bm = chips.find((c) => c.name === 'Battle Monster');
    expect(bm).toBeDefined();

    deductChipCosts(bm, tbl);
    const mutations = activateChip(bm, tbl, makeChipState());

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'markStress',
        payload: expect.objectContaining({ instanceId: 'char-1', amount: 4 }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'removeRollDie',
        payload: expect.objectContaining({ rollKey: 'damage', name: 'weapon' }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'markHP',
        payload: expect.objectContaining({ instanceId: 'adv-1', amount: 3 }),
      })
    );
  });

  it('negates existing damage statics when stripping the roll', () => {
    const self = mockCharacter({
      instanceId: 'char-1',
      currentHp: 5,
      maxHp: 6,
      currentStress: 0,
      maxStress: 6,
    });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const rolls = mockRoll({
      action: { isSuccess: true },
      damageDice: [{ name: 'weapon', die: 'd8', value: 2 }],
      damageStatics: [{ name: 'Rage Up', value: 2 }],
    });
    const gs = mockGameState({
      activeElements: [self, adv],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Battle Monster',
      action: baseAttackAction,
      rolls,
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([feat], 'reviewAction', tbl);
    const bm = chips.find((c) => c.name === 'Battle Monster');
    deductChipCosts(bm, tbl);
    const mutations = activateChip(bm, tbl, makeChipState());
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addRollStatic',
        payload: expect.objectContaining({
          rollKey: 'damage',
          name: 'Battle Monster',
          value: -2,
        }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'markHP',
        payload: expect.objectContaining({ instanceId: 'adv-1', amount: 1 }),
      })
    );
    const extra = applyMutations(tbl);
    expect(extra).toHaveLength(0);
  });
});
