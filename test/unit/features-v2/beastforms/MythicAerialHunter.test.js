import { describe, it, expect } from 'vitest';
import { DeadlyRaptor } from '../../../../src/features-v2/beastforms/MythicAerialHunter.js';
import {
  runReviewAction,
  mockCharacter,
  mockAdversary,
  mockChipState,
  mockGameState,
  mockRoll,
} from '../helpers.js';
import { applyMutations, buildTableSnapshot } from '../../../../src/features-v2/engine/table.js';

describe('Mythic Aerial Hunter — Deadly Raptor', () => {
  const charMelee = mockCharacter({
    instanceId: 'char-1',
    tokenX: 0,
    tokenY: 0,
    proficiency: 3,
  });
  const adv = mockAdversary({ instanceId: 'adv-1', tokenX: 3, tokenY: 0 });

  const chargeState = {
    activeElements: [charMelee, adv],
    _previousPositions: { 'char-1': { tokenX: 15, tokenY: 0 } },
    rolls: mockRoll({
      damageDice: [
        { name: 'weapon', die: 'd8', value: 2 },
        { name: 'bonus', die: 'd6', value: 5 },
      ],
    }),
  };

  it('exposes a reviewAction chip when charging from Close+ into Melee with damage dice', () => {
    const { chips } = runReviewAction(
      { ...DeadlyRaptor, _ownerInstanceId: 'char-1' },
      chargeState
    );
    expect(chips).toHaveLength(1);
    expect(chips[0].placements).toContain('reviewAction');
  });

  it('onUse queues rerollDie only for dice strictly below Proficiency', () => {
    const gs = mockGameState({
      ...chargeState,
      _ownerInstanceId: 'char-1',
      _featureKey: 'Deadly Raptor',
    });
    const table = buildTableSnapshot(gs);
    const { chips } = runReviewAction(
      { ...DeadlyRaptor, _ownerInstanceId: 'char-1' },
      chargeState
    );
    expect(chips).toHaveLength(1);
    chips[0].onUse(table, mockChipState());
    const mutations = applyMutations(table);
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'rerollDie',
        payload: expect.objectContaining({
          rollKey: 'damage',
          dieType: 'damageDie',
          dieName: 'weapon',
        }),
      })
    );
    expect(mutations.filter((m) => m.type === 'rerollDie')).toHaveLength(1);
  });

  it('does not offer the chip without prior position', () => {
    const { chips } = runReviewAction(
      { ...DeadlyRaptor, _ownerInstanceId: 'char-1' },
      {
        ...chargeState,
        _previousPositions: undefined,
      }
    );
    expect(chips).toHaveLength(0);
  });

  it('does not offer the chip when prior position was only Very Close (not at least Close band)', () => {
    const char = mockCharacter({
      instanceId: 'char-1',
      tokenX: 0,
      tokenY: 0,
      proficiency: 3,
    });
    const { chips } = runReviewAction(
      { ...DeadlyRaptor, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char, adv],
        _previousPositions: { 'char-1': { tokenX: 11, tokenY: 0 } },
        rolls: mockRoll({
          damageDice: [{ name: 'weapon', die: 'd8', value: 2 }],
        }),
      }
    );
    expect(chips).toHaveLength(0);
  });
});
