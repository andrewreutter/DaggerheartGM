/**
 * Player-only V2 cross-sheet chip activation (e.g. Bard Rally “Clear Stress” on an ally’s sheet).
 * Recomputes engine mutations from `chipKey` — same logic as GM `CharacterHoverCard` + `postTableOp`.
 */

import { activateV2CrossSheetChip, collectV2CrossSheetChips } from '../client/lib/v2-cross-sheet-lifecycle.js';
import { applyV2LifecycleMutations } from '../client/lib/table-ops.js';
import { buildV2RegistryWithSrdItems } from '../client/lib/v2-declarative-sheet.js';

/**
 * @param {{
 *   activeElements: object[],
 *   tableState: object,
 *   viewerInstanceId: string,
 *   chipKey: string,
 *   rng?: () => number,
 * }} params
 * @returns {{ ok: true, updates: { instanceId: string, updates: object }[], actionLoopNotifications: object[] } | { ok: false, status: number, error: string }}
 */
export function computePlayerV2CrossSheetChipApply(params) {
  const { activeElements, tableState, viewerInstanceId, chipKey, rng } = params || {};
  const key = chipKey != null ? String(chipKey).trim() : '';
  if (!viewerInstanceId || !key) {
    return { ok: false, status: 400, error: 'viewerInstanceId and chipKey required' };
  }
  if (!Array.isArray(activeElements)) {
    return { ok: false, status: 400, error: 'activeElements required' };
  }

  const registry = buildV2RegistryWithSrdItems(null);
  const fearCount = tableState?.fearCount ?? 0;
  const mapConfig = tableState?.mapConfig ?? null;
  const tableFeatureState = tableState?.featureState;

  const chips = collectV2CrossSheetChips(viewerInstanceId, activeElements, registry, 'card', {
    tableFeatureState,
    fearCount,
    mapConfig,
  });
  const chip = chips.find((c) => c._chipKey === key);
  if (!chip) {
    return { ok: false, status: 400, error: 'Chip not available' };
  }
  if (chip.disabled || chip.resourceUnaffordable) {
    return { ok: false, status: 400, error: chip.disableHint || 'Chip unavailable' };
  }

  const activated = activateV2CrossSheetChip(chip, viewerInstanceId, activeElements, registry, {
    tableFeatureState,
    fearCount,
    mapConfig,
    ...(typeof rng === 'function' ? { rng } : {}),
  });
  if (activated.error) {
    return { ok: false, status: 400, error: activated.error };
  }
  const { mutations } = activated;
  if (!mutations?.length) {
    return { ok: false, status: 400, error: 'No effect' };
  }

  const { updates, actionLoopNotifications } = applyV2LifecycleMutations(
    activeElements,
    mutations,
    chip._ownerInstanceId
  );

  return { ok: true, updates, actionLoopNotifications };
}
