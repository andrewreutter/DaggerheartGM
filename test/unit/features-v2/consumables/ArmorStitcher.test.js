import { describe, it, expect } from 'vitest';
import { loadCharacterFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { collectChips, activateChip, makeChipState } from '../../../../src/features-v2/engine/chip-system.js';
import { ArmorStitcher } from '../../../../src/features-v2/consumables/ArmorStitcher.js';
import registry from '../../../../src/features-v2/registry.js';
import { buildTableSnapshot } from '../../../../src/features-v2/engine/table.js';
import { mockCharacter, mockGameState } from '../helpers.js';

describe('Consumables — Armor Stitcher', () => {
  it('loads from inventory by SRD id', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Armor Stitcher', id: 'srd-cns-armor-stitcher' }],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: 'Armor Stitcher',
        description: ArmorStitcher.description,
        isSelect: expect.any(Function),
        _source: 'consumable',
        _consumableId: 'srd-cns-armor-stitcher',
      })
    );
  });

  it('card chip is disabled when no marked armor slots', () => {
    const char = mockCharacter({
      instanceId: 'char-1',
      hope: 5,
      maxArmor: 3,
      currentArmor: 3,
    });
    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [char],
        _ownerInstanceId: 'char-1',
        _featureKey: 'Armor Stitcher',
      })
    );
    const chips = collectChips([{ ...ArmorStitcher, _ownerInstanceId: 'char-1' }], 'card', tbl);
    expect(chips[0]?.disabled).toBe(true);
  });

  it('isSelect lists options up to min(Hope, marked slots)', () => {
    const char = mockCharacter({
      instanceId: 'char-1',
      hope: 3,
      maxArmor: 4,
      currentArmor: 2,
    });
    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [char],
        _ownerInstanceId: 'char-1',
        _featureKey: 'Armor Stitcher',
      })
    );
    const chips = collectChips([{ ...ArmorStitcher, _ownerInstanceId: 'char-1' }], 'card', tbl);
    const opts = typeof chips[0]?.isSelect === 'function' ? chips[0].isSelect(tbl) : [];
    expect(opts).toHaveLength(2);
    expect(opts[0]?.id).toBe('1');
    expect(opts[1]?.id).toBe('2');
  });

  it('activateChip with selectedId queues spendHope and clearArmor', () => {
    const char = mockCharacter({
      instanceId: 'char-1',
      hope: 4,
      maxArmor: 4,
      currentArmor: 2,
    });
    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [char],
        _ownerInstanceId: 'char-1',
        _featureKey: 'Armor Stitcher',
      })
    );
    const chips = collectChips([{ ...ArmorStitcher, _ownerInstanceId: 'char-1' }], 'card', tbl);
    const m = activateChip(chips[0], tbl, makeChipState(), { selectedId: '2' });
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'spendHope',
        payload: expect.objectContaining({ instanceId: 'char-1', amount: 2 }),
      })
    );
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'clearArmor',
        payload: expect.objectContaining({ instanceId: 'char-1', amount: 2 }),
      })
    );
  });
});
