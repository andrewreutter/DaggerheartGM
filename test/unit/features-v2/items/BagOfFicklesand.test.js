import { describe, it, expect } from 'vitest';
import { collectChips, activateChip, makeChipState } from '../../../../src/features-v2/engine/chip-system.js';
import { buildTableSnapshot, applyMutations } from '../../../../src/features-v2/engine/table.js';
import { loadCharacterFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { BagOfFicklesand } from '../../../../src/features-v2/items/BagOfFicklesand.js';
import registry from '../../../../src/features-v2/registry.js';
import { mockCharacter, mockAdversary, mockGameState } from '../helpers.js';

describe('Items — Bag of Ficklesand', () => {
  it('loads from inventory by SRD id', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Bag of Ficklesand', id: 'srd-itm-bag-of-ficklesand' }],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: 'Bag of Ficklesand',
        description: BagOfFicklesand.description,
        _source: 'item',
        _itemId: 'srd-itm-bag-of-ficklesand',
      })
    );
  });

  it('loads from inventory by name when id is omitted', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Bag of Ficklesand' }],
      }),
      registry
    );
    expect(feats.some((f) => f.name === 'Bag of Ficklesand' && f._source === 'item')).toBe(true);
  });

  it('dedupes the same SRD item id in inventory', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [
          { name: 'Bag of Ficklesand', id: 'srd-itm-bag-of-ficklesand' },
          { name: 'Bag of Ficklesand', id: 'srd-itm-bag-of-ficklesand' },
        ],
      }),
      registry
    );
    expect(feats.filter((f) => f.name === 'Bag of Ficklesand').length).toBe(1);
  });

  it('Presence card chip queues actionLoop vs difficulty 10', () => {
    const char = mockCharacter({ instanceId: 'char-1', tokenX: 0, tokenY: 0 });
    const gs = mockGameState({
      activeElements: [char],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Bag of Ficklesand',
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...BagOfFicklesand, _ownerInstanceId: 'char-1' }], 'card', tbl);
    const chip = chips.find((c) => c.name === 'Convince the bag (Presence 10)');
    expect(chip).toBeDefined();
    const fromUse = [...activateChip(chip, tbl, makeChipState()), ...applyMutations(tbl)];
    expect(fromUse).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({
          title: 'Bag of Ficklesand',
          trait: 'Presence',
          difficulty: 10,
        }),
      })
    );
  });

  it('Blow sand chip queues Finesse actionLoop after selecting a target in range', () => {
    const char = mockCharacter({ instanceId: 'char-1', tokenX: 0, tokenY: 0 });
    const adv = mockAdversary({ instanceId: 'adv-1', name: 'Grump Troll', tokenX: 0, tokenY: 0 });
    const gs = mockGameState({
      activeElements: [char, adv],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Bag of Ficklesand',
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...BagOfFicklesand, _ownerInstanceId: 'char-1' }], 'card', tbl);
    const chip = chips.find((c) => c.name === 'Blow sand (Finesse 10)');
    expect(chip).toBeDefined();
    const fromUse = [
      ...activateChip(chip, tbl, makeChipState(), { selectedTargetIds: ['adv-1'] }),
      ...applyMutations(tbl),
    ];
    expect(fromUse).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({
          title: 'Bag of Ficklesand',
          trait: 'Finesse',
          difficulty: 10,
          description: expect.stringMatching(/Grump Troll/),
        }),
      })
    );
  });

  it('does not expose intent-phase chips', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const gs = mockGameState({
      activeElements: [char],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Bag of Ficklesand',
    });
    const tbl = buildTableSnapshot(gs);
    const intent = collectChips([{ ...BagOfFicklesand, _ownerInstanceId: 'char-1' }], 'intent', tbl);
    expect(intent).toHaveLength(0);
  });
});
