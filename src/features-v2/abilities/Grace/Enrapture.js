/**
 * Grace domain — Enrapture (Tier 1)
 * SRD: Spellcast vs Close; on success target is Enraptured. Once per rest on a success you may mark Stress to force the Enraptured target to mark Stress.
 */

import { spellcastTraitLabel } from '../Codex/spellcast-label.js';

export const Enrapture = {
  name: 'Enrapture',
  description:
    'Make a **Spellcast Roll** against a target within Close range. On a success, they become temporarily _Enraptured_. While _Enraptured_, a target\'s attention is fixed on you, narrowing their field of view and drowning out any sound but your voice. Once per rest on a success, you can **mark a Stress** to force the _Enraptured_ target to mark a Stress as well.',
  chips: [
    {
      placements: ['card'],
      name: 'Enrapture',
      description:
        'Spellcast vs a target within Close range. On success: they are temporarily Enraptured (GM tracks).',
      onUse(table) {
        const trait = spellcastTraitLabel(table);
        table.me.actionLoop(
          'Enrapture',
          `Make a Spellcast (${trait}) roll vs a target within Close range. On a success, they become temporarily Enraptured.`,
          { trait }
        );
      },
    },
    {
      placements: ['card'],
      name: 'Enrapture — Shared Duress',
      frequency: 'rest',
      stressCost: 1,
      description:
        'Once per rest, after you have successfully Enraptured a target: mark 1 Stress to force that Enraptured target to mark 1 Stress.',
      onUse(table) {
        table.me.actionLoop(
          'Enrapture — Shared Duress',
          'Mark 1 Stress: the Enraptured target marks 1 Stress (rest-limited; GM applies).'
        );
      },
    },
  ],
};
