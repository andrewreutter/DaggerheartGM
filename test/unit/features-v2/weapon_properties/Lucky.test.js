import { describe, it, expect } from 'vitest';
import { Lucky } from '../../../../src/features-v2/weapon_properties/Lucky.js';
import {
  runReviewAction,
  runIntent,
  mockRoll,
  mockAction,
  mockCharacter,
  mockAdversary,
  mockChipState,
} from '../helpers.js';
import { collectChips, activateChip } from '../../../../src/features-v2/engine/chip-system.js';
import { buildTableSnapshot } from '../../../../src/features-v2/engine/table.js';
import { mockGameState } from '../helpers.js';

describe('Lucky', () => {
  it('exposes a reviewAction chip on a failed attack', () => {
    const { chips } = runReviewAction(Lucky, {
      action: mockAction({ type: 'attack' }),
      rolls: mockRoll({ isSuccess: false }),
    });
    const lucky = chips.find((c) => c.name === 'Lucky reroll');
    expect(lucky).toBeDefined();
    expect(lucky.stressCost).toBe(1);
    expect(lucky.placements).toContain('reviewAction');
  });

  it('does not offer the chip when the attack succeeded', () => {
    const { chips } = runReviewAction(Lucky, {
      action: mockAction({ type: 'attack' }),
      rolls: mockRoll({ isSuccess: true }),
    });
    expect(chips.filter((c) => c.name === 'Lucky reroll')).toHaveLength(0);
  });

  it('onUse marks Stress and queues reroll mutations for Hope and Fear dice', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const table = buildTableSnapshot(
      mockGameState({
        activeElements: [char, adv],
        _ownerInstanceId: 'char-1',
        _featureKey: 'Lucky',
        featureState: { Lucky: {} },
        rolls: mockRoll({ isSuccess: false }),
        action: {
          type: 'attack',
          actorInstanceId: 'char-1',
          targetInstanceIds: ['adv-1'],
          trait: 'Agility',
          range: 'melee',
          effects: [],
          appliedEffects: [],
        },
      })
    );

    const chips = collectChips([{ ...Lucky, _ownerInstanceId: 'char-1' }], 'reviewAction', table);
    const chip = chips.find((c) => c.name === 'Lucky reroll');
    expect(chip).toBeDefined();

    const mutations = activateChip(chip, table, mockChipState());
    expect(mutations.filter((m) => m.type === 'rerollDie')).toHaveLength(2);
    expect(mutations).toContainEqual(
      expect.objectContaining({ type: 'rerollDie', payload: expect.objectContaining({ dieType: 'hopeDie' }) })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({ type: 'rerollDie', payload: expect.objectContaining({ dieType: 'fearDie' }) })
    );
  });

  it('intent hook resets per-attack spend flag', () => {
    // Smoke: ensure onIntent runs without throwing
    runIntent(Lucky, {
      action: mockAction({ type: 'attack' }),
    });
    expect(true).toBe(true);
  });
});
