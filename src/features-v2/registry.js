/**
 * V2 Feature Registry
 *
 * Imports all feature collection barrel files and re-exports them as a single
 * registry object. Pass this registry to `loadCharacterFeatures` from the
 * engine to resolve features for any character.
 *
 * Each barrel exports a default object: { [featureId]: featureDescriptor }.
 * The registry is keyed by collection name (matching the keys used in
 * character data: classId, subclassId, ancestryId, communityId, etc.).
 */

import ancestries from './ancestries/index.js';
import communities from './communities/index.js';
import classes from './classes/index.js';
import subclasses from './subclasses/index.js';
import weapon_properties from './weapon_properties/index.js';
import armor_properties from './armor_properties/index.js';
import abilities from './abilities/index.js';
import beastforms from './beastforms/index.js';
import items from './items/index.js';
import consumables from './consumables/index.js';
import { LEGACY_CHARACTER_RUNTIME_MIGRATIONS } from './legacy-character-runtime-migrations.js';

const registry = {
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
  /** @type {typeof LEGACY_CHARACTER_RUNTIME_MIGRATIONS} */
  legacyCharacterRuntimeMigrations: LEGACY_CHARACTER_RUNTIME_MIGRATIONS,
};

export default registry;
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
};
