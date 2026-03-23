/**
 * SRD consumable — Feast of Xuria (common roll table 51).
 * daggerheart-srd/consumables/Feast of Xuria.md
 */

export const FeastOfXuria = {
  name: 'Feast of Xuria',
  description:
    'You can eat this meal to clear all HP and Stress and gain 1d4 Hope.',
  onUse(table) {
    const maxH = table.me.maxHP ?? 6;
    const curHp = table.me.currentHP ?? maxH;
    const heal = Math.max(0, maxH - curHp);
    if (heal > 0) {
      table.me.clearHP(heal);
    }

    const stress = table.me.currentStress ?? 0;
    if (stress > 0) {
      table.me.clearStress(stress);
    }

    const hopeGain = table.rollDie('d4');
    table.me.gainHope(hopeGain);
  },
};
