/**
 * SRD consumable — Stamina Potion (common roll table 20).
 * daggerheart-srd/consumables/Stamina Potion.md
 */

export const StaminaPotion = {
  name: 'Stamina Potion',
  description: 'Clear 1d4+1 Stress.',
  onUse(table) {
    const cleared = table.rollDie('d4') + 1;
    table.me.clearStress(cleared);
  },
};
