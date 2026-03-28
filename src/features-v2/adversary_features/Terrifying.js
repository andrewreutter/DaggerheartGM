/**
 * Adversary passive — Terrifying (SRD)
 *
 * TODO PASSIVE [AURA]: Successful attack: PCs within Close lose Hope; GM gains Fear (not automated).
 * TODO PASSIVE [TRACK]: Card toggle is bookkeeping only; apply Hope/Fear manually per SRD.
 */
export const Terrifying = {
  name: "Terrifying",
  type: 'passive',
  description: "When the Knight makes a successful attack, all PCs within Close range lose a Hope and you gain a Fear.",
  chips: [
    {
      name: "Track",
      description: "Toggle to mark that you are tracking this creature's Terrifying passive (Hope loss / Fear gain on successful attacks).",
      placements: ["card"],
      isToggle: true,
    },
  ],
};
