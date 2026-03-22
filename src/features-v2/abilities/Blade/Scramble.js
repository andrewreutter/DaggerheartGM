/**
 * Blade domain — Scramble (Tier 1)
 * SRD: Once per rest, when a creature within Melee range would deal damage to you,
 * you can avoid the attack and safely move out of Melee range of the enemy.
 */

import { when, isTargeted, hasDamage } from '../../engine/when.js';

function attackerInMeleeOfMe(table) {
  const a = table.action?.attacker;
  if (!a || !table.me) return false;
  return table.me.rangeFrom(a) === 'melee';
}

export const Scramble = {
  name: 'Scramble',
  description:
    'Once per rest, when a creature within Melee range would deal damage to you, you can avoid the attack and safely move out of Melee range of the enemy.',
  chips: [
    when(
      isTargeted,
      hasDamage,
      attackerInMeleeOfMe,
      {
        name: 'Scramble',
        placements: ['reviewAction'],
        frequency: 'rest',
        description:
          'Avoid this attack (no damage): you move out of Melee range of the attacker. GM: reposition your token.',
        onUse(table) {
          const id = table.me.instanceId;
          for (const e of table.action?.effects ?? []) {
            if (e.type === 'damage' && e.target?.instanceId === id && (e.amount ?? 0) > 0) {
              e.amount = 0;
            }
          }
          table.action.addNarration(
            `${table.me.name ?? 'You'} uses Scramble: the attack misses; move out of Melee range (GM).`
          );
        },
      }
    ),
  ],
};
