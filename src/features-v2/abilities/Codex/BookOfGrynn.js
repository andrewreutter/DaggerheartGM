/**
 * Codex — Book of Grynn (Tier 1 grimoire; SRD lists as Level 4 domain card)
 * SRD: daggerheart-srd/.build/03_json/abilities.json
 */

import { when } from '../../engine/when.js';
import { spellcastTraitLabel } from './spellcast-label.js';

function isWithinVeryCloseRangeOfMe(table, otherActor) {
  const b = table.me?.rangeFrom(otherActor);
  return b === 'melee' || b === 'veryClose';
}

/**
 * Pending damage to the feature owner, or to another PC within Very Close range of the owner.
 */
function hasArcaneDeflectionEligibleDamage(table) {
  const meId = table.me?.instanceId;
  if (!meId) return false;
  return Boolean(
    table.action?.effects?.some((e) => {
      if (e.type !== 'damage' || !(e.amount > 0)) return false;
      const tid = e.target?.instanceId;
      if (!tid) return false;
      if (tid === meId) return true;
      const other = table.characters.find((c) => c.instanceId === tid);
      if (!other) return false;
      return isWithinVeryCloseRangeOfMe(table, other);
    })
  );
}

export const BookOfGrynn = {
  name: 'Book of Grynn',
  description:
    '_Arcane Deflection:_ Once per long rest, **spend a Hope** to negate the damage of an attack targeting you or an ally within Very Close range.\n\n_Time Lock:_ Target an object within Far range. That object stops in time and space exactly where it is until your next rest. If a creature tries to move it, make a **Spellcast Roll** against them to maintain this spell.\n\n_Wall of Flame:_ Make a **Spellcast Roll (15)**. On a success, create a temporary wall of magical flame between two points within Far range. All creatures in its path must choose a side to be on, and anything that subsequently passes through the wall takes **4d10+3** magic damage.',
  chips: [
    when(hasArcaneDeflectionEligibleDamage, {
      name: 'Arcane Deflection',
      description:
        'Spend 1 Hope (once per long rest) to negate this attack’s damage against you or an ally within Very Close range.',
      placements: ['reviewAction'],
      hopeCost: 1,
      frequency: 'longRest',
      onUse(table) {
        const me = table.me;
        for (const e of table.action?.effects ?? []) {
          if (e.type !== 'damage' || !(e.amount > 0)) continue;
          const tid = e.target?.instanceId;
          if (!tid) continue;
          if (tid === me.instanceId) {
            e.amount = 0;
            continue;
          }
          const other = table.characters.find((c) => c.instanceId === tid);
          if (other && isWithinVeryCloseRangeOfMe(table, other)) {
            e.amount = 0;
          }
        }
        table.action.addNarration(
          `${me.name ?? 'You'} uses Arcane Deflection: negate the damage (once per long rest; 1 Hope spent).`
        );
      },
    }),
    {
      placements: ['card'],
      name: 'Time Lock',
      description:
        'Target an object within Far range; it is fixed until your next rest. If something tries to move it, Spellcast vs them to maintain.',
      onUse(table) {
        const trait = spellcastTraitLabel(table);
        table.me.actionLoop(
          'Book of Grynn — Time Lock',
          `Target an object within Far range. That object stops in time and space until your next rest. If a creature tries to move it, make a Spellcast (${trait}) roll against them to maintain this spell.`,
          { trait }
        );
      },
    },
    {
      placements: ['card'],
      name: 'Wall of Flame',
      description:
        'Spellcast (DC 15): wall of flame between two points within Far range; **4d10+3** magic damage through the wall.',
      onUse(table) {
        const trait = spellcastTraitLabel(table);
        table.me.actionLoop(
          'Book of Grynn — Wall of Flame',
          `Make a Spellcast (${trait}) roll — **DC 15**. On a success, create a temporary wall of magical flame between two points within Far range. All creatures in its path choose a side; anything that passes through takes **4d10+3** magic damage.`,
          { trait }
        );
      },
    },
  ],
};
