import { rewriteDamageForFeature } from '../../client/lib/dice-utils.js';

export default {
  name: 'Massive',
  automated: true,
  tagText: 'Extra damage die, keep highest (applied)',
  description: '-1 to Evasion; on a successful attack, roll an additional damage die and discard the lowest result.',
  passiveStatMods: { evasion: -1 },
  rewriteDamage(damageStr) {
    return rewriteDamageForFeature(damageStr, 'Massive');
  },
};
