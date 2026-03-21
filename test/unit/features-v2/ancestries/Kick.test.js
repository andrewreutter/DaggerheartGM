import { describe, it, expect } from 'vitest';
import { runReviewAction, mockTable, mockChipState } from '../helpers.js';
import { Kick } from '../../../../src/features-v2/ancestries/Faun.js';
import { applyMutations } from '../../../../src/features-v2/engine/table.js';

describe('Kick', () => {
  it('shows two review chips on successful melee attack', () => {
    const result = runReviewAction(Kick, {
      action: {
        type: 'attack',
        actorInstanceId: 'char-1',
        targetInstanceIds: ['adv-1'],
        range: 'melee',
      },
      rolls: {
        action: {
          hopeDie: { value: 8 },
          fearDie: { value: 5 },
          dice: [],
          statics: [],
          isSuccess: true,
        },
        damage: {
          dice: [{ name: 'weapon', die: 'd8', value: 4 }],
          statics: [],
        },
      },
    });

    expect(result.chips).toHaveLength(2);
    const names = result.chips.map((c) => c.name);
    expect(names).toContain('Kick (push target)');
    expect(names).toContain('Kick (leap back)');
    expect(result.chips[0].stressCost).toBe(1);
    expect(result.chips[0].placements).toContain('reviewAction');
  });

  it('does not show chips when attack is not successful', () => {
    const result = runReviewAction(Kick, {
      action: {
        type: 'attack',
        actorInstanceId: 'char-1',
        targetInstanceIds: ['adv-1'],
        range: 'melee',
      },
      rolls: {
        action: {
          hopeDie: { value: 3 },
          fearDie: { value: 2 },
          dice: [],
          statics: [],
          isSuccess: false,
        },
      },
    });

    expect(result.chips).toHaveLength(0);
  });

  it('does not show chips when range is not melee', () => {
    const result = runReviewAction(Kick, {
      action: {
        type: 'attack',
        actorInstanceId: 'char-1',
        targetInstanceIds: ['adv-1'],
        range: 'close',
      },
      rolls: {
        action: {
          hopeDie: { value: 8 },
          fearDie: { value: 5 },
          dice: [],
          statics: [],
          isSuccess: true,
        },
      },
    });

    expect(result.chips).toHaveLength(0);
  });

  it('does not show chips when not acting', () => {
    const result = runReviewAction(Kick, {
      action: {
        type: 'attack',
        actorInstanceId: 'char-2',
        targetInstanceIds: ['adv-1'],
        range: 'melee',
      },
      rolls: {
        action: {
          hopeDie: { value: 8 },
          fearDie: { value: 5 },
          dice: [],
          statics: [],
          isSuccess: true,
        },
      },
    });

    expect(result.chips).toHaveLength(0);
  });

  it('push chip: adds 2d6 damage and queues target move with veryClose condition', () => {
    const result = runReviewAction(Kick, {
      action: {
        type: 'attack',
        actorInstanceId: 'char-1',
        targetInstanceIds: ['adv-1'],
        range: 'melee',
      },
      rolls: {
        action: {
          hopeDie: { value: 8 },
          fearDie: { value: 5 },
          dice: [],
          statics: [],
          isSuccess: true,
        },
        damage: {
          dice: [{ name: 'weapon', die: 'd8', value: 4 }],
          statics: [],
        },
      },
    });

    const pushChip = result.chips.find((c) => c.name === 'Kick (push target)');
    expect(pushChip).toBeDefined();

    const table = mockTable({
      action: {
        type: 'attack',
        actorInstanceId: 'char-1',
        targetInstanceIds: ['adv-1'],
        range: 'melee',
      },
      rolls: {
        damage: {
          dice: [],
          statics: [],
        },
      },
    });

    pushChip.onUse(table, mockChipState());
    const mutations = applyMutations(table);

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addRollDie',
        payload: expect.objectContaining({
          rollKey: 'damage',
          name: 'Kick',
          die: '2d6',
        }),
      })
    );

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'move',
        payload: expect.objectContaining({
          instanceId: 'adv-1',
          description: 'Kick: knock target to Very Close range',
        }),
      })
    );
    const moveMut = mutations.find((m) => m.type === 'move');
    expect(typeof moveMut.payload.conditionFn).toBe('function');
  });

  it('leap chip: adds 2d6 damage and queues self move with veryClose condition', () => {
    const result = runReviewAction(Kick, {
      action: {
        type: 'attack',
        actorInstanceId: 'char-1',
        targetInstanceIds: ['adv-1'],
        range: 'melee',
      },
      rolls: {
        action: {
          hopeDie: { value: 8 },
          fearDie: { value: 5 },
          dice: [],
          statics: [],
          isSuccess: true,
        },
        damage: {
          dice: [{ name: 'weapon', die: 'd8', value: 4 }],
          statics: [],
        },
      },
    });

    const leapChip = result.chips.find((c) => c.name === 'Kick (leap back)');
    expect(leapChip).toBeDefined();

    const table = mockTable({
      action: {
        type: 'attack',
        actorInstanceId: 'char-1',
        targetInstanceIds: ['adv-1'],
        range: 'melee',
      },
      rolls: {
        damage: {
          dice: [],
          statics: [],
        },
      },
    });

    leapChip.onUse(table, mockChipState());
    const mutations = applyMutations(table);

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addRollDie',
        payload: expect.objectContaining({
          rollKey: 'damage',
          name: 'Kick',
          die: '2d6',
        }),
      })
    );

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'move',
        payload: expect.objectContaining({
          instanceId: 'char-1',
          description: 'Kick: leap to Very Close range from the target',
        }),
      })
    );
  });
});
