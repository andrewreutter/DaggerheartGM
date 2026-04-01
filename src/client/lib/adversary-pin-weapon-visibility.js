/**
 * Whether the offense list would show any weapon/action cards for the adversary map pin
 * (mirrors {@link CharacterWeaponList} filters — keep in sync when that component changes).
 */

import {
  getEffectiveWeaponRange,
  detectPairedWeapons,
  detectVersatileWeapons,
  detectOtherworldlyWeapons,
  detectChargedWeapons,
  runCharacterRender,
} from './character-calc.js';
import { rangeBandNameToFt, RANGE_BANDS_FT } from './map-range.js';
import { weaponMaxRangeFt } from './player-adversary-target-aid.js';
import { outOfRangeDisableReason } from '../components/CharacterDisplay.jsx';

function buildWeaponFailsDisabled(el, getValidTargets, ancestryFeatures, traits, isStressMaxed, weaponRenderHints) {
  const weaponSlotSrdId = (weapon) => {
    if (weapon.id === 'wep_0') return el.primaryWeaponId ?? null;
    if (weapon.id === 'wep_1') return el.secondaryWeaponId ?? null;
    return null;
  };
  const v2HintForWeapon = (weapon) => {
    const id = weaponSlotSrdId(weapon);
    return id && weaponRenderHints && typeof weaponRenderHints === 'object'
      ? weaponRenderHints[id]
      : undefined;
  };
  return (weapon) => {
    const v2Hint = v2HintForWeapon(weapon);
    if (v2Hint?.isDisabled === true) return true;
    if (!v2Hint && weapon.feature?.name === 'Pompous' && (traits.presence ?? 0) > 0) return true;
    if (weapon._charged && isStressMaxed) return true;
    return !!outOfRangeDisableReason(weapon, getValidTargets, el.instanceId, ancestryFeatures);
  };
}

/**
 * @returns {boolean} true when no weapon cards would render (same notion as empty title-row offense).
 */
export function computeWeaponListPinEmpty(el, {
  weaponReachMinFt,
  filterOutDisabledWeapons,
  getValidTargets,
}) {
  const ancestryFeatures = el.ancestryFeatures || [];
  const weaponsFull = (el.weapons || []).map((w) => ({
    ...w,
    effectiveRange:
      getEffectiveWeaponRange(w, ancestryFeatures) || w.effectiveRange || w.range || '',
  }));
  const weaponsReachFiltered =
    weaponReachMinFt != null && typeof weaponReachMinFt === 'number'
      ? weaponsFull.filter((w) => {
          const ft = weaponMaxRangeFt(w, ancestryFeatures);
          return ft != null && ft >= weaponReachMinFt;
        })
      : weaponsFull;

  const traits = el.traits || {};
  const isStressMaxed = (el.currentStress ?? 0) >= (el.maxStress ?? 6);
  const weaponRenderHints = el.weaponRenderHints;
  const weaponFailsDisabledFilter = buildWeaponFailsDisabled(
    el,
    getValidTargets,
    ancestryFeatures,
    traits,
    isStressMaxed,
    weaponRenderHints,
  );

  const weapons = filterOutDisabledWeapons
    ? weaponsReachFiltered.filter((w) => !weaponFailsDisabledFilter(w))
    : weaponsReachFiltered;

  const activeBeastform = el.activeBeastform;
  if (activeBeastform) {
    const beastformRangeWord = (activeBeastform.attack || '').trim().split(/\s+/)[0];
    const beastformFt = beastformRangeWord ? rangeBandNameToFt(beastformRangeWord) : null;
    const beastformReachOk =
      weaponReachMinFt == null ||
      (typeof weaponReachMinFt === 'number' && beastformFt != null && beastformFt >= weaponReachMinFt);
    if (beastformReachOk) {
      const beastformNoTargets =
        getValidTargets &&
        beastformFt != null &&
        el.instanceId &&
        (getValidTargets(el.instanceId, { weaponRangeFt: beastformFt }) ?? []).length === 0;
      const beastformDisabledReason = beastformNoTargets ? 'No targets in range' : null;
      const skipBeastformPinUi = filterOutDisabledWeapons && beastformDisabledReason;
      if (!skipBeastformPinUi) {
        return false;
      }
    }
  }

  const pairing = detectPairedWeapons(weapons);
  let virtualWeapon = null;
  if (pairing) {
    const { primaryWeapon, pairedWeapon } = pairing;
    if (
      !(
        filterOutDisabledWeapons &&
        (weaponFailsDisabledFilter(primaryWeapon) || weaponFailsDisabledFilter(pairedWeapon))
      )
    ) {
      virtualWeapon = { name: 'Paired' };
    }
  }
  if (virtualWeapon) return false;

  const ancestryVirtualWeaponsRaw = el._virtualWeapons || runCharacterRender(el).virtualWeapons;
  const ancestryVirtualWeapons = (ancestryVirtualWeaponsRaw || [])
    .filter((vw) => vw?.name && !weaponsFull.some((w) => w.name === vw.name))
    .filter((vw) => {
      if (weaponReachMinFt == null || typeof weaponReachMinFt !== 'number') return true;
      const ft = weaponMaxRangeFt(vw, ancestryFeatures);
      return ft != null && ft >= weaponReachMinFt;
    })
    .filter((vw) => {
      if (!filterOutDisabledWeapons) return true;
      const vwWeapon = {
        ...vw,
        effectiveRange: getEffectiveWeaponRange(vw, ancestryFeatures) || vw.effectiveRange || vw.range || '',
      };
      return !weaponFailsDisabledFilter(vwWeapon);
    });
  if (ancestryVirtualWeapons.length > 0) return false;

  const versatilePairs = detectVersatileWeapons(weapons);
  for (const { alternate } of versatilePairs) {
    const altW = { ...alternate, effectiveRange: getEffectiveWeaponRange(alternate, el.ancestryFeatures) };
    if (!filterOutDisabledWeapons || !weaponFailsDisabledFilter(altW)) return false;
  }

  const otherworldlyPairs = detectOtherworldlyWeapons(weapons);
  for (const { physicalVariant, magicalVariant } of otherworldlyPairs) {
    const phyW = { ...physicalVariant, effectiveRange: getEffectiveWeaponRange(physicalVariant, el.ancestryFeatures) };
    const magW = { ...magicalVariant, effectiveRange: getEffectiveWeaponRange(magicalVariant, el.ancestryFeatures) };
    const hidePhy = filterOutDisabledWeapons && weaponFailsDisabledFilter(phyW);
    const hideMag = filterOutDisabledWeapons && weaponFailsDisabledFilter(magW);
    if (!hidePhy || !hideMag) return false;
  }

  const chargedPairs = detectChargedWeapons(weapons);
  if (chargedPairs.length > 0 && !(filterOutDisabledWeapons && isStressMaxed)) return false;

  const startlingOk =
    weaponReachMinFt == null || weaponReachMinFt <= RANGE_BANDS_FT.MELEE;
  const startlingWeapons = startlingOk ? weapons.filter((w) => w.feature?.name === 'Startling') : [];
  if (startlingWeapons.length > 0 && !(filterOutDisabledWeapons && isStressMaxed)) return false;

  const otherworldlyOriginals = new Set(otherworldlyPairs.map((o) => o.original));
  const normalWeapons = weapons.filter((w) => !otherworldlyOriginals.has(w));
  return normalWeapons.length === 0;
}
