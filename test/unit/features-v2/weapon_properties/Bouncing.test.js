import { describe, it, expect } from 'vitest';
import { Bouncing } from '../../../../src/features-v2/weapon_properties/Bouncing.js';
import {
  runReviewAction,
  mockRoll,
  mockAction,
  mockTable,
  mockCharacter,
  mockAdversary,
  mockGameState,
} from '../helpers.js';
import { activateChip, makeChipState } from '../../../../src/features-v2/engine/chip-system.js';
import { buildTableSnapshot } from '../../../../src/features-v2/engine/table.js';

describe('Bouncing', () => {
  const char = mockCharacter({ instanceId: 'char-1', tokenX: 0, tokenY: 0 });
  const adv1 = mockAdversary({ instanceId: 'adv-1', name: 'Goblin A', tokenX: 5, tokenY: 0 });
  const adv2 = mockAdversary({ instanceId: 'adv-2', name: 'Goblin B', tokenX: 3, tokenY: 3 });
  const adv3 = mockAdversary({ instanceId: 'adv-3', name: 'Goblin C', tokenX: 200, tokenY: 200 });

  it('shows chip on successful attack', () => {
    const { chips } = runReviewAction(Bouncing, {
      activeElements: [char, adv1, adv2],
      action: mockAction({ type: 'attack', targetInstanceIds: ['adv-1'] }),
      rolls: mockRoll({ isSuccess: true }),
    });

    expect(chips).toHaveLength(1);
    expect(chips[0].multiSelect).toBe(true);
    expect(typeof chips[0].selectTargets).toBe('function');
  });

  it('does not show chip on failed attack', () => {
    const { chips } = runReviewAction(Bouncing, {
      action: mockAction({ type: 'attack' }),
      rolls: mockRoll({ isSuccess: false }),
    });

    expect(chips).toHaveLength(0);
  });

  it('does not show chip on non-attack action', () => {
    const { chips } = runReviewAction(Bouncing, {
      action: mockAction({ type: 'trait' }),
      rolls: mockRoll({ isSuccess: true }),
    });

    expect(chips).toHaveLength(0);
  });

  it('selectTargets returns adversaries excluding the primary target', () => {
    const gs = mockGameState({
      activeElements: [char, adv1, adv2],
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

    const { chips } = runReviewAction(Bouncing, {
      activeElements: [char, adv1, adv2],
      action: mockAction({ type: 'attack', targetInstanceIds: ['adv-1'], range: 'melee' }),
      rolls: mockRoll({ isSuccess: true }),
    });

    expect(chips).toHaveLength(1);
    const targets = chips[0].selectTargets(table);
    const ids = targets.map((t) => t.instanceId);
    expect(ids).not.toContain('adv-1');
    expect(ids).toContain('adv-2');
  });

  it('onUse stores bounceTargets and queues addDamageRoll mutation', () => {
    const gs = mockGameState({
      activeElements: [char, adv1, adv2],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Bouncing',
      action: {
        type: 'attack',
        actorInstanceId: 'char-1',
        targetInstanceIds: ['adv-1'],
        range: 'melee',
        effects: [],
        appliedEffects: [],
      },
      rolls: mockRoll({ damageDice: [{ name: 'weapon', die: 'd8', value: 5 }] }),
    });
    const table = buildTableSnapshot(gs);

    const chipState = makeChipState();
    const rawChip = Bouncing.chips[0]._value;
    const chip = {
      selectTargets: rawChip.selectTargets,
      onUse: rawChip.onUse,
    };

    activateChip(chip, table, chipState, { selectedTargetIds: ['adv-2'] });

    expect(table.feature.get('bounceTargets')).toBe(1);
  });

  it('stressCost reads bounceTargets from feature state', () => {
    const gs = mockGameState({
      activeElements: [char, adv1, adv2],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Bouncing',
    });
    const table = buildTableSnapshot(gs);
    table.feature.set('bounceTargets', 3);

    const costFn = Bouncing.chips[0]._value.stressCost;
    expect(costFn(table)).toBe(3);
  });

  it('stressCost defaults to 0 when no targets selected', () => {
    const gs = mockGameState({
      activeElements: [char, adv1],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Bouncing',
    });
    const table = buildTableSnapshot(gs);

    const costFn = Bouncing.chips[0]._value.stressCost;
    expect(costFn(table)).toBe(0);
  });
});
