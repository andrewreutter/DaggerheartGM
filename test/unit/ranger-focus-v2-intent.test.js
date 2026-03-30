import { describe, it, expect } from 'vitest';
import { applyRangerFocusV2IntentToPending } from '../../src/client/lib/ranger-focus-v2-intent.js';

describe('applyRangerFocusV2IntentToPending', () => {
  it('sets _rangerFocusAttempt and display suffix for Ranger V2 intent toggle', () => {
    const { pendingMeta, displayName } = applyRangerFocusV2IntentToPending({
      pendingMeta: { _attackerInstanceId: 'a' },
      displayName: 'Robin Longbow',
      chip: { _featureName: "Ranger's Focus", isToggle: true, name: "Attempt Ranger's Focus" },
    });
    expect(pendingMeta._rangerFocusAttempt).toBe(true);
    expect(pendingMeta._attackerInstanceId).toBe('a');
    expect(displayName).toBe("Robin Longbow with Ranger's Focus attempt");
  });

  it('does not duplicate suffix when already present', () => {
    const { displayName } = applyRangerFocusV2IntentToPending({
      pendingMeta: {},
      displayName: "X with Ranger's Focus attempt",
      chip: { _featureName: "Ranger's Focus", isToggle: true },
    });
    expect(displayName).toBe("X with Ranger's Focus attempt");
  });

  it('leaves meta and displayName unchanged for other chips', () => {
    const meta = { x: 1 };
    const { pendingMeta, displayName } = applyRangerFocusV2IntentToPending({
      pendingMeta: meta,
      displayName: 'Other',
      chip: { _featureName: 'Devastating', isToggle: true },
    });
    expect(pendingMeta).toBe(meta);
    expect(displayName).toBe('Other');
  });
});
