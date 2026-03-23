/**
 * SRD item — Box of Many Goods (roll table 34). daggerheart-srd/items/Box of Many Goods.md
 *
 * Once per long rest: roll d12; GM grants 0 / 1 / 2 random common consumables per the table.
 */

export const BoxOfManyGoods = {
  name: 'Box of Many Goods',
  description:
    'Once per long rest, you can open this small box and roll a d12. On a result of 1-6, it\u2019s empty. On a result of 7-10, it contains one random common consumable. On a result of 11-12, it contains two random common consumables.',
  frequency: 'longRest',
  onUse(table) {
    table.me.actionLoop(
      'Box of Many Goods',
      'Open the box and roll a d12. 1-6: empty. 7-10: one random common consumable. 11-12: two random common consumables (GM picks from common consumables).'
    );
  },
};
