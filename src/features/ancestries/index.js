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
 * stressCost/hopeCost are applied to the attacker (self) on acknowledge; onAcknowledge runs after.
 * Populated at module load by running onCharacterRender hooks against a mock context.
 * @type {Record<string, { onAcknowledge?: Function, stressCost?: number, hopeCost?: number }>}
 */
export const virtualWeaponBehaviors = {};

for (const builder of builders) {
  const features = [];
  let lastFeatureName = null;

  const char = {
    addFeature(name, description, hooks = {}) {
      lastFeatureName = name;
      const { onCharacterEdit, ...restHooks } = hooks;
      const descriptor = {
        name,
        description,
        ancestry: builder.name,
        sourceType: 'ancestry',
        source: builder.name,
        ...restHooks,
      };

      // Pre-capture static behaviors from onCharacterRender at module load time.
      // This extracts virtualWeaponBehaviors (onAcknowledge) and advantageTrigger
      // without requiring a live character object.
      if (hooks.onCharacterRender) {
        const mockCtx = {
          weapons: [],
          _currentFeatureName: name,
          addStatMod() {},
          addThresholdBonus() {},
          addAdvantageTrigger(condition) { descriptor.advantageTrigger = condition; },
          addVirtualWeapon(vw) {
            if (vw.onAcknowledge || vw.stressCost != null || vw.hopeCost != null) {
              virtualWeaponBehaviors[name] = {
                onAcknowledge: vw.onAcknowledge,
                stressCost: vw.stressCost,
                hopeCost: vw.hopeCost,
              };
            }
          },
        };
        try { hooks.onCharacterRender(mockCtx); } catch { /* no-op if hook errors without real char data */ }
      }

      // Pre-capture card chips from onCard (e.g. Fungril Death Connection).
      // Chips display on the feature card; click runs onUse(context); context.postAction() posts a banner; GM ack applies costs.
      if (hooks.onCard) {
        const cardChips = [];
        const card = { addChip(d) { cardChips.push(d); } };
        try { hooks.onCard(card); } catch { /* no-op */ }
        if (cardChips.length) descriptor.cardChips = cardChips;
      }

      featureMap[name] = descriptor;
      features.push(descriptor);
      if (typeof onCharacterEdit === 'function') {
        try { onCharacterEdit(char); } catch { /* no-op */ }
      }
    },
    addExperienceBonus(amount) {
      if (lastFeatureName != null && ancestryEntry) {
        ancestryEntry.experienceBonus = { amount, featureName: lastFeatureName };
      }
    },
  };

  const ancestryEntry = {
    name: builder.name,
    description: builder.description,
    features,
  };
  builder.onCharacterBuild(char);
  ancestryMap[builder.name] = ancestryEntry;
}

/** Feature name → feature descriptor (backward-compatible default export). */
export default featureMap;
