/**
 * Community features barrel.
 *
 * Each community file exports a dictionary of feature hooks: { 'Feature Name': { ...hooks } }.
 * Name/description come from the SRD. The barrel merges into communityFeatureMap and communityMap.
 */

import Highborne from './Highborne.js';
import Loreborne from './Loreborne.js';
import Orderborne from './Orderborne.js';
import Ridgeborne from './Ridgeborne.js';
import Seaborne from './Seaborne.js';
import Slyborne from './Slyborne.js';
import Underborne from './Underborne.js';
import Wanderborne from './Wanderborne.js';
import Wildborne from './Wildborne.js';

/** [communityName, featureDict] for each file */
const communityModules = [
  ['Highborne', Highborne],
  ['Loreborne', Loreborne],
  ['Orderborne', Orderborne],
  ['Ridgeborne', Ridgeborne],
  ['Seaborne', Seaborne],
  ['Slyborne', Slyborne],
  ['Underborne', Underborne],
  ['Wanderborne', Wanderborne],
  ['Wildborne', Wildborne],
];

/** @type {Record<string, object>} feature name → descriptor */
const communityFeatureMap = {};

/**
 * @type {Record<string, { name: string, description: string, features: object[] }>}
 * community name → community descriptor with ordered feature list
 */
export const communityMap = {};

for (const [communityName, featureDict] of communityModules) {
  const features = [];

  for (const [featureName, hooks] of Object.entries(featureDict)) {
    const descriptor = {
      name: featureName,
      sourceType: 'community',
      source: communityName,
      ...hooks,
    };
    communityFeatureMap[featureName] = descriptor;
    features.push(descriptor);
  }

  communityMap[communityName] = {
    name: communityName,
    description: '',
    features,
  };
}

export default communityFeatureMap;
