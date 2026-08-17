import { describe, it, expect } from 'vitest';
import { planSrdCollectionCacheSync } from '../../src/srd-loader.js';

describe('planSrdCollectionCacheSync', () => {
  it('skips overwrite of admin-edited rows and replaces unedited ones', () => {
    const { upserts, deleteIds } = planSrdCollectionCacheSync(
      [
        { external_id: 'srd-adv-bear', data: { name: 'Bear (admin)', _adminEditedAt: '2026-08-01T00:00:00.000Z' } },
        { external_id: 'srd-adv-wolf', data: { name: 'Wolf' } },
      ],
      [
        { id: 'srd-adv-bear', name: 'Bear' },
        { id: 'srd-adv-wolf', name: 'Dire Wolf' },
      ],
    );
    expect(upserts.map((i) => i.id)).toEqual(['srd-adv-wolf']);
    expect(deleteIds).toEqual([]);
  });

  it('deletes leftover non-admin-edited ids and keeps admin-edited leftovers', () => {
    const { upserts, deleteIds } = planSrdCollectionCacheSync(
      [
        { external_id: 'srd-adv-gone', data: { name: 'Gone' } },
        { external_id: 'srd-adv-kept', data: { name: 'Kept', _adminEditedAt: '2026-08-01T00:00:00.000Z' } },
      ],
      [{ id: 'srd-adv-new', name: 'New' }],
    );
    expect(upserts.map((i) => i.id)).toEqual(['srd-adv-new']);
    expect(deleteIds).toEqual(['srd-adv-gone']);
  });
});
