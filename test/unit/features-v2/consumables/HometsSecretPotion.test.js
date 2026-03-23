import { describe, it, expect } from 'vitest';
import { applyMutations, buildTableSnapshot } from '../../../../src/features-v2/engine/table.js';
import { loadCharacterFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { HometsSecretPotion } from '../../../../src/features-v2/consumables/HometsSecretPotion.js';
import registry from '../../../../src/features-v2/registry.js';
import { mockCharacter, mockGameState, mockRoll, runReviewAction } from '../helpers.js';

describe("Consumables — Homet's Secret Potion", () => {
  it('loads from inventory by SRD id', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: "Homet's Secret Potion", id: 'srd-cns-homet-s-secret-potion' }],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: "Homet's Secret Potion",
        description: HometsSecretPotion.description,
        _source: 'consumable',
        _consumableId: 'srd-cns-homet-s-secret-potion',
      })
    );
  });

  it('onUse queues setFeatureState for pending critical', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const gs = mockGameState({
      activeElements: [char],
      _ownerInstanceId: char.instanceId,
      _featureKey: "Homet's Secret Potion",
    });
    const table = buildTableSnapshot(gs);
    HometsSecretPotion.onUse(table);
    const mutations = applyMutations(table);
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: "Homet's Secret Potion",
          key: 'hometSecretPotionPendingCrit',
          value: true,
        }),
      })
    );
  });

  it('onReviewAction forces critical on the next successful attack and clears pending', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const r = mockRoll({ hopeValue: 3, fearValue: 8, isCritical: false });
    const { mutations, loop } = runReviewAction(
      { ...HometsSecretPotion, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char],
        currentActorInstanceId: 'char-1',
        featureState: {
          "Homet's Secret Potion": { hometSecretPotionPendingCrit: true },
        },
        rolls: r,
        action: { weaponId: 'w1' },
      }
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setActionRollCritical',
        payload: expect.objectContaining({ rollKey: 'action', isCritical: true }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: "Homet's Secret Potion",
          key: 'hometSecretPotionPendingCrit',
          value: false,
        }),
      })
    );
    expect(loop.gameState.rolls.action.isCritical).toBe(true);
  });

  it('onReviewAction does not fire when no pending potion state', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const r = mockRoll({ isCritical: false });
    const { mutations } = runReviewAction(
      { ...HometsSecretPotion, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char],
        currentActorInstanceId: 'char-1',
        featureState: {},
        rolls: r,
      }
    );
    expect(mutations.filter((m) => m.type === 'setActionRollCritical')).toHaveLength(0);
  });

  it('onReviewAction does not force critical when the attack missed', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const r = mockRoll({ isSuccess: false, isCritical: false });
    const { mutations } = runReviewAction(
      { ...HometsSecretPotion, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char],
        currentActorInstanceId: 'char-1',
        featureState: {
          "Homet's Secret Potion": { hometSecretPotionPendingCrit: true },
        },
        rolls: r,
      }
    );
    expect(mutations.filter((m) => m.type === 'setActionRollCritical')).toHaveLength(0);
  });

  it('onReviewAction does not fire for non-offensive action types', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const r = mockRoll({ isCritical: false });
    const { mutations } = runReviewAction(
      { ...HometsSecretPotion, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char],
        currentActorInstanceId: 'char-1',
        actionType: 'trait',
        featureState: {
          "Homet's Secret Potion": { hometSecretPotionPendingCrit: true },
        },
        rolls: r,
      }
    );
    expect(mutations.filter((m) => m.type === 'setActionRollCritical')).toHaveLength(0);
  });
});
