import { describe, it, expect } from 'vitest';
import { Bouncing } from '../../../../src/features-v2/weapon_properties/Bouncing.js';
import {
  runReviewAction,
  mockRoll,
  mockAction,
  mockCharacter,
  mockAdversary,
  mockGameState,
  mockChipState,
} from '../helpers.js';
import { activateChip, makeChipState } from '../../../../src/features-v2/engine/chip-system.js';
import { buildTableSnapshot, applyMutations } from '../../../../src/features-v2/engine/table.js';

describe('Bouncing', () => {
  const char = mockCharacter({
    instanceId: 'char-1',
    tokenX: 0,
    tokenY: 0,
    primaryWeapon: { name: 'Bow', range: 'far', trait: 'finesse', damage: 'd8' },
  });
  const primaryTarget = mockAdversary({ instanceId: 'adv-1', name: 'Goblin A', tokenX: 3, tokenY: 4 });
  const bounceTarget1 = mockAdversary({ instanceId: 'adv-2', name: 'Goblin B', tokenX: 5, tokenY: 0 });
  const bounceTarget2 = mockAdversary({ instanceId: 'adv-3', name: 'Goblin C', tokenX: 10, tokenY: 0 });

  function getDefaultOverrides() {
    return {
      activeElements: [char, primaryTarget, bounceTarget1, bounceTarget2],
      action: mockAction({ type: 'attack', actorInstanceId: 'char-1', targetInstanceIds: ['adv-1'], range: 'far' }),
      rolls: mockRoll({ isSuccess: true }),
    };
  }

  it('shows chip on attack actions', () => {
    const { chips } = runReviewAction(Bouncing, getDefaultOverrides());
    expect(chips).toHaveLength(1);
    expect(chips[0].description).toContain('additional targets');
  });

  it('does not show chip on non-attack actions', () => {
    const overrides = getDefaultOverrides();
    overrides.action = mockAction({ type: 'trait', actorInstanceId: 'char-1' });
    const { chips } = runReviewAction(Bouncing, overrides);
    expect(chips).toHaveLength(0);
  });

  it('provides a multi-select targetSelect', () => {
    const { chips } = runReviewAction(Bouncing, getDefaultOverrides());
    const chip = chips[0];
    expect(chip.targetSelect).toBeDefined();
    expect(chip.targetSelect.multi).toBe(true);
    expect(typeof chip.targetSelect.targets).toBe('function');
  });

  it('targetSelect returns in-range adversaries excluding primary target', () => {
    const state = mockGameState({
      ...getDefaultOverrides(),
      _ownerInstanceId: 'char-1',
      _featureKey: 'Bouncing',
    });
    const table = buildTableSnapshot(state);

    const { chips } = runReviewAction(Bouncing, getDefaultOverrides());
    const targetsFn = chips[0].targetSelect.targets;
    const targets = targetsFn(table);

    expect(targets.map((t) => t.id)).not.toContain('adv-1');
    expect(targets.map((t) => t.id)).toContain('adv-2');
    expect(targets.map((t) => t.id)).toContain('adv-3');
  });

  it('targetSelect excludes out-of-range targets', () => {
    const farAway = mockAdversary({ instanceId: 'adv-far', name: 'Far Away', tokenX: 500, tokenY: 0 });
    const overrides = {
      ...getDefaultOverrides(),
      activeElements: [char, primaryTarget, bounceTarget1, farAway],
    };
    const state = mockGameState({
      ...overrides,
      _ownerInstanceId: 'char-1',
      _featureKey: 'Bouncing',
    });
    const table = buildTableSnapshot(state);

    const { chips } = runReviewAction(Bouncing, overrides);
    const targets = chips[0].targetSelect.targets(table);

    expect(targets.map((t) => t.id)).toContain('adv-2');
    expect(targets.map((t) => t.id)).not.toContain('adv-far');
  });

  it('onUse queues addDamageRoll for each selected target', () => {
    const state = mockGameState({
      ...getDefaultOverrides(),
      _ownerInstanceId: 'char-1',
      _featureKey: 'Bouncing',
    });
    const table = buildTableSnapshot(state);

    const { chips } = runReviewAction(Bouncing, getDefaultOverrides());
    const chip = chips[0];
    const chipState = makeChipState();
    const mutations = activateChip(chip, table, chipState, {
      selectedTargetIds: ['adv-2', 'adv-3'],
    });

    const dmgMutations = mutations.filter((m) => m.type === 'addDamageRoll');
    expect(dmgMutations).toHaveLength(2);
    expect(dmgMutations[0].payload.targetInstanceIds).toEqual(['adv-2']);
    expect(dmgMutations[1].payload.targetInstanceIds).toEqual(['adv-3']);
    expect(dmgMutations[0].payload.dice).toBe('d8');
  });

  it('stressCost equals the number of selected targets', () => {
    const state = mockGameState({
      ...getDefaultOverrides(),
      _ownerInstanceId: 'char-1',
      _featureKey: 'Bouncing',
    });
    const table = buildTableSnapshot(state);

    const { chips } = runReviewAction(Bouncing, getDefaultOverrides());
    const chip = chips[0];
    const chipState = makeChipState();

    activateChip(chip, table, chipState, { selectedTargetIds: ['adv-2', 'adv-3'] });

    const cost = chip.stressCost(table);
    expect(cost).toBe(2);
  });

  it('stressCost is 0 when no targets are selected', () => {
    const state = mockGameState({
      ...getDefaultOverrides(),
      _ownerInstanceId: 'char-1',
      _featureKey: 'Bouncing',
    });
    const table = buildTableSnapshot(state);

    const { chips } = runReviewAction(Bouncing, getDefaultOverrides());
    const cost = chips[0].stressCost(table);
    expect(cost).toBe(0);
  });

  it('stores selectedTargetIds in feature state for cost function', () => {
    const state = mockGameState({
      ...getDefaultOverrides(),
      _ownerInstanceId: 'char-1',
      _featureKey: 'Bouncing',
    });
    const table = buildTableSnapshot(state);

    const { chips } = runReviewAction(Bouncing, getDefaultOverrides());
    const chipState = makeChipState();
    activateChip(chips[0], table, chipState, { selectedTargetIds: ['adv-2'] });

    expect(table.feature.get('bounceTargets')).toEqual(['adv-2']);
  });
});
