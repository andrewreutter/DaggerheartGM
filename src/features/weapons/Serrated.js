import { rewriteDamageForFeature } from '../../client/lib/dice-utils.js';

export default {
  name: 'Serrated',
  description: 'When you roll a 1 on a damage die, it deals 8 damage instead.',
  onCharacterBuild({ character, weapon }) {
    character.addFeature('Serrated', 'When you roll a 1 on a damage die, it deals 8 damage instead.', {
      showTag: true,
      automated: true,
      tagText: 'Minimum 8 on each damage die (applied)',
      rewriteDamage(damageStr) {
        return rewriteDamageForFeature(damageStr, 'Serrated');
      },
    });
  },
};
