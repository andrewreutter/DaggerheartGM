/**
 * Declarative virtual natural weapon for Druid **Beastform** — used with `when()` on the class feature.
 * Kept separate from `feature-loader.js` so `classes/Druid.js` can import without circular deps.
 */

import { pickActiveBeastformRef, parseBeastformAttackLine } from './beastform-parse.js';
import beastformsRegistryDefault from '../beastforms/index.js';

const DRUID_CLASS_SRD_ID = 'srd-cls-druid';

function characterTierFromLevel(level) {
  const n = Number(level) || 1;
  if (n >= 8) return 4;
  if (n >= 5) return 3;
  if (n >= 2) return 2;
  return 1;
}

/** Map internal range band (e.g. `veryClose`) to SRD-style labels for WeaponCard. */
export function formatBeastformRangeForDisplay(rangeBand) {
  if (rangeBand == null || rangeBand === '') return '';
  const key = String(rangeBand).toLowerCase().replace(/\s+/g, '');
  const map = {
    melee: 'Melee',
    veryclose: 'Very Close',
    close: 'Close',
    far: 'Far',
    veryfar: 'Very Far',
  };
  return map[key] || rangeBand;
}

/**
 * Resolve the active SRD beastform row (registry or legacy full `character.activeBeastform`).
 *
 * @returns {{ row: object, viaEvolution: boolean } | null}
 */
export function getActiveBeastformRow(character, mergedFeatureState, beastformMap) {
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

  if (!row) return null;
  return { row, viaEvolution };
}

/**
 * Build the virtual weapon object merged into `applyDeclarativeFeatures` → client weapons list.
 */
export function buildBeastformVirtualWeaponEntry(character, mergedFeatureState, beastformMap) {
  const resolved = getActiveBeastformRow(character, mergedFeatureState, beastformMap);
  if (!resolved) return null;
  const { row } = resolved;
  const atk = parseBeastformAttackLine(row.attack);
  if (!atk) return null;
  const prof = Math.max(0, Math.floor(Number(character.proficiency) || 0));
  const dice = atk.damage || '';
  const damage = prof > 0 && dice ? `${dice}+${prof}` : dice;
  const rangeLabel = formatBeastformRangeForDisplay(atk.range);
  return {
    id: '__beastform_natural__',
    name: row.name ? `${row.name} (Beastform)` : 'Beastform attack',
    trait: atk.trait,
    damage,
    damageType: atk.damageType === 'magic' ? 'Magic' : 'Physical',
    range: rangeLabel,
    effectiveRange: rangeLabel,
  };
}

/**
 * Inner value for `virtualWeapon: when(hasActiveBeastformInTable, resolveBeastformVirtualWeapon)`.
 * Invoked from `applyDeclarativeFeatures` when the when-wrapper resolves to a function.
 */
export function resolveBeastformVirtualWeapon(table, feature, character, ctx) {
  const beastformMap = ctx?.beastformMap ?? ctx?.registry?.beastforms;
  if (!beastformMap || typeof beastformMap !== 'object') return null;
  return buildBeastformVirtualWeaponEntry(character, ctx.mergedFeatureState, beastformMap);
}

/**
 * Inner value for `virtualSources: when(hasActiveBeastformInTable, resolveBeastformVirtualSources)` on **Beastform**.
 * Returns registry refs `{ collection: 'beastforms', id }` for the active form; `applyDeclarativeFeatures` expands via `expandVirtualSourceRef`.
 *
 * @param {object} table
 * @param {object} feature — parent class feature (Beastform)
 * @param {object} character
 * @param {{ mergedFeatureState?: object, beastformMap?: object, registry?: object }} ctx
 * @returns {{ collection: string, id: string }[]}
 */
export function resolveBeastformVirtualSources(table, feature, character, ctx) {
  const beastformMap = ctx?.beastformMap ?? ctx?.registry?.beastforms;
  if (!beastformMap || typeof beastformMap !== 'object') return [];
  const resolved = getActiveBeastformRow(character, ctx.mergedFeatureState, beastformMap);
  if (!resolved) return [];
  let fullRow = resolved.row;
  const bid = fullRow.id || fullRow.beastformId;
  if (bid && beastformMap[bid]) fullRow = beastformMap[bid];
  const bfId = bid || fullRow.id;
  if (!bfId) return [];
  return [{ collection: 'beastforms', id: bfId }];
}

/**
 * Merge SRD beastform rows (tier ≤ character tier) onto `character._beastformOptions` for Druid picks.
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
