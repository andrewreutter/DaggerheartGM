/**
 * Midnight domain — Phantom Retreat (Tier 2 domain spell / SRD level 5)
 * SRD: daggerheart-srd/abilities/Phantom Retreat.md
 */

import { when } from '../../engine/when.js';

export const PhantomRetreat = {
  name: 'Phantom Retreat',
  description:
    '**Spend a Hope** to activate Phantom Retreat where you\'re currently standing. **Spend another Hope** at any time before your next rest to disappear from where you are and reappear where you were standing when you activated Phantom Retreat. This spell ends after you reappear.',
  hooks: {
    onRest(table) {
      table.feature.set('phantomRetreatArmed', false);
      table.feature.set('phantomRetreatAnchorX', null);
      table.feature.set('phantomRetreatAnchorY', null);
    },
  },
  chips: [
    when(
      (table) => table.feature.get('phantomRetreatArmed') !== true,
      {
        placements: ['card'],
        name: 'Phantom Retreat — Set anchor',
        hopeCost: 1,
        description:
          'Spend 1 Hope to anchor Phantom Retreat at your current position on the map. Before your next rest, use Reappear to teleport back here (1 Hope).',
        isDisabled: (table) =>
          table.me.tokenX == null || table.me.tokenY == null
            ? 'Place your token on the map.'
            : false,
        onUse(table) {
          table.feature.set('phantomRetreatAnchorX', table.me.tokenX);
          table.feature.set('phantomRetreatAnchorY', table.me.tokenY);
          table.feature.set('phantomRetreatArmed', true);
          table.me.actionLoop(
            'Phantom Retreat',
            'Phantom Retreat is anchored at your current position. Before your next rest, spend 1 Hope using Phantom Retreat — Reappear to return here; the spell then ends.'
          );
        },
      }
    ),
    when(
      (table) => table.feature.get('phantomRetreatArmed') === true,
      {
        placements: ['card'],
        name: 'Phantom Retreat — Reappear',
        hopeCost: 1,
        description:
          'Spend 1 Hope to disappear from your current position and reappear at your Phantom Retreat anchor. The spell ends after you reappear.',
        onUse(table) {
          const ax = table.feature.get('phantomRetreatAnchorX');
          const ay = table.feature.get('phantomRetreatAnchorY');
          table.feature.set('phantomRetreatArmed', false);
          table.feature.set('phantomRetreatAnchorX', null);
          table.feature.set('phantomRetreatAnchorY', null);
          table.me.move(
            (t) => t.me.tokenX === ax && t.me.tokenY === ay,
            'Token on your Phantom Retreat anchor',
            'Phantom Retreat — reappear at your anchor.'
          );
          table.me.actionLoop(
            'Phantom Retreat',
            'You disappear and reappear at your Phantom Retreat anchor. The spell ends.'
          );
        },
      }
    ),
  ],
};
