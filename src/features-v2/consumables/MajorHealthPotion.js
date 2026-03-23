/**
 * SRD consumable — Major Health Potion (common roll table 43).
 * daggerheart-srd/consumables/Major Health Potion.md
 */

export const MajorHealthPotion = {
  name: 'Major Health Potion',
  description: 'Clear 1d4+2 HP.',
  onUse(table) {
    const healed = table.rollDie('d4') + 2;
    table.me.clearHP(healed);
  },
};
