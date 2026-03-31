/**
 * Parse JSON/body booleans without the `!!value` pitfall where non-empty strings
 * (e.g. `"false"`) are truthy.
 * @param {unknown} v
 * @param {boolean} [defaultValue=false]
 * @returns {boolean}
 */
export function parseHttpBooleanLoose(v, defaultValue = false) {
  if (v === true || v === 1) return true;
  if (v === false || v === 0) return false;
  if (v == null) return defaultValue;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    if (s === 'true' || s === '1' || s === 'yes') return true;
    if (s === 'false' || s === '0' || s === 'no' || s === '') return false;
  }
  return defaultValue;
}
