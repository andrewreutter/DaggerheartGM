/**
 * Bone domain — Bone-Touched (Tier 2 / Level 7)
 * SRD: daggerheart-srd/abilities/Bone-Touched.md
 */

import { when, anAttackSucceeds, againstYou } from '../../engine/when.js';

function boneDomainCardsInLoadout(table) {
  const lo = table.me?.domainLoadout ?? [];
  if (!Array.isArray(lo)) return 0;
  return lo.filter((c) => c && String(c.domain || '').toLowerCase() === 'bone').length;
}

function boneTouchedActive(table) {
  return boneDomainCardsInLoadout(table) >= 4;
}

export const BoneTouched = {
  name: 'Bone-Touched',
  description:
    'When 4 or more of the domain cards in your loadout are from the Bone domain, gain the following benefits:\n\n- +1 bonus to Agility\n- Once per rest, you can **spend 3 Hope** to cause an attack that succeeded against you to fail instead.',
  passiveStatMods: when(boneTouchedActive, {
    agility: 1,
  }),
  chips: [
    when(
      anAttackSucceeds,
      againstYou,
      boneTouchedActive,
      {
        name: 'Bone-Touched — Attack fails',
        placements: ['reviewAction'],
        hopeCost: 3,
        frequency: 'rest',
        description:
          'Spend 3 Hope (once per rest) to turn this successful attack against you into a failure (no hit).',
        isDisabled: (table) =>
          (table.me?.hope ?? 0) < 3 ? 'Need at least 3 Hope.' : false,
        onUse(table) {
          table.rolls?.action?.setActionSuccess?.(false);
          const id = table.me?.instanceId;
          if (!id) return;
          for (const e of table.action?.effects ?? []) {
            if (e.target?.instanceId !== id) continue;
            if (e.type === 'damage' && (e.amount ?? 0) > 0) e.amount = 0;
            if (e.stat === 'currentHP' && (e.amount ?? 0) > 0) e.amount = 0;
          }
          table.action.addNarration(
            `${table.me?.name ?? 'You'} uses Bone-Touched — the attack fails instead (3 Hope).`
          );
        },
      }
    ),
  ],
};
