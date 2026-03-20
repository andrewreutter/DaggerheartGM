/**
 * Galapa ancestry — feature hooks keyed by feature name.
 *
 * SRD (ancestry): Galapa resemble anthropomorphic turtles with large, domed shells into which they can retract. Members
 * of this ancestry can draw their head, arms, and legs into their shell for protection. Most galapa move slowly and can
 * live approximately 150 years.
 *
 * SRD (Shell): Gain a bonus to your damage thresholds equal to your Proficiency.
 *
 * SRD (Retract): **Mark a Stress** to retract into your shell. While in your shell, you have resistance to physical
 * damage, you have disadvantage on action rolls, and you can't move.
 */
export default {
  Shell: {
    passiveStatMods: { majorThreshold: 1, severeThreshold: 1 },
  },
  Retract: {
    chips: [
      {
        placement: 'card',
        label: 'Retract into your shell',
        onToggle({ character, chip }) {
          const source = 'Galapa - Retract';
          if (chip.isActive) {
            character.addResistance('physical', source);
            character.addDisadvantage(source);
            character.disableMove(source);
          } else {
            character.removeResistance('physical', source);
            character.removeDisadvantage(source);
            character.enableMove(source);
          }
        },
      },
    ],
  },
};
