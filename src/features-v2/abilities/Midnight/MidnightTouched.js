/**
 * Midnight domain — Midnight-Touched (Tier 2 / Level 7)
 * SRD: daggerheart-srd/abilities/Midnight-Touched.md
 */

import { when, isActing } from '../../engine/when.js';

function midnightDomainCardsInLoadout(table) {
  const lo = table.me?.domainLoadout ?? [];
  if (!Array.isArray(lo)) return 0;
  return lo.filter((c) => c && String(c.domain || '').toLowerCase() === 'midnight').length;
}

function midnightTouchedActive(table) {
  return midnightDomainCardsInLoadout(table) >= 4;
}

/** Fear dominates Hope (GM would gain a Fear) and the roll is not a Critical (tied dice). */
function fearWouldGiveGmFear(table) {
  const a = table.rolls?.action;
  const h = a?.hopeDie?.value;
  const f = a?.fearDie?.value;
  if (h == null || f == null) return false;
  if (a?.isCritical === true) return false;
  return f > h;
}

export const MidnightTouched = {
  name: 'Midnight-Touched',
  description:
    'When 4 or more of the domain cards in your loadout are from the Midnight domain, gain the following benefits:\n\n- Once per rest, when you have 0 Hope and the GM would gain a Fear, you can gain a Hope instead.\n- When you make a successful attack, you can **mark a Stress** to add the result of your Fear Die to your damage roll.',
  chips: [
    when(
      isActing,
      midnightTouchedActive,
      (table) => table.me?.hope === 0,
      fearWouldGiveGmFear,
      {
        name: 'Midnight-Touched — Hope instead of GM Fear',
        placements: ['reviewAction'],
        frequency: 'rest',
        description:
          'Once per rest when you have 0 Hope and this roll would give the GM a Fear (Fear die higher than Hope die), gain 1 Hope instead; the roll resolves as Hope so the GM does not gain Fear from it.',
        onUse(table) {
          table.rolls?.action?.setOutcome('hope');
          table.me.gainHope(1);
        },
      }
    ),
    when(
      isActing,
      midnightTouchedActive,
      (table) =>
        table.action?.type === 'attack' &&
        table.rolls?.action?.isSuccess === true &&
        table.rolls?.damage != null &&
        table.rolls?.action?.fearDie?.value != null,
      {
        name: 'Midnight-Touched — Fear Die to Damage',
        placements: ['reviewAction'],
        stressCost: 1,
        description: 'Mark 1 Stress to add your Fear Die result to this attack’s damage.',
        onUse(table) {
          const v = table.rolls.action.fearDie.value;
          table.rolls.damage.addStatic({ name: 'Midnight-Touched', value: v });
        },
      }
    ),
  ],
};
