/**
 * Galapa ancestry builder.
 *
 * Features:
 *   Shell — +Proficiency (or 1) to both major and severe damage thresholds (addThresholdBonus).
 *   Retract — Toggle: resistance to physical, disadvantage on rolls, cannot move (onCard + entity methods; system-derived toggle key).
 */
export default {
  name: 'Galapa',
  description: 'Galapa are turtle-like humanoids with protective shells and the ability to retract into them. They are known for their durability and defensive nature.',

  onCharacterBuild(char) {
    char.addFeature(
      'Shell',
      'Your shell provides natural protection. Add your Proficiency to both your Major and Severe damage thresholds.',
      {
        onCharacterRender: (ctx) => ctx.addThresholdBonus(ctx.proficiency ?? 1),
      }
    );

    char.addFeature(
      'Retract',
      'You can retract into your shell, gaining resistance to physical damage but suffering disadvantage on action rolls and being unable to move.',
      {
        onCard(card) {
          const source = 'Galapa - Retract';
          card.addChip({
            label: 'Retract into your shell',
            onToggle: (isActive, character) => {
              if (isActive) {
                character.addResistance('physical', source);
                character.addDisadvantage(source);
                character.disableMove(source);
              } else {
                character.removeResistance('physical', source);
                character.removeDisadvantage(source);
                character.enableMove(source);
              }
            },
          });
        },
      }
    );
  },
};
