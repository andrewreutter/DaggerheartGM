/**
 * SRD item — Hopekeeper Locket (daggerheart-srd/items/Hopekeeper Locket.md, roll 39)
 */

import { when, isActing } from '../engine/when.js';

const IMBUED_KEY = 'hopekeeperLocketImbued';

export const HopekeeperLocket = {
  name: 'Hopekeeper Locket',
  description:
    'During a long rest, if you have 6 Hope, you can spend a Hope to imbue this locket with your bountiful resolve. When you have 0 Hope, you can use the locket to immediately gain a Hope. The locket must be re‑imbued before it can be used this way again.',
  chips: [
    when(
      isActing,
      (t) => t.action?.type === 'longRest',
      (t) => (t.me?.hope ?? 0) >= 6,
      (t) => t.feature.get(IMBUED_KEY) !== true,
      {
        name: 'Imbue Hopekeeper Locket',
        placements: ['intent'],
        hopeCost: 1,
        description:
          'During this long rest: spend 1 Hope to imbue the locket. When you later have 0 Hope, you may use the locket once to gain 1 Hope (then imbue again before the next use).',
        onUse(table) {
          table.feature.set(IMBUED_KEY, true);
        },
      }
    ),
    when(
      (t) => (t.me?.hope ?? 0) === 0,
      (t) => t.feature.get(IMBUED_KEY) === true,
      {
        name: 'Use Hopekeeper Locket',
        placements: ['card'],
        description:
          'You have 0 Hope and the locket is imbued: gain 1 Hope immediately. The locket is empty until you imbue it again during a long rest.',
        onUse(table) {
          table.me.gainHope(1);
          table.feature.set(IMBUED_KEY, false);
        },
      }
    ),
  ],
};
