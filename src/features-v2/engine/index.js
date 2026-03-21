/**
 * V2 Feature Engine — Public API
 *
 * Re-exports everything from the engine modules as a single entry point.
 */

export {
  when,
  isActing,
  isTargeted,
  armorUseCommitted,
  isWhen,
  unwrap,
  unwrapAll,
} from './when.js';
export { buildTableSnapshot, applyMutations } from './table.js';
export {
  collectChips,
  activateChip,
  resolveChipDisabled,
  deductChipCosts,
  trackChipFrequency,
  resetChipFrequency,
  makeChipState,
} from './chip-system.js';
export { createActionLoop, dispatchStateChangeHooks } from './action-loop.js';
export {
  loadCharacterFeatures,
  applyDeclarativeFeatures,
  mergeDeclarativeFeatureState,
} from './feature-loader.js';
