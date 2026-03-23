/**
 * SRD consumable — Snap Powder (common roll table 18).
 * daggerheart-srd/consumables/Snap Powder.md
 */

export const SnapPowder = {
  name: 'Snap Powder',
  description: 'Mark a Stress and clear a HP.',
  onUse(table) {
    table.me.markStress(1);
    table.me.clearHP(1);
  },
};
