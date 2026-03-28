/**
 * Adversary passive — Armor-Shredding Shards (SRD)
 *
 * TODO PASSIVE [ARMOR]: Target marks Armor Slot without benefit; if they cannot, mark extra HP instead (per SRD).
 * TODO PASSIVE [AURA]: Range-limited effect on PCs (per SRD).
 */
export const ArmorShreddingShards = {
  name: "Armor-Shredding Shards",
  type: 'passive',
  description: "After a successful attack against the Snake within Melee range, the attacker must mark an Armor Slot. If they can't mark an Armor Slot, they must mark an HP.",
  adversaryAuraReminder: "Melee — , the attacker must mark an Armor Slot.",
};
