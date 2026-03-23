import { describe, it, expect } from 'vitest';
import { loadCharacterFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { SkeletonKey } from '../../../../src/features-v2/items/SkeletonKey.js';
import registry from '../../../../src/features-v2/registry.js';
import { mockCharacter, mockTable } from '../helpers.js';
import { isWhen, unwrapAll } from '../../../../src/features-v2/engine/when.js';

describe('Items — Skeleton Key', () => {
  it('loads from inventory by SRD id', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Skeleton Key', id: 'srd-itm-skeleton-key' }],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: 'Skeleton Key',
        description: SkeletonKey.description,
        _source: 'item',
        _itemId: 'srd-itm-skeleton-key',
      })
    );
  });

  it('loads from inventory by name when id is omitted', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Skeleton Key' }],
      }),
      registry
    );
    expect(feats.some((f) => f.name === 'Skeleton Key' && f._source === 'item')).toBe(true);
  });

  it('dedupes the same SRD item id in inventory', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [
          { name: 'Skeleton Key', id: 'srd-itm-skeleton-key' },
          { name: 'Skeleton Key', id: 'srd-itm-skeleton-key' },
        ],
      }),
      registry
    );
    expect(feats.filter((f) => f.name === 'Skeleton Key').length).toBe(1);
  });

  it('has a Finesse-scoped advantage trigger wrapped in when()', () => {
    expect(SkeletonKey.advantageTriggers).toHaveLength(1);
    expect(isWhen(SkeletonKey.advantageTriggers[0])).toBe(true);
  });

  it('resolves the advantage trigger when the action trait is Finesse', () => {
    const table = mockTable({
      action: {
        type: 'trait',
        trait: 'Finesse',
        actorInstanceId: 'char-1',
        effects: [],
        appliedEffects: [],
      },
    });
    const resolved = unwrapAll(SkeletonKey.advantageTriggers, table);
    expect(resolved).toContain('Finesse Rolls to open a locked door with this key');
  });

  it('does not resolve the advantage trigger when the action trait is not Finesse', () => {
    const table = mockTable({
      action: {
        type: 'trait',
        trait: 'Agility',
        actorInstanceId: 'char-1',
        effects: [],
        appliedEffects: [],
      },
    });
    expect(unwrapAll(SkeletonKey.advantageTriggers, table)).toHaveLength(0);
  });
});
