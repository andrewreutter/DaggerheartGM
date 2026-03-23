/**
 * Sage domain — Rejuvenation Barrier (Tier 2)
 * SRD: Spellcast (15). Once per rest on success: Very Close barrier; those inside when cast clear 1d4 HP each;
 * resistance (halve physical, round up) vs attacks from outside the barrier while active. Barrier follows the caster.
 */

import { when, isActing, unwrap } from '../../engine/when.js';
import { spellcastTraitLabel } from '../Codex/spellcast-label.js';

function distanceFt(x1, y1, x2, y2) {
  if (x1 == null || y1 == null || x2 == null || y2 == null) return null;
  return Math.hypot(x1 - x2, y1 - y2);
}

/** Very Close range = 10'. */
function withinVeryClose(ax, ay, bx, by) {
  const d = distanceFt(ax, ay, bx, by);
  return d != null && d <= 10;
}

function sourceAttackerId(effect) {
  const s = effect?.source;
  if (s && typeof s === 'object' && s.instanceId != null) return s.instanceId;
  return null;
}

export const RejuvenationBarrier = {
  name: 'Rejuvenation Barrier',
  description:
    '**Recall cost 1.** Make a **Spellcast Roll (15)**. Once per rest on a success, create a temporary barrier of protective energy around you at Very Close range. You and all allies within the barrier when this spell is cast clear **1d4** Hit Points. While the barrier is up, you and all allies within have resistance to physical damage from outside the barrier.\n\nWhen you move, the barrier follows you.',
  chips: [
    {
      placements: ['card'],
      name: 'Rejuvenation Barrier',
      frequency: 'rest',
      hopeCost: 1,
      description:
        'Once per rest: recall cost 1 Hope. Spellcast (15). On a success, raise a Very Close barrier centered on you (it follows your token). You and each ally with a placed token inside the barrier when this resolves clear 1d4 HP (rolled per character). While active, characters inside have resistance (halve, round up) to physical damage from sources outside the barrier.',
      onUse(table) {
        table.feature.set('rbAwaitingSpellcast', true);
        const trait = spellcastTraitLabel(table);
        table.me.actionLoop(
          'Rejuvenation Barrier',
          `Recall cost 1 Hope. Make a Spellcast (${trait}) roll (15). Once per rest on a success, create a barrier at Very Close range (centered on you; it moves with you). You and each ally within the barrier when this resolves clear 1d4 Hit Points (roll 1d4 separately for each). While the barrier is up, you and allies inside have resistance to physical damage from outside the barrier (halve incoming physical damage, round up).`,
          { trait, difficulty: 15 }
        );
      },
    },
  ],
  hooks: {
    onReviewAction(table) {
      const resolveSpellcast = unwrap(
        when(
          isActing,
          (t) =>
            t.action?.type === 'spellcast' && t.feature.get('rbAwaitingSpellcast') === true,
          (t) => typeof t.rolls?.action?.isSuccess === 'boolean',
          (t) => {
            t.feature.set('rbAwaitingSpellcast', false);
            if (t.rolls?.action?.isSuccess !== true) return;

            const cx = t.me.tokenX;
            const cy = t.me.tokenY;
            const healed = [];
            for (const c of t.characters) {
              if (cx == null || cy == null) continue;
              if (!withinVeryClose(cx, cy, c.tokenX, c.tokenY)) continue;
              const amt = t.rollDie('1d4');
              c.clearHP(amt);
              healed.push(`${c.name ?? 'Character'} (+${amt} HP)`);
            }
            t.feature.set('rejuvenationBarrierActive', true);
            if (healed.length) {
              t.action.addNarration(
                `Rejuvenation Barrier: ${healed.join('; ')}. Barrier is active (Very Close around ${t.me.name}; halve physical damage from outside, round up).`
              );
            } else {
              t.action.addNarration(
                `Rejuvenation Barrier succeeds — barrier is active (place tokens to track healing range; halve physical damage from outside while up).`
              );
            }
          }
        ),
        table
      );
      if (typeof resolveSpellcast === 'function') resolveSpellcast(table);

      const applyResistance = unwrap(
        when(
          (t) => t.feature.get('rejuvenationBarrierActive') === true,
          (t) => {
            const cx = t.me.tokenX;
            const cy = t.me.tokenY;
            if (cx == null || cy == null) return;

            let any = false;
            for (const e of t.action?.effects ?? []) {
              if (
                e.type !== 'damage' ||
                e.damageType !== 'physical' ||
                typeof e.amount !== 'number' ||
                e.amount <= 0
              )
                continue;

              const tid = e.target?.instanceId;
              if (!tid) continue;
              const target = t.actors.find((a) => a.instanceId === tid);
              if (!target?.isCharacter) continue;
              if (!withinVeryClose(cx, cy, target.tokenX, target.tokenY)) continue;

              const aid = sourceAttackerId(e) ?? t.action?.actor?.instanceId;
              if (aid) {
                const attacker = t.actors.find((a) => a.instanceId === aid);
                if (
                  attacker &&
                  withinVeryClose(cx, cy, attacker.tokenX, attacker.tokenY)
                ) {
                  continue;
                }
              }

              const before = e.amount;
              e.amount = Math.max(0, Math.ceil(e.amount / 2));
              if (e.amount < before) any = true;
            }
            if (any) {
              t.action.addNarration(
                'Rejuvenation Barrier: resistance halves physical damage from outside the barrier (round up).'
              );
            }
          }
        ),
        table
      );
      if (typeof applyResistance === 'function') applyResistance(table);
    },

    onRest(table) {
      table.feature.set('rbAwaitingSpellcast', false);
      if (table.action?.type === 'longRest') {
        table.feature.set('rejuvenationBarrierActive', false);
      }
    },
  },
};
