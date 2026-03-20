/**
 * Ancestry features barrel.
 *
 * Each ancestry file exports a dictionary of feature hooks: { 'Feature Name': { ...hooks } }.
 * Name/description come from the SRD. The barrel merges into featureMap and ancestryMap.
 * Features with virtualWeapon/virtualWeapons populate virtualWeaponBehaviors from the descriptor.
 */

import Infernis from './Infernis.js';
import Katari from './Katari.js';
import Giant from './Giant.js';
import Faun from './Faun.js';
import Dwarf from './Dwarf.js';
import Drakona from './Drakona.js';
import Clank from './Clank.js';
import Elf from './Elf.js';
import Simiah from './Simiah.js';
import Fungril from './Fungril.js';
import Orc from './Orc.js';
import Human from './Human.js';
import Halfling from './Halfling.js';
import Galapa from './Galapa.js';
import Ribbet from './Ribbet.js';
import Faerie from './Faerie.js';
import Goblin from './Goblin.js';
import Firbolg from './Firbolg.js';

/** [ancestryName, featureDict] for each file */
const ancestryModules = [
  ['Infernis', Infernis],
  ['Katari', Katari],
  ['Giant', Giant],
  ['Faun', Faun],
  ['Dwarf', Dwarf],
  ['Drakona', Drakona],
  ['Clank', Clank],
  ['Elf', Elf],
  ['Simiah', Simiah],
  ['Fungril', Fungril],
  ['Orc', Orc],
  ['Human', Human],
  ['Halfling', Halfling],
  ['Galapa', Galapa],
  ['Ribbet', Ribbet],
  ['Faerie', Faerie],
  ['Goblin', Goblin],
  ['Firbolg', Firbolg],
];

/** @type {Record<string, object>} feature name → full feature descriptor */
const featureMap = {};

/**
 * @type {Record<string, { name: string, description: string, features: object[] }>}
 * ancestry name → ancestry descriptor with ordered feature list
 */
export const ancestryMap = {};

/**
 * Feature name → { onAcknowledge?, stressCost?, hopeCost? } for virtual weapons.
 * Populated from declarative virtualWeapon/virtualWeapons on descriptors.
 * @type {Record<string, { onAcknowledge?: Function, stressCost?: number, hopeCost?: number }>}
 */
export const virtualWeaponBehaviors = {};

function registerVirtualWeaponBehaviors(descriptor, featureName) {
  const toCheck = descriptor.virtualWeapon ? [descriptor.virtualWeapon] : (descriptor.virtualWeapons || []);
  for (const vw of toCheck) {
    if (vw.onAcknowledge || vw.stressCost != null || vw.hopeCost != null) {
      virtualWeaponBehaviors[featureName] = {
        onAcknowledge: vw.onAcknowledge,
        stressCost: vw.stressCost,
        hopeCost: vw.hopeCost,
      };
      break;
    }
  }
}

for (const [ancestryName, featureDict] of ancestryModules) {
  const features = [];
  let experienceBonus = null;

  for (const [featureName, hooks] of Object.entries(featureDict)) {
    const descriptor = {
      name: featureName,
      sourceType: 'ancestry',
      source: ancestryName,
      ancestry: ancestryName,
      ...hooks,
    };
    if (descriptor.advantageTriggers && !descriptor.advantageTrigger && descriptor.advantageTriggers.length > 0) {
      descriptor.advantageTrigger = descriptor.advantageTriggers[0];
    }
    registerVirtualWeaponBehaviors(descriptor, featureName);
    featureMap[featureName] = descriptor;
    features.push(descriptor);
    if (typeof hooks.experienceBonus === 'number') {
      experienceBonus = { amount: hooks.experienceBonus, featureName };
    }
  }

  ancestryMap[ancestryName] = {
    name: ancestryName,
    description: '',
    features,
    ...(experienceBonus ? { experienceBonus } : {}),
  };
}

/** Feature name → feature descriptor (backward-compatible default export). */
export default featureMap;
