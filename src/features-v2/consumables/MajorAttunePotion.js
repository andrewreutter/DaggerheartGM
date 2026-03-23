/**
 * SRD consumable — Major Attune Potion (common roll table 28).
 * daggerheart-srd/consumables/Major Attune Potion.md
 */

import { when } from '../engine/when.js';

const ACTIVE_KEY = 'majorAttuneActive';

export const MajorAttunePotion = {
  name: 'Major Attune Potion',
  description: 'You gain a +1 bonus to your Instinct until your next rest.',
  onUse(table) {
    table.feature.set(ACTIVE_KEY, true);
  },
  passiveStatMods: when((table) => table.feature.get(ACTIVE_KEY) === true, {
    instinct: 1,
  }),
  hooks: {
    onRest: when(
      (t) => t.action?.type === 'shortRest' || t.action?.type === 'longRest',
      (table) => {
        table.feature.set(ACTIVE_KEY, false);
      }
    ),
  },
};
