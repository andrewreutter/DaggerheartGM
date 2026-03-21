import { describe, it, expect } from 'vitest';
import { DoubledUp } from '../../../../src/features-v2/weapon_properties/DoubledUp.js';
import {
  runReviewAction,
  mockRoll,
  mockAction,
  mockCharacter,
  mockAdversary,
  mockGameState,
} from '../helpers.js';
import { activateChip, makeChipState } from '../../../../src/features-v2/engine/chip-system.js';
import { buildTableSnapshot } from '../../../../src/features-v2/engine/table.js';

describe('Doubled Up', () => {
  const char = mockCharacter({
    instanceId: 'char-1',
    tokenX: 0,
    tokenY: 0,
    weapons: [
      { id: 'w1', name: 'Sword', trait: 'strength', range: 'melee', damage: 'd10', feature: [] },
      { id: 'w2', name: 'Dagger', trait: 'finesse', range: 'melee', damage: 'd6', feature: [] },
    ],
  });
  const adv1 = mockAdversary({ instanceId: 'adv-1', name: 'Goblin A', tokenX: 5, tokenY: 0 });
  const adv2 = mockAdversary({ instanceId: 'adv-2', name: 'Goblin B', tokenX: 3, tokenY: 3 });
  const adv3 = mockAdversary({ instanceId: 'adv-3', name: 'Far Goblin', tokenX: 200, tokenY: 200 });

  it('shows chip on successful attack', () => {
    const { chips } = runReviewAction(DoubledUp, {
      activeElements: [char, adv1, adv2],
      action: mockAction({ type: 'attack', targetInstanceIds: ['adv-1'], weaponId: 'w1' }),
      rolls: mockRoll({ isSuccess: true }),
    });

    expect(chips).toHaveLength(1);
    expect(typeof chips[0].selectTargets).toBe('function');
    expect(chips[0].multiSelect).toBeUndefined();
  });

  it('does not show chip on failed attack', () => {
    const { chips } = runReviewAction(DoubledUp, {
      activeElements: [char, adv1],
      action: mockAction({ type: 'attack', weaponId: 'w1' }),
      rolls: mockRoll({ isSuccess: false }),
    });

    expect(chips).toHaveLength(0);
  });

  it('does not show chip on non-attack action', () => {
    const { chips } = runReviewAction(DoubledUp, {
      activeElements: [char, adv1],
      action: mockAction({ type: 'trait', weaponId: 'w1' }),
      rolls: mockRoll({ isSuccess: true }),
    });

    expect(chips).toHaveLength(0);
  });

  it('does not show chip when attacking with secondary weapon', () => {
    const { chips } = runReviewAction(DoubledUp, {
      activeElements: [char, adv1, adv2],
      action: mockAction({ type: 'attack', targetInstanceIds: ['adv-1'], weaponId: 'w2' }),
      rolls: mockRoll({ isSuccess: true }),
    });

    expect(chips).toHaveLength(0);
  });

  it('selectTargets returns melee adversaries excluding primary target', () => {
    const gs = mockGameState({
      activeElements: [char, adv1, adv2, adv3],
      _ownerInstanceId: 'char-1',
      action: {
        type: 'attack',
        actorInstanceId: 'char-1',
        targetInstanceIds: ['adv-1'],
        range: 'melee',
        effects: [],
        appliedEffects: [],
      },
    });
    const table = buildTableSnapshot(gs);

    const { chips } = runReviewAction(DoubledUp, {
      activeElements: [char, adv1, adv2, adv3],
      action: mockAction({ type: 'attack', targetInstanceIds: ['adv-1'], weaponId: 'w1' }),
      rolls: mockRoll({ isSuccess: true }),
    });

    const targets = chips[0].selectTargets(table);
    const ids = targets.map((t) => t.instanceId);
    expect(ids).not.toContain('adv-1');
    expect(ids).toContain('adv-2');
    expect(ids).not.toContain('adv-3');
  });

  it('onUse queues addDamageRoll with secondary weapon damage', () => {
    const gs = mockGameState({
      activeElements: [char, adv1, adv2],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Doubled Up',
      action: {
        type: 'attack',
        actorInstanceId: 'char-1',
        targetInstanceIds: ['adv-1'],
        weaponId: 'w1',
        range: 'melee',
        effects: [],
        appliedEffects: [],
      },
      rolls: mockRoll(),
    });
    const table = buildTableSnapshot(gs);

    const chipState = makeChipState();
    const rawChip = DoubledUp.chips[0]._value;
    const chip = {
      selectTargets: rawChip.selectTargets,
      onUse: rawChip.onUse,
    };

    const mutations = activateChip(chip, table, chipState, {
      selectedTargetIds: ['adv-2'],
    });

    const dmgMut = mutations.find((m) => m.type === 'addDamageRoll');
    expect(dmgMut).toBeDefined();
    expect(dmgMut.payload.name).toBe('Doubled Up');
    expect(dmgMut.payload.dice).toBe('d6');
    expect(dmgMut.payload.targetInstanceIds).toEqual(['adv-2']);
  });
});
