/**
 * SRD consumable — Major Enlighten Potion (common roll table 30).
 * daggerheart-srd/consumables/Major Enlighten Potion.md
 */

import { when } from '../engine/when.js';

const ACTIVE_KEY = 'majorEnlightenActive';

export const MajorEnlightenPotion = {
  name: 'Major Enlighten Potion',
  description: 'You gain a +1 bonus to your Knowledge until your next rest.',
  onUse(table) {
    table.feature.set(ACTIVE_KEY, true);
  },
  passiveStatMods: when((table) => table.feature.get(ACTIVE_KEY) === true, {
    knowledge: 1,
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
