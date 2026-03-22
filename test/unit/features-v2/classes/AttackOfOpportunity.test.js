import { describe, it, expect } from 'vitest';
import { AttackOfOpportunity } from '../../../../src/features-v2/classes/Warrior.js';
import { runReviewAction, mockRoll, mockCharacter, mockAdversary, mockChipState } from '../helpers.js';
import { activateChip } from '../../../../src/features-v2/engine/chip-system.js';
import { buildTableSnapshot } from '../../../../src/features-v2/engine/table.js';
import { dispatchTokenMoveHooks } from '../../../../src/features-v2/engine/action-loop.js';

function makeLeaveMeleeReactionState(rollOverrides = {}) {
  const char = mockCharacter({
    instanceId: 'char-1',
    primaryWeapon: { id: 'w1', name: 'Sword', tier: 1, range: 'melee', trait: 'agility', damage: 'd10' },
  });
  const adv = mockAdversary({ instanceId: 'adv-1', difficulty: 14 });
  return {
    activeElements: [char, adv],
    actionType: 'reaction',
    action: {
      type: 'reaction',
      actorInstanceId: 'char-1',
      targetInstanceIds: ['adv-1'],
      trait: 'Agility',
      reactionContext: { kind: 'leaveMelee', moverInstanceId: 'adv-1' },
    },
    rolls: mockRoll({ isSuccess: true, isCritical: false, ...rollOverrides }),
  };
}

function tableForAoOChip() {
  const char = mockCharacter({
    instanceId: 'char-1',
    primaryWeapon: { id: 'w1', name: 'Sword', tier: 1, range: 'melee', trait: 'agility', damage: 'd10' },
  });
  const adv = mockAdversary({ instanceId: 'adv-1', difficulty: 14 });
  return buildTableSnapshot({
    fear: 0,
    activeElements: [char, adv],
    _ownerInstanceId: 'char-1',
    _featureKey: 'Attack of Opportunity',
    action: {
      type: 'reaction',
      actorInstanceId: 'char-1',
      targetInstanceIds: ['adv-1'],
      trait: 'Agility',
      reactionContext: { kind: 'leaveMelee', moverInstanceId: 'adv-1' },
      effects: [],
      appliedEffects: [],
    },
    rolls: mockRoll({ isSuccess: true, isCritical: false }),
  });
}

describe('Attack of Opportunity (Warrior)', () => {
  it('exposes a reviewAction chip on a successful leave-melee reaction', () => {
    const { chips } = runReviewAction(
      { ...AttackOfOpportunity, _ownerInstanceId: 'char-1' },
      makeLeaveMeleeReactionState()
    );
    expect(chips.length).toBe(1);
    expect(chips[0].multiSelect).toBe(true);
    expect(chips[0].placements).toContain('reviewAction');
  });

  it('does not show the chip when the reaction roll fails', () => {
    const { chips } = runReviewAction(
      { ...AttackOfOpportunity, _ownerInstanceId: 'char-1' },
      makeLeaveMeleeReactionState({ isSuccess: false })
    );
    expect(chips.length).toBe(0);
  });

  it('does not show the chip when reactionContext is not leaveMelee', () => {
    const char = mockCharacter({
      instanceId: 'char-1',
      primaryWeapon: { id: 'w1', name: 'Sword', tier: 1, range: 'melee', trait: 'agility', damage: 'd10' },
    });
    const adv = mockAdversary({ instanceId: 'adv-1', difficulty: 14 });
    const { chips } = runReviewAction(
      { ...AttackOfOpportunity, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char, adv],
        actionType: 'reaction',
        action: {
          type: 'reaction',
          actorInstanceId: 'char-1',
          targetInstanceIds: ['adv-1'],
          trait: 'Agility',
        },
        rolls: mockRoll({ isSuccess: true }),
      }
    );
    expect(chips.length).toBe(0);
  });

  it('queues primary-weapon damage when the damage outcome is chosen', () => {
    const { chips } = runReviewAction(
      { ...AttackOfOpportunity, _ownerInstanceId: 'char-1' },
      makeLeaveMeleeReactionState()
    );
    const chip = chips[0];
    const tbl = tableForAoOChip();
    const cs = mockChipState();
    const m = activateChip(chip, tbl, cs, { selectedIds: ['damage'] });
    expect(m.some((x) => x.type === 'addDamageRoll')).toBe(true);
    const dmg = m.find((x) => x.type === 'addDamageRoll');
    expect(dmg.payload.dice).toBe('d10');
    expect(dmg.payload.targetInstanceIds).toEqual(['adv-1']);
  });

  it('restrain queues restrictMovement on the mover', () => {
    const { chips } = runReviewAction(
      { ...AttackOfOpportunity, _ownerInstanceId: 'char-1' },
      makeLeaveMeleeReactionState()
    );
    const tbl = tableForAoOChip();
    const m = activateChip(chips[0], tbl, mockChipState(), { selectedIds: ['restrain'] });
    expect(m.some((x) => x.type === 'restrictMovement' && x.payload?.instanceId === 'adv-1')).toBe(true);
  });

  it('moveWith queues actionLoop on the reactor', () => {
    const { chips } = runReviewAction(
      { ...AttackOfOpportunity, _ownerInstanceId: 'char-1' },
      makeLeaveMeleeReactionState()
    );
    const tbl = tableForAoOChip();
    const m = activateChip(chips[0], tbl, mockChipState(), { selectedIds: ['moveWith'] });
    expect(m.some((x) => x.type === 'actionLoop' && x.payload?.title === 'Follow')).toBe(true);
  });

  it('onTokenMove queues actionLoop when an adversary leaves Melee (dispatchTokenMoveHooks)', () => {
    const char = mockCharacter({ instanceId: 'char-1', tokenX: 0, tokenY: 0 });
    const advPost = mockAdversary({ instanceId: 'adv-1', tokenX: 28, tokenY: 0, difficulty: 14 });
    const gameState = {
      fear: 0,
      activeElements: [char, advPost],
      featureState: {},
      _previousPositions: { 'adv-1': { tokenX: 4, tokenY: 0 } },
    };

    const { mutations } = dispatchTokenMoveHooks(
      gameState,
      [{ ...AttackOfOpportunity, _ownerInstanceId: 'char-1' }],
      { moverInstanceId: 'adv-1' }
    );

    expect(mutations.some((m) => m.type === 'actionLoop')).toBe(true);
    const al = mutations.find((m) => m.type === 'actionLoop');
    expect(al.payload.title).toBe('Attack of Opportunity');
    expect(al.payload.description).toContain('Difficulty (14)');
  });

  it('onTokenMove does not queue actionLoop when the mover stays in Melee', () => {
    const char = mockCharacter({ instanceId: 'char-1', tokenX: 0, tokenY: 0 });
    const advPost = mockAdversary({ instanceId: 'adv-1', tokenX: 3, tokenY: 0, difficulty: 14 });
    const gameState = {
      fear: 0,
      activeElements: [char, advPost],
      featureState: {},
      _previousPositions: { 'adv-1': { tokenX: 4, tokenY: 0 } },
    };

    const { mutations } = dispatchTokenMoveHooks(
      gameState,
      [{ ...AttackOfOpportunity, _ownerInstanceId: 'char-1' }],
      { moverInstanceId: 'adv-1' }
    );

    expect(mutations.filter((m) => m.type === 'actionLoop')).toHaveLength(0);
  });
});
