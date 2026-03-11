import { rewriteDamageForFeature } from '../../client/lib/dice-utils.js';

export default {
  name: 'Brutal',
  automated: true,
  tagText: 'Exploding damage die (applied)',
  description: 'When you roll the maximum value on a damage die, roll an additional damage die.',
  rewriteDamage(damageStr) {
    return rewriteDamageForFeature(damageStr, 'Brutal');
  },
};
