import { describe, it, expect } from 'vitest';
import { applyDeclarativeFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { buildTableSnapshot, applyMutations } from '../../../../src/features-v2/engine/table.js';
import { collectChips, activateChip, makeChipState, deductChipCosts } from '../../../../src/features-v2/engine/chip-system.js';
import { FullSurge } from '../../../../src/features-v2/abilities/Valor/FullSurge.js';
import { mockCharacter, mockGameState, mockAdversary } from '../helpers.js';
import { runIntent } from '../helpers.js';

describe('Valor — Full Surge', () => {
  it('adds +2 to all six traits when fullSurgeActive is set in feature state', () => {
    const { stats } = applyDeclarativeFeatures(
      [{ ...FullSurge, _ownerInstanceId: 'v1' }],
      mockCharacter({
        instanceId: 'v1',
        traits: { agility: 1, strength: 0, finesse: 0, instinct: 0, presence: 0, knowledge: 0 },
        featureState: { 'Full Surge': { fullSurgeActive: true } },
      }),
      {},
      null
    );
    expect(stats.agility).toBe(3);
    expect(stats.strength).toBe(2);
    expect(stats.finesse).toBe(2);
    expect(stats.instinct).toBe(2);
    expect(stats.presence).toBe(2);
    expect(stats.knowledge).toBe(2);
  });

  it('card is once per long rest with stress cost 3', () => {
    const fs = { 'Full Surge': {} };
    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [mockCharacter({ instanceId: 'v1' }), mockAdversary()],
        _ownerInstanceId: 'v1',
        _featureKey: 'Full Surge',
        featureState: fs,
        action: { type: 'free', actorInstanceId: 'v1', targetInstanceIds: [], effects: [] },
        rolls: undefined,
      })
    );
    const chips = collectChips([{ ...FullSurge, _ownerInstanceId: 'v1' }], 'card', tbl);
    const card = chips[0];
    expect(card?.frequency).toBe('longRest');
    expect(card?.stressCost).toBe(3);
  });

  it('onUse marks stress, sets fullSurgeActive, and posts actionLoop', () => {
    const fs = { 'Full Surge': {} };
    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [mockCharacter({ instanceId: 'v1', currentStress: 0, maxStress: 6 }), mockAdversary()],
        _ownerInstanceId: 'v1',
        _featureKey: 'Full Surge',
        featureState: fs,
        action: { type: 'free', actorInstanceId: 'v1', targetInstanceIds: [], effects: [] },
        rolls: undefined,
      })
    );
    const chips = collectChips([{ ...FullSurge, _ownerInstanceId: 'v1' }], 'card', tbl);
    const card = chips[0];
    const fromUse = activateChip(card, tbl, makeChipState());
    deductChipCosts(card, tbl);
    const fromCost = applyMutations(tbl);
    const all = [...fromUse, ...fromCost];
    expect(all).toContainEqual(
      expect.objectContaining({
        type: 'markStress',
        payload: expect.objectContaining({ instanceId: 'v1', amount: 3 }),
      })
    );
    expect(all).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Full Surge',
          key: 'fullSurgeActive',
          value: true,
        }),
      })
    );
    expect(all).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({ title: 'Full Surge' }),
      })
    );
  });

  it('onRest clears fullSurgeActive', () => {
    const fs = { 'Full Surge': { fullSurgeActive: true } };
    runIntent(
      { ...FullSurge, _ownerInstanceId: 'v1' },
      {
        activeElements: [mockCharacter({ instanceId: 'v1' }), mockAdversary()],
        featureState: fs,
        actionType: 'longRest',
        action: { type: 'longRest' },
      }
    );
    expect(fs['Full Surge']?.fullSurgeActive).toBe(false);
  });
});
