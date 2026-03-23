/**
 * Codex domain — Safe Haven (Tier 2 spell, SRD Level 8)
 * SRD: daggerheart-srd/abilities/Safe Haven.md
 */

import { when } from '../../engine/when.js';

export const SafeHaven = {
  name: 'Safe Haven',
  description:
    'When you have a few minutes of calm to focus, you can **spend 2 Hope** to summon your Safe Haven, a large interdimensional home where you and your allies can take shelter. When you do, a magical door appears somewhere within Close range. Only creatures of your choice can enter. Once inside, you can make the entrance invisible. You and anyone else inside can always exit. Once you leave, the doorway must be summoned again.\n\nWhen you take a rest within your own Safe Haven, you can choose an additional downtime move.',
  passiveStatMods: when(
    (table) => table.feature.get('summoned') === true,
    {
      numShortRestSlots: 1,
      numLongRestSlots: 1,
    }
  ),
  chips: [
    {
      placements: ['card'],
      name: 'Safe Haven',
      hopeCost: 2,
      description:
        'Spend 2 Hope when you have a few minutes of calm. A magical door to your Safe Haven appears somewhere within Close range; only creatures you choose may enter. Inside, you may hide the entrance. Anyone inside can exit. When you leave, the doorway closes until you summon it again.',
      onUse(table) {
        table.feature.set('summoned', true);
        table.me.actionLoop(
          'Safe Haven',
          'A magical door to your Safe Haven appears within Close range. Only creatures you choose may enter. You may make the entrance invisible from inside. Anyone inside can leave. When you leave, summon again (2 Hope) to reopen the doorway.'
        );
      },
    },
    {
      placements: ['card'],
      name: 'Leave Safe Haven',
      description:
        'You leave the Safe Haven; the doorway closes until you summon it again (2 Hope). Rest downtime bonuses from this spell apply only while the haven is open.',
      onUse(table) {
        table.feature.set('summoned', false);
        table.me.actionLoop(
          'Leave Safe Haven',
          'The Safe Haven doorway closes. Spend 2 Hope on Safe Haven again to summon a new door when you have a few minutes of calm.'
        );
      },
    },
  ],
};
