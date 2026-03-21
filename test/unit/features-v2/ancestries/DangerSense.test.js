import { describe, it, expect } from 'vitest';
import { runReviewAction, mockCharacter, mockAdversary, mockRoll, mockTable, mockChipState } from '../helpers.js';
import { applyMutations } from '../../../../src/features-v2/engine/table.js';
import { DangerSense } from '../../../../src/features-v2/ancestries/Goblin.js';

describe('Danger Sense', () => {
  it('shows chip when adversary attacks me', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const result = runReviewAction(DangerSense, {
      activeElements: [char, adv],
      _ownerInstanceId: 'char-1',
      action: {
        type: 'attack',
        actorInstanceId: 'adv-1',
        targetInstanceIds: ['char-1'],
        effects: [],
        appliedEffects: [],
      },
      rolls: mockRoll(),
    });

    expect(result.chips).toHaveLength(1);
    expect(result.chips[0]._featureName).toBe('Danger Sense');
    expect(result.chips[0].placements).toContain('reviewAction');
    expect(result.chips[0].stressCost).toBe(1);
    expect(result.chips[0].frequency).toBe('rest');
  });

  it('shows chip when adversary attacks ally within melee range (≤5ft)', () => {
    const me = mockCharacter({ instanceId: 'char-1', tokenX: 0, tokenY: 0 });
    const ally = mockCharacter({ instanceId: 'char-2', tokenX: 4, tokenY: 0 }); // 4ft — melee
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const result = runReviewAction(DangerSense, {
      activeElements: [me, ally, adv],
      _ownerInstanceId: 'char-1',
      action: {
        type: 'attack',
        actorInstanceId: 'adv-1',
        targetInstanceIds: ['char-2'],
        effects: [],
        appliedEffects: [],
      },
      rolls: mockRoll(),
    });

    expect(result.chips).toHaveLength(1);
    expect(result.chips[0]._featureName).toBe('Danger Sense');
  });

  it('does not show chip on non-attack actions', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const result = runReviewAction(DangerSense, {
      activeElements: [char, adv],
      _ownerInstanceId: 'char-1',
      action: {
        type: 'trait',
        actorInstanceId: 'adv-1',
        targetInstanceIds: ['char-1'],
        effects: [],
        appliedEffects: [],
      },
      rolls: mockRoll(),
    });

    expect(result.chips).toHaveLength(0);
  });

  it('queues rerollDie mutations for both dice when chip is used', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const result = runReviewAction(DangerSense, {
      activeElements: [char, adv],
      _ownerInstanceId: 'char-1',
      action: {
        type: 'attack',
        actorInstanceId: 'adv-1',
        targetInstanceIds: ['char-1'],
        effects: [],
        appliedEffects: [],
      },
      rolls: mockRoll(),
    });

    const chip = result.chips[0];
    expect(chip).toBeDefined();

    const table = mockTable({
      activeElements: [char, adv],
      _ownerInstanceId: 'char-1',
      action: {
        type: 'attack',
        actorInstanceId: 'adv-1',
        targetInstanceIds: ['char-1'],
        effects: [],
        appliedEffects: [],
      },
      rolls: mockRoll(),
    });

    chip.onUse(table, mockChipState());
    const mutations = applyMutations(table);

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'rerollDie',
        payload: expect.objectContaining({ rollKey: 'action', dieType: 'hopeDie' }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'rerollDie',
        payload: expect.objectContaining({ rollKey: 'action', dieType: 'fearDie' }),
      })
    );
  });
});
