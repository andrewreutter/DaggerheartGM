/**
 * Game Table display labels for weapons, guide features, and domain cards.
 * Stored on the character element as `sheetDisplayNames: { weapons?, features?, abilities? }`.
 * Roll/banner human-readable text uses {@link formatSheetDisplayLabel}; `{Tag: ...}` blocks stay canonical.
 */

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
 * @returns {string}
 */
export function getFeatureSheetLabelParts(el, featureKey, originalName) {
  const o = String(originalName ?? '');
  const custom =
    featureKey &&
    el?.sheetDisplayNames?.features &&
    typeof el.sheetDisplayNames.features === 'object'
      ? el.sheetDisplayNames.features[featureKey]
      : undefined;
  return getSheetDisplayLabelParts(o, custom);
}

export function getFeatureSheetLabel(el, featureKey, originalName) {
  const { primary, parenthetical } = getFeatureSheetLabelParts(el, featureKey, originalName);
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
