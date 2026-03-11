import { rewriteDamageForFeature } from '../../client/lib/dice-utils.js';

export default {
  name: 'Serrated',
  automated: true,
  tagText: 'Minimum 8 on each damage die (applied)',
  description: 'When you roll a 1 on a damage die, it deals 8 damage instead.',
  rewriteDamage(damageStr) {
    return rewriteDamageForFeature(damageStr, 'Serrated');
  },
};
