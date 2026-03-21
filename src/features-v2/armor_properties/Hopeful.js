/**
 * SRD: When you would spend Hope, you can mark an Armor Slot instead.
 *
 * `substituteArmorForHope` is merged from declarative evaluation onto the character element so the
 * engine can authorize `spendHope(..., { armorInstead: true })` without referencing this feature’s name.
 */
export const Hopeful = {
  name: 'Hopeful',
  description: 'When you would spend Hope, you can mark an Armor Slot instead.',
  substituteArmorForHope: true,
};
