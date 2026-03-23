/**
 * Splendor domain — Zone of Protection (Tier 2 spell card / SRD level 6)
 * SRD: Spellcast (16); once per long rest on success, zone at a point within Far range;
 * allies within Very Close of that point reduce damage by a d6 track (starts 1, +1 per proc, ends >6).
 */

import { when, isActing } from '../../engine/when.js';
import { spellcastTraitLabel } from '../Codex/spellcast-label.js';

function distanceFt(x1, y1, x2, y2) {
  if (x1 == null || y1 == null || x2 == null || y2 == null) return null;
  return Math.hypot(x1 - x2, y1 - y2);
}

/** Very Close = ≤10' from the zone center. */
function isActorInZone(actor, zoneX, zoneY) {
  const d = distanceFt(zoneX, zoneY, actor.tokenX, actor.tokenY);
  return d != null && d <= 10;
}

export const ZoneOfProtection = {
  name: 'Zone of Protection',
  description:
    'Make a **Spellcast Roll (16)**. Once per long rest on a success, choose a point within Far range and create a visible zone of protection there for all allies within Very Close range of that point. When you do, place a **d6** on this card with the 1 value facing up. When an ally in this zone takes damage, they reduce it by the die\'s value. You then increase the die\'s value by one. When the die\'s value would exceed 6, this effect ends.',
  chips: [
    {
      placements: ['card'],
      name: 'Zone of Protection',
      frequency: 'longRest',
      description:
        'Once per long rest: Spellcast (16). On a success, place a zone at a point within Far range (automation uses your token position as the center—move before resolving if needed). Allies within Very Close of that point reduce damage by the d6 on this card (starts at 1, then +1 after each proc; ends when the die would exceed 6).',
      onUse(table) {
        table.feature.set('zopAwaitingSpellcast', true);
        const trait = spellcastTraitLabel(table);
        table.me.actionLoop(
          'Zone of Protection',
          `Make a Spellcast (${trait}) roll (16). Once per long rest on a success, choose a point within Far range on the map and create a visible zone covering all allies within Very Close range of that point. Place a d6 on this card with 1 face up. When an ally in the zone takes damage, reduce it by the die's current value, then increase the die by 1; when the die would exceed 6, the zone ends. (Automation: zone center defaults to your token's position—place your token at the chosen point before resolving if it should be elsewhere.)`,
          { trait, difficulty: 16 }
        );
      },
    },
  ],
  hooks: {
    onReviewAction: when(
      isActing,
      (table) =>
        table.action?.type === 'spellcast' &&
        table.feature.get('zopAwaitingSpellcast') === true,
      (table) => typeof table.rolls?.action?.isSuccess === 'boolean',
      (table) => {
        table.feature.set('zopAwaitingSpellcast', false);
        if (table.rolls?.action?.isSuccess !== true) return;
        table.feature.set('zoneDieValue', 1);
        table.feature.set('zoneCenterX', table.me.tokenX);
        table.feature.set('zoneCenterY', table.me.tokenY);
      }
    ),
    onReviewOutcome: when(
      (table) => table.feature.get('zoneDieValue') != null,
      (table) => {
        const die = table.feature.get('zoneDieValue');
        const zx = table.feature.get('zoneCenterX');
        const zy = table.feature.get('zoneCenterY');
        if (die == null || zx == null || zy == null) return;

        for (const e of table.action?.effects ?? []) {
          if (e.type !== 'damage' || typeof e.amount !== 'number' || e.amount <= 0) continue;
          const tid = e.target?.instanceId;
          if (!tid) continue;
          const targetEl = table.actors.find((a) => a.instanceId === tid);
          if (!targetEl?.isCharacter) continue;
          if (!isActorInZone(targetEl, zx, zy)) continue;

          const reduce = Math.min(die, e.amount);
          e.amount = Math.max(0, e.amount - reduce);
          const next = die + 1;
          if (next > 6) {
            table.feature.set('zoneDieValue', null);
            table.feature.set('zoneCenterX', null);
            table.feature.set('zoneCenterY', null);
            table.action.addNarration(
              `Zone of Protection ends — the ward would exceed 6 on the d6 (reduced this hit by ${reduce}).`
            );
          } else {
            table.feature.set('zoneDieValue', next);
            table.action.addNarration(
              `Zone of Protection reduces damage by ${reduce} (d6 was ${die}; track is now ${next}).`
            );
          }
          return;
        }
      }
    ),
    onRest(table) {
      if (table.action?.type !== 'longRest') return;
      table.feature.set('zoneDieValue', null);
      table.feature.set('zoneCenterX', null);
      table.feature.set('zoneCenterY', null);
      table.feature.set('zopAwaitingSpellcast', false);
    },
  },
};
