/**
 * Sage domain — Gifted Tracker (Tier 1)
 * SRD: Hope for GM questions while tracking; +1 Evasion vs tracked quarry when engaged.
 */

import { when, isTargeted } from '../../engine/when.js';

export const GiftedTracker = {
  name: 'Gifted Tracker',
  description:
    'When you\'re tracking a specific creature or group of creatures based on signs of their passage, you can **spend any number of Hope** and ask the GM that many questions from the following list.\n\n- What direction did they go?\n- How long ago did they pass through?\n- What were they doing in this location?\n- How many of them were here?\n\nWhen you encounter creatures you\'ve tracked in this way, gain a +1 bonus to your Evasion against them.',
  chips: [
    {
      placements: ['card'],
      name: 'Gifted Tracker',
      description:
        'While tracking by signs of passage, spend any number of Hope—tell the GM how many Hope you spend to ask that many questions from the list (direction, timing, activity here, count).',
      onUse(table) {
        table.me.actionLoop(
          'Gifted Tracker',
          `While tracking a creature or group by signs of passage, spend any number of Hope. For each Hope spent, ask the GM one question:\n- What direction did they go?\n- How long ago did they pass through?\n- What were they doing in this location?\n- How many of them were here?\n\nWhen you encounter those tracked creatures in combat, use **Engaged with tracked quarry** on this card for +1 Evasion while the toggle is on (GM).`
        );
      },
    },
    {
      placements: ['card'],
      name: 'Engaged with tracked quarry',
      description:
        'Turn on while fighting creatures you tracked; you have +1 Evasion when targeted by attacks. Turn off when the encounter ends or you are no longer fighting them.',
      isToggle: true,
      onUse(table, chipState) {
        table.feature.set('giftedTrackerEngaged', chipState.isOn);
      },
    },
    when(
      (table) => table.feature.get('giftedTrackerEngaged') === true,
      isTargeted,
      {
        placements: ['reviewAction'],
        name: 'Gifted Tracker — Evasion',
        description: '+1 Evasion against attacks from tracked quarry while this toggle is on.',
        temporaryStatMods: { evasion: 1 },
      }
    ),
  ],
};
