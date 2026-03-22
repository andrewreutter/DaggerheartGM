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
import beastformsRegistryDefault from '../beastforms/index.js';

/** Registry key for Druid — used only to attach beastform picker options (not SRD feature-name branching). */
const DRUID_CLASS_SRD_ID = 'srd-cls-druid';

/**
 * Resolves which beastform is active for feature loading — V2 `featureState` first, then
 * legacy Phase 1 **`character.activeBeastform`** (`id` or `beastformId` on the full SRD row).
 */
function getActiveBeastformIdFromCharacter(character) {
  const fs = character?.featureState || {};
  const fromState =
    fs.Beastform?.activeBeastform?.beastformId ||
    fs.Evolution?.activeBeastform?.beastformId ||
    null;
  if (fromState) return fromState;
  const ab = character?.activeBeastform;
  if (ab && typeof ab === 'object') {
    return ab.beastformId || ab.id || null;
  }
  return null;
}

function characterTierFromLevel(level) {
  const n = Number(level) || 1;
  if (n >= 8) return 4;
  if (n >= 5) return 3;
  if (n >= 2) return 2;
  return 1;
}

/**
 * Merge SRD beastform rows (tier ≤ character tier) onto `character._beastformOptions` so
 * `table.me.beastformOptions` is available for Druid **Beastform** / **Evolution** `isSelect` cards.
 *
 * Call when hydrating a character for the V2 engine (after resolving `classId` / `level` / `tier`).
 *
 * @param {object} character — character element (`classId`, `level` or `tier`)
 * @param {object} [registry] — V2 registry; uses `registry.beastforms` or the default beastform map
 * @returns {object} shallow copy with `_beastformOptions` set, or the original reference when unchanged
 */
export function attachBeastformOptions(character, registry) {
  if (!character || typeof character !== 'object') return character;
  const map = registry?.beastforms ?? beastformsRegistryDefault;
  if (!map || character.classId !== DRUID_CLASS_SRD_ID) return character;

  const tier = character.tier ?? characterTierFromLevel(character.level);
  const list = Object.values(map).filter((b) => b.tier <= tier);
  list.sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name));
  return { ...character, _beastformOptions: list };
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
function snapshotForDeclarativeFeature(feature, character, tableBase, mergedFeatureState) {
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
  return buildTableSnapshot({
    fear: tableBase?.top?.fear ?? 0,
    mapConfig: tableBase?.top?.map ?? null,
    activeElements: [character],
    _ownerInstanceId: feature._ownerInstanceId ?? character.instanceId,
    _featureKey: feature.name ?? 'Feature',
    _activeFeature: feature,
    _sourceObject: sourceObject,
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
 *
 * **Druid + active beastform:** When `classId` is the Druid SRD id and a form is active
 * (`featureState` or legacy `activeBeastform.id`), each entry in **`registry.beastforms[id].features`**
 * is appended — these are V2 descriptors married to SRD metadata in `beastforms/index.js`
 * (`marryBeastformFeatures`). Annotated with `_source: 'beastform'`, `_beastformId`, `_sourceObject`
 * (full beastform row). In snapshots, **`table.source`** is that row; **`table.activeFeature`** is the sub-feature.
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
          ...(option.sourceScopeKey != null && option.sourceScopeKey !== ''
            ? { _sourceScopeKey: option.sourceScopeKey }
            : {}),
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
      const armorFeatures = Array.isArray(armor.features)
        ? armor.features
        : Array.isArray(armor.feature)
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

  // Beastform sub-features (Druid only, while a form is active — same ids as registry.beastforms rows)
  if (character.classId === DRUID_CLASS_SRD_ID) {
    const beastformId = getActiveBeastformIdFromCharacter(character);
    if (beastformId && registry.beastforms?.[beastformId]) {
      const row = registry.beastforms[beastformId];
      const subfeats = Array.isArray(row.features) ? row.features : [];
      for (const feat of subfeats) {
        if (feat && typeof feat === 'object') {
          features.push({
            ...feat,
            _ownerInstanceId: instanceId,
            _source: 'beastform',
            _sourceObject: row,
            _beastformId: beastformId,
          });
        }
      }
    }
  }

  return features;
}

// ---------------------------------------------------------------------------
// Beastform — declarative overlay (Druid Beastform / Evolution)
// ---------------------------------------------------------------------------

/**
 * Parse SRD strings like `"Agility +1"` or `"Evasion +2"` (same shape as client `parseBeastformBonus`).
 * @returns {{ stat: string, bonus: number } | null}
 */
export function parseBeastformStatBonus(str) {
  if (!str || typeof str !== 'string') return null;
  const m = str.trim().match(/^(\w+)\s*([+-]\d+)$/i);
  if (!m) return null;
  return { stat: m[1].toLowerCase(), bonus: parseInt(m[2], 10) };
}

function normalizeBeastformRangeBand(rangeStr) {
  const x = String(rangeStr).trim().toLowerCase();
  if (x === 'very close') return 'veryClose';
  if (x === 'very far') return 'veryFar';
  return x;
}

/**
 * Parse a beastform `attack` line such as `"Melee Agility d4 phy"`.
 * @returns {{ trait: string, range: string, damage: string, damageType: 'physical'|'magic' } | null}
 */
export function parseBeastformAttackLine(line) {
  if (!line || typeof line !== 'string') return null;
  const m = line
    .trim()
    .match(/^(Melee|Very Close|Close|Far|Very Far)\s+(\w+)\s+(d\d+)(?:\s+(phy|mag))?/i);
  if (!m) return null;
  return {
    trait: m[2].toLowerCase(),
    range: normalizeBeastformRangeBand(m[1]),
    damage: m[3],
    damageType: m[4]?.toLowerCase() === 'mag' ? 'magic' : 'physical',
  };
}

function pickActiveBeastformRef(mergedFeatureState) {
  const b = mergedFeatureState?.Beastform?.activeBeastform;
  const e = mergedFeatureState?.Evolution?.activeBeastform;
  if (b?.beastformId) return { ref: b, viaEvolution: false };
  if (e?.beastformId) return { ref: e, viaEvolution: true };
  return null;
}

/**
 * Apply SRD beastform row bonuses, virtual natural weapon, weapon disable hints, and domain lockout
 * when the druid has an active beastform (feature state or legacy full `character.activeBeastform`).
 *
 * @returns {{ domainLoadoutDisabled: boolean }}
 */
function applyBeastformDeclarativeOverlay({
  stats,
  virtualWeapons,
  mergeWeaponRenderHint,
  character,
  mergedFeatureState,
  beastformMap,
}) {
  const picked = pickActiveBeastformRef(mergedFeatureState);
  let row = null;
  let viaEvolution = false;

  if (picked) {
    row = beastformMap[picked.ref.beastformId];
    viaEvolution = picked.viaEvolution;
  }
  if (!row && character.activeBeastform?.attack) {
    row = character.activeBeastform;
    viaEvolution = row.viaEvolution === true;
  }

  if (!row) return { domainLoadoutDisabled: false };

  const tb = parseBeastformStatBonus(row.trait_bonus);
  if (tb && tb.stat !== 'evasion' && typeof stats[tb.stat] === 'number') {
    stats[tb.stat] += tb.bonus;
  }
  const eb = parseBeastformStatBonus(row.evasion_bonus);
  if (eb?.stat === 'evasion' && typeof stats.evasion === 'number') {
    stats.evasion += eb.bonus;
  }

  if (viaEvolution) {
    const ek = mergedFeatureState?.Evolution?.evolutionTraitKey || character.evolutionTraitKey;
    if (ek && typeof stats[ek] === 'number') stats[ek] += 1;
  }

  const atk = parseBeastformAttackLine(row.attack);
  if (atk) {
    virtualWeapons.push({
      id: '__beastform_natural__',
      name: row.name ? `${row.name} (Beastform)` : 'Beastform attack',
      ...atk,
    });
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
 * @returns {{ stats: object, virtualWeapons: object[], advantageTriggers: object[], damageAffinities: object, movementModes: object[], rangeOverrides: object, substituteArmorForHope: boolean, weaponRenderHints: object, extraTagTeamInitiationsPerSession: number, tagTeamPartnerHopeDiscount: number, domainLoadoutDisabled: boolean, contactsEverywhereSessionUses: number, shadowStepperVeryFarUnlocked: boolean }}
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

  for (const feature of features) {
    const table = snapshotForDeclarativeFeature(feature, character, tableBase, mergedFeatureState);

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

  const beastformMap = registry?.beastforms ?? beastformsRegistryDefault;
  const { domainLoadoutDisabled } = applyBeastformDeclarativeOverlay({
    stats,
    virtualWeapons,
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
    movementModes,
    rangeOverrides,
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
  };
}
