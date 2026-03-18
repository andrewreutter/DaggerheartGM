/**
 * Community features barrel.
 *
 * Same builder shape as ancestries: { name, description, onCharacterBuild(char) }.
 * Each descriptor gets sourceType: 'community' and source: builder.name for badges and state keys.
 * Community features are merged with ancestry features into the unified origin registry.
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

const builders = [Highborne, Loreborne, Orderborne, Ridgeborne, Seaborne, Slyborne, Underborne, Wanderborne, Wildborne];

/** @type {Record<string, object>} feature name → descriptor (sourceType: 'community', source: community name) */
const communityFeatureMap = {};

/**
 * @type {Record<string, { name: string, description: string, features: object[] }>}
 * community name → community descriptor with ordered feature list
 */
export const communityMap = {};

for (const builder of builders) {
  const features = [];

  const char = {
    addFeature(name, description, hooks = {}) {
      const descriptor = {
        name,
        description,
        sourceType: 'community',
        source: builder.name,
        ...hooks,
      };

      if (hooks.onCharacterRender) {
        const mockCtx = {
          addStatMod() {},
          addAdvantageTrigger(condition) { descriptor.advantageTrigger = condition; },
          addVirtualWeapon() {},
        };
        try { hooks.onCharacterRender(mockCtx); } catch { /* no-op */ }
      }

      if (hooks.onCard) {
        const cardChips = [];
        const card = { addChip(d) { cardChips.push(d); } };
        try { hooks.onCard(card); } catch { /* no-op */ }
        if (cardChips.length) descriptor.cardChips = cardChips;
      }

      communityFeatureMap[name] = descriptor;
      features.push(descriptor);
    },
  };

  const communityEntry = {
    name: builder.name,
    description: builder.description,
    features,
  };
  builder.onCharacterBuild(char);
  communityMap[builder.name] = communityEntry;
}

export default communityFeatureMap;
