import { describe, it, expect } from 'vitest';
import { loadCharacterFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { collectChips } from '../../../../src/features-v2/engine/chip-system.js';
import { GillSalve } from '../../../../src/features-v2/consumables/GillSalve.js';
import registry from '../../../../src/features-v2/registry.js';
import { buildTableSnapshot } from '../../../../src/features-v2/engine/table.js';
import { mockCharacter, mockGameState } from '../helpers.js';

describe('Consumables — Gill Salve', () => {
  it('loads from inventory by SRD id', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Gill Salve', id: 'srd-cns-gill-salve' }],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: 'Gill Salve',
        description: GillSalve.description,
        _source: 'consumable',
        _consumableId: 'srd-cns-gill-salve',
      })
    );
  });

  it('exposes a narrative card chip (no default onUse)', () => {
    const t = buildTableSnapshot(
      mockGameState({
        _ownerInstanceId: 'char-1',
        _featureKey: 'Gill Salve',
      })
    );
    const chips = collectChips(
      [{ ...GillSalve, _ownerInstanceId: 'char-1' }],
      'card',
      t
    );
    expect(chips).toHaveLength(1);
    expect(chips[0]).toMatchObject({
      name: 'Gill Salve',
      description: GillSalve.description,
      placements: ['card'],
    });
    expect(chips[0].onUse).toBeUndefined();
  });
});
