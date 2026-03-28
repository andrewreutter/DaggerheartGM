/**
 * V2 Feature Engine — Feature Loader
 *
 * Resolves which feature objects apply to a given character based on their
 * chosen options, and applies declarative passive behaviors (stat mods,
 * virtual weapons, advantage triggers, etc.) during the Character Rendering
 * phase.
 */

import { enrichHoverActionMeta } from './hover-action-enrich.js';
import { unwrap, unwrapAll } from './when.js';
import { buildTableSnapshot } from './table.js';
import { SRD_CLASS_DRUID_SCOPE_KEY } from './feature-scope-keys.js';
import { forEachConsumableRestBonusPending } from './consumable-rest-bonus.js';
import beastformsRegistryDefault from '../beastforms/index.js';
import { getActiveBeastformRow } from './beastform-virtual-weapon-decl.js';

export { parseBeastformAttackLine } from './beastform-parse.js';
export { attachBeastformOptions } from './beastform-virtual-weapon-decl.js';

/**
 * Stable scope for `featureState[scope]` / `table.source` — explicit registry `sourceScopeKey` wins, else `collection:id`.
 */
export function resolveSourceScopeKey(collection, id, option) {
  const explicit = option?.sourceScopeKey;
  if (explicit != null && explicit !== '') return explicit;
  return `${collection}:${id}`;
}

/** Match SRD `makeId('items', name)` in `src/srd/parser.js`. */
function slugifySrdItemName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Maps `registry` collection keys to `_source` tags on pushed rows. */
const VIRTUAL_SOURCE_COLLECTION_TO_TAG = {
  beastforms: 'beastform',
  classes: 'class',
  subclasses: 'subclass',
  ancestries: 'ancestry',
  communities: 'community',
};

/**
 * Append feature rows from `registry[collection][id]` — same shape as the inner `addFeatures`
 * in {@link loadCharacterFeatures} (used for virtual registry sources + normal loads).
 *
 * @param {object[]} features — array to mutate
 * @param {string} sourceTag — `_source` on each row (`'class'`, `'beastform'`, …)
 */
function appendFeaturesFromRegistryOption(features, collection, id, registry, instanceId, sourceTag) {
  if (!id || !registry[collection]) return;
  const option = registry[collection][id];
  if (!option) return;

  let optionFeatures = Array.isArray(option.features)
    ? option.features
    : option.feature
      ? Array.isArray(option.feature)
        ? option.feature
        : [option.feature]
      : [];

  if (
    (collection === 'items' || collection === 'ancestries') &&
    optionFeatures.length === 0
  ) {
    optionFeatures = [option];
  }

  for (const feat of optionFeatures) {
    if (feat && typeof feat === 'object') {
      const row = {
        ...feat,
        _ownerInstanceId: instanceId,
        _source: sourceTag,
        _sourceObject: option,
        _sourceScopeKey: resolveSourceScopeKey(collection, id, option),
      };
      if (collection === 'beastforms') row._beastformId = id;
      features.push(row);
    }
  }
}

/**
 * Expand `{ collection, id }` refs from **`virtualSources`** into annotated feature rows
 * (same pipeline as {@link loadCharacterFeatures} for supported collections).
 *
 * @param {{ collection: string, id: string }} ref
 * @returns {object[]}
 */
export function expandVirtualSourceRef(ref, registry, instanceId) {
  if (!ref || typeof ref !== 'object') return [];
  const { collection, id } = ref;
  if (!collection || !id || !registry?.[collection]) return [];
  const sourceTag = VIRTUAL_SOURCE_COLLECTION_TO_TAG[collection];
  if (!sourceTag) return [];
  const out = [];
  appendFeaturesFromRegistryOption(out, collection, id, registry, instanceId, sourceTag);
  return out;
}

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
function snapshotForDeclarativeFeature(feature, character, tableBase, mergedFeatureState, registry) {
  // Weapon rows come from the shared registry; shallow-copy so `onRender` can set
  // `table.source.isDisabled` without mutating `registry.weapons[id]` for all tables.
  let sourceObject = feature._sourceObject;
  if (feature._source === 'weapon_property') {
    if (!sourceObject || typeof sourceObject !== 'object') {
      sourceObject = feature._weaponId ? { id: feature._weaponId } : {};
    }
    sourceObject = { ...sourceObject };
  } else if (feature._source === 'beastform' && sourceObject && typeof sourceObject === 'object') {
    // Full beastform registry row — copy so hooks cannot mutate shared registry data.
    sourceObject = { ...sourceObject };
  }
  const ownerId =
    feature._ownerInstanceId ?? character.instanceId ?? character.id ?? '__declarative__';
  const charEl = {
    ...character,
    elementType: character.elementType || 'character',
    instanceId: character.instanceId || character.id || ownerId,
  };
  return buildTableSnapshot({
    fear: tableBase?.top?.fear ?? 0,
    mapConfig: tableBase?.top?.map ?? null,
    activeElements: [charEl],
    _ownerInstanceId: ownerId,
    _featureKey: feature.name ?? 'Feature',
    _activeFeature: feature,
    _sourceObject: sourceObject,
    featureState: mergedFeatureState,
    registry,
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
 * @param {object} registry   — full V2 registry (`items`, `consumables`, classes, …). Inventory
 *                               entries on **`character.inventory`** with **`id`** = **`registry.items[id]`**
 *                               load that row’s **`features`**.
 * @returns {object[]} flat array of feature objects
 *
 * **Druid + active beastform:** Sub-features are **not** appended here — use **`virtualSources`**
 * on the **Beastform** class feature (see `classes/Druid.js`), expanded in **`applyDeclarativeFeatures`**.
 */
export function loadCharacterFeatures(character, registry) {
  const features = [];
  const instanceId = character.instanceId || character.id || '__v2_owner__';

  function addFeatures(collection, id, source) {
    appendFeaturesFromRegistryOption(features, collection, id, registry, instanceId, source);
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

    // SRD rows use `features` (array); some tests use singular `feature`.
    const weaponFeatures = Array.isArray(weapon.features)
      ? weapon.features
      : Array.isArray(weapon.feature)
        ? weapon.feature
        : weapon.feature
          ? [weapon.feature]
          : [];

    for (const wf of weaponFeatures) {
      // Look up the property implementation in weapon_properties
      const propName = wf.name || wf;
      const propImpl = registry.weapon_properties?.[propName];
      const weaponScope =
        weapon.sourceScopeKey != null && weapon.sourceScopeKey !== ''
          ? weapon.sourceScopeKey
          : `weapons:${weaponId}`;
      if (propImpl) {
        features.push({
          ...propImpl,
          _ownerInstanceId: instanceId,
          _source: 'weapon_property',
          _weaponId: weaponId,
          _sourceObject: weapon,
          _sourceScopeKey: weaponScope,
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
          _sourceScopeKey: weaponScope,
        });
      }
    }
  }

  // Armor
  if (character.armorId) {
    const armor = registry.armor?.[character.armorId];
    if (armor) {
      const armorFeatures = Array.isArray(armor.features)
        ? armor.features
        : Array.isArray(armor.feature)
          ? armor.feature
          : armor.feature
            ? [armor.feature]
            : [];

      const armorScope =
        armor.sourceScopeKey != null && armor.sourceScopeKey !== ''
          ? armor.sourceScopeKey
          : `armor:${character.armorId}`;
      for (const af of armorFeatures) {
        const propName = af.name || af;
        const propImpl = registry.armor_properties?.[propName];
        if (propImpl) {
          features.push({
            ...propImpl,
            _ownerInstanceId: instanceId,
            _source: 'armor_property',
            _sourceObject: armor,
            _sourceScopeKey: armorScope,
          });
        } else if (typeof af === 'object') {
          features.push({
            name: propName,
            description: af.text,
            _ownerInstanceId: instanceId,
            _source: 'armor_property',
            _sourceObject: armor,
            _sourceScopeKey: armorScope,
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
        _sourceScopeKey: resolveSourceScopeKey('abilities', abilityId, ability),
      });
    }
  }

  // Items — registry row may be `{ features: [...] }`, a single mechanical V2 feature (`hooks` / `chips` / `passiveStatMods`),
  // or a minimal narrative-only descriptor (`name` + `description` only).
  const itemIdsSeen = new Set();
  function pushItemFeaturesForId(itemId) {
    if (!itemId || itemIdsSeen.has(itemId) || !registry.items) return;
    const opt = registry.items[itemId];
    if (!opt || typeof opt !== 'object') return;
    itemIdsSeen.add(itemId);

    const nested = Array.isArray(opt.features)
      ? opt.features
      : opt.feature
        ? Array.isArray(opt.feature)
          ? opt.feature
          : [opt.feature]
        : [];
    const list =
      nested.length > 0
        ? nested
        : Array.isArray(opt.features) && opt.features.length === 0
          ? []
          : opt.name && (opt.hooks != null || opt.chips != null || opt.passiveStatMods != null)
            ? [opt]
            : opt.name &&
                typeof opt.description === 'string' &&
                opt.features === undefined &&
                opt.feature == null
              ? [opt]
              : [];

    for (const feat of list) {
      if (feat && typeof feat === 'object') {
        features.push({
          ...feat,
          _ownerInstanceId: instanceId,
          _source: 'item',
          _sourceObject: opt,
          _itemId: itemId,
          _sourceScopeKey: resolveSourceScopeKey('items', itemId, opt),
        });
      }
    }
  }

  // Consumables — same resolution pattern as items (`inventory` entries with `srd-cns-*` id or SRD name).
  const consumableIdsSeen = new Set();
  function pushConsumableFeaturesForId(consumableId) {
    if (!consumableId || consumableIdsSeen.has(consumableId) || !registry.consumables) return;
    const opt = registry.consumables[consumableId];
    if (!opt || typeof opt !== 'object') return;
    consumableIdsSeen.add(consumableId);

    const nested = Array.isArray(opt.features)
      ? opt.features
      : opt.feature
        ? Array.isArray(opt.feature)
          ? opt.feature
          : [opt.feature]
        : [];
    const list =
      nested.length > 0
        ? nested
        : Array.isArray(opt.features) && opt.features.length === 0
          ? []
          : opt.name &&
              (opt.hooks != null ||
                opt.chips != null ||
                opt.passiveStatMods != null ||
                opt.onUse != null)
            ? [opt]
            : opt.name &&
                typeof opt.description === 'string' &&
                opt.features === undefined &&
                opt.feature == null
              ? [opt]
              : [];

    for (const feat of list) {
      if (feat && typeof feat === 'object') {
        features.push({
          ...feat,
          _ownerInstanceId: instanceId,
          _source: 'consumable',
          _sourceObject: opt,
          _consumableId: consumableId,
          _sourceScopeKey: resolveSourceScopeKey('consumables', consumableId, opt),
        });
      }
    }
  }

  if (Array.isArray(character.itemIds)) {
    for (const id of character.itemIds) {
      if (typeof id === 'string') pushItemFeaturesForId(id);
    }
  }
  const inv = character.inventory;
  if (Array.isArray(inv)) {
    for (const entry of inv) {
      if (!entry || typeof entry !== 'object') continue;
      let itemId = null;
      if (typeof entry.id === 'string' && registry.items?.[entry.id]) {
        itemId = entry.id;
      } else if (entry.name && registry.items) {
        const candidate = `srd-itm-${slugifySrdItemName(entry.name)}`;
        if (registry.items[candidate]) itemId = candidate;
      }
      if (itemId) pushItemFeaturesForId(itemId);

      let consumableId = null;
      if (typeof entry.id === 'string' && registry.consumables?.[entry.id]) {
        consumableId = entry.id;
      } else if (entry.name && registry.consumables) {
        const candidate = `srd-cns-${slugifySrdItemName(entry.name)}`;
        if (registry.consumables[candidate]) consumableId = candidate;
      }
      if (consumableId) pushConsumableFeaturesForId(consumableId);
    }
  }

  // Rest-banner / consumable use: passiveStatMods may still apply after inventory removes the row
  // (e.g. Potion of Stability — `restBonusActive` until rest completes). Re-include those consumables.
  if (character.featureState && registry.consumables) {
    forEachConsumableRestBonusPending(character.featureState, (featKey) => {
      const cid = featKey.startsWith('consumables:') ? featKey.slice('consumables:'.length) : null;
      if (cid && registry.consumables[cid] && !consumableIdsSeen.has(cid)) {
        pushConsumableFeaturesForId(cid);
      }
    });
  }

  return features.map((f) => enrichHoverActionMeta(f));
}

// ---------------------------------------------------------------------------
// Beastform — declarative overlay (Druid Beastform / Evolution)
// ---------------------------------------------------------------------------

export {
  parseBeastformStatBonus,
  advantageTriggersFromBeastformRow,
} from '../beastforms/beastform-row-stat-mods.js';

/**
 * Apply SRD beastform row bonuses, weapon disable hints, and domain lockout
 * when the druid has an active beastform (Druid scoped `featureState` and/or denormalized `character.activeBeastform`).
 *
 * Virtual natural weapon is contributed by the **Beastform** class feature via
 * `virtualWeapon: when(hasActiveBeastformInTable, resolveBeastformVirtualWeapon)` in `classes/Druid.js`.
 *
 * @returns {{ domainLoadoutDisabled: boolean }}
 */
function applyBeastformDeclarativeOverlay({
  stats,
  mergeWeaponRenderHint,
  character,
  mergedFeatureState,
  beastformMap,
}) {
  const resolved = getActiveBeastformRow(character, mergedFeatureState, beastformMap);
  if (!resolved) return { domainLoadoutDisabled: false };
  const { row, viaEvolution } = resolved;

  if (viaEvolution) {
    const ek = mergedFeatureState?.[SRD_CLASS_DRUID_SCOPE_KEY]?.evolutionTraitKey;
    if (ek && typeof stats[ek] === 'number') stats[ek] += 1;
  }

  const hint = { isDisabled: true, disabledReason: 'Beastform active' };
  for (const wid of [
    character.primaryWeaponId,
    character.secondaryWeaponId,
    ...(character.weaponIds || []),
  ].filter(Boolean)) {
    mergeWeaponRenderHint(wid, hint);
  }

  return { domainLoadoutDisabled: true };
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
 * @param {object}   [registry] — optional V2 registry (for `registry.beastforms` id lookup); defaults to generated SRD beastform map
 * @returns {{ stats: object, virtualWeapons: object[], advantageTriggers: object[], damageAffinities: object, rangeOverrides: object, weaponTraitOverrides: Record<string, string>, substituteArmorForHope: boolean, weaponRenderHints: object, extraTagTeamInitiationsPerSession: number, tagTeamPartnerHopeDiscount: number, domainLoadoutDisabled: boolean, contactsEverywhereSessionUses: number, shadowStepperVeryFarUnlocked: boolean, virtualFeaturesExpanded: object[], mergedFeatures: object[] }}
 *          **`virtualFeaturesExpanded`** — rows from **`virtualSource` / `virtualSources`** (registry refs only).
 */
export function applyDeclarativeFeatures(features, character, tableBase, registry) {
  const stats = {
    evasion: character.evasion ?? 0,
    armorScore: character.armorScore ?? 0,
    maxHP: character.maxHp ?? character.maxHP ?? 0,
    maxStress: character.maxStress ?? 0,
    maxHope: character.maxHope ?? 0,
    maxArmor: character.maxArmor ?? 0,
    majorThreshold: character.armorThresholds?.major ?? 0,
    severeThreshold: character.armorThresholds?.severe ?? 0,
    /** Base proficiency (advancement picks); consumables/features may add via passiveStatMods. */
    proficiency: character.proficiency ?? 1,
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
  const rangeOverrides = {}; // { [sourceRange]: effectiveRange } — e.g. { melee: 'veryClose' }
  /** @type {Record<string, string>} SRD weapon id → attack trait label (e.g. Gems of …) */
  const weaponTraitOverrides = {};
  /** @type {Record<string, { isDisabled?: boolean, disabledReason?: string }>} */
  const weaponRenderHints = {};
  let substituteArmorForHope = !!character.substituteArmorForHope;

  let extraTagTeamInitiationsPerSession = Math.max(
    0,
    Math.floor(Number(character.extraTagTeamInitiationsPerSession) || 0)
  );
  let tagTeamPartnerHopeDiscount = Math.max(
    0,
    Math.floor(Number(character.tagTeamPartnerHopeDiscount) || 0)
  );

  /** Syndicate **Reliable Backup** (mastery): raises **Contacts Everywhere** uses per session (default 1). */
  let contactsEverywhereSessionUses = Math.max(
    1,
    Math.floor(Number(character.contactsEverywhereSessionUses) || 0) || 1
  );

  /** Nightwalker **Fleeting Shadow** sets true so **Shadow Stepper** can use Very Far range. */
  let shadowStepperVeryFarUnlocked = character.shadowStepperVeryFarUnlocked === true;

  const mergedFeatureState = mergeDeclarativeFeatureState(character, tableBase);
  const beastformMap = registry?.beastforms ?? beastformsRegistryDefault;
  const declarativeVirtualCtx = { mergedFeatureState, registry, beastformMap };
  const instanceId = character.instanceId || character.id || '__v2_owner__';

  /** Rows from `virtualSource` / `virtualSources`. */
  const virtualFeaturesExpanded = [];
  for (const feature of features) {
    const table = snapshotForDeclarativeFeature(feature, character, tableBase, mergedFeatureState, registry);

    const vsOne = unwrap(feature.virtualSource, table);
    if (vsOne != null) {
      let resolved = vsOne;
      if (typeof resolved === 'function') {
        resolved = resolved(table, feature, character, declarativeVirtualCtx);
      }
      if (resolved != null) {
        const refs = Array.isArray(resolved) ? resolved : [resolved];
        for (const ref of refs) {
          if (ref && typeof ref === 'object' && ref.collection && ref.id) {
            virtualFeaturesExpanded.push(...expandVirtualSourceRef(ref, registry, instanceId));
          }
        }
      }
    }

    let vSources = unwrapAll(feature.virtualSources, table);
    if (typeof vSources === 'function') {
      vSources = vSources(table, feature, character, declarativeVirtualCtx);
    }
    if (Array.isArray(vSources)) {
      for (const ref of vSources) {
        if (ref && typeof ref === 'object' && ref.collection && ref.id) {
          virtualFeaturesExpanded.push(...expandVirtualSourceRef(ref, registry, instanceId));
        }
      }
    }
  }

  const allFeatures = features.concat(virtualFeaturesExpanded);

  /** Apply `_sourceObject.passiveStatMods` at most once per `_sourceScopeKey` (e.g. beastform row bonuses). */
  const appliedSourcePassiveStatMods = new Set();
  /** Apply `_sourceObject.advantageTriggers` at most once per beastform row (SRD `advantages` keywords). */
  const appliedSourceAdvantageTriggers = new Set();

  function mergeWeaponRenderHint(weaponId, hint) {
    if (!weaponId || !hint || typeof hint !== 'object') return;
    const prev = weaponRenderHints[weaponId] || {};
    const merged = { ...prev, ...hint };
    if ('isDisabled' in prev || 'isDisabled' in hint) {
      merged.isDisabled = !!(prev.isDisabled || hint.isDisabled);
    }
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

  for (const feature of allFeatures) {
    const table = snapshotForDeclarativeFeature(feature, character, tableBase, mergedFeatureState, registry);

    const subHope = unwrap(feature.substituteArmorForHope, table);
    if (subHope === true) substituteArmorForHope = true;

    const extraTag = unwrap(feature.extraTagTeamInitiationsPerSession, table);
    if (typeof extraTag === 'number' && extraTag > 0) {
      extraTagTeamInitiationsPerSession += Math.floor(extraTag);
    }

    const hopeDisc = unwrap(feature.tagTeamPartnerHopeDiscount, table);
    if (typeof hopeDisc === 'number' && hopeDisc > 0) {
      tagTeamPartnerHopeDiscount = Math.max(tagTeamPartnerHopeDiscount, Math.floor(hopeDisc));
    }

    const ceUses = unwrap(feature.contactsEverywhereSessionUses, table);
    if (typeof ceUses === 'number' && ceUses >= 1) {
      contactsEverywhereSessionUses = Math.max(
        contactsEverywhereSessionUses,
        Math.floor(ceUses)
      );
    }

    const ssFar = unwrap(feature.shadowStepperVeryFarUnlocked, table);
    if (ssFar === true) shadowStepperVeryFarUnlocked = true;

    const scopeKey = feature._sourceScopeKey;
    const srcObj = feature._sourceObject;
    // Row-level `passiveStatMods` on the registry object (e.g. beastform trait/evasion strings).
    // Restrict to beastform: items/consumables often use one object as both `_sourceObject` and the
    // sole feature row — applying source + feature would double-count.
    if (
      feature._source === 'beastform' &&
      scopeKey &&
      srcObj &&
      srcObj.passiveStatMods != null &&
      !appliedSourcePassiveStatMods.has(scopeKey)
    ) {
      appliedSourcePassiveStatMods.add(scopeKey);
      const srcMods = unwrap(srcObj.passiveStatMods, table);
      if (srcMods && typeof srcMods === 'object') {
        for (const [key, value] of Object.entries(srcMods)) {
          let resolvedValue = unwrap(value, table);
          if (typeof resolvedValue === 'function') resolvedValue = resolvedValue(table, feature);
          if (typeof resolvedValue === 'number' && key in stats) {
            stats[key] += resolvedValue;
          }
        }
      }
    }

    if (
      feature._source === 'beastform' &&
      scopeKey &&
      srcObj &&
      Array.isArray(srcObj.advantageTriggers) &&
      srcObj.advantageTriggers.length > 0 &&
      !appliedSourceAdvantageTriggers.has(scopeKey)
    ) {
      appliedSourceAdvantageTriggers.add(scopeKey);
      const srcAdv = unwrapAll(srcObj.advantageTriggers, table);
      if (Array.isArray(srcAdv)) advantageTriggers.push(...srcAdv);
    }

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

    // virtualWeapon (singular) — supports when() and (table, feature, character, ctx) => object | array | null
    const vOne = unwrap(feature.virtualWeapon, table);
    if (vOne != null) {
      let resolved = vOne;
      if (typeof resolved === 'function') {
        resolved = resolved(table, feature, character, declarativeVirtualCtx);
      }
      if (resolved != null) {
        if (Array.isArray(resolved)) virtualWeapons.push(...resolved);
        else virtualWeapons.push(resolved);
      }
    }

    // virtualWeapons
    let vWeapons = unwrapAll(feature.virtualWeapons, table);
    if (typeof vWeapons === 'function') {
      vWeapons = vWeapons(table, feature, character, declarativeVirtualCtx);
    }
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

    // rangeOverrides — merge each feature's map into the accumulated result
    const overrides = unwrap(feature.rangeOverrides, table);
    if (overrides && typeof overrides === 'object' && !Array.isArray(overrides)) {
      Object.assign(rangeOverrides, overrides);
    }

    // weaponTraitOverrides — { [srdWeaponId]: trait label } (Gems of …, etc.); last feature wins on the same id
    const wTraitOv = unwrap(feature.weaponTraitOverrides, table);
    let resolvedWT = wTraitOv;
    if (typeof resolvedWT === 'function') resolvedWT = resolvedWT(table, feature, character);
    if (resolvedWT && typeof resolvedWT === 'object' && !Array.isArray(resolvedWT)) {
      Object.assign(weaponTraitOverrides, resolvedWT);
    }

    // Per-weapon effective range (e.g. Flickerfly Pendant — physical melee only); overrides merged `rangeOverrides` for that weapon id.
    const hintBuilder = unwrap(feature.computeWeaponRenderHints, table);
    if (typeof hintBuilder === 'function') {
      const hints = hintBuilder(table, character, registry);
      if (hints && typeof hints === 'object') {
        for (const [weaponId, hint] of Object.entries(hints)) {
          mergeWeaponRenderHint(weaponId, hint);
        }
      }
    }

    // Weapon property rendering: `onRender(table)` mutates ephemeral `table.source` (weapon shallow copy).
    const resolvedOnRender = unwrap(feature.onRender, table);
    if (feature._weaponId && typeof resolvedOnRender === 'function') {
      resolvedOnRender(table);
      const src = table.source;
      if (src && typeof src === 'object' && ('isDisabled' in src || src.disabledReason)) {
        mergeWeaponRenderHint(feature._weaponId, {
          ...('isDisabled' in src ? { isDisabled: !!src.isDisabled } : {}),
          ...(src.disabledReason ? { disabledReason: src.disabledReason } : {}),
        });
      }
    }
  }

  const { domainLoadoutDisabled } = applyBeastformDeclarativeOverlay({
    stats,
    mergeWeaponRenderHint,
    character,
    mergedFeatureState,
    beastformMap,
  });

  return {
    stats,
    virtualWeapons,
    advantageTriggers,
    damageAffinities,
    rangeOverrides,
    /**
     * Client merges onto `recomputeCharacter` weapons: `{ [srdWeaponId]: 'Agility' }` style maps.
     */
    weaponTraitOverrides,
    /**
     * Merge onto the character element — max uses per session for the **Contacts Everywhere** card chip
     * (`frequency` + `frequencyMaxUses`). Base **1**; **Reliable Backup** raises to **3**.
     */
    contactsEverywhereSessionUses,
    /**
     * Merge onto the character element — when true, **Nightwalker** **Shadow Stepper** uses Very Far range (**Fleeting Shadow**).
     */
    shadowStepperVeryFarUnlocked,
    /** When true, merge onto the character element so `table.me.substituteArmorForHope` is set in snapshots (armor-for-Hope substitution). */
    substituteArmorForHope,
    /**
     * Merge onto the character element (like `_rangeOverrides`) so weapon views include `isDisabled` / `disabledReason` in snapshots.
     * Shape: `{ [weaponId]: { isDisabled?: boolean, disabledReason?: string } }`.
     */
    weaponRenderHints,
    /**
     * Merge onto the character element — adds to the core Tag Team initiation budget per session (e.g. **Camaraderie** +1).
     */
    extraTagTeamInitiationsPerSession,
    /**
     * Merge onto the character element — when an ally initiates a Tag Team Roll with this character as partner,
     * reduce the initiator’s Hope cost by this amount (e.g. **Camaraderie** `1` → ally pays 2 Hope instead of 3).
     */
    tagTeamPartnerHopeDiscount,
    /**
     * When true, merge onto the character element so `table.me.domainLoadoutDisabled` is true (Druid **Beastform** / **Evolution** — no domain spell cards while transformed).
     */
    domainLoadoutDisabled,
    /** Feature rows from `virtualSource(s)` registry expansion (not in `loadCharacterFeatures`). */
    virtualFeaturesExpanded,
    /** `loadCharacterFeatures` output plus virtual expansions — use for chips, hooks, and Game Table. */
    mergedFeatures: allFeatures,
  };
}
