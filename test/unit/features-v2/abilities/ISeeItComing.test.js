import { describe, it, expect } from 'vitest';
import { buildTableSnapshot, applyMutations } from '../../../../src/features-v2/engine/table.js';
import { collectChips, activateChip, deductChipCosts, makeChipState } from '../../../../src/features-v2/engine/chip-system.js';
import { unwrap } from '../../../../src/features-v2/engine/when.js';
import { PENDING_EVASION_BONUS_STATE_KEY } from '../../../../src/game-constants.js';
import { ISeeItComing } from '../../../../src/features-v2/abilities/Bone/ISeeItComing.js';
import {
  mockCharacter,
  mockAdversary,
  mockGameState,
  mockAdversaryAttackRoll,
} from '../helpers.js';

describe('ISeeItComing', () => {
  it('reviewAction chip appears when an adversary attacks you from beyond Melee', () => {
    const char = mockCharacter({ instanceId: 'char-1', tokenX: 0, tokenY: 0 });
    const adv = mockAdversary({ instanceId: 'adv-1', tokenX: 40, tokenY: 0 });
    const gs = mockGameState({
      activeElements: [char, adv],
      _ownerInstanceId: 'char-1',
      _featureKey: 'I See It Coming',
      featureState: { 'I See It Coming': {} },
      action: {
        type: 'attack',
        actorInstanceId: 'adv-1',
        targetInstanceIds: ['char-1'],
        range: 'close',
        trait: 'Agility',
        effects: [{ type: 'damage', target: { instanceId: 'char-1' }, amount: 3 }],
      },
      rolls: mockAdversaryAttackRoll(),
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...ISeeItComing, _ownerInstanceId: 'char-1' }], 'reviewAction', tbl);
    expect(chips.some((c) => c.name === 'I See It Coming')).toBe(true);
  });

  it('reviewAction chip does not appear when the attacker is in Melee range', () => {
    const char = mockCharacter({ instanceId: 'char-1', tokenX: 0, tokenY: 0 });
    const adv = mockAdversary({ instanceId: 'adv-1', tokenX: 3, tokenY: 0 });
    const gs = mockGameState({
      activeElements: [char, adv],
      _ownerInstanceId: 'char-1',
      _featureKey: 'I See It Coming',
      featureState: { 'I See It Coming': {} },
      action: {
        type: 'attack',
        actorInstanceId: 'adv-1',
        targetInstanceIds: ['char-1'],
        range: 'melee',
        trait: 'Agility',
        effects: [{ type: 'damage', target: { instanceId: 'char-1' }, amount: 2 }],
      },
      rolls: mockAdversaryAttackRoll(),
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...ISeeItComing, _ownerInstanceId: 'char-1' }], 'reviewAction', tbl);
    expect(chips.filter((c) => c.name === 'I See It Coming')).toHaveLength(0);
  });

  it('activating the chip marks Stress, rolls d4, and queues temporary Evasion', () => {
    const char = mockCharacter({ instanceId: 'char-1', tokenX: 0, tokenY: 0 });
    const adv = mockAdversary({ instanceId: 'adv-1', tokenX: 40, tokenY: 0 });
    const gs = mockGameState({
      activeElements: [char, adv],
      _ownerInstanceId: 'char-1',
      _featureKey: 'I See It Coming',
      featureState: { 'I See It Coming': {} },
      action: {
        type: 'attack',
        actorInstanceId: 'adv-1',
        targetInstanceIds: ['char-1'],
        range: 'close',
        effects: [{ type: 'damage', target: { instanceId: 'char-1' }, amount: 3 }],
      },
      rolls: mockAdversaryAttackRoll(),
      _rng: () => 0.31,
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...ISeeItComing, _ownerInstanceId: 'char-1' }], 'reviewAction', tbl);
    const chip = chips.find((c) => c.name === 'I See It Coming');
    expect(chip).toBeDefined();
    const fromUse = activateChip(chip, tbl, makeChipState());
    deductChipCosts(chip, tbl);
    const m = [...fromUse, ...applyMutations(tbl)];
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'markStress',
        payload: expect.objectContaining({ instanceId: 'char-1', amount: 1 }),
      })
    );
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'addTemporaryStatMod',
        payload: expect.objectContaining({ instanceId: 'char-1', stat: 'evasion', value: 2 }),
      })
    );
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'I See It Coming',
          key: PENDING_EVASION_BONUS_STATE_KEY,
          value: 2,
        }),
      })
    );
  });

  it('onReviewOutcome clears stored d4 bonus after resolution', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const gs = mockGameState({
      activeElements: [char, adv],
      _ownerInstanceId: 'char-1',
      _featureKey: 'I See It Coming',
      featureState: { 'I See It Coming': { [PENDING_EVASION_BONUS_STATE_KEY]: 3 } },
      action: {
        type: 'attack',
        actorInstanceId: 'adv-1',
        targetInstanceIds: ['char-1'],
        effects: [],
      },
      rolls: mockAdversaryAttackRoll(),
    });
    const tbl = buildTableSnapshot(gs);
    const fn = unwrap(ISeeItComing.hooks.onReviewOutcome, tbl);
    expect(typeof fn).toBe('function');
    fn(tbl);
    const m = applyMutations(tbl);
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'I See It Coming',
          key: PENDING_EVASION_BONUS_STATE_KEY,
          value: 0,
        }),
      })
    );
  });
});
