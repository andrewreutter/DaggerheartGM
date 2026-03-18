/**
 * Orc ancestry builder.
 *
 * Features:
 *   Sturdy — When you have 1 HP remaining, attacks against you have disadvantage (onTargeted: subtract 1d6 before roll).
 *   Tusks  — On successful Melee attack, spend 1 Hope to add 1d6 damage (banner chip).
 */
export default {
  name: 'Orc',
  description: 'Orcs are humanoids most easily recognized by their square features and boar-like tusks that protrude from their lower jaw. Their tusks vary in size and, though they extend from the mouth, aren\'t used for eating. Instead, many orcs decorate their tusks with significant ornamentation. Orcs typically live for 125 years, with tusks that continue growing throughout their lives. They have pointed ears and hair and skin in green, blue, pink, or gray tones. Orcs tend toward a muscular build and range in height from 5 feet to 6½ feet.',

  onCharacterBuild(char) {
    char.addFeature(
      'Sturdy',
      'When you have 1 Hit Point remaining, attacks against you have disadvantage.',
      {
        onTargeted: (roll, character) => character.currentHp === 1 && roll.addDisadvantage(),
      }
    );

    char.addFeature(
      'Tusks',
      'When you succeed on an attack against a target within Melee range, you can **spend a Hope** to gore the target with your tusks, dealing an extra **1d6** damage.',
      {
        onBanner(banner) {
          banner.addChip({
            label: 'Spend 1 Hope for +1d6 damage (Tusks)',
            hopeCost: 1,
            isVisible: (roll) => roll.attacker && roll.attacker.isMe && roll.isSuccess && roll.attackRange === 'Melee',
            onChipAck(roll, character, ctx) {
              ctx.addDamage('1d6');
            },
          });
        },
      }
    );
  },
};
