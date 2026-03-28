/**
 * Adversary passive — Ashes to Ashes (SRD)
 *
 * TODO PASSIVE [FEAR_GAIN]: GM gains Fear — wire to Fear track (per SRD trigger).
 * TODO PASSIVE [RESOURCE]: PC Hope loss (per SRD trigger).
 * TODO PASSIVE [AURA]: Range-limited effect on PCs (per SRD).
 */
export const AshesToAshes = {
  name: "Ashes to Ashes",
  type: 'passive',
  description: "When a PC rolls a failure while within Close range of the Ashen Tyrant, they lose a Hope and you gain a Fear. If the PC can't lose a Hope, they must mark a HP.",
  adversaryAuraReminder: "Close — of the Ashen Tyrant, they lose a Hope and you gain a Fear.",
};
