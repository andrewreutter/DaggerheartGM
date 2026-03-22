/**
 * V2 declarative sheet bridge — merges `loadCharacterFeatures` + `applyDeclarativeFeatures`
 * output onto Phase 1 `recomputeCharacter` results when the feature flag is on.
 *
 * Flag: user menu **V1 / V2** toggle (persists `localStorage.dh_v2DeclarativeSheet`), or `?v2Sheet=1`,
 * or tests: `globalThis.__DH_V2_DECLARATIVE_SHEET__ = true`.
 */

import { useSyncExternalStore } from 'react';
import v2registry from '../../features-v2/registry.js';
import {
  attachBeastformOptions,
  loadCharacterFeatures,
  applyDeclarativeFeatures,
} from '../../features-v2/index.js';

export const V2_DECLARATIVE_SHEET_LS_KEY = 'dh_v2DeclarativeSheet';

const LS_KEY = V2_DECLARATIVE_SHEET_LS_KEY;

/**
 * @returns {boolean}
 */
export function isV2DeclarativeSheetEnabled() {
  if (typeof globalThis.__DH_V2_DECLARATIVE_SHEET__ === 'boolean') {
    return globalThis.__DH_V2_DECLARATIVE_SHEET__;
  }
  if (typeof window === 'undefined') return false;
  try {
    if (new URLSearchParams(window.location.search).get('v2Sheet') === '1') return true;
    if (window.localStorage?.getItem(LS_KEY) === '1') return true;
  } catch {
    /* ignore */
  }
  return false;
}

/**
 * Subscribe to changes (user toggle, other tabs’ localStorage, or `?v2Sheet` URL strip).
 * For React, prefer {@link useV2DeclarativeSheetEnabledLive}.
 */
export function subscribeV2DeclarativeSheet(onStoreChange) {
  if (typeof window === 'undefined') return () => {};
  const fire = () => onStoreChange();
  const onStorage = (e) => {
    if (e.key === LS_KEY || e.key === null) fire();
  };
  window.addEventListener('dh-v2-declarative-sheet', fire);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener('dh-v2-declarative-sheet', fire);
    window.removeEventListener('storage', onStorage);
  };
}

/**
 * Persist V1/V2 preference and notify subscribers (same tab + `storage` for other tabs).
 * Choosing V1 removes `v2Sheet=1` from the URL so the query param does not override.
 */
export function setV2DeclarativeSheetPreference(enabled) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LS_KEY, enabled ? '1' : '0');
  } catch {
    /* ignore */
  }
  if (!enabled) {
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.has('v2Sheet')) {
        url.searchParams.delete('v2Sheet');
        window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
      }
    } catch {
      /* ignore */
    }
  }
  window.dispatchEvent(new CustomEvent('dh-v2-declarative-sheet'));
}

/**
 * Re-render when {@link setV2DeclarativeSheetPreference} runs or storage changes elsewhere.
 * @returns {boolean}
 */
export function useV2DeclarativeSheetEnabledLive() {
  return useSyncExternalStore(subscribeV2DeclarativeSheet, isV2DeclarativeSheetEnabled, () => false);
}

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
  if (!isV2DeclarativeSheetEnabled()) return recomputed;
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
    spellcastTrait: rawCharacter.spellcastTrait ?? recomputed.spellcastTrait,
    evolutionTraitKey: rawCharacter.evolutionTraitKey ?? recomputed.evolutionTraitKey,
    domainLoadout: rawCharacter.domainLoadout ?? recomputed.domainLoadout,
    substituteArmorForHope:
      rawCharacter.substituteArmorForHope ?? recomputed.substituteArmorForHope,
    ancestryIds: v2AncestryKeys.length ? v2AncestryKeys : rawCharacter.ancestryIds || [],
    instanceId: recomputed.instanceId || rawCharacter.instanceId,
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

  return {
    ...recomputed,
    weaponRenderHints: decl.weaponRenderHints,
    domainLoadoutDisabled: decl.domainLoadoutDisabled,
    substituteArmorForHope: decl.substituteArmorForHope,
    _v2RangeOverrides: decl.rangeOverrides,
    _v2ExtraTagTeamInitiationsPerSession: decl.extraTagTeamInitiationsPerSession,
    _v2TagTeamPartnerHopeDiscount: decl.tagTeamPartnerHopeDiscount,
    contactsEverywhereSessionUses: decl.contactsEverywhereSessionUses ?? 1,
    shadowStepperVeryFarUnlocked: decl.shadowStepperVeryFarUnlocked === true,
  };
}
