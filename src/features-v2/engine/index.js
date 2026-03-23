/**
 * V2 Feature Engine — Public API
 *
 * Re-exports everything from the engine modules as a single entry point.
 */

export {
  when,
  isActing,
  isTargeted,
  againstYou,
  anAttackSucceeds,
  youSucceedOnAnAttack,
  againstATargetInMeleeRange,
  againstATargetWithinMeleeRange,
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
  evaluateIsDisabled,
  canPayChipCosts,
  describeChipResourceBlock,
  getChipDisableHint,
  deductChipCosts,
  trackChipFrequency,
  resetChipFrequency,
  makeChipState,
} from './chip-system.js';
export {
  createActionLoop,
  collectPhaseChipsOnly,
  shouldIncludePhaseChipForViewer,
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
  advantageTriggersFromBeastformRow,
  parseBeastformAttackLine,
} from './feature-loader.js';
export { findWeaponDamageDieForPool } from './weapon-damage-die.js';
