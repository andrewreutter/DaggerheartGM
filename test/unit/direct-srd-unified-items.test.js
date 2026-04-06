import { describe, expect, it } from 'vitest';
import { getUnifiedItems } from '../../src/db.js';

describe('direct SRD unified items', () => {
  it('serves rules through the unified library path', async () => {
    const result = await getUnifiedItems('app', 'user', 'rules', {
      includeSrd: true,
      search: 'rest',
      sort: 'name',
      offset: 0,
      limit: 20,
    });
    expect(result.totalCount).toBeGreaterThan(0);
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items.every((item) => item._source === 'srd')).toBe(true);
  });

  it('serves campaign frames through the unified library path', async () => {
    const result = await getUnifiedItems('app', 'user', 'campaign_frames', {
      includeSrd: true,
      sort: 'name',
      offset: 0,
      limit: 20,
    });
    expect(result.totalCount).toBeGreaterThan(0);
    expect(result.items.some((item) => item.name === 'THE WITHERWILD')).toBe(true);
  });
});
