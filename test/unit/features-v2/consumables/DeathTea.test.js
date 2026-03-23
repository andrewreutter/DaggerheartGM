import { describe, it, expect } from 'vitest';
import { applyMutations, buildTableSnapshot } from '../../../../src/features-v2/engine/table.js';
import { loadCharacterFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { DeathTea } from '../../../../src/features-v2/consumables/DeathTea.js';
import registry from '../../../../src/features-v2/registry.js';
import { mockCharacter, mockAdversary, mockGameState, mockRoll, runReviewAction, runIntent } from '../helpers.js';

describe('Consumables — Death Tea', () => {
  it('loads from inventory by SRD id', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Death Tea', id: 'srd-cns-death-tea' }],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: 'Death Tea',
        description: DeathTea.description,
        _source: 'consumable',
        _consumableId: 'srd-cns-death-tea',
      })
    );
  });

  it('onUse queues setFeatureState for pending tea', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const gs = mockGameState({
      activeElements: [char],
      _ownerInstanceId: char.instanceId,
      _featureKey: 'Death Tea',
    });
    const table = buildTableSnapshot(gs);
    DeathTea.onUse(table);
    const mutations = applyMutations(table);
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Death Tea',
          key: 'deathTeaPending',
          value: true,
        }),
      })
    );
  });

  it('onReviewAction instant-kills target on critical hit and clears pending', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1', currentHp: 3, maxHp: 3 });
    const r = mockRoll({
      hopeValue: 6,
      fearValue: 6,
      isSuccess: true,
      isCritical: true,
    });
    const dmg = { type: 'damage', target: { instanceId: 'adv-1' }, amount: 4, damageType: 'physical' };
    const { mutations } = runReviewAction(
      { ...DeathTea, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char, adv],
        currentActorInstanceId: 'char-1',
        featureState: {
          'Death Tea': { deathTeaPending: true },
        },
        rolls: r,
        action: {
          weaponId: 'w1',
          effects: [dmg],
        },
      }
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Death Tea',
          key: 'deathTeaPending',
          value: false,
        }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'markHP',
        payload: expect.objectContaining({ instanceId: 'adv-1', amount: 3 }),
      })
    );
    expect(dmg.amount).toBe(0);
    expect(mutations.some((m) => m.type === 'addNarration')).toBe(true);
  });

  it('onReviewAction does not fire without pending state', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const r = mockRoll({ hopeValue: 6, fearValue: 6, isSuccess: true, isCritical: true });
    const { mutations } = runReviewAction(
      { ...DeathTea, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char, adv],
        currentActorInstanceId: 'char-1',
        featureState: {},
        rolls: r,
        action: { weaponId: 'w1', effects: [] },
      }
    );
    expect(mutations.filter((m) => m.type === 'markHP')).toHaveLength(0);
  });

  it('onReviewAction does not fire when the attack is not a critical', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const r = mockRoll({ hopeValue: 3, fearValue: 8, isSuccess: true, isCritical: false });
    const { mutations } = runReviewAction(
      { ...DeathTea, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char, adv],
        currentActorInstanceId: 'char-1',
        featureState: { 'Death Tea': { deathTeaPending: true } },
        rolls: r,
        action: { weaponId: 'w1', effects: [] },
      }
    );
    expect(mutations.filter((m) => m.type === 'setFeatureState')).toHaveLength(0);
  });

  it('onRest (long rest) kills the drinker if no critical hit yet', () => {
    const { mutations } = runIntent(
      { ...DeathTea, _ownerInstanceId: 'char-1' },
      {
        actionType: 'longRest',
        featureState: {
          'Death Tea': { deathTeaPending: true },
        },
      }
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'markHP',
        payload: expect.objectContaining({ instanceId: 'char-1', amount: 4 }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Death Tea',
          key: 'deathTeaPending',
          value: false,
        }),
      })
    );
  });

  it('onRest (short rest) does not apply the long-rest death penalty', () => {
    const { mutations } = runIntent(
      { ...DeathTea, _ownerInstanceId: 'char-1' },
      {
        actionType: 'shortRest',
        featureState: {
          'Death Tea': { deathTeaPending: true },
        },
      }
    );
    expect(mutations.filter((m) => m.type === 'markHP')).toHaveLength(0);
  });
});
