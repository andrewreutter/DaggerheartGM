/**
 * SRD "Reaction Rolls": a reaction roll works like an action roll except it doesn't
 * generate Hope or Fear (and doesn't trigger additional GM moves). The dice are still
 * a Duality (Hope/Fear) pair, so the banner/log UI must not show Hope/Fear color
 * styling or "with Hope"/"with Fear" messaging for these rolls even though a Hope
 * and Fear die were rolled.
 *
 * Rolls are flagged via `_isReaction` in roll meta (GM-called reaction Proceed
 * in `GMTableView.jsx`, which reuses `handlePlayerOwnRoll`), persisted onto the
 * roll object end-to-end.
 */

/** True when Hope/Fear-specific messaging and color styling should be suppressed for this roll. */
export function isReactionRoll(roll) {
  return !!roll?._isReaction;
}

/**
 * Resolve which color scheme a Duality roll banner should use.
 * Returns 'neutral' | 'hope' | 'fear'. Reaction rolls always resolve to 'neutral'.
 */
export function resolveDualityBannerSchemeKey({ isReaction, hasDuality, resolved, dominantFromPreset, isHope }) {
  if (isReaction || !hasDuality || (!resolved && !dominantFromPreset)) return 'neutral';
  return isHope ? 'hope' : 'fear';
}
