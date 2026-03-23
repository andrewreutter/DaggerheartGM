/**
 * SRD consumable — Minor Health Potion (common roll table 07).
 * daggerheart-srd/consumables/Minor Health Potion.md
 */

export const MinorHealthPotion = {
  name: 'Minor Health Potion',
  description: 'Clear 1d4 HP.',
  onUse(table) {
    const healed = table.rollDie('d4');
    table.me.clearHP(healed);
  },
};
