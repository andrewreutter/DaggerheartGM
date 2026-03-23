/**
 * SRD item — Ring of Unbreakable Resolve (roll table 59).
 * Once per session: after the GM spends Fear from the pool, spend 4 Hope to return 1 Fear (GM adjudicates other effects).
 */

import { when } from '../engine/when.js';

const OFFER_KEY = 'unbreakableResolveOffer';

function batchIncludesGmSpendFear(table) {
  return (table.mutationBatch || []).some(
    (m) => m.type === 'spendFear' && (m.payload?.amount ?? 0) > 0
  );
}

export const RingOfUnbreakableResolve = {
  name: 'Ring of Unbreakable Resolve',
  description:
    'Once per session, when the GM spends a Fear, you can spend 4 Hope to cancel the effects of that spent Fear.',
  hooks: {
    onStateChange: when(batchIncludesGmSpendFear, (table) => {
      table.feature.set(OFFER_KEY, true);
    }),
  },
  chips: [
    when(
      (t) => t.feature.get(OFFER_KEY) === true,
      {
        name: 'Ring of Unbreakable Resolve — cancel GM Fear',
        placements: ['card'],
        hopeCost: 4,
        frequency: 'session',
        description:
          'After the GM spent Fear from the pool: spend 4 Hope to return 1 Fear to the GM pool, undoing that spend. The GM should revise or undo any effects that depended on it.',
        onUse(table) {
          table.top.gainFear(1);
          table.feature.set(OFFER_KEY, false);
          table.me.actionLoop(
            'Ring of Unbreakable Resolve',
            'Spend 4 Hope: return 1 Fear to the GM pool. Cancel or revise the effects of that Fear spend as appropriate.'
          );
        },
      }
    ),
  ],
};
