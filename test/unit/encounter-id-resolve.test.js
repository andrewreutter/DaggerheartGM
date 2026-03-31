import { describe, it, expect } from 'vitest';
import {
  slugTail,
  findBestCatalogNearMatch,
  mergeAdvPlanRows,
  mergeEnvPlanRows,
} from '../../src/encounter-id-resolve.js';

describe('encounter-id-resolve', () => {
  it('slugTail strips known prefixes and hyphens', () => {
    expect(slugTail('srd-adv-iron-golem')).toBe('iron golem');
    expect(slugTail('srd-env-haunted-woods')).toBe('haunted woods');
  });

  it('findBestCatalogNearMatch picks a close slug tail', () => {
    const catalog = [
      { id: 'srd-adv-iron-golem', name: 'Iron Golem' },
      { id: 'srd-adv-bear', name: 'Bear' },
    ];
    const m = findBestCatalogNearMatch('srd-adv-iron-golemm', catalog);
    expect(m).not.toBeNull();
    expect(m.id).toBe('srd-adv-iron-golem');
  });

  it('findBestCatalogNearMatch uses nameHint when slug is far off', () => {
    const catalog = [{ id: 'srd-adv-shadow-wraith', name: 'Shadow Wraith' }];
    const m = findBestCatalogNearMatch('srd-adv-made-up-thing', catalog, {
      nameHint: 'Shadow Wraith',
    });
    expect(m).not.toBeNull();
    expect(m.id).toBe('srd-adv-shadow-wraith');
  });

  it('mergeAdvPlanRows merges counts by id', () => {
    expect(
      mergeAdvPlanRows([
        { id: 'a', count: 1, tier: 2, role: 'standard' },
        { id: 'a', count: 2, tier: 2, role: 'standard' },
      ]),
    ).toEqual([{ id: 'a', count: 3, tier: 2, role: 'standard' }]);
  });

  it('mergeEnvPlanRows merges counts by id', () => {
    expect(
      mergeEnvPlanRows([
        { id: 'e1', count: 1, tier: 1, type: 'dungeon' },
        { id: 'e1', count: 1, tier: 1, type: 'dungeon' },
      ]),
    ).toEqual([{ id: 'e1', count: 2, tier: 1, type: 'dungeon' }]);
  });
});
