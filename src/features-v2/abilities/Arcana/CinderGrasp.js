/**
 * Arcana domain spell — SRD: daggerheart-srd/abilities/Cinder Grasp.md
 */

import { when } from '../../engine/when.js';

/** True when the current action's actor is On Fire (tick damage at resolve). */
function actorOnFireEndOfAction(table) {
  const actor = table.action?.actor;
  return actor?.hasCondition('On Fire') === true;
}

function spellcastTraitLabel(table) {
  const key = table.me?.spellcastTrait;
  if (!key || typeof key !== 'string') return 'Presence';
  return key.charAt(0).toUpperCase() + key.slice(1);
}

export const CinderGrasp = {
  name: 'Cinder Grasp',
  description:
    'Make a **Spellcast Roll** against a target within Melee range. On a success, the target instantly bursts into flames, takes **1d20+3** magic damage, and is temporarily lit _On Fire_.\n\nWhen a creature acts while _On Fire_, they must take an extra **2d6** magic damage if they are still _On Fire_ at the end of their action.',
  hooks: {
    onResolve: when(actorOnFireEndOfAction, (table) => {
      const actor = table.action.actor;
      table.action.addDamageRoll({
        name: 'Cinder Grasp (On Fire)',
        dice: '2d6',
        damageType: 'magic',
        targets: [actor],
      });
    }),
  },
  chips: [
    {
      placements: ['card'],
      description:
        'Spellcast vs Melee. On success: 1d20+3 magic damage and On Fire. On Fire: +2d6 magic at end of their action if still On Fire.',
      onUse(table) {
        const trait = spellcastTraitLabel(table);
        table.me.actionLoop(
          'Cinder Grasp',
          `Spellcast (${trait}) vs a target within Melee. On success: 1d20+3 magic damage and the target is On Fire. While On Fire, they take an extra 2d6 magic damage at the end of their action if still On Fire.`,
          { trait }
        );
      },
    },
  ],
};
