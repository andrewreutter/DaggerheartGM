/**
 * Trait score numeral styling — shared by CharacterDisplay (trait grid, reaction row, weapon badges).
 */

/** Red / green / neutral text classes for the score digits only. */
export function traitScoreNumberColorClass(score) {
  if (score < 0) return 'text-red-200 dh-light:text-red-800';
  if (score > 0) return 'text-emerald-200 dh-light:text-emerald-800';
  return 'text-dh';
}

/** Larger numeral for −1 (or lower) and +2+; 0 and +1 use the smaller tier. */
export function traitScoreNumberIsLargeMagnitude(score) {
  return score < 0 || score >= 2;
}

/** Main trait grid: 0 < +1 < large; fixed row height uses min-h with these classes. */
export function traitScoreNumberSizeClassTraitChip(score) {
  if (score === 0) return 'text-lg';
  if (traitScoreNumberIsLargeMagnitude(score)) return 'text-2xl';
  return 'text-xl';
}

/** Reaction roll score numerals — one size per density; emphasis is color-only (`traitScoreNumberColorClass`). */
export function traitScoreNumberSizeClassReactionGrid(_score, compact) {
  return compact ? 'text-[10px]' : 'text-[11px]';
}

/** Weapon card trait badge numeral. */
export function traitScoreNumberSizeClassWeaponBadge(score) {
  if (score === 0) return 'text-[7px]';
  if (traitScoreNumberIsLargeMagnitude(score)) return 'text-[9px]';
  return 'text-[8px]';
}
