/**
 * SRD consumable — Circle of the Void (common roll table 40).
 * daggerheart-srd/consumables/Circle of the Void.md
 *
 * Zone effects (Far-range void, no casting inside, magic damage immunity) are
 * table-adjudicated; the engine applies the Stress cost when the item is used.
 */

export const CircleOfTheVoid = {
  name: 'Circle of the Void',
  description:
    'Mark a Stress to create a void that extends up to Far range. No magic can be cast inside the void, and creatures within the void are immune to magic damage.',
  onUse(table) {
    table.me.markStress(1);
  },
};
