/**
 * Game Table display labels for weapons, guide features, and domain cards.
 * Stored on the character element as `sheetDisplayNames: { weapons?, features?, abilities? }`.
 * Roll/banner human-readable text uses {@link formatSheetDisplayLabel}; `{Tag: ...}` blocks stay canonical.
 */

import { getOrderedGuideFeatureEntries } from './guide-feature-entries.js';

/**
 * Slug segment for {@link makeFeatureSheetDisplayKey} (lowercase alphanumerics + underscores).
 * @param {string|null|undefined} s
 */
export function slugForFeatureSheetKey(s) {
  if (s == null) return '';
  return String(s)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');
}

/**
 * Base stable key from SRD source label + feature name (before collision suffix).
 * Model + resolver use the same prefix; {@link finalizeFeatureSheetDisplayKeys} may append `__hex` when bases collide.
 *
 * @param {string|null|undefined} sourceName — class, subclass, ancestry, community, or beastform name string
 * @param {string|null|undefined} featureName
 */
export function makeFeatureSheetDisplayKey(sourceName, featureName) {
  const a = slugForFeatureSheetKey(sourceName);
  const b = slugForFeatureSheetKey(featureName);
  return `feat__${a}__${b}`;
}

/**
 * @param {string} a
 * @param {string} b
 */
function shortPairHashHex(a, b) {
  const s = `${a}\0${b}`;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).slice(0, 6);
}

/**
 * Given every guide feature row’s (source, name), produce a map `source\\0name` → final key string.
 * Unique bases keep {@link makeFeatureSheetDisplayKey}; colliding bases get `__` + hash suffix.
 *
 * @param {{ sourceName: string, featureName: string }[]} rows
 * @returns {Map<string, string>}
 */
export function finalizeFeatureSheetDisplayKeys(rows) {
  /** @type {Map<string, string[]>} */
  const baseToPairs = new Map();
  for (const r of rows || []) {
    const sn = String(r.sourceName ?? '').trim();
    const fn = String(r.featureName ?? '').trim();
    if (!fn) continue;
    const base = makeFeatureSheetDisplayKey(sn, fn);
    const pk = `${sn}\0${fn}`;
    if (!baseToPairs.has(base)) baseToPairs.set(base, []);
    baseToPairs.get(base).push(pk);
  }
  const out = new Map();
  for (const [base, pairKeys] of baseToPairs) {
    const uniq = [...new Set(pairKeys)];
    if (uniq.length <= 1) {
      out.set(uniq[0], base);
      continue;
    }
    for (const pk of uniq) {
      const [sn, fn] = pk.split('\0');
      out.set(pk, `${base}__${shortPairHashHex(sn, fn)}`);
    }
  }
  return out;
}

/**
 * Source string for feature-key slugging (matches SRD `resolveFeatures` / guide rows).
 * @param {object|null|undefined} row — guide `featRow`
 */
export function rowSourceNameForFeatureDisplayKey(row) {
  if (!row || typeof row !== 'object') return '';
  if (typeof row.source === 'string' && row.source.trim()) return row.source.trim();
  if (row.source && typeof row.source === 'object' && row.source.name != null) {
    return String(row.source.name).trim();
  }
  return '';
}

/**
 * @param {object} el — character element after `recomputeCharacter` (or equivalent)
 * @param {() => void} [onV2CardChip]
 * @returns {{ sourceName: string, featureName: string }[]}
 */
export function collectGuideFeatureKeyRows(el, onV2CardChip) {
  const entries = getOrderedGuideFeatureEntries(el, onV2CardChip ?? (() => {}));
  return entries
    .map((e) => ({
      sourceName: rowSourceNameForFeatureDisplayKey(e.row),
      featureName: e.row?.name != null ? String(e.row.name) : '',
    }))
    .filter((r) => r.featureName);
}

/**
 * Guide `entry.key` values plus finalized squashed keys for this sheet.
 *
 * @param {object} el
 * @param {() => void} [onV2CardChip]
 * @returns {Set<string>}
 */
export function buildAllowedFeatureSheetDisplayNameKeys(el, onV2CardChip) {
  const entries = getOrderedGuideFeatureEntries(el, onV2CardChip ?? (() => {}));
  const rows = collectGuideFeatureKeyRows(el, onV2CardChip);
  const pairToKey = finalizeFeatureSheetDisplayKeys(rows);
  const allowed = new Set();
  for (const e of entries) {
    if (e.key) allowed.add(String(e.key));
  }
  for (const k of pairToKey.values()) {
    if (k) allowed.add(k);
  }
  return allowed;
}

/**
 * @param {Record<string, string>|null|undefined} featuresMap — `el.sheetDisplayNames.features`
 * @param {string|null|undefined} guideKey
 * @param {string|null|undefined} sourceName
 * @param {string|null|undefined} featureName
 * @param {object|null|undefined} el
 */
export function resolveFeatureSheetDisplayCustom(featuresMap, guideKey, sourceName, featureName, el) {
  if (!featuresMap || typeof featuresMap !== 'object') return undefined;
  const gk = guideKey && String(guideKey).trim();
  if (gk && featuresMap[gk]) return featuresMap[gk];
  if (!el || sourceName == null || featureName == null) return undefined;
  const rows = collectGuideFeatureKeyRows(el);
  const pairToKey = finalizeFeatureSheetDisplayKeys(rows);
  const pk = `${String(sourceName).trim()}\0${String(featureName).trim()}`;
  const squashed = pairToKey.get(pk);
  return squashed && featuresMap[squashed] ? featuresMap[squashed] : undefined;
}

/**
 * @param {string} original
 * @param {string|null|undefined} custom
 * @returns {{ primary: string, parenthetical: string | null }}
 */
export function getSheetDisplayLabelParts(original, custom) {
  const o = String(original ?? '').trim();
  const c = custom == null ? '' : String(custom).trim();
  if (!c || c === o) return { primary: o, parenthetical: null };
  return { primary: c, parenthetical: o };
}

/**
 * @param {string} original
 * @param {string|null|undefined} custom
 * @returns {string}
 */
export function formatSheetDisplayLabel(original, custom) {
  const { primary, parenthetical } = getSheetDisplayLabelParts(original, custom);
  return parenthetical == null ? primary : `${primary} (${parenthetical})`;
}

/**
 * Split `attackerName + ' ' + formatSheetDisplayLabel(...)` for banner/action-line typography
 * (smaller parenthetical original). Optional suffix after the closing `)` is preserved
 * (e.g. `: Subfeature`, ` with Ranger's Focus attempt`).
 *
 * @param {string|null|undefined} displayName
 * @param {string|null|undefined} attackerName — character name prefix (e.g. `el.name`)
 * @returns {{ base: string, parenthetical: string | null, suffix: string }}
 */
export function splitDisplayNameForSheetParen(displayName, attackerName) {
  const d = String(displayName ?? '').trim();
  const a = String(attackerName ?? '').trim();
  if (!a || (!d.startsWith(`${a} `) && d !== a)) {
    return { base: d, parenthetical: null, suffix: '' };
  }
  const rest = d === a ? '' : d.slice(a.length).trimStart();
  const m = rest.match(/^(.+?)\s+\(([^)]+)\)([\s\S]*)$/);
  if (!m) return { base: d, parenthetical: null, suffix: '' };
  return {
    base: `${a} ${m[1].trim()}`,
    parenthetical: m[2].trim(),
    suffix: m[3] ?? '',
  };
}

/**
 * Stable key for a weapon row (matches CharacterWeaponList / rolls).
 * @param {object} weapon
 * @param {{ primaryWeaponId?: string|null, secondaryWeaponId?: string|null }} [el]
 * @returns {string|null}
 */
export function getWeaponSheetDisplayKey(weapon, el) {
  if (!weapon || typeof weapon !== 'object') return null;
  if (weapon.id != null && weapon.id !== '') return String(weapon.id);
  if (!el) return null;
  const n = weapon.name;
  if (weapon.isPrimary !== false && el.primaryWeaponId) return `slot-primary:${el.primaryWeaponId}`;
  if (weapon.isPrimary === false && el.secondaryWeaponId) return `slot-secondary:${el.secondaryWeaponId}`;
  if (typeof n === 'string' && n) return `name:${n}`;
  return null;
}

/**
 * @param {object} el — character element (may include sheetDisplayNames)
 * @param {object} weapon
 * @returns {string} label for rolls/banners (custom + parenthetical or original)
 */
export function getWeaponSheetLabelParts(el, weapon) {
  const original = weapon?.name != null ? String(weapon.name) : '';
  const key = getWeaponSheetDisplayKey(weapon, el);
  const custom =
    key && el?.sheetDisplayNames?.weapons && typeof el.sheetDisplayNames.weapons === 'object'
      ? el.sheetDisplayNames.weapons[key]
      : undefined;
  return getSheetDisplayLabelParts(original, custom);
}

export function getWeaponSheetLabel(el, weapon) {
  const { primary, parenthetical } = getWeaponSheetLabelParts(el, weapon);
  return parenthetical == null ? primary : `${primary} (${parenthetical})`;
}

/**
 * @param {object} el
 * @param {string} featureKey — Guide `entry.key`
 * @param {string} originalName
 * @param {string} [sourceName] — SRD source string on the feature row (class / subclass / ancestry name) for squashed-key lookup
 */
export function getFeatureSheetLabelParts(el, featureKey, originalName, sourceName) {
  const o = String(originalName ?? '');
  const custom = resolveFeatureSheetDisplayCustom(
    el?.sheetDisplayNames?.features,
    featureKey,
    sourceName,
    originalName,
    el,
  );
  return getSheetDisplayLabelParts(o, custom);
}

/**
 * @param {object} el
 * @param {string} featureKey
 * @param {string} originalName
 * @param {string} [sourceName]
 */
export function getFeatureSheetLabel(el, featureKey, originalName, sourceName) {
  const { primary, parenthetical } = getFeatureSheetLabelParts(el, featureKey, originalName, sourceName);
  return parenthetical == null ? primary : `${primary} (${parenthetical})`;
}

/**
 * @param {object} el
 * @param {string} abilityKey — e.g. `ability-${id}`
 * @param {string} originalName
 * @returns {string}
 */
export function getAbilitySheetLabelParts(el, abilityKey, originalName) {
  const o = String(originalName ?? '');
  const custom =
    abilityKey &&
    el?.sheetDisplayNames?.abilities &&
    typeof el.sheetDisplayNames.abilities === 'object'
      ? el.sheetDisplayNames.abilities[abilityKey]
      : undefined;
  return getSheetDisplayLabelParts(o, custom);
}

export function getAbilitySheetLabel(el, abilityKey, originalName) {
  const { primary, parenthetical } = getAbilitySheetLabelParts(el, abilityKey, originalName);
  return parenthetical == null ? primary : `${primary} (${parenthetical})`;
}

/**
 * Merge one override into `sheetDisplayNames` immutably (table-local bag only).
 * @param {object|null|undefined} prevBag — `el.sheetDisplayNames`
 * @param {'weapons'|'features'|'abilities'} bucket
 * @param {string} key
 * @param {string|null|undefined} value — empty clears that key
 * @returns {object|undefined} next `sheetDisplayNames`, or `undefined` if nothing left
 */
export function patchSheetDisplayNames(prevBag, bucket, key, value) {
  if (!key) return prevBag && Object.keys(prevBag).length ? prevBag : undefined;
  const v = value == null ? '' : String(value).trim();
  const prev = prevBag && typeof prevBag === 'object' ? prevBag : {};
  const prevBucket = { ...(prev[bucket] && typeof prev[bucket] === 'object' ? prev[bucket] : {}) };
  if (!v) {
    delete prevBucket[key];
  } else {
    prevBucket[key] = v;
  }
  const next = { ...prev };
  if (Object.keys(prevBucket).length === 0) {
    delete next[bucket];
  } else {
    next[bucket] = prevBucket;
  }
  if (Object.keys(next).length === 0) return undefined;
  return next;
}
