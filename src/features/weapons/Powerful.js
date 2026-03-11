import { rewriteDamageForFeature } from '../../client/lib/dice-utils.js';

export default {
  name: 'Powerful',
  automated: true,
  tagText: 'Extra damage die, keep highest (applied)',
  description: 'On a successful attack, roll an additional damage die and discard the lowest result.',
  rewriteDamage(damageStr) {
    return rewriteDamageForFeature(damageStr, 'Powerful');
  },
};
