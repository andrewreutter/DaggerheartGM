/**
 * Adversary action — Randomized Tactics (SRD)
 *
 * TODO ACTION [ATTACKSHAPED_DAMAGE]: Descriptor + roll wiring for standard / shared / multi-target attacks (`adversary-roll-descriptors.js`).
 * TODO ACTION [RESOURCE]: Adversary Stress mark for movement/ability (per SRD).
 * TODO ACTION [ROLL]: Reaction rolls (trait as stated) and outcomes (per SRD).
 * TODO ACTION [CONDITION]: Apply/remove conditions on targets (per SRD).
 * TODO ACTION [AURA]: Range-limited effect on PCs (per SRD).
 * TODO ACTION [NARRATIVE_BANNER]: Purely narrative / reminder clause — banner or log only: The Box uses the corresponding move:
 */
export const RandomizedTactics = {
  name: "Randomized Tactics",
  type: 'action',
  description: "**Mark a Stress** and roll a **d6**. The Box uses the corresponding move:\n\n- 1. _Mana Beam._ The Box fires a searing beam. Make an attack against a target within Far range. On a success, deal **2d10+2** magic damage.\n- 2. _Fire Jets._ The Box shoots into the air, spinning and releasing jets of flame. Make an attack against all targets within Close range. Targets the Box succeeds against take **2d8** physical damage.\n- 3. _Trample._ The Box rockets around erratically. Make an attack against all PCs within Close range. Targets the Box succeeds against take **1d6+5** physical damage and are _Vulnerable_ until their next roll with Hope.\n- 4. _Shocking Gas._ The Box sprays out a silver gas sparking with lightning. All targets within Close range must succeed on a Finesse Reaction Roll or mark 3 Stress.\n- 5. _Stunning Clap._ The Box leaps and their sides clap, creating a small sonic boom. All targets within Very Close range must succeed on a Strength Reaction Roll or become _Vulnerable_ until the cube is defeated.\n- 6. _Psionic Whine._ The Box releases a cluster of mechanical bees whose buzz rattles mortal minds. All targets within Close range must succeed on a Presence Reaction Roll or take **2d4+9** direct magic damage.",
};
