/**
 * SRD consumable — Dragonbloom Tea (common roll table 48).
 * daggerheart-srd/consumables/Dragonbloom Tea.md
 */

export const DragonbloomTea = {
  name: 'Dragonbloom Tea',
  description:
    'You can drink this tea to unleash a fiery breath attack. Make an Instinct Roll against all adversaries in front of you within Close range. Targets you succeed against take 2d20 physical damage using your Proficiency.',
  onUse(table) {
    table.me.actionLoop(
      'Dragonbloom Tea',
      'Make an Instinct roll against all adversaries in front of you within Close range. Targets you succeed against take 2d20 physical damage using your Proficiency (GM resolves rolls vs each target).',
      { trait: 'Instinct' }
    );
  },
};
