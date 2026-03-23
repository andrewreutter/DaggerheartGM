/**
 * SRD consumable — Major Control Potion (common roll table 27).
 * daggerheart-srd/consumables/Major Control Potion.md
 */

import { when } from '../engine/when.js';

const ACTIVE_KEY = 'majorControlActive';

export const MajorControlPotion = {
  name: 'Major Control Potion',
  description: 'You gain a +1 bonus to your Finesse until your next rest.',
  onUse(table) {
    table.feature.set(ACTIVE_KEY, true);
  },
  passiveStatMods: when((table) => table.feature.get(ACTIVE_KEY) === true, {
    finesse: 1,
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
