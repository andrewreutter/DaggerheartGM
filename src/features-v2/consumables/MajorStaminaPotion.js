/**
 * SRD consumable — Major Stamina Potion (common roll table 44).
 * daggerheart-srd/consumables/Major Stamina Potion.md
 */

export const MajorStaminaPotion = {
  name: 'Major Stamina Potion',
  description: 'Clear 1d4+2 Stress.',
  onUse(table) {
    const cleared = table.rollDie('d4') + 2;
    table.me.clearStress(cleared);
  },
};
