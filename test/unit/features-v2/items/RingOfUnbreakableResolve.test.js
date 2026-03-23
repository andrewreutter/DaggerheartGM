import { describe, it, expect } from 'vitest';
import {
  collectChips,
  activateChip,
  deductChipCosts,
  makeChipState,
} from '../../../../src/features-v2/engine/chip-system.js';
import { buildTableSnapshot, applyMutations } from '../../../../src/features-v2/engine/table.js';
import { dispatchStateChangeHooks } from '../../../../src/features-v2/engine/action-loop.js';
import { loadCharacterFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { RingOfUnbreakableResolve } from '../../../../src/features-v2/items/RingOfUnbreakableResolve.js';
import registry from '../../../../src/features-v2/registry.js';
import { mockCharacter, mockAdversary, mockGameState, mockRoll } from '../helpers.js';

describe('Items — Ring of Unbreakable Resolve', () => {
  it('loads from inventory by SRD id', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Ring of Unbreakable Resolve', id: 'srd-itm-ring-of-unbreakable-resolve' }],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: 'Ring of Unbreakable Resolve',
        description: RingOfUnbreakableResolve.description,
        _source: 'item',
        _itemId: 'srd-itm-ring-of-unbreakable-resolve',
        chips: RingOfUnbreakableResolve.chips,
      })
    );
  });

  it('onStateChange sets offer when mutation batch includes spendFear', () => {
    const char = mockCharacter({ instanceId: 'c1', hope: 6, maxHope: 6 });
    const gs = mockGameState({
      activeElements: [char],
      featureState: { 'Ring of Unbreakable Resolve': {} },
      action: null,
      rolls: null,
      fear: 2,
    });
    const { mutations } = dispatchStateChangeHooks(
      gs,
      [{ ...RingOfUnbreakableResolve, _ownerInstanceId: 'c1' }],
      [{ type: 'spendFear', payload: { amount: 1 } }]
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Ring of Unbreakable Resolve',
          key: 'unbreakableResolveOffer',
          value: true,
        }),
      })
    );
  });

  it('collects card chip when offer is active', () => {
    const char = mockCharacter({ instanceId: 'c1', hope: 6, maxHope: 6 });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const gs = mockGameState({
      activeElements: [char, adv],
      _ownerInstanceId: 'c1',
      _featureKey: 'Ring of Unbreakable Resolve',
      featureState: { 'Ring of Unbreakable Resolve': { unbreakableResolveOffer: true } },
      rolls: mockRoll(),
      action: {
        type: 'attack',
        actorInstanceId: 'c1',
        targetInstanceIds: [adv.instanceId],
        effects: [],
        appliedEffects: [],
      },
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...RingOfUnbreakableResolve, _ownerInstanceId: 'c1' }], 'card', tbl);
    expect(chips.some((c) => c.name === 'Ring of Unbreakable Resolve — cancel GM Fear')).toBe(true);
  });

  it('does not collect card chip when offer is inactive', () => {
    const char = mockCharacter({ instanceId: 'c1', hope: 6, maxHope: 6 });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const gs = mockGameState({
      activeElements: [char, adv],
      _ownerInstanceId: 'c1',
      _featureKey: 'Ring of Unbreakable Resolve',
      featureState: { 'Ring of Unbreakable Resolve': {} },
      rolls: mockRoll(),
      action: {
        type: 'attack',
        actorInstanceId: 'c1',
        targetInstanceIds: [adv.instanceId],
        effects: [],
        appliedEffects: [],
      },
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...RingOfUnbreakableResolve, _ownerInstanceId: 'c1' }], 'card', tbl);
    expect(chips).toHaveLength(0);
  });

  it('activateChip spends 4 Hope, gains 1 Fear for GM pool, clears offer', () => {
    const char = mockCharacter({ instanceId: 'c1', hope: 6, maxHope: 6 });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const gs = mockGameState({
      activeElements: [char, adv],
      _ownerInstanceId: 'c1',
      _featureKey: 'Ring of Unbreakable Resolve',
      featureState: { 'Ring of Unbreakable Resolve': { unbreakableResolveOffer: true } },
      rolls: mockRoll(),
      fear: 1,
      action: {
        type: 'attack',
        actorInstanceId: 'c1',
        targetInstanceIds: [adv.instanceId],
        effects: [],
        appliedEffects: [],
      },
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...RingOfUnbreakableResolve, _ownerInstanceId: 'c1' }], 'card', tbl);
    const chip = chips.find((c) => c.name === 'Ring of Unbreakable Resolve — cancel GM Fear');
    expect(chip).toBeDefined();
    deductChipCosts(chip, tbl);
    const fromUse = [...activateChip(chip, tbl, makeChipState()), ...applyMutations(tbl)];
    expect(fromUse).toContainEqual(
      expect.objectContaining({
        type: 'spendHope',
        payload: expect.objectContaining({ instanceId: 'c1', amount: 4 }),
      })
    );
    expect(fromUse).toContainEqual(
      expect.objectContaining({
        type: 'gainFear',
        payload: expect.objectContaining({ amount: 1 }),
      })
    );
    expect(fromUse).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Ring of Unbreakable Resolve',
          key: 'unbreakableResolveOffer',
          value: false,
        }),
      })
    );
  });
});
