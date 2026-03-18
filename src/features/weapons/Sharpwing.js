import { rewriteDamageWithBonus } from '../../client/lib/dice-utils.js';

export default {
  name: 'Sharpwing',
  description: 'Gain a bonus to your damage rolls equal to your Agility.',
  onCharacterBuild({ character, weapon }) {
    character.addFeature('Sharpwing', 'Gain a bonus to your damage rolls equal to your Agility.', {
      showTag: true,
      automated: true,
      tagText: ({ traits } = {}) => `+${traits?.agility ?? 0} damage from Agility (applied)`,
      rewriteDamage(damageStr, { traits } = {}) {
        return rewriteDamageWithBonus(damageStr, traits?.agility ?? 0);
      },
    });
  },
};
