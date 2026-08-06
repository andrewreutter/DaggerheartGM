import { describe, expect, it, vi } from 'vitest';
import { buildAddToItemTargets } from '../../src/client/lib/add-to-item-targets.js';

describe('buildAddToItemTargets', () => {
  it('returns an empty array when no editable item is registered', () => {
    expect(buildAddToItemTargets(null)).toEqual([]);
    expect(buildAddToItemTargets(undefined)).toEqual([]);
  });

  it('returns just the primary target when there are no extra targets', () => {
    const onAddImageUrl = vi.fn();
    const targets = buildAddToItemTargets({ name: 'Fenris', onAddImageUrl });
    expect(targets).toEqual([{ key: 'primary', label: 'Fenris', onAddImageUrl }]);
  });

  it('appends extraTargets after the primary target (e.g. a companion)', () => {
    const onAddImageUrl = vi.fn();
    const onAddCompanionImageUrl = vi.fn();
    const targets = buildAddToItemTargets({
      name: 'Fenris',
      onAddImageUrl,
      extraTargets: [{ key: 'companion', label: 'Shadow', onAddImageUrl: onAddCompanionImageUrl }],
    });
    expect(targets).toEqual([
      { key: 'primary', label: 'Fenris', onAddImageUrl },
      { key: 'companion', label: 'Shadow', onAddImageUrl: onAddCompanionImageUrl },
    ]);
  });

  it('omits the primary target when the item has no onAddImageUrl callback', () => {
    const onAddCompanionImageUrl = vi.fn();
    const targets = buildAddToItemTargets({
      name: 'Fenris',
      extraTargets: [{ key: 'companion', label: 'Shadow', onAddImageUrl: onAddCompanionImageUrl }],
    });
    expect(targets).toEqual([{ key: 'companion', label: 'Shadow', onAddImageUrl: onAddCompanionImageUrl }]);
  });

  it('filters out malformed extra targets missing a callback', () => {
    const onAddImageUrl = vi.fn();
    const targets = buildAddToItemTargets({
      name: 'Fenris',
      onAddImageUrl,
      extraTargets: [{ key: 'companion', label: 'Shadow' }, null, { key: 'broken' }],
    });
    expect(targets).toEqual([{ key: 'primary', label: 'Fenris', onAddImageUrl }]);
  });
});
