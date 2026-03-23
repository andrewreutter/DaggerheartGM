import { describe, it, expect } from 'vitest';
import {
  collectChips,
  activateChip,
  deductChipCosts,
  makeChipState,
} from '../../../../src/features-v2/engine/chip-system.js';
import { buildTableSnapshot, applyMutations } from '../../../../src/features-v2/engine/table.js';
import { loadCharacterFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { HopekeeperLocket } from '../../../../src/features-v2/items/HopekeeperLocket.js';
import registry from '../../../../src/features-v2/registry.js';
import { mockCharacter, mockAdversary, mockGameState, mockRoll } from '../helpers.js';

describe('Items — Hopekeeper Locket', () => {
  it('loads from inventory by SRD id', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Hopekeeper Locket', id: 'srd-itm-hopekeeper-locket' }],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: 'Hopekeeper Locket',
        _source: 'item',
        _itemId: 'srd-itm-hopekeeper-locket',
        chips: HopekeeperLocket.chips,
      })
    );
  });

  it('intent chip imbues during long rest at 6+ Hope and spends 1 Hope', () => {
    const char = mockCharacter({ instanceId: 'c1', hope: 6, maxHope: 6 });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const gs = mockGameState({
      activeElements: [char, adv],
      _ownerInstanceId: 'c1',
      _featureKey: 'Hopekeeper Locket',
      featureState: { 'Hopekeeper Locket': {} },
      rolls: mockRoll(),
      action: {
        type: 'longRest',
        actorInstanceId: 'c1',
        targetInstanceIds: [],
        effects: [],
        appliedEffects: [],
      },
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...HopekeeperLocket, _ownerInstanceId: 'c1' }], 'intent', tbl);
    const chip = chips.find((c) => c.name === 'Imbue Hopekeeper Locket');
    expect(chip).toBeDefined();
    deductChipCosts(chip, tbl);
    const fromUse = [...activateChip(chip, tbl, makeChipState()), ...applyMutations(tbl)];
    expect(fromUse).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Hopekeeper Locket',
          key: 'hopekeeperLocketImbued',
          value: true,
        }),
      })
    );
    expect(fromUse).toContainEqual(
      expect.objectContaining({
        type: 'spendHope',
        payload: expect.objectContaining({ instanceId: 'c1', amount: 1 }),
      })
    );
  });

  it('card chip gains 1 Hope at 0 Hope when imbued and clears imbue', () => {
    const char = mockCharacter({ instanceId: 'c1', hope: 0, maxHope: 6 });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const gs = mockGameState({
      activeElements: [char, adv],
      _ownerInstanceId: 'c1',
      _featureKey: 'Hopekeeper Locket',
      featureState: { 'Hopekeeper Locket': { hopekeeperLocketImbued: true } },
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
    const chips = collectChips([{ ...HopekeeperLocket, _ownerInstanceId: 'c1' }], 'card', tbl);
    const chip = chips.find((c) => c.name === 'Use Hopekeeper Locket');
    expect(chip).toBeDefined();
    const fromUse = [...activateChip(chip, tbl, makeChipState()), ...applyMutations(tbl)];
    expect(fromUse).toContainEqual(
      expect.objectContaining({
        type: 'gainHope',
        payload: expect.objectContaining({ instanceId: 'c1', amount: 1 }),
      })
    );
    expect(fromUse).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Hopekeeper Locket',
          key: 'hopekeeperLocketImbued',
          value: false,
        }),
      })
    );
  });

  it('does not offer imbue on short rest', () => {
    const char = mockCharacter({ instanceId: 'c1', hope: 6, maxHope: 6 });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const gs = mockGameState({
      activeElements: [char, adv],
      _ownerInstanceId: 'c1',
      _featureKey: 'Hopekeeper Locket',
      featureState: { 'Hopekeeper Locket': {} },
      rolls: mockRoll(),
      action: {
        type: 'shortRest',
        actorInstanceId: 'c1',
        targetInstanceIds: [],
        effects: [],
        appliedEffects: [],
      },
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...HopekeeperLocket, _ownerInstanceId: 'c1' }], 'intent', tbl);
    expect(chips.find((c) => c.name === 'Imbue Hopekeeper Locket')).toBeUndefined();
  });
});
