/**
 * SRD consumable — Improved Arcane Shard (common roll table 24).
 * daggerheart-srd/consumables/Improved Arcane Shard.md
 */

export const ImprovedArcaneShard = {
  name: 'Improved Arcane Shard',
  description:
    'You can make a Finesse Roll to throw this shard at a group of adversaries within Far range. Targets you succeed against take 2d20 magic damage.',
  onUse(table) {
    table.me.actionLoop(
      'Improved Arcane Shard',
      'Make a Finesse roll against a group of adversaries within Far range. Targets you succeed against take 2d20 magic damage (GM resolves rolls vs each target).',
      { trait: 'Finesse' }
    );
  },
};
