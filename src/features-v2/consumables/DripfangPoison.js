/**
 * SRD consumable — Dripfang Poison (common roll table 42).
 * daggerheart-srd/consumables/Dripfang Poison.md
 */

export const DripfangPoison = {
  name: 'Dripfang Poison',
  description:
    'A creature who consumes this poison takes 8d10 direct magic damage.',
  onUse(table) {
    const total = table.rollDie('8d10');
    table.me.actionLoop(
      'Dripfang Poison',
      `Apply ${total} direct magic damage to the creature who consumed this poison.`
    );
  },
};
