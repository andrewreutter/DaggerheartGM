import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildTableSnapshot, applyMutations } from '../../../../src/features-v2/engine/table.js';
import { collectChips, activateChip, deductChipCosts, makeChipState } from '../../../../src/features-v2/engine/chip-system.js';
import { Resurrection } from '../../../../src/features-v2/abilities/Splendor/Resurrection.js';
import {
  mockCharacter,
  mockGameState,
  mockAction,
  mockRoll,
  runReviewAction,
} from '../helpers.js';

describe('Splendor — Resurrection', () => {
  const feat = { ...Resurrection, _ownerInstanceId: 'char-1' };

  it('main card spends 2 Hope (recall), queues Spellcast (20), sets resurrectionAwaitingSpellcast', () => {
    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [mockCharacter({ instanceId: 'char-1', hope: 5 })],
        _ownerInstanceId: 'char-1',
        _featureKey: 'Resurrection',
        action: {
          type: 'free',
          actorInstanceId: 'char-1',
          targetInstanceIds: [],
          effects: [],
          appliedEffects: [],
        },
        rolls: undefined,
      })
    );
    const chips = collectChips([feat], 'card', tbl);
    const main = chips.find((c) => c.name === 'Resurrection');
    expect(main?.hopeCost).toBe(2);
    const m = activateChip(main, tbl, makeChipState());
    deductChipCosts(main, tbl);
    const fromCost = applyMutations(tbl);
    const all = [...m, ...fromCost];
    expect(all).toContainEqual(
      expect.objectContaining({
        type: 'spendHope',
        payload: expect.objectContaining({ instanceId: 'char-1', amount: 2 }),
      })
    );
    expect(all).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({ title: 'Resurrection', difficulty: 20 }),
      })
    );
    expect(all).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({ key: 'resurrectionAwaitingSpellcast', value: true }),
      })
    );
  });

  it('successful Spellcast rolls d6 ≤5: queues vault move and last d6 state', () => {
    const { mutations } = runReviewAction(feat, {
      actionType: 'spellcast',
      action: mockAction({ type: 'spellcast', actorInstanceId: 'char-1', targetInstanceIds: [] }),
      rolls: mockRoll({ isSuccess: true }),
      featureState: { Resurrection: { resurrectionAwaitingSpellcast: true } },
      _rng: () => 0.01,
    });
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Resurrection',
          key: 'resurrectionAwaitingSpellcast',
          value: false,
        }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'rollDie',
        payload: expect.objectContaining({ notation: 'd6' }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'domainCardMoveToVault',
        payload: expect.objectContaining({ cardId: 'srd-abl-resurrection' }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Resurrection',
          key: 'resurrectionLastVaultD6',
          value: 1,
        }),
      })
    );
  });

  it('successful Spellcast with d6 = 6 does not move card to vault', () => {
    const { mutations } = runReviewAction(feat, {
      actionType: 'spellcast',
      action: mockAction({ type: 'spellcast', actorInstanceId: 'char-1', targetInstanceIds: [] }),
      rolls: mockRoll({ isSuccess: true }),
      featureState: { Resurrection: { resurrectionAwaitingSpellcast: true } },
      _rng: () => 0.95,
    });
    expect(mutations).not.toContainEqual(
      expect.objectContaining({
        type: 'domainCardMoveToVault',
        payload: expect.objectContaining({ cardId: 'srd-abl-resurrection' }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Resurrection',
          key: 'resurrectionLastVaultD6',
          value: 6,
        }),
      })
    );
  });

  it('failed Spellcast sets one-week cooldown and does not roll d6', () => {
    const before = Date.now();
    const { mutations } = runReviewAction(feat, {
      actionType: 'spellcast',
      action: mockAction({ type: 'spellcast', actorInstanceId: 'char-1', targetInstanceIds: [] }),
      rolls: mockRoll({ isSuccess: false }),
      featureState: { Resurrection: { resurrectionAwaitingSpellcast: true } },
    });
    const cooldown = mutations.find(
      (m) => m.type === 'setFeatureState' && m.payload?.key === 'resurrectionCooldownUntil'
    );
    expect(cooldown).toBeDefined();
    expect(cooldown.payload.value).toBeGreaterThanOrEqual(before + 7 * 24 * 60 * 60 * 1000 - 1000);
    expect(mutations.filter((m) => m.type === 'rollDie')).toHaveLength(0);
  });

  describe('cooldown disables card chip', () => {
    let nowSpy;

    beforeEach(() => {
      nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    });

    afterEach(() => {
      nowSpy.mockRestore();
    });

    it('chip is disabled while cooldown is active', () => {
      const tbl = buildTableSnapshot(
        mockGameState({
          activeElements: [mockCharacter({ instanceId: 'char-1', hope: 5 })],
          _ownerInstanceId: 'char-1',
          _featureKey: 'Resurrection',
          featureState: {
            Resurrection: { resurrectionCooldownUntil: 1_700_000_000_000 + 86400000 },
          },
          action: {
            type: 'free',
            actorInstanceId: 'char-1',
            targetInstanceIds: [],
            effects: [],
            appliedEffects: [],
          },
          rolls: undefined,
        })
      );
      const chips = collectChips([feat], 'card', tbl);
      const main = chips.find((c) => c.name === 'Resurrection');
      expect(main?.disabled).toBe(true);
    });

    it('chip is enabled when cooldown has expired', () => {
      const tbl = buildTableSnapshot(
        mockGameState({
          activeElements: [mockCharacter({ instanceId: 'char-1', hope: 5 })],
          _ownerInstanceId: 'char-1',
          _featureKey: 'Resurrection',
          featureState: {
            Resurrection: { resurrectionCooldownUntil: 1_700_000_000_000 - 1000 },
          },
          action: {
            type: 'free',
            actorInstanceId: 'char-1',
            targetInstanceIds: [],
            effects: [],
            appliedEffects: [],
          },
          rolls: undefined,
        })
      );
      const chips = collectChips([feat], 'card', tbl);
      const main = chips.find((c) => c.name === 'Resurrection');
      expect(main?.isDisabled?.(tbl)).toBe(false);
    });
  });
});
