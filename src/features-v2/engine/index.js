/**
 * V2 Feature Engine — Public API
 *
 * Re-exports everything from the engine modules as a single entry point.
 */

export { when, isActing, isTargeted, isWhen, unwrap, unwrapAll } from './when.js';
export { buildTableSnapshot, applyMutations } from './table.js';
export {
  collectChips,
  activateChip,
  deductChipCosts,
  trackChipFrequency,
  resetChipFrequency,
  makeChipState,
} from './chip-system.js';
export { createActionLoop } from './action-loop.js';
export { loadCharacterFeatures, applyDeclarativeFeatures } from './feature-loader.js';
