/**
 * Unified feature registry — single import point for all feature maps.
 *
 * Usage:
 *   import { weaponFeatures, armorFeatures, classFeatures } from '../features/registry.js';
 */
export { default as weaponFeatures } from './weapons/index.js';
export { default as armorFeatures }  from './armor/index.js';
export { default as classFeatures }  from './classes/index.js';
