/**
 * Adversary action — Avalanche Tail (SRD)
 *
 * TODO ACTION [ATTACKSHAPED_DAMAGE]: Descriptor + roll wiring for standard / shared / multi-target attacks (`adversary-roll-descriptors.js`).
 * TODO ACTION [RESOURCE]: Adversary Stress mark for movement/ability (per SRD).
 * TODO ACTION [MOVEMENT]: Forced movement range (per SRD).
 * TODO ACTION [CONDITION]: Apply/remove conditions on targets (per SRD).
 * TODO ACTION [AURA]: Range-limited effect on PCs (per SRD).
 */
export const AvalancheTail = {
  name: "Avalanche Tail",
  type: 'action',
  description: "**Mark a Stress** to make an attack against all targets within Close range. Targets the Obsidian Predator succeeds against take **4d6+4** physical damage and are knocked back to Far range and _Vulnerable_ until their next roll with Hope.",
  adversaryAuraReminder: "Close — .",
};
