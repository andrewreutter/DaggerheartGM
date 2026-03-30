/**
 * Flatten persisted feature get/set bags for Game Table sidebar display.
 *
 * - V2: Values written with **`table.source.set` / `table.feature.set`** are recorded in
 *   `featureStateDeclared` and listed here. Values written only with **`setInternal`**
 *   (framework toggles, etc.) are **not** declared and are omitted — including when
 *   `featureStateDeclared` is missing (legacy rows): we still skip keys like `_v2t:…`
 *   that only `setInternal` uses).
 * - Legacy hooks: `_originFeatureStateDeclared` for keys from `feature.set` in `onRoll`;
 *   when that map is absent, legacy bags are flattened minus `_v2t:` keys.
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
 * Keys persisted only via `table.*.setInternal` (chip toggle storage, etc.), never via
 * the author-facing `set()` API. Must not appear in Feature state even in legacy fallback.
 */
function isFrameworkInternalFeatureStateKey(key) {
  return String(key).startsWith('_v2t:');
}

/** Legacy boolean mirror of Wings of Light toggle; flying is tracked via `_v2t:` + helpers. */
function isLegacyWingedSentinelFlyingMirror(scopeKey, key) {
  return scopeKey === 'WingedSentinel' && key === 'flying';
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
      if (k === '_cardValues') continue;
      if (v === undefined) continue;
      if (isFrameworkInternalFeatureStateKey(k)) continue;
      if (isLegacyWingedSentinelFlyingMirror(scopeKey, k)) continue;
      const lineKey = `${scopeKey}.${k}`;
      if (seen.has(lineKey)) continue;
      seen.add(lineKey);
      lines.push({ lineKey, value: formatFeatureStateValue(v) });
    }
  }

  function addFromDeclaredMap(scopeKey, bag, declaredBag) {
    if (!bag || typeof bag !== 'object' || Array.isArray(bag)) return;
    if (!declaredBag || typeof declaredBag !== 'object' || Array.isArray(declaredBag)) return;
    for (const [k, marked] of Object.entries(declaredBag)) {
      if (!marked) continue;
      if (k === '_cardValues') continue;
      if (isFrameworkInternalFeatureStateKey(k)) continue;
      if (isLegacyWingedSentinelFlyingMirror(scopeKey, k)) continue;
      if (!Object.prototype.hasOwnProperty.call(bag, k)) continue;
      const v = bag[k];
      if (v === undefined) continue;
      const lineKey = `${scopeKey}.${k}`;
      if (seen.has(lineKey)) continue;
      seen.add(lineKey);
      lines.push({ lineKey, value: formatFeatureStateValue(v) });
    }
  }

  const fs = el?.featureState;
  const fd = el?.featureStateDeclared;
  if (fs && typeof fs === 'object' && !Array.isArray(fs)) {
    if (fd !== undefined && fd !== null && typeof fd === 'object' && !Array.isArray(fd)) {
      for (const scopeKey of Object.keys(fd)) {
        addFromDeclaredMap(scopeKey, fs[scopeKey], fd[scopeKey]);
      }
    } else {
      for (const [scopeKey, bag] of Object.entries(fs)) {
        addNestedBag(scopeKey, bag);
      }
    }
  }

  const ori = el?._originFeatureState;
  const oriDecl = el?._originFeatureStateDeclared;
  if (ori && typeof ori === 'object' && !Array.isArray(ori)) {
    if (oriDecl !== undefined && oriDecl !== null && typeof oriDecl === 'object' && !Array.isArray(oriDecl)) {
      for (const scopeKey of Object.keys(oriDecl)) {
        addFromDeclaredMap(scopeKey, ori[scopeKey], oriDecl[scopeKey]);
      }
    } else {
      for (const [scopeKey, bag] of Object.entries(ori)) {
        addNestedBag(scopeKey, bag);
      }
    }
  }

  lines.sort((a, b) => a.lineKey.localeCompare(b.lineKey));
  return lines;
}
