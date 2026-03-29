/**
 * Adversary passive — Blocking Shield (SRD)
 *
 * TODO PASSIVE [AFFINITY]: Immunity or special damage rules (per SRD).
 * TODO PASSIVE [ROLL]: Disadvantage on stated rolls (per SRD).
 * TODO PASSIVE [AURA]: Range-limited effect on PCs (per SRD).
 * TODO PASSIVE [NARRATIVE_BANNER]: Purely narrative / reminder clause — banner or log only: Creatures trapped inside the Gaoler are immune to this feature.
 */
// TODO(adversary): Aura/range reminder removed from Guide UI; add onUse if this should automate at the table.
export const BlockingShield = {
  name: "Blocking Shield",
  type: 'passive',
  description: "Creatures within Melee range of the Gaoler have disadvantage on attack rolls against them. Creatures trapped inside the Gaoler are immune to this feature.",
};
