import { describe, it, expect } from 'vitest';
import { collectChips } from '../../../../src/features-v2/engine/chip-system.js';
import { applyMutations } from '../../../../src/features-v2/engine/table.js';
import { FrontlineTank, Unstoppable } from '../../../../src/features-v2/classes/Guardian.js';
import { mockTable, mockChipState, runReviewAction, runResolve, mockAdversaryAttackRoll } from '../helpers.js';

describe('Frontline Tank (Guardian)', () => {
  it('exposes a default card with Hope 3 that clears 2 armor slots on use', () => {
    const table = mockTable();
    const annotated = { ...FrontlineTank, _ownerInstanceId: 'char-1' };
    const chips = collectChips([annotated], 'card', table);
    expect(chips).toHaveLength(1);
    expect(chips[0].hopeCost).toBe(3);

    chips[0].onUse(table, mockChipState());
    const mutations = applyMutations(table);

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'clearArmor',
        payload: expect.objectContaining({ instanceId: 'char-1', amount: 2 }),
      })
    );
  });
});

describe('Unstoppable (Guardian)', () => {
  it('initializes Unstoppable die state on card use', () => {
    const table = mockTable({ featureState: {}, _featureKey: 'Unstoppable' });
    const annotated = { ...Unstoppable, _ownerInstanceId: 'char-1' };
    const chips = collectChips([annotated], 'card', table, {});
    expect(chips).toHaveLength(1);
    chips[0].onUse(table, mockChipState());
    const mutations = applyMutations(table);
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Unstoppable',
          key: 'unstoppableActive',
          value: true,
        }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          key: 'unstoppableDieValue',
          value: 1,
        }),
      })
    );
  });

  it('onReviewAction reduces incoming physical damage by one step while Unstoppable', () => {
    const effects = [
      {
        type: 'damage',
        target: { instanceId: 'char-1' },
        amount: 3,
        damageType: 'physical',
      },
    ];
    const { loop } = runReviewAction(Unstoppable, {
      action: {
        actorInstanceId: 'adv-1',
        targetInstanceIds: ['char-1'],
        effects,
      },
      featureState: { Unstoppable: { unstoppableActive: true } },
      rolls: mockAdversaryAttackRoll({ isSuccess: true }),
    });
    expect(effects[0].amount).toBe(2);
    expect(loop).toBeDefined();
  });

  it('onReviewAction adds die value to outgoing physical damage while Unstoppable', () => {
    const effects = [
      {
        type: 'damage',
        target: { instanceId: 'adv-1' },
        amount: 2,
        damageType: 'physical',
      },
    ];
    runReviewAction(Unstoppable, {
      action: {
        actorInstanceId: 'char-1',
        targetInstanceIds: ['adv-1'],
        effects,
      },
      featureState: {
        Unstoppable: { unstoppableActive: true, unstoppableDieValue: 2 },
      },
      rolls: mockAdversaryAttackRoll({ isSuccess: true }),
    });
    expect(effects[0].amount).toBe(4);
  });

  it('onResolve increases die value after a successful hit that deals HP', () => {
    const { mutations } = runResolve(Unstoppable, {
      action: {
        actorInstanceId: 'char-1',
        targetInstanceIds: ['adv-1'],
        effects: [
          {
            type: 'damage',
            target: { instanceId: 'adv-1' },
            amount: 2,
            damageType: 'physical',
          },
        ],
      },
      featureState: {
        Unstoppable: { unstoppableActive: true, unstoppableDieValue: 1, unstoppableDieMax: 4 },
      },
      rolls: mockAdversaryAttackRoll({ isSuccess: true }),
    });
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          key: 'unstoppableDieValue',
          value: 2,
        }),
      })
    );
  });

  it('onResolve clears Unstoppable when die would exceed max', () => {
    const { mutations } = runResolve(Unstoppable, {
      action: {
        actorInstanceId: 'char-1',
        targetInstanceIds: ['adv-1'],
        effects: [
          {
            type: 'damage',
            target: { instanceId: 'adv-1' },
            amount: 1,
            damageType: 'physical',
          },
        ],
      },
      featureState: {
        Unstoppable: { unstoppableActive: true, unstoppableDieValue: 4, unstoppableDieMax: 4 },
      },
      rolls: mockAdversaryAttackRoll({ isSuccess: true }),
    });
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          key: 'unstoppableActive',
          value: false,
        }),
      })
    );
  });
});
