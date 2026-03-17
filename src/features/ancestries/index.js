/**
 * Ancestry features barrel.
 *
 * Each ancestry file exports a builder object:
 *   { name, description, onCharacterBuild(char) }
 *
 * The barrel runs every builder once at module load. `char.addFeature(name, description, hooks?)`
 * accumulates feature descriptors into two output maps:
 *
 *   featureMap   — { [featureName]: featureDescriptor }  (backward-compatible default export)
 *   ancestryMap  — { [ancestryName]: { name, description, features: [...] } }
 *
 * For fully-implemented ancestries, character-calc.js reads from ancestryMap instead of SRD data,
 * so the SRD JSON is not consulted for feature names/descriptions at character-render time.
 */

import Infernis from './Infernis.js';
import Katari   from './Katari.js';
import Giant    from './Giant.js';
import Faun     from './Faun.js';
import Dwarf    from './Dwarf.js';

const builders = [Infernis, Katari, Giant, Faun, Dwarf];

/** @type {Record<string, object>} feature name → full feature descriptor */
const featureMap = {};

/**
 * @type {Record<string, { name: string, description: string, features: object[] }>}
 * ancestry name → ancestry descriptor with ordered feature list
 */
export const ancestryMap = {};

/**
 * Feature name → { onAcknowledge } for virtual weapons that need a custom acknowledge callback.
 * Populated at module load by running onCharacterRender hooks against a mock context.
 * @type {Record<string, { onAcknowledge: Function }>}
 */
export const virtualWeaponBehaviors = {};

for (const builder of builders) {
  const features = [];

  const char = {
    addFeature(name, description, hooks = {}) {
      const descriptor = {
        name,
        description,
        ancestry: builder.name,
        ...hooks,
      };

      // Pre-capture static behaviors from onCharacterRender at module load time.
      // This extracts virtualWeaponBehaviors (onAcknowledge) and advantageTrigger
      // without requiring a live character object.
      if (hooks.onCharacterRender) {
        const mockCtx = {
          weapons: [],
          _currentFeatureName: name,
          addStatMod() {},
          addAdvantageTrigger(condition) { descriptor.advantageTrigger = condition; },
          addVirtualWeapon(vw) {
            if (vw.onAcknowledge) virtualWeaponBehaviors[name] = { onAcknowledge: vw.onAcknowledge };
          },
        };
        try { hooks.onCharacterRender(mockCtx); } catch { /* no-op if hook errors without real char data */ }
      }

      featureMap[name] = descriptor;
      features.push(descriptor);
    },
  };

  builder.onCharacterBuild(char);

  ancestryMap[builder.name] = {
    name: builder.name,
    description: builder.description,
    features,
  };
}

/** Feature name → feature descriptor (backward-compatible default export). */
export default featureMap;
