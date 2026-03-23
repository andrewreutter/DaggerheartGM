/**
 * Blade domain — Reaper's Strike (Tier 3 / Level 9)
 * SRD: daggerheart-srd/.build/03_json/abilities.json
 */

export const ReapersStrike = {
  name: "Reaper's Strike",
  description:
    'Once per long rest, **spend a Hope** to make an attack roll. The GM tells you which targets within range it would succeed against. Choose one of these targets and force them to mark 5 Hit Points.',
  hopeCost: 1,
  frequency: 'longRest',
  onUse(table) {
    table.me.actionLoop(
      "Reaper's Strike",
      'Spend 1 Hope (once per long rest). Make an attack roll; the GM tells you which targets within range the attack would succeed against. Choose one of those targets and force them to mark 5 Hit Points.'
    );
  },
};
