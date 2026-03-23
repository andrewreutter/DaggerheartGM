/**
 * SRD item — Shard of Memory (roll table 52). daggerheart-srd/items/Shard of Memory.md
 *
 * Vault recall is resolved at the table; this wires Hope cost, long-rest frequency, and a table notice.
 */

export const ShardOfMemory = {
  name: 'Shard of Memory',
  description:
    'Once per long rest, you can spend 2 Hope to recall a domain card from your vault instead of paying its Recall Cost.',
  hopeCost: 2,
  frequency: 'longRest',
  onUse(table) {
    table.me.actionLoop(
      'Shard of Memory',
      "Recall one domain card from your vault. You do not pay that card's Recall Cost (you already spent 2 Hope for this shard use)."
    );
  },
};
