import { describe, it, expect } from 'vitest';
import { mergeUpdatesForInstance } from '../../src/client/lib/v2-merge-element-updates.js';

describe('v2-owned-card-chip-table', () => {
  it('mergeUpdatesForInstance shallow-merges rows for the same instance', () => {
    const updates = [
      { instanceId: 'pc-1', updates: { hope: 3, featureState: { A: { x: 1 } } } },
      { instanceId: 'pc-1', updates: { currentStress: 2 } },
      { instanceId: 'other', updates: { hope: 99 } },
    ];
    expect(mergeUpdatesForInstance(updates, 'pc-1')).toEqual({
      hope: 3,
      featureState: { A: { x: 1 } },
      currentStress: 2,
    });
  });
});
