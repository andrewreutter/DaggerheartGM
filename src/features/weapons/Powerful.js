import { rewriteDamageForFeature } from '../../client/lib/dice-utils.js';

export default {
  name: 'Powerful',
  description: 'On a successful attack, roll an additional damage die and discard the lowest result.',
  showTag: true,
  automated: true,
  tagText: 'Extra damage die, keep highest (applied)',
  rewriteDamage(damageStr) {
    return rewriteDamageForFeature(damageStr, 'Powerful');
  },
};
