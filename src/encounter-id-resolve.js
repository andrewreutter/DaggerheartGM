/**
 * Near-match catalog ids when the encounter LLM hallucinates slugs.
 */

/**
 * @param {string} id
 * @returns {string}
 */
export function slugTail(id) {
  const s = String(id || '').trim().toLowerCase();
  return s.replace(/^srd-adv-|^srd-env-/, '').replace(/-/g, ' ').trim();
}

/**
 * Levenshtein distance (small strings only).
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

/**
 * 0–1 score (higher is better).
 * @param {string} a
 * @param {string} b
 */
export function stringSimilarityScore(a, b) {
  const x = String(a || '').toLowerCase().trim();
  const y = String(b || '').toLowerCase().trim();
  if (!x || !y) return 0;
  if (x === y) return 1;
  const d = levenshtein(x, y);
  const maxLen = Math.max(x.length, y.length);
  return maxLen === 0 ? 1 : 1 - d / maxLen;
}

const MIN_NEAR_MATCH = 0.62;

/**
 * @param {string} badId
 * @param {{ id: string, name?: string }[]} catalogItems
 * @param {{ nameHint?: string, minScore?: number }} [opts]
 * @returns {{ id: string, score: number } | null}
 */
export function findBestCatalogNearMatch(badId, catalogItems, opts = {}) {
  const minScore = opts.minScore ?? MIN_NEAR_MATCH;
  const tail = slugTail(badId);
  const hint = opts.nameHint ? String(opts.nameHint).trim().toLowerCase() : '';
  let best = null;
  let bestScore = 0;
  for (const item of catalogItems) {
    const cid = String(item.id || '');
    const ctail = slugTail(cid);
    const name = String(item.name || '').toLowerCase();
    let s = stringSimilarityScore(tail, ctail);
    if (hint && name) {
      s = Math.max(s, stringSimilarityScore(hint, name) * 0.95);
      if (name.includes(hint) || hint.includes(name)) s = Math.max(s, 0.85);
    }
    if (s > bestScore) {
      bestScore = s;
      best = cid;
    }
  }
  if (best && bestScore >= minScore) return { id: best, score: bestScore };
  return null;
}

/** @typedef {{ id: string, count: number, tier?: number, role?: string, nameHint?: string }} AdvPlanRow */
/** @typedef {{ id: string, count: number, tier?: number, type?: string, nameHint?: string }} EnvPlanRow */

/**
 * @param {AdvPlanRow[]} rows
 * @returns {AdvPlanRow[]}
 */
export function mergeAdvPlanRows(rows) {
  const m = new Map();
  for (const r of rows) {
    const prev = m.get(r.id);
    if (!prev) m.set(r.id, { ...r });
    else {
      m.set(r.id, {
        ...prev,
        count: prev.count + r.count,
      });
    }
  }
  return [...m.values()];
}

/**
 * @param {EnvPlanRow[]} rows
 * @returns {EnvPlanRow[]}
 */
export function mergeEnvPlanRows(rows) {
  const m = new Map();
  for (const r of rows) {
    const prev = m.get(r.id);
    if (!prev) m.set(r.id, { ...r });
    else m.set(r.id, { ...prev, count: prev.count + r.count });
  }
  return [...m.values()];
}
