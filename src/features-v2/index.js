/**
 * V2 Feature System — Public Entry Point
 *
 * Re-exports the engine API and the registry so consumers can import from a
 * single location.
 *
 * Usage:
 *   import { buildTableSnapshot, when, isActing, createActionLoop } from 'src/features-v2';
 *   import registry from 'src/features-v2';
 */

// Engine
export {
  when,
  isActing,
  isTargeted,
  isWhen,
  unwrap,
  unwrapAll,
  buildTableSnapshot,
  applyMutations,
  collectChips,
  activateChip,
  deductChipCosts,
  trackChipFrequency,
  resetChipFrequency,
  makeChipState,
  createActionLoop,
  loadCharacterFeatures,
  applyDeclarativeFeatures,
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
} from './registry.js';
