import { rewriteDamageForFeature } from '../../client/lib/dice-utils.js';

export default {
  name: 'Brutal',
  description: 'When you roll the maximum value on a damage die, roll an additional damage die.',
  onCharacterBuild({ character, weapon }) {
    character.addFeature('Brutal', 'When you roll the maximum value on a damage die, roll an additional damage die.', {
      showTag: true,
      automated: true,
      tagText: 'Exploding damage die (applied)',
      rewriteDamage(damageStr) {
        return rewriteDamageForFeature(damageStr, 'Brutal');
      },
    });
  },
};
