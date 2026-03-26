/**
 * Declarative sheet bridge — merges `loadCharacterFeatures` + `applyDeclarativeFeatures`
 * output onto `recomputeCharacter` results (weapon hints, trait overrides, etc.).
 */

import v2registry from '../../features-v2/registry.js';
import {
  attachBeastformOptions,
  loadCharacterFeatures,
  applyDeclarativeFeatures,
} from '../../features-v2/index.js';
import { getResolvedActiveBeastformBonuses } from './character-calc.js';

/**
 * Merge SRD weapon/armor rows into the V2 registry so `loadCharacterFeatures` can resolve
 * weapon_properties / armor_properties by feature name on each item.
 *
 * @param {object} srdData — from `useCharacterSrdData` (expects `weaponsById`, `armorById`)
 * @returns {object} registry-like object safe to pass to `loadCharacterFeatures`
 */
export function buildV2RegistryWithSrdItems(srdData) {
  return {
    ...v2registry,
    weapons: srdData?.weaponsById || {},
    armor: srdData?.armorById || {},
  };
}

/**
 * Resolve SRD weapon id for a sheet weapon row (`wep_0` / `wep_1` → primary/secondary SRD ids).
 * @param {object} weaponRow — `buildActiveFeatures` weapon row (`source` = resolved weapon object)
 * @param {{ primaryWeaponId?: string, secondaryWeaponId?: string }} char
 */
function weaponRowSrdId(weaponRow, char) {
  const src = weaponRow?.source;
  if (!src || typeof src !== 'object') return null;
  const id = src.id;
  if (id === 'wep_0') return char.primaryWeaponId ?? null;
  if (id === 'wep_1') return char.secondaryWeaponId ?? null;
  if (typeof id === 'string' && id.startsWith('srd-wpn-')) return id;
  return null;
}

/**
 * Match one `loadCharacterFeatures` row to a `buildActiveFeatures` row so we can copy
 * `_sourceScopeKey` and other V2 annotations (View implementation source on feature cards).
 *
 * @param {object} row — entry from `recomputeCharacter` `activeFeatures`
 * @param {object[]} engine — `mergedEngineFeatures` from the declarative loader
 * @param {object} char — `charForLoader` (weapon ids, armorId, etc.)
 */
export function findMatchingEngineFeature(row, engine, char) {
  if (!row || !Array.isArray(engine)) return null;
  const candidates = engine.filter((e) => e && e.name === row.name);
  if (candidates.length === 0) return null;
  const t = row.type;

  if (t === 'class') return candidates.find((e) => e._source === 'class') ?? null;
  if (t === 'subclass') return candidates.find((e) => e._source === 'subclass') ?? null;
  if (t === 'ancestry') return candidates.find((e) => e._source === 'ancestry') ?? null;
  if (t === 'community') return candidates.find((e) => e._source === 'community') ?? null;

  if (t === 'ability') {
    const aid = row.id;
    return (
      candidates.find(
        (e) =>
          e._source === 'ability' &&
          (e._sourceScopeKey === `abilities:${aid}` || e._sourceObject?.id === aid),
      ) ?? null
    );
  }

  if (t === 'weapon') {
    const srid = weaponRowSrdId(row, char);
    if (srid) {
      const hit = candidates.find((e) => e._source === 'weapon_property' && e._weaponId === srid);
      if (hit) return hit;
    }
    return candidates.find((e) => e._source === 'weapon_property') ?? null;
  }

  if (t === 'armor') {
    const matches = candidates.filter((e) => e._source === 'armor_property');
    if (matches.length === 1) return matches[0];
    const aid = char.armorId;
    return (
      matches.find((e) => e._sourceScopeKey === `armor:${aid}` || e._sourceObject?.id === aid) ?? matches[0] ?? null
    );
  }

  if (t === 'beastform') {
    return candidates.find((e) => e._source === 'beastform') ?? null;
  }

  return null;
}

/**
 * Copy V2 registry linkage from engine rows onto sheet `activeFeatures` (which omit `_sourceScopeKey`).
 */
function enrichActiveFeaturesWithEngineRows(activeFeatures, engine, char) {
  if (!Array.isArray(activeFeatures) || activeFeatures.length === 0) return activeFeatures;
  return activeFeatures.map((row) => {
    const e = findMatchingEngineFeature(row, engine, char);
    if (!e) return row;
    return {
      ...row,
      _sourceScopeKey: e._sourceScopeKey ?? row._sourceScopeKey,
      _source: e._source ?? row._source,
      _sourceObject: e._sourceObject ?? row._sourceObject,
      _ownerInstanceId: e._ownerInstanceId ?? row._ownerInstanceId,
      _weaponId: e._weaponId ?? row._weaponId,
      _itemId: e._itemId ?? row._itemId,
      _consumableId: e._consumableId ?? row._consumableId,
      _beastformId: e._beastformId ?? row._beastformId,
      _weaponFeatureText: e._weaponFeatureText ?? row._weaponFeatureText,
    };
  });
}

/**
 * Map SRD ancestry ids (`srd-anc-*`) to V2 compound keys (`Human.HighStamina`) by matching
 * SRD feature display names to V2 descriptor `name` fields and ancestry labels.
 *
 * @param {string[]} ancestryIds
 * @param {object} srdData
 * @param {object} [v2AncestriesRegistry] — default: `ancestries` barrel
 * @returns {string[]}
 */
export function expandSrdAncestryIdsToV2Keys(
  ancestryIds,
  srdData,
  v2AncestriesRegistry = v2registry.ancestries
) {
  if (!Array.isArray(ancestryIds) || !srdData?.ancestriesById || !v2AncestriesRegistry) return [];
  const out = [];
  for (const aid of ancestryIds) {
    const row = srdData.ancestriesById[aid];
    if (!row) continue;
    out.push(...resolveSrdAncestryRowToV2Keys(row, v2AncestriesRegistry));
  }
  return out;
}

/**
 * @param {{ name?: string, features?: { name?: string }[] }} srdRow
 * @param {object} v2Ancestries
 * @returns {string[]}
 */
export function resolveSrdAncestryRowToV2Keys(srdRow, v2Ancestries) {
  const keys = [];
  const v2Entries = Object.entries(v2Ancestries || {});
  for (const f of srdRow.features || []) {
    const fn = (f.name || '').trim().toLowerCase();
    if (!fn) continue;
    for (const [k, desc] of v2Entries) {
      const dot = k.indexOf('.');
      if (dot === -1) continue;
      const prefix = k.slice(0, dot);
      const dname = (desc?.name || '').trim().toLowerCase();
      if (dname !== fn) continue;
      if (!ancestryNameMatchesV2Prefix(srdRow.name, prefix)) continue;
      keys.push(k);
      break;
    }
  }
  return keys;
}

function ancestryNameMatchesV2Prefix(srdAncestryName, v2Prefix) {
  const a = String(srdAncestryName || '')
    .replace(/[^a-zA-Z]/g, '')
    .toLowerCase();
  const b = String(v2Prefix || '')
    .replace(/[^a-zA-Z]/g, '')
    .toLowerCase();
  if (!a || !b) return false;
  if (a === b) return true;
  const first = String(srdAncestryName || '')
    .split(/\s+/)[0]
    .replace(/[^a-zA-Z]/g, '')
    .toLowerCase();
  if (first === b) return true;
  if (a.length >= 3 && b.length >= 3 && (a.endsWith(b) || b.endsWith(a))) return true;
  return false;
}

/**
 * @param {object} recomputed — output of `recomputeCharacter`
 * @param {object} rawCharacter — library / table element (ids + runtime fields)
 * @param {object} srdData
 * @param {{ fearCount?: number, mapConfig?: object | null, tableFeatureState?: object }} [ctx]
 * @returns {object}
 */
export function mergeV2DeclarativeSheetOverlay(recomputed, rawCharacter, srdData, ctx = {}) {
  if (!recomputed || !srdData) return recomputed;

  const registry = buildV2RegistryWithSrdItems(srdData);
  const v2AncestryKeys = expandSrdAncestryIdsToV2Keys(
    rawCharacter.ancestryIds || recomputed.ancestryIds || [],
    srdData,
    registry.ancestries
  );

  let charForLoader = {
    ...recomputed,
    primaryWeaponId: rawCharacter.primaryWeaponId ?? recomputed.primaryWeaponId,
    secondaryWeaponId: rawCharacter.secondaryWeaponId ?? recomputed.secondaryWeaponId,
    armorId: rawCharacter.armorId ?? recomputed.armorId,
    classId: rawCharacter.classId ?? recomputed.classId,
    subclassId: rawCharacter.subclassId ?? recomputed.subclassId,
    communityId: rawCharacter.communityId ?? recomputed.communityId,
    abilityIds: rawCharacter.abilityIds ?? recomputed.abilityIds,
    weaponIds: rawCharacter.weaponIds ?? recomputed.weaponIds,
    level: rawCharacter.level ?? recomputed.level,
    tier: rawCharacter.tier ?? recomputed.tier,
    featureState: rawCharacter.featureState ?? recomputed.featureState,
    activeBeastform: rawCharacter.activeBeastform ?? recomputed.activeBeastform,
    gold: rawCharacter.gold ?? recomputed.gold ?? 0,
    inventory: rawCharacter.inventory ?? recomputed.inventory ?? [],
    spellcastTrait: rawCharacter.spellcastTrait ?? recomputed.spellcastTrait,
    evolutionTraitKey: rawCharacter.evolutionTraitKey ?? recomputed.evolutionTraitKey,
    domainLoadout: rawCharacter.domainLoadout ?? recomputed.domainLoadout,
    substituteArmorForHope:
      rawCharacter.substituteArmorForHope ?? recomputed.substituteArmorForHope,
    ancestryIds: v2AncestryKeys.length ? v2AncestryKeys : rawCharacter.ancestryIds || [],
    // Library rows use `id`; table elements use `instanceId`. Both must feed V2 snapshots so `table.me` resolves.
    instanceId:
      recomputed.instanceId ||
      rawCharacter.instanceId ||
      recomputed.id ||
      rawCharacter.id,
  };

  charForLoader = attachBeastformOptions(charForLoader, registry);

  const tableBase = {
    top: {
      fear: ctx.fearCount ?? 0,
      map: ctx.mapConfig ?? null,
    },
    featureState: ctx.tableFeatureState,
  };

  const features = loadCharacterFeatures(charForLoader, registry);
  const decl = applyDeclarativeFeatures(features, charForLoader, tableBase, registry);
  const mergedEngineFeatures = decl.mergedFeatures || features;

  const baseMajor = recomputed.armorThresholds?.major ?? 0;
  const baseSev = recomputed.armorThresholds?.severe ?? 0;
  const v2MajorDelta = Math.max(0, (decl.stats?.majorThreshold ?? baseMajor) - baseMajor);
  const v2SevereDelta = Math.max(0, (decl.stats?.severeThreshold ?? baseSev) - baseSev);

  /** Hope ability (e.g. Druid Evolution) lives in V2 `classes` registry but not in SRD `class_features` — append so GuideFeatureCard + card chips work on the Game Table. */
  let activeFeatures = enrichActiveFeaturesWithEngineRows(recomputed.activeFeatures || [], mergedEngineFeatures, charForLoader);
  const hopeName = recomputed.hopeFeature?.name;
  if (hopeName && !activeFeatures.some((a) => a.name === hopeName)) {
    const hopeRow = mergedEngineFeatures.find((f) => f.name === hopeName);
    if (hopeRow && (hopeRow.chips || hopeRow.hooks)) {
      const srdClassObj = srdData.classesById?.[charForLoader.classId];
      activeFeatures = [
        ...activeFeatures,
        {
          ...hopeRow,
          type: 'class',
          source: srdClassObj ?? recomputed.class,
        },
      ];
    }
  }

  const beastformVirtualRows = (decl.virtualFeaturesExpanded || []).filter((f) => f._source === 'beastform');
  if (beastformVirtualRows.length) {
    activeFeatures = [
      ...activeFeatures,
      ...beastformVirtualRows.map((f) => ({
        ...f,
        type: 'beastform',
        sourceType: 'beastform',
        source: f._sourceObject?.name ?? 'Beastform',
      })),
    ];
    const bfSrc = beastformVirtualRows[0]._sourceObject;
    const adv = bfSrc?.advantageTriggers;
    if (Array.isArray(adv) && adv.length) {
      activeFeatures.push({
        name: bfSrc.name || 'Beastform',
        type: 'beastform',
        sourceType: 'beastform',
        source: bfSrc.name,
        advantageTriggers: adv,
        id: `${bfSrc.id || 'beastform'}-advantages`,
      });
    }
  }

  const traitOv = decl.weaponTraitOverrides || {};
  let weapons = recomputed.weapons ? [...recomputed.weapons] : [];
  // Replace stub rows from `runCharacterRender` with V2-resolved virtual weapons (e.g. Druid Beastform `when(virtualWeapon)`).
  weapons = weapons.filter((w) => {
    if (!w) return false;
    if (w.id === '__beastform_natural__') return false;
    if (w._featureName === 'Beastform' && !w.damage) return false;
    if (Array.isArray(w._predicates)) return false;
    return true;
  });
  if (Array.isArray(decl.virtualWeapons) && decl.virtualWeapons.length) {
    // `recomputeCharacter` → `runCharacterRender` already merges registry `virtualWeapons`
    // into `recomputed.weapons` and `recomputed._virtualWeapons`. Appending `decl.virtualWeapons`
    // again duplicates cards (e.g. Katari Retracting Claws).
    const seen = new Set(weapons.map((w) => w?.name).filter(Boolean));
    const extra = [];
    for (const vw of decl.virtualWeapons) {
      if (!vw || typeof vw !== 'object') continue;
      const n = vw.name;
      if (!n || seen.has(n)) continue;
      seen.add(n);
      extra.push({ ...vw });
    }
    if (extra.length) weapons = [...weapons, ...extra];
  }
  if (weapons.length && Object.keys(traitOv).length) {
    weapons = weapons.map((w) => {
      const srdId =
        w.id === 'wep_0'
          ? charForLoader.primaryWeaponId
          : w.id === 'wep_1'
            ? charForLoader.secondaryWeaponId
            : null;
      const t = srdId && traitOv[srdId];
      return t ? { ...w, trait: t } : w;
    });
  }

  const bfBonuses = getResolvedActiveBeastformBonuses(
    {
      ...rawCharacter,
      ...recomputed,
      featureState: rawCharacter.featureState ?? recomputed.featureState,
      activeBeastform: rawCharacter.activeBeastform ?? recomputed.activeBeastform,
    },
    srdData
  );
  let activeBeastformOut = rawCharacter.activeBeastform ?? recomputed.activeBeastform ?? null;
  if (bfBonuses) {
    activeBeastformOut = {
      ...(activeBeastformOut || {}),
      id: activeBeastformOut?.id || activeBeastformOut?.beastformId || bfBonuses.id,
      beastformId: activeBeastformOut?.beastformId || activeBeastformOut?.id || bfBonuses.id,
      name: activeBeastformOut?.name || bfBonuses.name,
      trait_bonus: bfBonuses.trait_bonus,
      evasion_bonus: bfBonuses.evasion_bonus,
      attack: activeBeastformOut?.attack || bfBonuses.attack,
      advantages: activeBeastformOut?.advantages ?? bfBonuses.advantages,
    };
  }

  return {
    ...recomputed,
    /** CONV-011 rest slot totals from merged declarative features (Rest banner + Potion of Stability, etc.). */
    _v2RestSlotStats: {
      numShortRestSlots: decl.stats?.numShortRestSlots ?? 0,
      numLongRestSlots: decl.stats?.numLongRestSlots ?? 0,
      numLongMovesInShortRest: decl.stats?.numLongMovesInShortRest ?? 0,
    },
    // Table/runtime fields must win over recomputed so Game Table patches (e.g. activeModifiers) are visible on the sheet.
    activeModifiers: rawCharacter.activeModifiers ?? recomputed.activeModifiers ?? [],
    featureState: rawCharacter.featureState ?? recomputed.featureState,
    /** Declarative V2 threshold deltas (e.g. Earth channel) for `effectiveThresholds` / defense row breakdown. */
    _v2MajorThresholdBonus: v2MajorDelta || undefined,
    _v2SevereThresholdBonus: v2SevereDelta || undefined,
    activeFeatures,
    weapons,
    weaponRenderHints: decl.weaponRenderHints,
    domainLoadoutDisabled: decl.domainLoadoutDisabled,
    substituteArmorForHope: decl.substituteArmorForHope,
    _v2RangeOverrides: decl.rangeOverrides,
    _v2ExtraTagTeamInitiationsPerSession: decl.extraTagTeamInitiationsPerSession,
    _v2TagTeamPartnerHopeDiscount: decl.tagTeamPartnerHopeDiscount,
    contactsEverywhereSessionUses: decl.contactsEverywhereSessionUses ?? 1,
    shadowStepperVeryFarUnlocked: decl.shadowStepperVeryFarUnlocked === true,
    activeBeastform: activeBeastformOut,
  };
}
