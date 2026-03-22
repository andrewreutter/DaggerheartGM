import { describe, it, expect } from 'vitest';
import { Lifestealing } from '../../../../src/features-v2/weapon_properties/Lifestealing.js';
import {
  runReviewAction,
  runReviewActionThenResolveAction,
  mockRoll,
  mockAction,
  mockCharacter,
  mockAdversary,
} from '../helpers.js';
import { collectChips, activateChip, makeChipState, resolveChipDisabled } from '../../../../src/features-v2/engine/chip-system.js';
import { buildTableSnapshot } from '../../../../src/features-v2/engine/table.js';

describe('Lifestealing', () => {
  it('onReviewAction rolls d6 and stores face on a successful attack', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations } = runReviewAction(Lifestealing, {
      activeElements: [char, adv],
      action: mockAction({ type: 'attack' }),
      rolls: mockRoll({ isSuccess: true }),
      _rng: () => 5 / 6,
    });

    expect(mutations).toContainEqual(
      expect.objectContaining({ type: 'rollDie', payload: expect.objectContaining({ notation: 'd6' }) })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({ featureKey: 'Lifestealing', key: 'lifestealD6', value: 6 }),
      })
    );
  });

  it('resolveAction exposes two chips; disabled when d6 ≠ 6', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { resolveAction } = runReviewActionThenResolveAction(Lifestealing, {
      activeElements: [char, adv],
      action: mockAction({ type: 'attack' }),
      rolls: mockRoll({ isSuccess: true }),
      _rng: () => 0,
    });

    expect(resolveAction.chips).toHaveLength(2);
    expect(resolveAction.chips.every((c) => c.disabled === true)).toBe(true);
    expect(resolveAction.chips[0].placements).toContain('resolveAction');
  });

  it('resolveAction chips enabled when d6 = 6', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { resolveAction } = runReviewActionThenResolveAction(Lifestealing, {
      activeElements: [char, adv],
      action: mockAction({ type: 'attack' }),
      rolls: mockRoll({ isSuccess: true }),
      _rng: () => 5 / 6,
    });

    expect(resolveAction.chips).toHaveLength(2);
    expect(resolveAction.chips.every((c) => c.disabled === false)).toBe(true);
  });

  it('Clear Hit Point chip applies clearHP and disables further use', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { gameState, resolveAction } = runReviewActionThenResolveAction(Lifestealing, {
      activeElements: [char, adv],
      action: mockAction({ type: 'attack' }),
      rolls: mockRoll({ isSuccess: true }),
      _rng: () => 5 / 6,
    });

    const table = buildTableSnapshot({
      ...gameState,
      _featureKey: 'Lifestealing',
      _ownerInstanceId: 'char-1',
    });
    const hpChip = resolveAction.chips.find((c) => c.name.includes('Hit Point'));
    expect(hpChip).toBeDefined();

    const mutations = activateChip(hpChip, table, makeChipState());
    expect(mutations).toContainEqual(
      expect.objectContaining({ type: 'clearHP', payload: { instanceId: 'char-1', amount: 1 } })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({ key: 'lifestealUsed', value: true }),
      })
    );

    const chipsAfter = collectChips([{ ...Lifestealing, _ownerInstanceId: 'char-1' }], 'resolveAction', table);
    expect(chipsAfter.every((c) => c.disabled === true)).toBe(true);
  });

  it('Clear Stress chip applies clearStress', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { gameState, resolveAction } = runReviewActionThenResolveAction(Lifestealing, {
      activeElements: [char, adv],
      action: mockAction({ type: 'attack' }),
      rolls: mockRoll({ isSuccess: true }),
      _rng: () => 5 / 6,
    });

    const table = buildTableSnapshot({
      ...gameState,
      _featureKey: 'Lifestealing',
      _ownerInstanceId: 'char-1',
    });
    const stressChip = resolveAction.chips.find((c) => c.name.includes('Stress'));
    const mutations = activateChip(stressChip, table, makeChipState());
    expect(mutations).toContainEqual(
      expect.objectContaining({ type: 'clearStress', payload: { instanceId: 'char-1', amount: 1 } })
    );
  });

  it('activateChip no-ops when chip is disabled', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { gameState, resolveAction } = runReviewActionThenResolveAction(Lifestealing, {
      activeElements: [char, adv],
      action: mockAction({ type: 'attack' }),
      rolls: mockRoll({ isSuccess: true }),
      _rng: () => 0,
    });

    const table = buildTableSnapshot({
      ...gameState,
      _featureKey: 'Lifestealing',
      _ownerInstanceId: 'char-1',
    });
    const hpChip = resolveAction.chips[0];
    expect(resolveChipDisabled(hpChip, table)).toBe(true);
    expect(activateChip(hpChip, table, makeChipState())).toEqual([]);
  });

  it('does not fire onReviewAction on a failed attack', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations } = runReviewAction(Lifestealing, {
      activeElements: [char, adv],
      action: mockAction({ type: 'attack' }),
      rolls: mockRoll({ isSuccess: false }),
      _rng: () => 5 / 6,
    });

    expect(mutations.filter((m) => m.type === 'rollDie')).toHaveLength(0);
  });

  it('does not fire when the character is not the acting entity', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const other = mockCharacter({ instanceId: 'char-2' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations } = runReviewAction({ ...Lifestealing, _ownerInstanceId: 'char-2' }, {
      activeElements: [char, other, adv],
      action: mockAction({ type: 'attack', actorInstanceId: 'char-1' }),
      rolls: mockRoll({ isSuccess: true }),
      _rng: () => 5 / 6,
    });

    expect(mutations.filter((m) => m.type === 'rollDie')).toHaveLength(0);
  });
});
