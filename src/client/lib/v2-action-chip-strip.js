import {
  evaluateIsDisabled,
  describeChipResourceBlock,
  resolveChipDisabled,
} from '../../features-v2/engine/chip-system.js';
import { buildFeatureCardModelForCharacter } from './build-feature-card-model.js';
import { getFrequencyCycleWord } from './frequency-cycle-ui.jsx';

/**
 * @param {object} chip — raw card chip from model
 * @param {object} model — from {@link buildFeatureCardModelForCharacter}
 * @param {object} table — engine table snapshot
 * @returns {{ chipForEngine: object, resolvedName: string }}
 */
export function resolveActionChipSlotContext(chip, model, table) {
  const baseName = chip.name || model.displayName;
  const resolvedName = typeof baseName === 'function' ? baseName(table) : baseName;
  const chipForEngine = { ...chip, name: resolvedName };
  return { chipForEngine, resolvedName };
}

/**
 * Whether a V2 action card chip belongs in the "Used, inapplicable, or too costly" subsection
 * (sheet Actions strip / expanded card chip rows) vs the primary chip row.
 *
 * @param {object} params
 * @param {boolean} params.usedThisCycle — frequency-gated chip already used this session/rest/long-rest cycle
 * @param {boolean} params.resourceUnaffordable — engine: Hope/Stress/Armor costs cannot be paid
 * @param {boolean} params.logicDisabled — engine {@link resolveChipDisabled} / inapplicable predicates
 */
export function shouldMoveV2ActionChipToUnusableSubsection({
  usedThisCycle,
  resourceUnaffordable,
  logicDisabled = false,
}) {
  return !!(usedThisCycle || resourceUnaffordable || logicDisabled);
}

/**
 * Primary human-readable line for why a chip is in the unusable subsection (tooltip header).
 * Order: refresh restriction → resource block → isDisabled message / fallbacks.
 *
 * @param {object} params
 * @param {object} params.chipForEngine — chip with resolved `name`
 * @param {object} params.table
 * @param {boolean} params.chipUsed
 * @param {string|null} params.usedHint
 * @param {boolean} params.resourceUnaffordable
 * @param {boolean} params.logicDisabled
 * @returns {string|null}
 */
export function getActionChipUnusablePrimaryLine({
  chipForEngine,
  table,
  chipUsed,
  usedHint,
  resourceUnaffordable,
  logicDisabled,
}) {
  if (chipUsed && usedHint) return usedHint;
  if (resourceUnaffordable) {
    return describeChipResourceBlock(chipForEngine, table) || 'Cannot pay resource costs.';
  }
  if (logicDisabled) {
    const ev = evaluateIsDisabled(chipForEngine, table);
    if (ev.message) return ev.message;
    const dr = chipForEngine.disabledReason;
    if (typeof dr === 'function') {
      const s = dr(table);
      if (s && String(s).trim()) return String(s).trim();
    } else if (typeof dr === 'string' && dr.trim()) return dr.trim();
    return 'Unavailable right now.';
  }
  return null;
}

/**
 * @param {object} chip
 * @param {object} model
 * @param {object} table
 * @param {object} el — character element
 * @param {string} effectiveKey — feature usage key
 * @returns {object} Fields for one Actions strip chip slot
 */
export function computeActionChipUnusableState(chip, model, table, el, effectiveKey) {
  const { chipForEngine, resolvedName } = resolveActionChipSlotContext(chip, model, table);
  const isUsed = !!(el?.featureUsage?.[effectiveKey]?.used);
  const chipUsed = !!(chip.frequency && isUsed);
  const resourceUnaffordable = !!chip.resourceUnaffordable;
  const logicDisabled = resolveChipDisabled(chipForEngine, table);
  const moveToUnusable = shouldMoveV2ActionChipToUnusableSubsection({
    usedThisCycle: chipUsed,
    resourceUnaffordable,
    logicDisabled,
  });
  let usedHint = null;
  if (chipUsed && chip.frequency) {
    const word = getFrequencyCycleWord(chip.frequency);
    usedHint = `Already used (${word || chip.frequency}).`;
  }
  const primaryUnusableLine = moveToUnusable
    ? getActionChipUnusablePrimaryLine({
        chipForEngine,
        table,
        chipUsed,
        usedHint,
        resourceUnaffordable,
        logicDisabled,
      })
    : null;

  return {
    chipForEngine,
    resolvedName,
    chipUsed,
    resourceUnaffordable,
    logicDisabled,
    moveToUnusable,
    usedHint,
    primaryUnusableLine,
  };
}

/**
 * One slot per card chip across guide/loadout entries (sheet Actions strip).
 *
 * @param {Array<{ row: object, key: string, kind?: string, ability?: object }>} entries
 * @returns {Array<{ entry: object, chipIndex: number, model: object, table: object, effectiveKey: string } & ReturnType<typeof computeActionChipUnusableState>>}
 */
export function buildActionChipSlotsForSheet(entries, el, v2TableContext) {
  const slots = [];
  if (!entries?.length) return slots;
  for (const entry of entries) {
    const { model, table } = buildFeatureCardModelForCharacter(entry.row, el, v2TableContext);
    const effectiveKey = entry.key || model.name;
    const n = model.cardChips?.length ?? 0;
    for (let i = 0; i < n; i++) {
      const chip = model.cardChips[i];
      const state = computeActionChipUnusableState(chip, model, table, el, effectiveKey);
      slots.push({ entry, chipIndex: i, model, table, effectiveKey, ...state });
    }
  }
  return slots;
}

/**
 * Whether the sheet Actions strip should show the global "Used, inapplicable, or too costly" block
 * (at least one chip is used-this-cycle, unaffordable, or logic-disabled). Mirrors {@link GuideFeatureCardChips} placement rules.
 *
 * @param {Array<{ row: object, key: string }>} entries — guide or loadout entries with card chips
 */
export function hasAnyUnusableActionChipsForSheet(entries, el, v2TableContext) {
  return buildActionChipSlotsForSheet(entries, el, v2TableContext).some((s) => s.moveToUnusable);
}

/** True if this guide/loadout row contributes at least one used-, unaffordable-, or logic-disabled chip. */
export function entryHasUnusableActionChipsForSheet(entry, el, v2TableContext) {
  return hasAnyUnusableActionChipsForSheet([entry], el, v2TableContext);
}

/**
 * Sheet Actions strip (`CharacterFeatureActionsBody`): both the primary chip row and the
 * "Used, inapplicable, or too costly" row must use the same intrinsic-width layout so
 * `isSelect` / `selectTargets` segmented chips do not stretch wider in one subsection.
 *
 * @param {'full'|'activeOnly'|'unusableOnly'} stripSlot — {@link GuideFeatureCardChips} `stripSlot`
 * @returns {boolean}
 */
export function shouldUseIntrinsicWidthForActionsStripSlot(stripSlot) {
  return stripSlot === 'activeOnly' || stripSlot === 'unusableOnly';
}
