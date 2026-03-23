/**
 * Valor domain — Shrug It Off (Tier 2 / level 7 spell)
 * SRD: daggerheart-srd/abilities/Shrug It Off.md
 */

import { when, isTargeted } from '../../engine/when.js';
import { reduceIncomingHpByOneThreshold } from '../../engine/armor-review-outcome.js';

const SHRUG_IT_OFF_CARD_ID = 'srd-abl-shrug-it-off';

function hasIncomingDamageToMe(table) {
  const id = table.me?.instanceId;
  if (!id) return false;
  return (table.action?.effects ?? []).some((e) => {
    if (e.type === 'damage' && e.target?.instanceId === id && e.amount > 0) return true;
    if (e.stat === 'currentHP' && e.target?.instanceId === id && e.amount > 0) return true;
    return false;
  });
}

export const ShrugItOff = {
  name: 'Shrug It Off',
  description:
    'When you would take damage, you can **mark a Stress** to reduce the severity of the damage by one threshold. When you do, roll a **d6**. On a result of 3 or lower, place this card in your vault.',
  chips: [
    when(
      isTargeted,
      hasIncomingDamageToMe,
      {
        placements: ['reviewOutcome'],
        name: 'Shrug It Off',
        stressCost: 1,
        description:
          'Mark a Stress to reduce this hit by one threshold, then roll a d6 — on 3 or lower, move this card to your vault.',
        onUse(table) {
          reduceIncomingHpByOneThreshold(table);
          const d6 = table.rollDie('d6');
          if (d6 <= 3) {
            table.me.moveDomainCardToVault(SHRUG_IT_OFF_CARD_ID);
          }
        },
      }
    ),
  ],
};
