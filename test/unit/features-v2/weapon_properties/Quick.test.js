import { describe, it, expect } from 'vitest';
import { Quick } from '../../../../src/features-v2/weapon_properties/Quick.js';
import {
  runReviewAction,
  mockRoll,
  mockAction,
  mockGameState,
  mockCharacter,
  mockAdversary,
} from '../helpers.js';
import { activateChip, makeChipState } from '../../../../src/features-v2/engine/chip-system.js';
import { buildTableSnapshot } from '../../../../src/features-v2/engine/table.js';

describe('Quick', () => {
  const char = mockCharacter({
    instanceId: 'char-1',
    tokenX: 0,
    tokenY: 0,
    weapons: [{ name: 'Halberd', damage: 'd8', trait: 'Strength', range: 'melee' }],
  });
  const adv1 = mockAdversary({ instanceId: 'adv-1', tokenX: 5, tokenY: 0 });
  const adv2 = mockAdversary({ instanceId: 'adv-2', tokenX: 5, tokenY: 5 });

  it('shows a reviewAction chip with selectTargets on successful attack', () => {
    const { chips } = runReviewAction(Quick, {
      activeElements: [char, adv1, adv2],
      action: mockAction({ type: 'attack', targetInstanceIds: ['adv-1'], range: 'melee' }),
      rolls: mockRoll({ isSuccess: true }),
    });
    expect(chips).toHaveLength(1);
    expect(typeof chips[0].selectTargets).toBe('function');
  });

  it('queues addDamageRoll for a selected second target in the same range band', () => {
    const gs = mockGameState({
      character: char,
      adversary: adv1,
      activeElements: [char, adv1, adv2],
      _ownerInstanceId: 'char-1',
      action: {
        type: 'attack',
        actorInstanceId: 'char-1',
        targetInstanceIds: ['adv-1'],
        trait: 'Strength',
        range: 'melee',
        effects: [],
        appliedEffects: [],
      },
      rolls: mockRoll({ isSuccess: true }),
    });
    const table = buildTableSnapshot(gs);

    const { chips } = runReviewAction(Quick, {
      activeElements: [char, adv1, adv2],
      action: mockAction({
        type: 'attack',
        targetInstanceIds: ['adv-1'],
        range: 'melee',
      }),
      rolls: mockRoll({ isSuccess: true }),
    });

    const mutations = activateChip(chips[0], table, makeChipState(), {
      selectedTargetIds: ['adv-2'],
    });

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addDamageRoll',
        payload: expect.objectContaining({
          name: 'Quick',
          dice: 'd8',
          targetInstanceIds: ['adv-2'],
        }),
      })
    );
  });

  it('does not show a chip on failed attack', () => {
    const { chips } = runReviewAction(Quick, {
      action: mockAction({ type: 'attack' }),
      rolls: mockRoll({ isSuccess: false }),
    });
    expect(chips).toHaveLength(0);
  });

  it('does not show a chip on non-attack actions', () => {
    const { chips } = runReviewAction(Quick, {
      action: mockAction({ type: 'trait' }),
      rolls: mockRoll({ isSuccess: true }),
    });
    expect(chips).toHaveLength(0);
  });
});
