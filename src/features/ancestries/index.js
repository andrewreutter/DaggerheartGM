/**
 * Ancestry features barrel.
 *
 * Each ancestry file exports { name, description, features: [{ name, description, ...hooks }] }.
 * The barrel iterates builder.features and registers each via addFeature. Descriptors go to
 * featureMap and the ancestry's features array. ancestryMap holds { name, description, features } per ancestry.
 */

import { createFeatureBuilder } from '../add-feature.js';
import Infernis from './Infernis.js';
import Katari   from './Katari.js';
import Giant    from './Giant.js';
import Faun     from './Faun.js';
import Dwarf    from './Dwarf.js';
import Drakona  from './Drakona.js';
import Clank    from './Clank.js';
import Elf      from './Elf.js';
import Simiah   from './Simiah.js';
import Fungril  from './Fungril.js';
import Orc      from './Orc.js';
import Human    from './Human.js';
import Halfling from './Halfling.js';
import Galapa   from './Galapa.js';
import Ribbet   from './Ribbet.js';
import Faerie   from './Faerie.js';
import Goblin   from './Goblin.js';
import Firbolg  from './Firbolg.js';

const builders = [Infernis, Katari, Giant, Faun, Dwarf, Drakona, Clank, Elf, Simiah, Fungril, Orc, Human, Halfling, Galapa, Ribbet, Faerie, Goblin, Firbolg];

/** @type {Record<string, object>} feature name → full feature descriptor */
const featureMap = {};

/**
 * @type {Record<string, { name: string, description: string, features: object[] }>}
 * ancestry name → ancestry descriptor with ordered feature list
 */
export const ancestryMap = {};

/**
 * Feature name → { onAcknowledge?, stressCost?, hopeCost? } for virtual weapons.
 * Populated at module load by running onCharacterRender hooks against a mock context.
 * @type {Record<string, { onAcknowledge?: Function, stressCost?: number, hopeCost?: number }>}
 */
export const virtualWeaponBehaviors = {};

for (const builder of builders) {
  const features = [];
  const ancestryEntry = {
    name: builder.name,
    description: builder.description,
    features,
  };

  const char = createFeatureBuilder({
    targetMap: featureMap,
    featureList: features,
    sourceType: 'ancestry',
    source: builder.name,
    virtualWeaponBehaviors,
    ancestryEntry,
    onAfterAdd(descriptor, hooks, charRef) {
      if (typeof hooks.onCharacterEdit === 'function') {
        hooks.onCharacterEdit(charRef);
      }
    },
  });

  for (const { name, description, ...hooks } of builder.features) {
    char.addFeature(name, description, hooks);
  }
  ancestryMap[builder.name] = ancestryEntry;
}

/** Feature name → feature descriptor (backward-compatible default export). */
export default featureMap;
