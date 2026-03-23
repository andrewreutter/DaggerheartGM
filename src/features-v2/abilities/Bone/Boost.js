/**
 * Bone domain — Boost (Tier 2 spell card; SRD level 4)
 * SRD: Mark a Stress to boost off a willing ally within Close range, aerial attack vs a Far-range target:
 * advantage on the attack, +d10 damage, end in Melee of the target.
 */

import { when, isActing } from '../../engine/when.js';

/** Within the Close range band (≤30') for ally positioning. */
const ALLY_CLOSE_BANDS = new Set(['melee', 'veryClose', 'close']);

function hasAllyWithinClose(table) {
  const me = table.me;
  if (!me) return false;
  for (const c of table.characters ?? []) {
    if (c.instanceId === me.instanceId) continue;
    const band = me.rangeFrom(c);
    if (band && ALLY_CLOSE_BANDS.has(band)) return true;
  }
  return false;
}

function isFarBandAttackVsAdversary(table) {
  if (table.action?.type !== 'attack') return false;
  const tgt = table.action?.target;
  if (!tgt || !(tgt.isAdversary === true || tgt.elementType === 'adversary')) return false;
  return table.me?.rangeFrom(tgt) === 'far';
}

export const Boost = {
  name: 'Boost',
  description:
    '**Mark a Stress** to boost off a willing ally within Close range, fling yourself into the air, and perform an aerial attack against a target within Far range. You have advantage on the attack, add a **d10** to the damage roll, and end your move within Melee range of the target.',
  chips: [
    when(
      isActing,
      (t) => t.action?.type === 'attack',
      hasAllyWithinClose,
      isFarBandAttackVsAdversary,
      {
        name: 'Boost',
        placements: ['intent'],
        stressCost: 1,
        description:
          'Mark a Stress: advantage on this attack and +d10 damage. Requires another PC within Close range on the map (willing ally — GM) and a Far-range adversary; after the hit, end your movement within Melee of the target (GM).',
        onUse(table) {
          table.rolls?.action?.addAdvantageDie?.('Boost');
          table.rolls?.damage?.addDie?.({ name: 'Boost', die: 'd10' });
          table.me?.actionLoop?.(
            'Boost',
            'You boosted off a willing ally within Close range and make this aerial attack against a Far-range target; after resolving the hit, end your movement within Melee range of the target (GM confirms positions).'
          );
        },
      }
    ),
  ],
};
