/**
 * Arcana domain — Sensory Projection (Tier 3)
 * SRD: daggerheart-srd/abilities/Sensory Projection.md
 */

import { spellcastTraitLabel } from '../Codex/spellcast-label.js';

export const SensoryProjection = {
  name: 'Sensory Projection',
  description:
    'Once per rest, make a **Spellcast Roll (15)**. On a success, drop into a vision that lets you clearly see and hear any place you have been before as though you are standing there in this moment. You can move freely in this vision and are not constrained by the physics or impediments of a physical body. This spell cannot be detected by mundane or magical means. You drop out of this vision upon taking damage or casting another spell.',
  chips: [
    {
      placements: ['card'],
      name: 'Sensory Projection',
      frequency: 'rest',
      description:
        'Spellcast (15). On a success, enter an undetectable vision of a place you have visited; you may move freely in the vision. Ends if you take damage or cast another spell.',
      onUse(table) {
        const trait = spellcastTraitLabel(table);
        table.me.actionLoop(
          'Sensory Projection',
          `Once per rest — make a Spellcast (${trait}) roll (15). On a success, you drop into a vision that lets you clearly see and hear any place you have been before as though you are standing there in this moment. You can move freely in this vision and are not constrained by the physics or impediments of a physical body. This spell cannot be detected by mundane or magical means. You drop out of this vision upon taking damage or casting another spell.`,
          { trait, difficulty: 15 }
        );
      },
    },
  ],
};
