/**
 * Seraph class features — per-feature descriptors.
 *
 * SRD (class): Seraphs are divine fighters and healers imbued with sacred purpose. Their ethos traditionally aligns
 * with the domain or goals of their god. It is better to be a seraph's ally than their enemy.
 *
 * SRD (Prayer Dice): At the beginning of each session, roll a number of **d4s** equal to your subclass's Spellcast trait
 * and place them on your character sheet. These are your Prayer Dice. You can spend any number of Prayer Dice to aid
 * yourself or an ally within Far range. You can use a spent die's value to reduce incoming damage, add to a roll's
 * result after the roll is made, or gain Hope equal to the result. At the end of each session, clear all unspent Prayer Dice.
 *
 * SRD (Life Support, Hope): **Spend 3 Hope** to clear a Hit Point on an ally within Close range.
 *
 * Implementation: Prayer Dice is the hope ability; modifier usage (gainHope, add to roll, reduce damage) via
 * ActionBanner and handleBannerAcknowledge. onModifierUsed invoked when a Prayer Die chip is used in non-roll mode.
 */

/** @type {Record<string, object>} */
const features = {
  'Prayer Dice': {
    name: 'Prayer Dice',
    class: 'Seraph',
    onModifierUsed() {},
  },
};

export default features;
