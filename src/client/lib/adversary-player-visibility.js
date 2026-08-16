/**
 * Per-adversary player visibility on the Game Table.
 *
 * `visibleToPlayers` defaults to true when omitted (legacy rows and new adds).
 * `false` hides the adversary from players (SSE redaction + client filter).
 */

/** @param {{ visibleToPlayers?: boolean }|null|undefined} el */
export function isAdversaryVisibleToPlayers(el) {
  return el?.visibleToPlayers !== false;
}

/**
 * @param {Array<object>|null|undefined} elements
 * @returns {object[]}
 */
export function filterAdversariesVisibleToPlayers(elements) {
  return (elements || []).filter(
    (el) => el?.elementType !== 'adversary' || isAdversaryVisibleToPlayers(el),
  );
}

/** @param {Array<object>|null|undefined} adversaries */
export function canRevealAnyAdversaries(adversaries) {
  return (adversaries || []).some(
    (el) => el?.elementType === 'adversary' && !isAdversaryVisibleToPlayers(el),
  );
}

/** @param {Array<object>|null|undefined} adversaries */
export function canHideAnyAdversaries(adversaries) {
  return (adversaries || []).some(
    (el) => el?.elementType === 'adversary' && isAdversaryVisibleToPlayers(el),
  );
}

/**
 * Hidden adversaries are GM-only. Resolved table state uses `elements`;
 * some in-memory paths also carry `activeElements`.
 *
 * @param {object} state table_state-like
 * @param {'gm' | 'player'} audience
 */
export function redactHiddenAdversariesForAudience(state, audience) {
  if (!state || typeof state !== 'object') return state;
  if (audience !== 'player') return state;
  let next = state;
  for (const key of ['elements', 'activeElements']) {
    const els = next[key];
    if (!Array.isArray(els)) continue;
    const filtered = filterAdversariesVisibleToPlayers(els);
    if (filtered.length !== els.length) {
      next = { ...next, [key]: filtered };
    }
  }
  return next;
}
