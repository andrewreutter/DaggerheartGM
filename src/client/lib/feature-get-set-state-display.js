/**
 * Flatten persisted feature get/set bags for Game Table sidebar display.
 *
 * - V2: `character.featureState[sourceScopeKey][key]` — `table.source.get` / `table.source.set`
 * - Legacy hooks: `character._originFeatureState[featureName][key]` — `feature.get` / `feature.set`
 *
 * When the same scope.key exists in both, V2 wins.
 */

function formatFeatureStateValue(value) {
  if (value === null || value === undefined) return String(value);
  const t = typeof value;
  if (t === 'string' || t === 'number' || t === 'boolean') return String(value);
  if (t === 'bigint') return String(value);
  try {
    const s = JSON.stringify(value);
    return s.length > 400 ? `${s.slice(0, 397)}…` : s;
  } catch {
    return '';
  }
}

/**
 * @param {object} [el]
 * @returns {{ lineKey: string, value: string }[]}
 */
export function getFeatureGetSetStateLines(el) {
  const lines = [];
  const seen = new Set();

  function addNestedBag(scopeKey, bag) {
    if (!bag || typeof bag !== 'object' || Array.isArray(bag)) return;
    for (const [k, v] of Object.entries(bag)) {
      if (v === undefined) continue;
      const lineKey = `${scopeKey}.${k}`;
      if (seen.has(lineKey)) continue;
      seen.add(lineKey);
      lines.push({ lineKey, value: formatFeatureStateValue(v) });
    }
  }

  const fs = el?.featureState;
  if (fs && typeof fs === 'object' && !Array.isArray(fs)) {
    for (const [scopeKey, bag] of Object.entries(fs)) {
      addNestedBag(scopeKey, bag);
    }
  }

  const ori = el?._originFeatureState;
  if (ori && typeof ori === 'object' && !Array.isArray(ori)) {
    for (const [scopeKey, bag] of Object.entries(ori)) {
      addNestedBag(scopeKey, bag);
    }
  }

  lines.sort((a, b) => a.lineKey.localeCompare(b.lineKey));
  return lines;
}
