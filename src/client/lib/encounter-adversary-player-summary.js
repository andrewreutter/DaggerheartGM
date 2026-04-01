/**
 * Player Encounter panel + player adversary map pin: when an instance row is shown.
 * Matches {@link GMTableView} damaged-instance filter for the player Encounter column.
 *
 * @param {object} displayEl
 * @param {object} inst
 * @returns {boolean}
 */
export function playerEncounterInstanceRowVisible(displayEl, inst) {
  const hpMax = displayEl.hp_max || 0;
  const hpCur = inst.currentHp ?? hpMax;
  const hpDamage = hpMax - hpCur;
  const stressDamage = inst.currentStress || 0;
  const hasConditions = !!(
    inst.vulnerable ||
    (inst.conditions != null && String(inst.conditions).trim() !== '')
  );
  return hpDamage > 0 || stressDamage > 0 || hasConditions;
}
