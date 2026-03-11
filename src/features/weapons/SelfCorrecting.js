import { rewriteDamageForFeature } from '../../client/lib/dice-utils.js';

export default {
  name: 'Self-Correcting',
  automated: true,
  tagText: 'Minimum 6 on each damage die (applied)',
  description: 'When you roll a 1 on a damage die, it deals 6 damage instead.',
  rewriteDamage(damageStr) {
    return rewriteDamageForFeature(damageStr, 'Self-Correcting');
  },
};
