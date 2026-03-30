import { describe, it, expect } from 'vitest';
import {
  getInitialV2ReviewTargetSelection,
  primaryDamageTargetIsInPickList,
} from '../../src/client/lib/v2-review-chip-target-selection.js';

describe('v2-review-chip-target-selection', () => {
  it('Hold Them Off shape: extras only — primary not in list yields [] (do not clear user picks on roll churn)', () => {
    const pickTargets = [
      { instanceId: 'adv-2', name: 'B' },
      { instanceId: 'adv-3', name: 'C' },
    ];
    expect(
      getInitialV2ReviewTargetSelection(pickTargets, {
        needsTargets: true,
        primaryDamageTargetId: 'adv-1',
      })
    ).toEqual([]);
    expect(primaryDamageTargetIsInPickList(pickTargets, 'adv-1')).toBe(false);
  });

  it('when primary is pickable, seed with primary', () => {
    const pickTargets = [{ instanceId: 'adv-1', name: 'A' }];
    expect(
      getInitialV2ReviewTargetSelection(pickTargets, {
        needsTargets: true,
        primaryDamageTargetId: 'adv-1',
      })
    ).toEqual(['adv-1']);
    expect(primaryDamageTargetIsInPickList(pickTargets, 'adv-1')).toBe(true);
  });
});
