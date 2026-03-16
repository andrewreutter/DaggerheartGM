/**
 * Seraph class features.
 *
 * Prayer Dice flow:
 *   1. Clicking "Prayer Dice" in CharacterHoverCard rolls Nd4 (N = spellcast trait value).
 *   2. On banner dismiss, GMTableView extracts the individual d4 values and adds one
 *      Prayer Die chip per die to the character's activeModifiers.
 *   3. Each chip has a concrete `.value` (the rolled face). Clicking the chip
 *      broadcasts "Uses Prayer Die — value N" and removes the chip (handled by
 *      CharacterHoverCard's onUseMod callback — no IoC hook needed for the basic case).
 *   4. Chips with `refreshOn: 'session'` are auto-cleared on session start.
 */
export default {
  name: 'Seraph',
};
