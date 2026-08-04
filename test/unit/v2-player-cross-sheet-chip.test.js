import { describe, it, expect } from 'vitest';
import { computePlayerV2CrossSheetChipApply } from '../../src/server/v2-player-cross-sheet-chip.js';
import { collectV2CrossSheetChips } from '../../src/client/lib/v2-cross-sheet-lifecycle.js';
import { buildV2RegistryWithSrdItems } from '../../src/client/lib/v2-declarative-sheet.js';
import { mockCharacter } from './features-v2/helpers.js';

describe('computePlayerV2CrossSheetChipApply', () => {
  it('returns 400 when chipKey is missing', () => {
    const ally = mockCharacter({ instanceId: 'c2' });
    const r = computePlayerV2CrossSheetChipApply({
      activeElements: [ally],
      tableState: {},
      viewerInstanceId: 'c2',
      chipKey: '',
    });
    expect(r.ok).toBe(false);
    expect(r.status).toBe(400);
  });

  // After the rollThenResume migration, "Spend Rally Die — Clear Stress" now queues a physical
  // die roll via sheetActionRoll instead of silently applying clearStress. The actual stress clear
  // happens server-side via `onPhysicalRollResolved` after the GM acknowledges the banner.
  it('Rally clear stress: emits sheetActionRoll with _v2PhysicalRollResume (no clearStress in updates)', () => {
    const bard = mockCharacter({ instanceId: 'b1', classId: 'srd-cls-bard' });
    const ally = mockCharacter({ instanceId: 'c2', currentStress: 4 });
    const activeElements = [bard, ally];
    const tableState = {
      featureState: { Rally: { partyDice: { c2: { dice: 'd6' } } } },
      fearCount: 0,
      mapConfig: null,
    };
    const registry = buildV2RegistryWithSrdItems(null);
    const chips = collectV2CrossSheetChips('c2', activeElements, registry, 'card', {
      tableFeatureState: tableState.featureState,
      fearCount: 0,
      mapConfig: null,
    });
    const stressChip = chips.find((c) => c.name === 'Spend Rally Die — Clear Stress');
    expect(stressChip).toBeDefined();
    expect(stressChip._chipKey).toBeDefined();

    const r = computePlayerV2CrossSheetChipApply({
      activeElements,
      tableState,
      viewerInstanceId: 'c2',
      chipKey: stressChip._chipKey,
      rng: () => 0.99,
    });
    expect(r.ok).toBe(true);
    // The chip should produce a sheetActionRoll (physical die), not immediate clearStress updates.
    expect(r.sheetActionRolls).toBeDefined();
    expect(r.sheetActionRolls.length).toBe(1);
    const physRoll = r.sheetActionRolls[0];
    expect(physRoll.rollText).toBe('[d6]');
    expect(physRoll.rollMeta?._v2PhysicalRollResume).toBeDefined();
    expect(physRoll.rollMeta._v2PhysicalRollResume.featureName).toBe('Rally');
    expect(physRoll.rollMeta._v2PhysicalRollResume.meInstanceId).toBe('c2');
    // No immediate clearStress in updates (deferred to onPhysicalRollResolved).
    const clear = r.updates.find((u) => u.instanceId === 'c2' && u.updates.currentStress !== undefined);
    expect(clear).toBeUndefined();
  });
});
