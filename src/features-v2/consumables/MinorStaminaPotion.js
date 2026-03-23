/**
 * SRD consumable — Minor Stamina Potion (common roll table 08).
 * daggerheart-srd/consumables/Minor Stamina Potion.md
 */

export const MinorStaminaPotion = {
  name: 'Minor Stamina Potion',
  description: 'Clear 1d4 Stress.',
  onUse(table) {
    const cleared = table.rollDie('d4');
    table.me.clearStress(cleared);
  },
};
