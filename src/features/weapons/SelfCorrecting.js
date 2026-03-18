import { rewriteDamageForFeature } from '../../client/lib/dice-utils.js';

export default {
  name: 'Self-Correcting',
  description: 'When you roll a 1 on a damage die, it deals 6 damage instead.',
  onCharacterBuild({ character, weapon }) {
    character.addFeature('Self-Correcting', 'When you roll a 1 on a damage die, it deals 6 damage instead.', {
      showTag: true,
      automated: true,
      tagText: 'Minimum 6 on each damage die (applied)',
      rewriteDamage(damageStr) {
        return rewriteDamageForFeature(damageStr, 'Self-Correcting');
      },
    });
  },
};
