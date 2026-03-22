import { describe, it, expect } from 'vitest';
import {
  runReviewAction,
  mockCharacter,
  mockAdversary,
  mockRoll,
  mockTable,
  mockChipState,
} from '../helpers.js';
import { applyMutations } from '../../../../src/features-v2/engine/table.js';
import { InternalCompass } from '../../../../src/features-v2/ancestries/Halfling.js';

describe('Internal Compass', () => {
  it('shows chip when Hope Die value is 1', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const result = runReviewAction(InternalCompass, {
      activeElements: [char, adv],
      _ownerInstanceId: 'char-1',
      action: {
        type: 'attack',
        actorInstanceId: 'char-1',
        targetInstanceIds: ['adv-1'],
        effects: [],
        appliedEffects: [],
      },
      rolls: mockRoll({ hopeValue: 1 }),
    });

    expect(result.chips).toHaveLength(1);
    expect(result.chips[0]._featureName).toBe('Internal Compass');
    expect(result.chips[0].placements).toContain('reviewAction');
  });

  it('does not show chip when Hope Die value is not 1', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const result = runReviewAction(InternalCompass, {
      activeElements: [char, adv],
      _ownerInstanceId: 'char-1',
      action: {
        type: 'attack',
        actorInstanceId: 'char-1',
        targetInstanceIds: ['adv-1'],
        effects: [],
        appliedEffects: [],
      },
      rolls: mockRoll({ hopeValue: 7 }),
    });

    expect(result.chips).toHaveLength(0);
  });

  it('queues rerollDie mutation when chip is used', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const result = runReviewAction(InternalCompass, {
      activeElements: [char, adv],
      _ownerInstanceId: 'char-1',
      action: {
        type: 'attack',
        actorInstanceId: 'char-1',
        targetInstanceIds: ['adv-1'],
        effects: [],
        appliedEffects: [],
      },
      rolls: mockRoll({ hopeValue: 1 }),
    });

    const chip = result.chips[0];
    expect(chip).toBeDefined();

    const table = mockTable({
      activeElements: [char, adv],
      _ownerInstanceId: 'char-1',
      action: {
        type: 'attack',
        actorInstanceId: 'char-1',
        targetInstanceIds: ['adv-1'],
        effects: [],
        appliedEffects: [],
      },
      rolls: mockRoll({ hopeValue: 1 }),
    });

    chip.onUse(table, mockChipState());
    const mutations = applyMutations(table);

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'rerollDie',
        payload: { rollKey: 'action', dieType: 'hopeDie' },
      })
    );
  });
});
