/**
 * Adversary action — Dive-Bomb (SRD)
 *
 * TODO ACTION [ATTACKSHAPED_DAMAGE]: Descriptor + roll wiring for standard / shared / multi-target attacks (`adversary-roll-descriptors.js`).
 * TODO ACTION [RESOURCE]: PC Hope loss (per SRD trigger).
 * TODO ACTION [RESOURCE]: Adversary Stress mark for movement/ability (per SRD).
 * TODO ACTION [MOVEMENT]: Flying movement, range swaps, and rider rules (per SRD).
 * TODO ACTION [AURA]: Range-limited effect on PCs (per SRD).
 */
export const DiveBomb = {
  name: "Dive-Bomb",
  type: 'action',
  description: "If the Obsidian Predator is flying, **mark a Stress** to choose a point within Far range. Move to that point and make an attack against all targets within Very Close range. Targets the Obsidian Predator succeeds against take **2d10+6** physical damage and must mark a Stress and lose a Hope.",
};
