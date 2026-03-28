/**
 * Adversary action — Clear the Decks (SRD)
 *
 * TODO ACTION [ATTACKSHAPED_RANGE]: Descriptor + roll wiring for range-scoped attack actions (`adversary-roll-descriptors.js`).
 * TODO ACTION [RESOURCE]: Adversary Stress mark for movement/ability (per SRD).
 * TODO ACTION [AURA]: Range-limited effect on PCs (per SRD).
 */
export const ClearTheDecks = {
  name: "Clear the Decks",
  type: 'action',
  description: "Make an attack against a target within Very Close range. On a success, **mark a Stress** to move into Melee range of the target, dealing **3d4** physical damage and knocking the target back to Close range.",
  adversaryAuraReminder: "Very Close — .",
};
