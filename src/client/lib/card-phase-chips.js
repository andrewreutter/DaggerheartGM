/**
 * V2 feature chips may use `placement: 'card'` or `placements: ['card']`.
 */

export function isCardPhaseChip(chip) {
  if (!chip || typeof chip !== 'object') return false;
  if (chip.placement === 'card') return true;
  return Array.isArray(chip.placements) && chip.placements.includes('card');
}

export function filterCardPhaseChips(chips) {
  if (!Array.isArray(chips)) return [];
  return chips.filter(isCardPhaseChip);
}
