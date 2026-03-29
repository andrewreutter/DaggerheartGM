import { describe, it, expect } from 'vitest';
import { buildDefaultNewSrdLibraryItem } from '../../src/client/lib/library-default-new-item.js';

describe('buildDefaultNewSrdLibraryItem', () => {
  it('sets tier for tier-ranked collections', () => {
    expect(buildDefaultNewSrdLibraryItem('weapons')).toEqual({
      name: '',
      description: '',
      tier: 1,
    });
    expect(buildDefaultNewSrdLibraryItem('environments')).toEqual({
      name: '',
      description: '',
      tier: 1,
      type: 'exploration',
      difficulty: 10,
    });
  });

  it('sets level for abilities', () => {
    expect(buildDefaultNewSrdLibraryItem('abilities')).toEqual({
      name: '',
      description: '',
      level: 1,
    });
  });

  it('uses name and description only for rankMode none', () => {
    expect(buildDefaultNewSrdLibraryItem('classes')).toEqual({
      name: '',
      description: '',
    });
  });
});
