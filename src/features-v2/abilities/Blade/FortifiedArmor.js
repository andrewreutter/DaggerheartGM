/**
 * Blade domain — Fortified Armor (Tier 2 / level 4)
 * SRD: daggerheart-srd/abilities/Fortified Armor.md
 * +2 to Major and Severe damage thresholds while wearing armor.
 */

export const FortifiedArmor = {
  name: 'Fortified Armor',
  description:
    'While you are wearing armor, gain a +2 bonus to your damage thresholds.',
  passiveStatMods: {
    majorThreshold: (table) => (table.me?.armorId ? 2 : 0),
    severeThreshold: (table) => (table.me?.armorId ? 2 : 0),
  },
};
