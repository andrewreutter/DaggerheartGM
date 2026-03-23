import { describe, it, expect } from 'vitest';
import { buildTableSnapshot, applyMutations } from '../../../../src/features-v2/engine/table.js';
import { collectChips, activateChip, makeChipState } from '../../../../src/features-v2/engine/chip-system.js';
import { GoreAndGlory } from '../../../../src/features-v2/abilities/Blade/GoreAndGlory.js';
import { mockCharacter, mockAdversary, mockGameState, mockRoll, runReviewAction, runReviewOutcome } from '../helpers.js';

const feat = { ...GoreAndGlory, _ownerInstanceId: 'char-1' };

const baseAttackAction = {
  type: 'attack',
  actorInstanceId: 'char-1',
  targetInstanceIds: ['adv-1'],
  weaponId: 'srd-wpn-longsword',
  effects: [],
};

describe('Blade — Gore and Glory', () => {
  it('shows reviewAction chip on a critical weapon attack', () => {
    const { chips } = runReviewAction(feat, {
      action: baseAttackAction,
      rolls: mockRoll({ action: { isSuccess: true, isCritical: true } }),
    });
    const crit = chips.filter((c) => c.name === 'Gore and Glory — Critical');
    expect(crit).toHaveLength(1);
    expect(crit[0].placements).toContain('reviewAction');
    expect(typeof crit[0].isSelect).toBe('function');
  });

  it('does not show the critical chip without a weaponId (not a weapon attack)', () => {
    const { chips: noWeapon } = runReviewAction(feat, {
      action: { ...baseAttackAction, weaponId: null },
      rolls: mockRoll({ action: { isSuccess: true, isCritical: true } }),
    });
    expect(noWeapon.filter((c) => c.name === 'Gore and Glory — Critical')).toHaveLength(0);
  });

  it('does not show the critical chip when the attack is not a critical', () => {
    const { chips } = runReviewAction(feat, {
      action: baseAttackAction,
      rolls: mockRoll({ action: { isSuccess: true, isCritical: false } }),
    });
    expect(chips.filter((c) => c.name === 'Gore and Glory — Critical')).toHaveLength(0);
  });

  it('reviewAction chip gainHope queues gainHope', () => {
    const self = mockCharacter({ instanceId: 'char-1', hope: 2 });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const gs = mockGameState({
      activeElements: [self, adv],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Gore and Glory',
      action: { ...baseAttackAction, effects: [] },
      rolls: mockRoll({ action: { isSuccess: true, isCritical: true } }),
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([feat], 'reviewAction', tbl);
    const crit = chips.find((c) => c.name === 'Gore and Glory — Critical');
    expect(crit).toBeDefined();
    const m = [...activateChip(crit, tbl, makeChipState(), { selectedId: 'gainHope' }), ...applyMutations(tbl)];
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'gainHope',
        payload: expect.objectContaining({ instanceId: 'char-1', amount: 1 }),
      })
    );
  });

  it('reviewAction chip clearStress queues clearStress', () => {
    const self = mockCharacter({ instanceId: 'char-1', currentStress: 2 });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const gs = mockGameState({
      activeElements: [self, adv],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Gore and Glory',
      action: { ...baseAttackAction, effects: [] },
      rolls: mockRoll({ action: { isSuccess: true, isCritical: true } }),
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([feat], 'reviewAction', tbl);
    const crit = chips.find((c) => c.name === 'Gore and Glory — Critical');
    const m = [...activateChip(crit, tbl, makeChipState(), { selectedId: 'clearStress' }), ...applyMutations(tbl)];
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'clearStress',
        payload: expect.objectContaining({ instanceId: 'char-1', amount: 1 }),
      })
    );
  });

  it('shows reviewOutcome chip when pending HP marks would defeat the adversary', () => {
    const adv = mockAdversary({ instanceId: 'adv-1', currentHp: 3, maxHp: 3 });
    const { chips } = runReviewOutcome(feat, {
      activeElements: [mockCharacter({ instanceId: 'char-1' }), adv],
      action: {
        ...baseAttackAction,
        effects: [{ stat: 'currentHP', target: { instanceId: 'adv-1' }, amount: 3 }],
      },
      rolls: mockRoll({ isSuccess: true }),
    });
    const defeat = chips.filter((c) => c.name === 'Gore and Glory — Defeat');
    expect(defeat).toHaveLength(1);
    expect(defeat[0].placements).toContain('reviewOutcome');
  });

  it('does not show defeat chip when the attack roll fails', () => {
    const adv = mockAdversary({ instanceId: 'adv-1', currentHp: 3, maxHp: 3 });
    const { chips } = runReviewOutcome(feat, {
      activeElements: [mockCharacter({ instanceId: 'char-1' }), adv],
      action: {
        ...baseAttackAction,
        effects: [{ stat: 'currentHP', target: { instanceId: 'adv-1' }, amount: 3 }],
      },
      rolls: mockRoll({ isSuccess: false }),
    });
    expect(chips.filter((c) => c.name === 'Gore and Glory — Defeat')).toHaveLength(0);
  });

  it('defeat chip onUse clears Stress when selected', () => {
    const self = mockCharacter({ instanceId: 'char-1', currentStress: 2 });
    const adv = mockAdversary({ instanceId: 'adv-1', currentHp: 3, maxHp: 3 });
    const gs = mockGameState({
      activeElements: [self, adv],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Gore and Glory',
      action: {
        ...baseAttackAction,
        effects: [{ stat: 'currentHP', target: { instanceId: 'adv-1' }, amount: 3 }],
      },
      rolls: mockRoll({ isSuccess: true }),
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([feat], 'reviewOutcome', tbl);
    const defeat = chips.find((c) => c.name === 'Gore and Glory — Defeat');
    expect(defeat).toBeDefined();
    const m = [...activateChip(defeat, tbl, makeChipState(), { selectedId: 'clearStress' }), ...applyMutations(tbl)];
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'clearStress',
        payload: expect.objectContaining({ instanceId: 'char-1', amount: 1 }),
      })
    );
  });
});
