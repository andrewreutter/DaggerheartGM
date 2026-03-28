/**
 * Adversary action — God Rays (SRD)
 *
 * TODO ACTION [ACTIONSECONDARY]: Secondary dice / saves / pools (`clientHoverUseRoll`, banner chips per authoring guide).
 * TODO ACTION [DAMAGE]: Half damage on success vs full on failure where stated (per SRD).
 * TODO ACTION [RESOURCE]: Adversary Stress mark for movement/ability (per SRD).
 * TODO ACTION [ROLL]: Disadvantage on stated rolls (per SRD).
 * TODO ACTION [ROLL]: Reaction rolls (trait as stated) and outcomes (per SRD).
 * TODO ACTION [CONDITION]: Apply/remove conditions on targets (per SRD).
 * TODO ACTION [AURA]: Range-limited effect on PCs (per SRD).
 */
export const GodRays = {
  name: "God Rays",
  type: 'action',
  description: "**Mark a Stress** to reflect a sliver of divinity as a searing beam of light that hits up to twenty targets within Very Far range. Targets must make a Presence Reaction Roll, with disadvantage if they are marked _Guilty_. Targets who fail take **4d6+12** magic damage. Targets who succeed take half damage.",
};
