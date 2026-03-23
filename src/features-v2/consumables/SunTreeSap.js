/**
 * SRD consumable — Sun Tree Sap (common roll table 41).
 * daggerheart-srd/consumables/Sun Tree Sap.md
 */

export const SunTreeSap = {
  name: 'Sun Tree Sap',
  description:
    'Consume this sap to roll a d6. On a result of 5-6, clear 2 HP. On a result of 2-4, clear 3 Stress. On a result of 1, see through the veil of death and return changed, gaining one scar.',
  onUse(table) {
    const r = table.rollDie('d6');
    if (r >= 5) {
      table.me.clearHP(2);
    } else if (r >= 2) {
      table.me.clearStress(3);
    } else {
      table.me.addCondition('Scar');
    }
  },
};
