import { describe, it, expect } from 'vitest';
import { resolveLibraryItemDeepLink } from '../../src/client/lib/library-item-deep-link.js';

const scene = { id: 'scene-new', name: 'Bandit Ambush' };

describe('resolveLibraryItemDeepLink', () => {
  it('ignores missing and new-item routes', () => {
    expect(resolveLibraryItemDeepLink({ itemId: null }).action).toBe('ignore');
    expect(resolveLibraryItemDeepLink({ itemId: 'new' }).action).toBe('ignore');
  });

  it('opens when the item is already in the displayed list', () => {
    const result = resolveLibraryItemDeepLink({
      itemId: scene.id,
      items: [scene],
      isPaginated: true,
    });
    expect(result).toEqual({ action: 'open', item: scene });
  });

  it('opens a just-saved item from the app bag and asks for a list refresh', () => {
    // Create Scene → saveItem writes data.scenes; LibraryView still shows stale search.items.
    const result = resolveLibraryItemDeepLink({
      itemId: scene.id,
      items: [{ id: 'older-scene' }],
      fallbackItems: [scene],
      loading: false,
      isPaginated: true,
    });
    expect(result).toEqual({ action: 'open-and-refresh', item: scene });
  });

  it('waits while a paginated search is in flight', () => {
    expect(resolveLibraryItemDeepLink({
      itemId: scene.id,
      items: [],
      loading: true,
      isPaginated: true,
    }).action).toBe('wait');
  });

  it('refreshes a stale paginated list instead of treating a miss as deleted', () => {
    // Hidden LibraryView already loaded scenes; Game Table just saved a new one.
    expect(resolveLibraryItemDeepLink({
      itemId: scene.id,
      items: [{ id: 'older-scene' }],
      fallbackItems: [],
      loading: false,
      isPaginated: true,
      refreshAttempted: false,
    }).action).toBe('refresh');
  });

  it('leaves only after a refresh still cannot find the item', () => {
    expect(resolveLibraryItemDeepLink({
      itemId: scene.id,
      items: [{ id: 'older-scene' }],
      loading: false,
      isPaginated: true,
      refreshAttempted: true,
    }).action).toBe('leave');
  });

  it('keeps an already-open modal when the list slot was evicted', () => {
    expect(resolveLibraryItemDeepLink({
      itemId: scene.id,
      items: [],
      loading: false,
      isPaginated: true,
      refreshAttempted: true,
      modalItemId: scene.id,
    }).action).toBe('keep-modal');
  });

  it('waits for a non-paginated first load', () => {
    expect(resolveLibraryItemDeepLink({
      itemId: 'adv-1',
      items: [],
      isPaginated: false,
      nonPaginatedReady: false,
    }).action).toBe('wait');
  });

  it('leaves a missing non-paginated item once the tab is ready', () => {
    expect(resolveLibraryItemDeepLink({
      itemId: 'gone',
      items: [{ id: 'other' }],
      isPaginated: false,
      nonPaginatedReady: true,
    }).action).toBe('leave');
  });
});
