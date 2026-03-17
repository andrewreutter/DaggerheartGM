/**
 * Seraph class features.
 *
 * Prayer Dice flow:
 *   1. Clicking "Prayer Dice" in CharacterHoverCard rolls Nd4 (N = spellcast trait value).
 *   2. On banner dismiss, GMTableView builds _addModifiers from subItems and applies them
 *      via applyFeatureResources — one Prayer Die chip per d4 with usageModes: ['gainHope'].
 *   3. Each chip shows a "+Hope" button. Clicking it posts an ActionBanner (requires GM ack).
 *      On GM ack, handleBannerAcknowledge gains Hope equal to die value and removes the chip.
 *   4. Adding the die value to a roll: prayer die buttons appear directly in roll banners
 *      (for Seraph's own rolls and ally rolls). Clicking toggles a bonus to the displayed total;
 *      on Acknowledge the die is consumed.
 *   5. Reducing damage: a prayer die "-Dmg" toggle appears in damage banners when a character
 *      or ally is targeted. When toggled, subtracts die value from damage before thresholds;
 *      on Acknowledge the die is consumed.
 *   6. Chips with refreshOn: 'session' are auto-cleared on session start.
 */
export default {
  name: 'Seraph',
  // gainHope is handled via ActionBanner → GMTableView handleBannerAcknowledge
  // (requires GM acknowledge before applying Hope).
  onModifierUsed() {},
};
