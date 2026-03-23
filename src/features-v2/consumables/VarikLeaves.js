/**
 * SRD consumable — Varik Leaves (common roll table 10).
 * daggerheart-srd/consumables/Varik Leaves.md
 */

export const VarikLeaves = {
  name: 'Varik Leaves',
  description: 'You can eat these paired leaves to immediately gain 2 Hope.',
  onUse(table) {
    table.me.gainHope(2);
  },
};
