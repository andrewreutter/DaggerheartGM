/**
 * Adversary action — Terrifying Chorus (SRD)
 *
 * Game Table: `onUse` spends 2 Hope from each PC within Far of this adversary.
 */
export const TerrifyingChorus = {
  name: "Terrifying Chorus",
  type: "action",
  description: "All PCs within Far range lose 2 Hope.",
  onUse: (table) =>
    table.characters.forEach((c) => table.me.isWithinRangeBandOf(c, "far") && c.spendHope(2)),
};
