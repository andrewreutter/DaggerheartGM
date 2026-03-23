/**
 * SRD consumable — Health Potion (common roll table 19).
 * daggerheart-srd/consumables/Health Potion.md
 */

export const HealthPotion = {
  name: 'Health Potion',
  description: 'Clear 1d4+1 HP.',
  onUse(table) {
    const healed = table.rollDie('d4') + 1;
    table.me.clearHP(healed);
  },
};
