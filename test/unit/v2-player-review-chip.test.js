import { describe, it, expect } from 'vitest';
import { computePlayerV2ReviewChipApply } from '../../src/server/v2-player-review-chip.js';

describe('computePlayerV2ReviewChipApply', () => {
  it('returns 400 when activationKey is missing', () => {
    const r = computePlayerV2ReviewChipApply({
      activeElements: [],
      tableState: {},
      viewerInstanceId: 'pc-1',
      roll: { _attackerInstanceId: 'pc-1' },
      activationKey: '',
      srdData: { weaponsById: {}, armorById: {} },
    });
    expect(r.ok).toBe(false);
    expect(r.status).toBe(400);
  });
});
