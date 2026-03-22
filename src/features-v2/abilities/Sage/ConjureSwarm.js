/**
 * Sage domain — Conjure Swarm (Tier 1)
 * SRD: Tekaira Armored Beetles + Fire Flies (domain card)
 */

import { spellcastTraitLabel } from '../Codex/spellcast-label.js';
import { when, isTargeted, hasPhysicalDamage, unwrap } from '../../engine/when.js';

export const ConjureSwarm = {
  name: 'Conjure Swarm',
  description:
    '_Tekaira Armored Beetles:_ **Mark a Stress** to conjure armored beetles that encircle you. When you next take damage, reduce the severity by one threshold. You can **spend a Hope** to keep the beetles conjured after taking damage.\n\n_Fire Flies:_ Make a **Spellcast Roll** against all adversaries within Close range. **Spend a Hope** to deal **2d8+3** magic damage to targets you succeeded against.',
  hooks: {
    onReviewAction(table) {
      const reduceOnce = unwrap(
        when(
          isTargeted,
          hasPhysicalDamage,
          (t) => t.feature.get('conjureSwarmBeetlesAwaiting') === true,
          (t) => {
            t.action.reduceIncomingPhysicalSeverityBySteps(1);
            t.feature.set('conjureSwarmBeetlesAwaiting', false);
            t.feature.set('conjureSwarmBeetlesActive', false);
          }
        ),
        table
      );
      if (typeof reduceOnce === 'function') reduceOnce(table);
    },
    onRest(table) {
      table.feature.set('conjureSwarmBeetlesAwaiting', false);
      table.feature.set('conjureSwarmBeetlesActive', false);
    },
  },
  chips: [
    {
      placements: ['card'],
      name: 'Tekaira Armored Beetles',
      stressCost: 1,
      description:
        'Conjure armored beetles that encircle you. The next time you take damage, reduce severity by one threshold. You may spend 1 Hope after taking damage to keep the beetles conjured.',
      onUse(table) {
        table.feature.set('conjureSwarmBeetlesAwaiting', true);
        table.feature.set('conjureSwarmBeetlesActive', true);
        table.me.actionLoop(
          'Conjure Swarm — Tekaira Armored Beetles',
          'Mark Stress: conjure armored beetles that encircle you. When you next take damage, reduce the severity by one threshold. You can spend 1 Hope to keep the beetles conjured after taking damage (GM resolves).'
        );
      },
    },
    {
      placements: ['card'],
      name: 'Fire Flies',
      hopeCost: 1,
      description:
        'Spend 1 Hope. Spellcast vs each adversary within Close; deal 2d8+3 magic damage to targets you succeeded against.',
      onUse(table) {
        const trait = spellcastTraitLabel(table);
        table.me.actionLoop(
          'Conjure Swarm — Fire Flies',
          `Spend 1 Hope. Make a Spellcast (${trait}) roll against each adversary within Close range. Deal 2d8+3 magic damage to targets you succeeded against.`,
          { trait }
        );
      },
    },
  ],
};
