/**
 * V2 Feature System — Public Entry Point
 *
 * Re-exports the engine API and the registry so consumers can import from a
 * single location.
 *
 * Usage:
 *   import { buildTableSnapshot, when, isActing, createActionLoop, dispatchStateChangeHooks } from 'src/features-v2';
 *   import registry from 'src/features-v2';
 */

// Engine
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
  buildTableSnapshot,
  applyMutations,
  collectChips,
  activateChip,
  resolveChipDisabled,
  evaluateIsDisabled,
  deductChipCosts,
  trackChipFrequency,
  resetChipFrequency,
  makeChipState,
  createActionLoop,
  dispatchStateChangeHooks,
  findWeaponDamageDieForPool,
  loadCharacterFeatures,
  applyDeclarativeFeatures,
  mergeDeclarativeFeatureState,
  attachBeastformOptions,
  parseBeastformStatBonus,
  advantageTriggersFromBeastformRow,
  parseBeastformAttackLine,
  loadAdversaryFeatures,
  mergeAdversaryV2Overlay,
} from './engine/index.js';

// Registry
export { default as registry } from './registry.js';
export {
  ancestries,
  communities,
  classes,
  subclasses,
  weapon_properties,
  armor_properties,
  abilities,
  beastforms,
  items,
  consumables,
  adversary_features,
} from './registry.js';
