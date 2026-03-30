import { describe, it, expect } from 'vitest';
import { HoldThemOff, RangersFocus } from '../../../../src/features-v2/classes/Ranger.js';
import {
  runReviewAction,
  runReviewOutcome,
  runReviewActionThenReviewOutcome,
  mockRoll,
  mockAction,
  mockGameState,
  mockCharacter,
  mockAdversary,
} from '../helpers.js';
import { activateChip, makeChipState, collectChips } from '../../../../src/features-v2/engine/chip-system.js';
import { buildTableSnapshot } from '../../../../src/features-v2/engine/table.js';
import { dispatchSceneEndHooks } from '../../../../src/features-v2/engine/action-loop.js';

describe('Hold Them Off (Ranger)', () => {
  const char = mockCharacter({
    instanceId: 'char-1',
    tokenX: 0,
    tokenY: 0,
    weapons: [{ name: 'Shortbow', damage: 'd8', trait: 'Agility', range: 'close' }],
  });
  const adv1 = mockAdversary({ instanceId: 'adv-1', tokenX: 5, tokenY: 0 });
  const adv2 = mockAdversary({ instanceId: 'adv-2', tokenX: 8, tokenY: 0 });
  const adv3 = mockAdversary({ instanceId: 'adv-3', tokenX: 12, tokenY: 0 });

  it('shows a reviewAction chip with multi-select targets on successful attack', () => {
    const { chips } = runReviewAction(
      { ...HoldThemOff, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char, adv1, adv2, adv3],
        action: mockAction({
          type: 'attack',
          targetInstanceIds: ['adv-1'],
          range: 'close',
          weaponId: 'w1',
        }),
        rolls: mockRoll({ isSuccess: true }),
      }
    );
    expect(chips).toHaveLength(1);
    expect(chips[0].hopeCost).toBe(3);
    expect(chips[0].multiSelect).toBe(true);
    expect(typeof chips[0].selectTargets).toBe('function');
  });

  it('queues addDamageRoll for two selected additional targets in the same range band', () => {
    const gs = mockGameState({
      character: char,
      adversary: adv1,
      activeElements: [char, adv1, adv2, adv3],
      _ownerInstanceId: 'char-1',
      action: {
        type: 'attack',
        actorInstanceId: 'char-1',
        targetInstanceIds: ['adv-1'],
        trait: 'Agility',
        range: 'close',
        weaponId: 'w1',
        effects: [],
        appliedEffects: [],
      },
      rolls: mockRoll({ isSuccess: true }),
    });
    const table = buildTableSnapshot(gs);

    const { chips } = runReviewAction(
      { ...HoldThemOff, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char, adv1, adv2, adv3],
        action: mockAction({
          type: 'attack',
          targetInstanceIds: ['adv-1'],
          range: 'close',
          weaponId: 'w1',
        }),
        rolls: mockRoll({ isSuccess: true }),
      }
    );

    const mutations = activateChip(chips[0], table, makeChipState(), {
      selectedTargetIds: ['adv-2', 'adv-3'],
    });

    expect(mutations.filter((m) => m.type === 'addDamageRoll')).toHaveLength(2);
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addDamageRoll',
        payload: expect.objectContaining({
          name: 'Hold Them Off',
          dice: 'd8',
          targetInstanceIds: ['adv-2'],
        }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addDamageRoll',
        payload: expect.objectContaining({
          name: 'Hold Them Off',
          targetInstanceIds: ['adv-3'],
        }),
      })
    );
  });

  it('does not show a chip on a failed attack (CONV-025)', () => {
    const { chips } = runReviewAction(
      { ...HoldThemOff, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char, adv1, adv2],
        action: mockAction({
          type: 'attack',
          targetInstanceIds: ['adv-1'],
          range: 'close',
          weaponId: 'w1',
        }),
        rolls: mockRoll({ isSuccess: false }),
      }
    );
    expect(chips).toHaveLength(0);
  });

  it('does not show a chip when the attack snapshot has no weaponId (SRD: attack with a weapon)', () => {
    const { chips } = runReviewAction(
      { ...HoldThemOff, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char, adv1, adv2, adv3],
        action: mockAction({
          type: 'attack',
          targetInstanceIds: ['adv-1'],
          range: 'close',
          weaponId: null,
        }),
        rolls: mockRoll({ isSuccess: true }),
      }
    );
    expect(chips).toHaveLength(0);
  });

  it('does not show a chip on a successful trait roll', () => {
    const { chips } = runReviewAction(
      { ...HoldThemOff, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char, adv1, adv2],
        action: mockAction({ type: 'trait', targetInstanceIds: ['adv-1'], range: 'close' }),
        rolls: mockRoll({ isSuccess: true }),
      }
    );
    expect(chips).toHaveLength(0);
  });
});

describe("Ranger's Focus", () => {
  const adv = mockAdversary({ instanceId: 'adv-1' });
  const rf = { ...RangersFocus, _ownerInstanceId: 'char-1' };

  it('onReviewAction spends Hope, clears arm, sets Focus + focusedBy on hit (v1-style)', () => {
    const ranger = mockCharacter({
      instanceId: 'char-1',
      name: 'Aria',
      rangerFocusOnNextAttack: true,
    });
    const { mutations } = runReviewAction(rf, {
      activeElements: [ranger, adv],
      rolls: mockRoll({ isSuccess: true }),
    });
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'spendHope',
        payload: expect.objectContaining({ instanceId: 'char-1', amount: 1 }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setRangerFocusOnNextAttack',
        payload: { instanceId: 'char-1', value: false },
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFocusTarget',
        payload: { instanceId: 'char-1', focusTargetInstanceId: 'adv-1' },
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFocusedBy',
        payload: { instanceId: 'adv-1', focusedBy: 'Aria' },
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: "Ranger's Focus",
          key: 'rangerFocusStressTargetId',
          value: 'adv-1',
          cardValue: 'Focus: Test Adversary',
        }),
      })
    );
  });

  it('onReviewAction still spends Hope when the attack fails (attempt was made)', () => {
    const ranger = mockCharacter({ instanceId: 'char-1', rangerFocusOnNextAttack: true });
    const { mutations } = runReviewAction(rf, {
      activeElements: [ranger, adv],
      rolls: mockRoll({ isSuccess: false }),
    });
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'spendHope',
        payload: expect.objectContaining({ instanceId: 'char-1', amount: 1 }),
      })
    );
    expect(mutations.filter((m) => m.type === 'setFocusTarget')).toHaveLength(0);
  });

  it('onReviewOutcome marks Stress on Focus damage (ongoing focus by id)', () => {
    const ranger = mockCharacter({ instanceId: 'char-1', focusTargetId: 'adv-1' });
    const { mutations } = runReviewOutcome(rf, {
      activeElements: [ranger, adv],
      action: {
        type: 'attack',
        actorInstanceId: 'char-1',
        targetInstanceIds: ['adv-1'],
        trait: 'Agility',
        range: 'melee',
        effects: [{ stat: 'currentHP', amount: 1, target: adv }],
        appliedEffects: [],
      },
    });
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'markStress',
        payload: { instanceId: 'adv-1', amount: 1 },
      })
    );
  });

  it('onReviewOutcome marks Stress after reviewAction established Focus same turn', () => {
    const ranger = mockCharacter({
      instanceId: 'char-1',
      name: 'Aria',
      rangerFocusOnNextAttack: true,
    });
    const { mutations } = runReviewActionThenReviewOutcome(rf, {
      activeElements: [ranger, adv],
      rolls: mockRoll({ isSuccess: true }),
      action: {
        effects: [{ stat: 'currentHP', amount: 1, target: adv }],
      },
    });
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'markStress',
        payload: { instanceId: 'adv-1', amount: 1 },
      })
    );
  });

  it('shows a reviewAction chip to end Focus and reroll duality on a failed attack vs Focus', () => {
    const ranger = mockCharacter({ instanceId: 'char-1', focusTargetId: 'adv-1' });
    const { chips } = runReviewAction(rf, {
      activeElements: [ranger, adv],
      rolls: mockRoll({ isSuccess: false }),
    });
    expect(chips).toHaveLength(1);
    expect(chips[0].name).toBe('End Focus to reroll');
  });

  it('exposes an intent-phase toggle to arm the next weapon attack', () => {
    const table = buildTableSnapshot(
      mockGameState({ activeElements: [mockCharacter({ instanceId: 'char-1' }), adv], _ownerInstanceId: 'char-1' })
    );
    const chips = collectChips([rf], 'intent', table);
    const toggle = chips.find((c) => c.name === "Attempt Ranger's Focus");
    expect(toggle?.isToggle).toBe(true);
  });

  it('onSceneEnd clears Focus and focusedBy', () => {
    const ranger = mockCharacter({ instanceId: 'char-1', name: 'Aria', focusTargetId: 'adv-1' });
    const advFocused = mockAdversary({ instanceId: 'adv-1', focusedBy: 'Aria' });
    const gameState = mockGameState({
      activeElements: [ranger, advFocused],
      _ownerInstanceId: 'char-1',
      _featureKey: "Ranger's Focus",
    });
    const { mutations } = dispatchSceneEndHooks(gameState, [rf]);
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFocusTarget',
        payload: { instanceId: 'char-1', focusTargetInstanceId: null },
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFocusedBy',
        payload: { instanceId: 'adv-1', focusedBy: null },
      })
    );
  });
});
