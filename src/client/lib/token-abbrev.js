/**
 * Battle-map token letter codes.
 *
 * Default encoding (`tokenAbbrev`): one word → first two letters; two or more words →
 * initials of the first two. Adversaries on the same table often share a family prefix
 * (`Jagged Knife Hexer` / `Jagged Knife Lieutenant` → both `JK`), so
 * `stripSharedNamePrefix` drops the longest leading word-run shared with any *other*
 * distinct name before that encoder runs. Prefixes are computed on distinct names, not
 * instances — five Lackeys still encode as `JK` (instance `#` distinguishes copies).
 */

/** Split on whitespace and `:` so `Fallen Warlord: Realm-Breaker` clusters with its sibling. */
export function tokenizeTokenName(name) {
  if (name == null) return [];
  return String(name).trim().split(/[\s:]+/).filter(Boolean);
}

/**
 * Two-letter code from a (possibly already-stripped) display name.
 * @param {unknown} name
 * @returns {string}
 */
export function tokenAbbrev(name) {
  if (!name) return '?';
  const words = String(name).trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function normalizedTokenWords(name) {
  return tokenizeTokenName(name).map((w) => w.toLowerCase()).join(' ');
}

/**
 * Drop the longest leading word-run this name shares with any other distinct name.
 * If stripping would consume the whole name, keep the last word.
 * When nothing is shared, the original trimmed name is returned unchanged (colons intact).
 *
 * @param {unknown} name
 * @param {Iterable<unknown>|null|undefined} distinctNames
 * @returns {string}
 */
export function stripSharedNamePrefix(name, distinctNames) {
  const raw = name == null ? '' : String(name).trim();
  const words = tokenizeTokenName(raw);
  if (words.length === 0) return raw;

  const selfNorm = words.map((w) => w.toLowerCase()).join(' ');
  let maxShared = 0;
  for (const other of distinctNames || []) {
    const otherWords = tokenizeTokenName(other);
    if (otherWords.length === 0) continue;
    if (otherWords.map((w) => w.toLowerCase()).join(' ') === selfNorm) continue;
    let i = 0;
    while (
      i < words.length
      && i < otherWords.length
      && words[i].toLowerCase() === otherWords[i].toLowerCase()
    ) {
      i += 1;
    }
    if (i > maxShared) maxShared = i;
  }

  if (maxShared === 0) return raw;
  if (maxShared >= words.length) return words[words.length - 1];
  return words.slice(maxShared).join(' ');
}

/**
 * Unique adversary display names in first-seen order (case-insensitive dedupe).
 * Pass the already-filtered table/scene adversary list (visible / present-for-party).
 *
 * @param {Iterable<{ elementType?: string, name?: unknown }>|null|undefined} elements
 * @returns {string[]}
 */
export function collectDistinctAdversaryNames(elements) {
  const seen = new Set();
  const out = [];
  for (const el of elements || []) {
    if (el?.elementType !== 'adversary') continue;
    const n = el.name == null ? '' : String(el.name).trim();
    if (!n) continue;
    const key = normalizedTokenWords(n) || n.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(n);
  }
  return out;
}

/**
 * @param {unknown} name
 * @param {Iterable<unknown>|null|undefined} distinctAdversaryNames
 * @returns {string}
 */
export function adversaryTokenAbbrev(name, distinctAdversaryNames) {
  return tokenAbbrev(stripSharedNamePrefix(name, distinctAdversaryNames));
}

/**
 * Letter code for a map/tray token. Characters and board tokens never strip prefixes.
 *
 * @param {{ elementType?: string, name?: unknown, label?: unknown }|null|undefined} element
 * @param {Iterable<unknown>|null|undefined} distinctAdversaryNames
 * @returns {string}
 */
export function tokenAbbrevForElement(element, distinctAdversaryNames) {
  if (!element) return tokenAbbrev(null);
  if (element.elementType === 'boardToken') {
    const label = element.label != null ? String(element.label) : element.name;
    return tokenAbbrev(label);
  }
  if (element.elementType === 'adversary') {
    return adversaryTokenAbbrev(element.name, distinctAdversaryNames);
  }
  return tokenAbbrev(element.name);
}
