/**
 * Sage domain — Death Grip (Tier 2)
 * SRD: Spellcast vs Close — pull/constrict/vine-line damage; success restrains
 */

import { spellcastTraitLabel } from '../Codex/spellcast-label.js';

export const DeathGrip = {
  name: 'Death Grip',
  description:
    'Make a **Spellcast Roll** against a target within Close range and choose one of the following options:\n\n- You pull the target into Melee range or pull yourself into Melee range of them.\n- You constrict the target and force them to mark 2 Stress.\n- All adversaries between you and the target must succeed on a Reaction Roll (13) or be hit by vines, taking **3d6+2** physical damage.\n\nOn a success, vines reach out from your hands, causing the chosen effect and temporarily _Restraining_ the target.',
  chips: [
    {
      placements: ['card'],
      name: 'Death Grip',
      description:
        'Recall cost 1. Spellcast vs a target within Close range; on a success choose pull to Melee, 2 Stress on the target, or Reaction (13) for adversaries in line for 3d6+2 physical. Success also temporarily Restrains the target.',
      onUse(table) {
        const trait = spellcastTraitLabel(table);
        table.me.actionLoop(
          'Death Grip',
          `Recall cost 1. Make a Spellcast (${trait}) roll against a target within Close range and choose one option on a success: pull the target to Melee range or move yourself to Melee range of them; or constrict and force the target to mark 2 Stress; or adversaries between you and the target must succeed on a Reaction Roll (13) or be hit by vines for 3d6+2 physical damage. On a success, vines reach out and temporarily Restrain the target (GM resolves positioning and reactions).`,
          { trait }
        );
      },
    },
  ],
};
