/**
 * Grace domain — Mass Enrapture (Tier 3 / SRD level 8)
 * SRD: daggerheart-srd/abilities/Mass Enrapture.md
 */

import { spellcastTraitLabel } from '../Codex/spellcast-label.js';

export const MassEnrapture = {
  name: 'Mass Enrapture',
  description:
    '**Spend 3 Hope (recall)** to make a **Spellcast Roll** against all targets within Far range. Targets you succeed against become temporarily _Enraptured_. While _Enraptured_, a target\'s attention is fixed on you, narrowing their field of view and drowning out any sound but your voice. **Mark a Stress** to force all _Enraptured_ targets to mark a Stress, ending this spell.',
  chips: [
    {
      placements: ['card'],
      name: 'Mass Enrapture',
      hopeCost: 3,
      description:
        'Spend 3 Hope (recall). Spellcast vs all targets within Far range. Each target you succeed against becomes temporarily Enraptured (GM tracks).',
      onUse(table) {
        const trait = spellcastTraitLabel(table);
        table.me.actionLoop(
          'Mass Enrapture',
          `Spend 3 Hope (recall). Make a Spellcast (${trait}) roll against all targets within Far range. For each target you succeed against, they become temporarily Enraptured.`,
          { trait }
        );
      },
    },
    {
      placements: ['card'],
      name: 'Mass Enrapture — Collapse',
      stressCost: 1,
      description:
        'Mark 1 Stress to force each Enraptured target to mark 1 Stress; the spell ends.',
      onUse(table) {
        table.me.actionLoop(
          'Mass Enrapture — Collapse',
          'Mark 1 Stress: each Enraptured target marks 1 Stress and the spell ends (GM applies).'
        );
      },
    },
  ],
};
