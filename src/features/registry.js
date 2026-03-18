/**
 * Unified feature registry — single import point for all feature maps.
 *
 * originFeatures (and ancestryFeatures alias) merge ancestry + community descriptors
 * so banner reactions, onAct, and display use one registry; sourceType/source drive badges.
 */
import ancestryFeatureMap, { ancestryMap, virtualWeaponBehaviors } from './ancestries/index.js';
import communityFeatureMap, { communityMap } from './communities/index.js';

const originFeatures = { ...ancestryFeatureMap, ...communityFeatureMap };

export { default as weaponFeatures } from './weapons/index.js';
export { default as armorFeatures } from './armor/index.js';
export { default as classFeatures } from './classes/index.js';
export { originFeatures, originFeatures as ancestryFeatures, ancestryMap, communityMap, virtualWeaponBehaviors };
