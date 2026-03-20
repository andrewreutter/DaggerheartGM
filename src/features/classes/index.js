/**
 * Class features barrel — flat map from feature name to descriptor.
 * Each class file exports a dictionary { 'Feature Name': descriptor }; we merge them here.
 */
import Bard from './Bard.js';
import Druid from './Druid.js';
import Guardian from './Guardian.js';
import Ranger from './Ranger.js';
import Rogue from './Rogue.js';
import Seraph from './Seraph.js';
import Sorcerer from './Sorcerer.js';
import Wizard from './Wizard.js';

const featureDictionaries = [Bard, Druid, Guardian, Ranger, Rogue, Seraph, Sorcerer, Wizard];

/** @type {Record<string, object>} */
const classFeatures = Object.assign({}, ...featureDictionaries);

/**
 * Map feature name → class name (derived from each descriptor's .class).
 * Used when call sites need the class name for a feature (e.g. hope ability lookup by class).
 */
/** @type {Record<string, string>} */
const classFeatureNameToClass = {};
for (const [featureName, descriptor] of Object.entries(classFeatures)) {
  if (descriptor.class) classFeatureNameToClass[featureName] = descriptor.class;
}

export default classFeatures;
export { classFeatureNameToClass };
