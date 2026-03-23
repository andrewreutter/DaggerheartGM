/**
 * Splendor domain — Stunning Sunlight (Level 8 spell; Recall Cost 2)
 * SRD: Spellcast vs adversaries in front within Far; on success spend any Hope to affect that many targets with Reaction (14); 3d20+3 magic on pass, 4d20+5 magic + Stunned on fail.
 */

import { spellcastTraitLabel } from '../Codex/spellcast-label.js';

export const StunningSunlight = {
  name: 'Stunning Sunlight',
  description:
    '**Recall Cost 2.** Make a **Spellcast Roll** to unleash powerful rays of burning sunlight against all adversaries in front of you within Far range. On a success, **spend any number of Hope** and force that many targets you succeeded against to make a Reaction Roll (14).\n\nTargets who succeed take **3d20+3** magic damage. Targets who fail take **4d20+5** magic damage and are temporarily _Stunned_. While _Stunned_, they can\'t use reactions and can\'t take any other actions until they clear this condition.',
  chips: [
    {
      placements: ['card'],
      name: 'Stunning Sunlight',
      hopeCost: 2,
      description:
        'Spend 2 Hope (recall). Spellcast vs adversaries in front of you within Far. On a success, spend any additional Hope and apply that many successful targets: each makes a Reaction Roll (14). Pass: 3d20+3 magic damage. Fail: 4d20+5 magic damage + Stunned.',
      onUse(table) {
        const trait = spellcastTraitLabel(table);
        table.me.actionLoop(
          'Stunning Sunlight',
          `Spend 2 Hope (recall). Make a Spellcast (${trait}) roll against all adversaries in front of you within Far range. On a success, spend any number of Hope and choose that many targets you succeeded against; each makes a Reaction Roll (14). On a pass: 3d20+3 magic damage. On a fail: 4d20+5 magic damage and the target is temporarily Stunned (no reactions or other actions until Stunned is cleared).`,
          { trait }
        );
      },
    },
  ],
};
