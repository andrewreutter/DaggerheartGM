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

describe('DoubledUp', () => {
  const char = mockCharacter({
    instanceId: 'char-1',
    tokenX: 0,
    tokenY: 0,
    primaryWeapon: { name: 'Dual Blades', range: 'melee', trait: 'finesse', damage: 'd6' },
  });
  const primaryTarget = mockAdversary({ instanceId: 'adv-1', name: 'Goblin A', tokenX: 3, tokenY: 0 });
  const meleeTarget = mockAdversary({ instanceId: 'adv-2', name: 'Goblin B', tokenX: 4, tokenY: 0 });
  const farTarget = mockAdversary({ instanceId: 'adv-3', name: 'Goblin C', tokenX: 200, tokenY: 0 });

  function getDefaultOverrides() {
    return {
      activeElements: [char, primaryTarget, meleeTarget, farTarget],
      action: mockAction({ type: 'attack', actorInstanceId: 'char-1', targetInstanceIds: ['adv-1'], range: 'melee' }),
      rolls: mockRoll({ isSuccess: true }),
    };
  }

  it('shows chip on attack actions', () => {
    const { chips } = runReviewAction(DoubledUp, getDefaultOverrides());
    expect(chips).toHaveLength(1);
    expect(chips[0].description).toContain('Melee');
  });

  it('does not show chip on non-attack actions', () => {
    const overrides = getDefaultOverrides();
    overrides.action = mockAction({ type: 'trait', actorInstanceId: 'char-1' });
    const { chips } = runReviewAction(DoubledUp, overrides);
    expect(chips).toHaveLength(0);
  });

  it('provides a single-select targetSelect (function form)', () => {
    const { chips } = runReviewAction(DoubledUp, getDefaultOverrides());
    const chip = chips[0];
    expect(typeof chip.targetSelect).toBe('function');
  });

  it('targetSelect returns melee-range adversaries excluding primary target', () => {
    const state = mockGameState({
      ...getDefaultOverrides(),
      _ownerInstanceId: 'char-1',
      _featureKey: 'Doubled Up',
    });
    const table = buildTableSnapshot(state);

    const { chips } = runReviewAction(DoubledUp, getDefaultOverrides());
    const targets = chips[0].targetSelect(table);

    expect(targets.map((t) => t.id)).not.toContain('adv-1');
    expect(targets.map((t) => t.id)).toContain('adv-2');
    expect(targets.map((t) => t.id)).not.toContain('adv-3');
  });

  it('onUse queues addDamageRoll for the selected target', () => {
    const state = mockGameState({
      ...getDefaultOverrides(),
      _ownerInstanceId: 'char-1',
      _featureKey: 'Doubled Up',
    });
    const table = buildTableSnapshot(state);

    const { chips } = runReviewAction(DoubledUp, getDefaultOverrides());
    const chipState = makeChipState();
    const mutations = activateChip(chips[0], table, chipState, {
      selectedTargetIds: ['adv-2'],
    });

    const dmgMutations = mutations.filter((m) => m.type === 'addDamageRoll');
    expect(dmgMutations).toHaveLength(1);
    expect(dmgMutations[0].payload.targetInstanceIds).toEqual(['adv-2']);
    expect(dmgMutations[0].payload.dice).toBe('d6');
    expect(dmgMutations[0].payload.name).toBe('Doubled Up');
  });

  it('has no stress or hope cost', () => {
    const { chips } = runReviewAction(DoubledUp, getDefaultOverrides());
    expect(chips[0].stressCost).toBeUndefined();
    expect(chips[0].hopeCost).toBeUndefined();
  });

  it('does nothing when no target is selected', () => {
    const state = mockGameState({
      ...getDefaultOverrides(),
      _ownerInstanceId: 'char-1',
      _featureKey: 'Doubled Up',
    });
    const table = buildTableSnapshot(state);

    const { chips } = runReviewAction(DoubledUp, getDefaultOverrides());
    const chipState = makeChipState();
    const mutations = activateChip(chips[0], table, chipState, {
      selectedTargetIds: [],
    });

    const dmgMutations = mutations.filter((m) => m.type === 'addDamageRoll');
    expect(dmgMutations).toHaveLength(0);
  });
});
