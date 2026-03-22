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
  collectChipsForOtherCharacterSheets,
  activateChip,
  resolveChipDisabled,
  deductChipCosts,
  trackChipFrequency,
  resetChipFrequency,
  makeChipState,
} from './chip-system.js';
export {
  createActionLoop,
  collectPhaseChipsOnly,
  mergeGameStateWithActionConfig,
  dispatchStateChangeHooks,
  dispatchSceneEndHooks,
  dispatchTokenMoveHooks,
} from './action-loop.js';
export {
  loadCharacterFeatures,
  applyDeclarativeFeatures,
  mergeDeclarativeFeatureState,
  attachBeastformOptions,
  parseBeastformStatBonus,
  parseBeastformAttackLine,
} from './feature-loader.js';
export { findWeaponDamageDieForPool } from './weapon-damage-die.js';
