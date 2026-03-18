/**
 * Community features barrel.
 *
 * Same builder shape as ancestries: { name, description, onCharacterBuild(char) }.
 * Uses shared createFeatureBuilder; descriptors get sourceType: 'community' and source: builder.name.
 */

import { createFeatureBuilder } from '../add-feature.js';
import Highborne from './Highborne.js';
import Loreborne from './Loreborne.js';
import Orderborne from './Orderborne.js';
import Ridgeborne from './Ridgeborne.js';
import Seaborne from './Seaborne.js';
import Slyborne from './Slyborne.js';
import Underborne from './Underborne.js';
import Wanderborne from './Wanderborne.js';
import Wildborne from './Wildborne.js';

const builders = [Highborne, Loreborne, Orderborne, Ridgeborne, Seaborne, Slyborne, Underborne, Wanderborne, Wildborne];

/** @type {Record<string, object>} feature name → descriptor */
const communityFeatureMap = {};

/**
 * @type {Record<string, { name: string, description: string, features: object[] }>}
 * community name → community descriptor with ordered feature list
 */
export const communityMap = {};

for (const builder of builders) {
  const features = [];
  const communityEntry = {
    name: builder.name,
    description: builder.description,
    features,
  };

  const char = createFeatureBuilder({
    targetMap: communityFeatureMap,
    featureList: features,
    sourceType: 'community',
    source: builder.name,
  });

  builder.onCharacterBuild(char);
  communityMap[builder.name] = communityEntry;
}

export default communityFeatureMap;
