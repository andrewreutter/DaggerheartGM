import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mergeUpdatesForInstance } from '../../src/client/lib/v2-merge-element-updates.js';

vi.mock('../../src/client/lib/api.js', () => ({
  postActionNotification: vi.fn(async () => ({})),
  postLifeSupportSelect: vi.fn(async () => ({})),
  postTableOp: vi.fn(),
  postV2OwnedCardChip: vi.fn(async () => ({ ok: true })),
}));

import { postV2OwnedCardChip, postTableOp } from '../../src/client/lib/api.js';
import { runV2OwnedCardChipTableAction } from '../../src/client/lib/v2-owned-card-chip-table.js';
import { buildV2RegistryWithSrdItems } from '../../src/client/lib/v2-declarative-sheet.js';
import { mockCharacter, mockAdversary } from './features-v2/helpers.js';

describe('v2-owned-card-chip-table', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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

  it('player path posts v2-owned-card-chip (full multi-instance apply) instead of postTableOp', async () => {
    const bard = mockCharacter({
      instanceId: 'b1',
      tokenX: 0,
      tokenY: 0,
      hope: 5,
      classId: 'srd-cls-bard',
      name: 'Brix',
    });
    const adv = mockAdversary({
      instanceId: 'adv-1',
      tokenX: 5,
      tokenY: 0,
      difficulty: 14,
      name: 'Goblin',
    });
    const registry = buildV2RegistryWithSrdItems(null);

    await runV2OwnedCardChipTableAction({
      featRow: { name: 'Make a Scene', description: 'Distract' },
      chip: { name: 'Make a Scene' },
      selectOpts: { selectedTargetIds: ['adv-1'] },
      displayEl: bard,
      el: bard,
      activeElementsForV2Snapshots: [bard, adv],
      v2Registry: registry,
      tableFeatureState: {},
      fearCount: 0,
      mapConfig: null,
      tableId: 'table-1',
      isPlayer: true,
    });

    expect(postV2OwnedCardChip).toHaveBeenCalledWith(
      'table-1',
      expect.objectContaining({
        ownerInstanceId: 'b1',
        featureName: 'Make a Scene',
        chipName: 'Make a Scene',
        selectOpts: { selectedTargetIds: ['adv-1'] },
      })
    );
    expect(postTableOp).not.toHaveBeenCalled();
  });
});
