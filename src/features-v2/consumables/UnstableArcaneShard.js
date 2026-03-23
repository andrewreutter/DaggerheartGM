/**
 * SRD consumable — Unstable Arcane Shard (common roll table 12).
 * daggerheart-srd/consumables/Unstable Arcane Shard.md
 */

export const UnstableArcaneShard = {
  name: 'Unstable Arcane Shard',
  description:
    'You can make a Finesse Roll to throw this shard at a group of adversaries within Far range. Targets you succeed against take 1d20 magic damage.',
  onUse(table) {
    table.me.actionLoop(
      'Unstable Arcane Shard',
      'Make a Finesse roll against a group of adversaries within Far range. Targets you succeed against take 1d20 magic damage (GM resolves rolls vs each target).',
      { trait: 'Finesse' }
    );
  },
};
