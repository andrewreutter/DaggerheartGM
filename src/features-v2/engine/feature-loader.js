/**
 * V2 Feature Engine — Feature Loader
 *
 * Resolves which feature objects apply to a given character based on their
 * chosen options, and applies declarative passive behaviors (stat mods,
 * virtual weapons, advantage triggers, etc.) during the Character Rendering
 * phase.
 */

import { unwrap, unwrapAll } from './when.js';
import { buildTableSnapshot } from './table.js';

/**
 * Merge persisted V2 feature state from the character element and optional
 * table snapshot so `table.feature.get(...)` works during declarative evaluation.
 *
 * - `character.featureState` and `tableBase.featureState` (from `buildTableSnapshot`)
 *   are shallow-merged per feature key; character values win on key overlap.
 *
 * Returns a **new** object safe to pass into `buildTableSnapshot` (avoids mutating
 * live table state when the engine adds empty per-feature buckets).
 */
export function mergeDeclarativeFeatureState(character = {}, tableBase = {}) {
  const merged = {};

  function mergeFrom(src) {
    if (!src || typeof src !== 'object') return;
    for (const [featKey, bag] of Object.entries(src)) {
      if (!bag || typeof bag !== 'object') continue;
      merged[featKey] = { ...(merged[featKey] || {}), ...bag };
    }
  }

  mergeFrom(tableBase.featureState);
  mergeFrom(character.featureState);

  // Deep-clone per-feature bags so buildTableSnapshot / buildFeatureStore
  // can add empty `{}` buckets without touching live `gameState.featureState`.
  const clone = {};
  for (const [k, bag] of Object.entries(merged)) {
    clone[k] = { ...bag };
  }
  return clone;
}

/**
 * Snapshot for one feature during declarative evaluation so `table.source` /
 * `table.activeFeature` match the feature being applied (mirrors the action loop).
 */
function snapshotForDeclarativeFeature(feature, character, tableBase, mergedFeatureState) {
  return buildTableSnapshot({
    fear: tableBase?.top?.fear ?? 0,
    mapConfig: tableBase?.top?.map ?? null,
    activeElements: [character],
    _ownerInstanceId: feature._ownerInstanceId ?? character.instanceId,
    _featureKey: feature.name ?? 'Feature',
    _activeFeature: feature,
    _sourceObject: feature._sourceObject,
    featureState: mergedFeatureState,
  });
}

// ---------------------------------------------------------------------------
// loadCharacterFeatures
// ---------------------------------------------------------------------------

/**
 * Given a character's chosen options and the V2 registry, return a flat array
 * of all feature objects that apply to this character. Each returned feature
 * is annotated with `_ownerInstanceId`, `_source` (e.g. 'class', 'weapon_property'),
 * and internal registry linkage so `table.source` in snapshots points at the
 * class, weapon, armor, ancestry, etc. row the feature came from.
 *
 * @param {object} character  — character data including chosen option IDs
 * @param {object} registry   — { ancestries, communities, classes, subclasses,
 *                               weapon_properties, armor_properties, abilities,
 *                               beastforms, items, consumables }
 * @returns {object[]} flat array of feature objects
 */
export function loadCharacterFeatures(character, registry) {
  const features = [];
  const instanceId = character.instanceId || character.id;

  function addFeatures(collection, id, source) {
    if (!id || !registry[collection]) return;
    const option = registry[collection][id];
    if (!option) return;

    const optionFeatures = Array.isArray(option.features)
      ? option.features
      : option.feature
      ? Array.isArray(option.feature)
        ? option.feature
        : [option.feature]
      : [];

    for (const feat of optionFeatures) {
      if (feat && typeof feat === 'object') {
        features.push({
          ...feat,
          _ownerInstanceId: instanceId,
          _source: source,
          _sourceObject: option,
        });
      }
    }
  }

  // Class
  if (character.classId) addFeatures('classes', character.classId, 'class');

  // Subclass
  if (character.subclassId) addFeatures('subclasses', character.subclassId, 'subclass');

  // Ancestry (may be multiple)
  const ancestryIds = character.ancestryIds
    ? Array.isArray(character.ancestryIds)
      ? character.ancestryIds
      : [character.ancestryIds]
    : character.ancestryId
    ? [character.ancestryId]
    : [];

  for (const id of ancestryIds) {
    addFeatures('ancestries', id, 'ancestry');
  }

  // Community
  if (character.communityId) addFeatures('communities', character.communityId, 'community');

  // Weapons
  const weaponIds = [
    character.primaryWeaponId,
    character.secondaryWeaponId,
    ...(character.weaponIds || []),
  ].filter(Boolean);

  for (const weaponId of weaponIds) {
    const weapon = registry.weapons?.[weaponId];
    if (!weapon) continue;

    const weaponFeatures = Array.isArray(weapon.feature)
      ? weapon.feature
      : weapon.feature
      ? [weapon.feature]
      : [];

    for (const wf of weaponFeatures) {
      // Look up the property implementation in weapon_properties
      const propName = wf.name || wf;
      const propImpl = registry.weapon_properties?.[propName];
      if (propImpl) {
        features.push({
          ...propImpl,
          _ownerInstanceId: instanceId,
          _source: 'weapon_property',
          _weaponId: weaponId,
          _sourceObject: weapon,
          // Keep raw feature text for any implementation that needs it
          _weaponFeatureText: typeof wf === 'object' ? wf.text : undefined,
        });
      } else if (typeof wf === 'object') {
        // No registered implementation yet — include as a display-only feature
        features.push({
          name: propName,
          description: wf.text,
          _ownerInstanceId: instanceId,
          _source: 'weapon_property',
          _weaponId: weaponId,
          _sourceObject: weapon,
        });
      }
    }
  }

  // Armor
  if (character.armorId) {
    const armor = registry.armor?.[character.armorId];
    if (armor) {
      const armorFeatures = Array.isArray(armor.feature)
        ? armor.feature
        : armor.feature
        ? [armor.feature]
        : [];

      for (const af of armorFeatures) {
        const propName = af.name || af;
        const propImpl = registry.armor_properties?.[propName];
        if (propImpl) {
          features.push({
            ...propImpl,
            _ownerInstanceId: instanceId,
            _source: 'armor_property',
            _sourceObject: armor,
          });
        } else if (typeof af === 'object') {
          features.push({
            name: propName,
            description: af.text,
            _ownerInstanceId: instanceId,
            _source: 'armor_property',
            _sourceObject: armor,
          });
        }
      }
    }
  }

  // Abilities
  for (const abilityId of character.abilityIds || []) {
    const ability = registry.abilities?.[abilityId];
    if (ability) {
      features.push({
        ...ability,
        _ownerInstanceId: instanceId,
        _source: 'ability',
        _sourceObject: ability,
      });
    }
  }

  return features;
}

// ---------------------------------------------------------------------------
// applyDeclarativeFeatures
// ---------------------------------------------------------------------------

/**
 * Iterate all features and apply declarative passive behaviors to the
 * character's computed stats. Respects when() wrappers on each property.
 *
 * Returns an updated character stats object (does not mutate the original).
 *
 * @param {object[]} features   — from loadCharacterFeatures()
 * @param {object}   character  — raw character data
 * @param {object}   tableBase  — optional base snapshot (fear/map); per-feature `table` is rebuilt so `table.source` / `table.activeFeature` are set
 * @returns {{ stats: object, virtualWeapons: object[], advantageTriggers: object[], damageAffinities: object, movementModes: object[], rangeOverrides: object, substituteArmorForHope: boolean, weaponRenderHints: object }}
 */
export function applyDeclarativeFeatures(features, character, tableBase) {
  const stats = {
    evasion: character.evasion ?? 0,
    armorScore: character.armorScore ?? 0,
    maxHP: character.maxHp ?? character.maxHP ?? 0,
    maxStress: character.maxStress ?? 0,
    maxHope: character.maxHope ?? 0,
    maxArmor: character.maxArmor ?? 0,
    majorThreshold: character.armorThresholds?.major ?? 0,
    severeThreshold: character.armorThresholds?.severe ?? 0,
    agility: character.traits?.agility ?? 0,
    strength: character.traits?.strength ?? 0,
    finesse: character.traits?.finesse ?? 0,
    instinct: character.traits?.instinct ?? 0,
    presence: character.traits?.presence ?? 0,
    knowledge: character.traits?.knowledge ?? 0,
    // Rest downtime (CONV-011) — consumed by client rest UI via getRestMovesForCharacter
    numShortRestSlots: 0,
    numLongRestSlots: 0,
    numLongMovesInShortRest: 0,
  };

  const virtualWeapons = [];
  const advantageTriggers = [];
  const damageAffinities = { resistances: [], immunities: [], vulnerabilities: [] };
  const movementModes = [];
  const rangeOverrides = {}; // { [sourceRange]: effectiveRange } — e.g. { melee: 'veryClose' }
  /** @type {Record<string, { isDisabled?: boolean, disabledReason?: string }>} */
  const weaponRenderHints = {};
  let substituteArmorForHope = !!character.substituteArmorForHope;

  const mergedFeatureState = mergeDeclarativeFeatureState(character, tableBase);

  function mergeWeaponRenderHint(weaponId, hint) {
    if (!weaponId || !hint || typeof hint !== 'object') return;
    const prev = weaponRenderHints[weaponId] || {};
    const merged = { ...prev, ...hint };
    merged.isDisabled = !!(prev.isDisabled || hint.isDisabled);
    if (merged.isDisabled) {
      merged.disabledReason =
        (hint.isDisabled && hint.disabledReason) ||
        (prev.isDisabled && prev.disabledReason) ||
        merged.disabledReason;
    } else {
      delete merged.disabledReason;
    }
    weaponRenderHints[weaponId] = merged;
  }

  for (const feature of features) {
    const table = snapshotForDeclarativeFeature(feature, character, tableBase, mergedFeatureState);

    const subHope = unwrap(feature.substituteArmorForHope, table);
    if (subHope === true) substituteArmorForHope = true;

    // passiveStatMods
    const mods = unwrap(feature.passiveStatMods, table);
    if (mods && typeof mods === 'object') {
      for (const [key, value] of Object.entries(mods)) {
        let resolvedValue = unwrap(value, table);
        // Allow function values: (table, feature?) => number
        // The feature object is passed as the second arg for fields like `_weaponId`;
        // registry fields (tier, damage, …) should be read from `table.source`.
        if (typeof resolvedValue === 'function') resolvedValue = resolvedValue(table, feature);
        if (typeof resolvedValue === 'number' && key in stats) {
          stats[key] += resolvedValue;
        }
      }
    }

    // virtualWeapons
    const vWeapons = unwrapAll(feature.virtualWeapons, table);
    if (Array.isArray(vWeapons)) virtualWeapons.push(...vWeapons);

    // advantageTriggers
    const triggers = unwrapAll(feature.advantageTriggers, table);
    if (Array.isArray(triggers)) advantageTriggers.push(...triggers);

    // damageAffinities
    const affinities = unwrapAll(feature.damageAffinities, table);
    if (affinities) {
      if (Array.isArray(affinities.resistances))
        damageAffinities.resistances.push(...affinities.resistances);
      if (Array.isArray(affinities.immunities))
        damageAffinities.immunities.push(...affinities.immunities);
      if (Array.isArray(affinities.vulnerabilities))
        damageAffinities.vulnerabilities.push(...affinities.vulnerabilities);
    }

    // movementModes
    const modes = unwrapAll(feature.movementModes, table);
    if (Array.isArray(modes)) movementModes.push(...modes);
    else if (typeof modes === 'string') movementModes.push(modes);

    // rangeOverrides — merge each feature's map into the accumulated result
    const overrides = unwrap(feature.rangeOverrides, table);
    if (overrides && typeof overrides === 'object' && !Array.isArray(overrides)) {
      Object.assign(rangeOverrides, overrides);
    }

    // Weapon property rendering (e.g. Pompous — disable weapon when traits fail)
    const resolvedOnRender = unwrap(feature.onRender, table);
    if (feature._weaponId && resolvedOnRender !== undefined) {
      let hint;
      if (typeof resolvedOnRender === 'function') hint = resolvedOnRender(table);
      else if (resolvedOnRender && typeof resolvedOnRender === 'object') hint = resolvedOnRender;
      if (hint && typeof hint === 'object') mergeWeaponRenderHint(feature._weaponId, hint);
    }
  }

  return {
    stats,
    virtualWeapons,
    advantageTriggers,
    damageAffinities,
    movementModes,
    rangeOverrides,
    /** When true, merge onto the character element so `table.me.substituteArmorForHope` is set in snapshots (armor-for-Hope substitution). */
    substituteArmorForHope,
    /**
     * Merge onto the character element (like `_rangeOverrides`) so weapon views include `isDisabled` / `disabledReason` in snapshots.
     * Shape: `{ [weaponId]: { isDisabled?: boolean, disabledReason?: string } }`.
     */
    weaponRenderHints,
  };
}
