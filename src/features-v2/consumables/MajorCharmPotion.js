/**
 * SRD consumable — Major Charm Potion (common roll table 29).
 * daggerheart-srd/consumables/Major Charm Potion.md
 */

import { when } from '../engine/when.js';

const ACTIVE_KEY = 'majorCharmActive';

export const MajorCharmPotion = {
  name: 'Major Charm Potion',
  description: 'You gain a +1 bonus to your Presence until your next rest.',
  onUse(table) {
    table.feature.set(ACTIVE_KEY, true);
  },
  passiveStatMods: when((table) => table.feature.get(ACTIVE_KEY) === true, {
    presence: 1,
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
