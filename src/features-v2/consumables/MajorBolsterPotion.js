/**
 * SRD consumable — Major Bolster Potion (common roll table 26).
 * daggerheart-srd/consumables/Major Bolster Potion.md
 */

import { when } from '../engine/when.js';

const ACTIVE_KEY = 'majorBolsterActive';

export const MajorBolsterPotion = {
  name: 'Major Bolster Potion',
  description: 'You gain a +1 bonus to your Strength until your next rest.',
  onUse(table) {
    table.feature.set(ACTIVE_KEY, true);
  },
  passiveStatMods: when((table) => table.feature.get(ACTIVE_KEY) === true, {
    strength: 1,
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
