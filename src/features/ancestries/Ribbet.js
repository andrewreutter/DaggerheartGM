/**
 * Ribbet ancestry builder.
 *
 * Features:
 *   Long Tongue — Virtual weapon (Finesse, Close, d12 physical, +Proficiency). On Acknowledge: self.markStress(1).
 *   Amphibious — Display only (narrative: breathe and move underwater).
 */
export default {
  name: 'Ribbet',
  description: 'Ribbet are frog-like humanoids with long, sticky tongues and an affinity for water. They can breathe and move easily underwater and use their tongues as a formidable natural weapon.',

  features: [
    {
      name: 'Long Tongue',
      description: 'You can attack a target within Close range using your tongue as a **Finesse** weapon that deals **d12** physical damage using your Proficiency. **Mark a Stress** when you use this attack.',
      onCharacterRender(ctx) {
        ctx.addVirtualWeapon({
          trait: 'Finesse',
          range: 'Close',
          damage: 'd12',
          damageProficiency: true,
          description: 'd12 physical damage using Proficiency; mark 1 Stress on use',
          stressCost: 1,
        });
      },
    },
    {
      name: 'Amphibious',
      description: 'You can breathe air and water and move through water without penalty.',
    },
  ],
};
