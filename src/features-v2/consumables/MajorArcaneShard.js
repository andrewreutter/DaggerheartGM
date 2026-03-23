/**
 * SRD consumable — Major Arcane Shard (common roll table 38).
 * daggerheart-srd/consumables/Major Arcane Shard.md
 */

export const MajorArcaneShard = {
  name: 'Major Arcane Shard',
  description:
    'You can make a Finesse Roll to throw this shard at a group of adversaries within Far range. Targets you succeed against take 4d20 magic damage.',
  onUse(table) {
    table.me.actionLoop(
      'Major Arcane Shard',
      'Make a Finesse roll against a group of adversaries within Far range. Targets you succeed against take 4d20 magic damage (GM resolves rolls vs each target).',
      { trait: 'Finesse' }
    );
  },
};
