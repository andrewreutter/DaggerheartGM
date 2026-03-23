/**
 * SRD consumable — Stardrop (common roll table 60).
 * daggerheart-srd/consumables/Stardrop.md
 */

export const Stardrop = {
  name: 'Stardrop',
  description:
    'You can use this stardrop to summon a hailstorm of comets that deals 8d20 physical damage to all targets within Very Far range.',
  onUse(table) {
    table.me.actionLoop(
      'Stardrop',
      'Summon a hailstorm of comets. All targets within Very Far range take 8d20 physical damage (GM resolves damage to each affected target).'
    );
  },
};
