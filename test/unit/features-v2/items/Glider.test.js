import { describe, it, expect } from 'vitest';
import {
  collectChips,
  activateChip,
  deductChipCosts,
  makeChipState,
} from '../../../../src/features-v2/engine/chip-system.js';
import { buildTableSnapshot, applyMutations } from '../../../../src/features-v2/engine/table.js';
import { loadCharacterFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { Glider } from '../../../../src/features-v2/items/Glider.js';
import registry from '../../../../src/features-v2/registry.js';
import { mockCharacter, mockGameState } from '../helpers.js';

describe('Items — Glider', () => {
  it('loads from inventory by SRD id', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Glider', id: 'srd-itm-glider' }],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: 'Glider',
        description: Glider.description,
        _source: 'item',
        _itemId: 'srd-itm-glider',
      })
    );
  });

  it('loads from inventory by name when id is omitted', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Glider' }],
      }),
      registry
    );
    expect(feats.some((f) => f.name === 'Glider' && f._source === 'item')).toBe(true);
  });

  it('dedupes the same SRD item id in inventory', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [
          { name: 'Glider', id: 'srd-itm-glider' },
          { name: 'Glider', id: 'srd-itm-glider' },
        ],
      }),
      registry
    );
    expect(feats.filter((f) => f.name === 'Glider').length).toBe(1);
  });

  it('card chip spends 1 Stress and opens an actionLoop for deploy / safe landing', () => {
    const char = mockCharacter({ instanceId: 'char-1', currentStress: 0, maxStress: 6 });
    const gs = mockGameState({
      activeElements: [char],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Glider',
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...Glider, _ownerInstanceId: 'char-1' }], 'card', tbl);
    expect(chips).toHaveLength(1);
    expect(chips[0].stressCost).toBe(1);

    deductChipCosts(chips[0], tbl);
    const fromUse = [...activateChip(chips[0], tbl, makeChipState()), ...applyMutations(tbl)];

    expect(fromUse).toContainEqual(
      expect.objectContaining({
        type: 'markStress',
        payload: { instanceId: 'char-1', amount: 1 },
      })
    );
    expect(fromUse).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({
          title: 'Glider',
          description: expect.stringMatching(/glide safely/i),
        }),
      })
    );
  });

  it('does not expose intent-phase chips', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const gs = mockGameState({
      activeElements: [char],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Glider',
    });
    const tbl = buildTableSnapshot(gs);
    const intent = collectChips([{ ...Glider, _ownerInstanceId: 'char-1' }], 'intent', tbl);
    expect(intent).toHaveLength(0);
  });
});
