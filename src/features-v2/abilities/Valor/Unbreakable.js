/**
 * Valor domain — Unbreakable (Tier 4 / level 10 spell)
 * SRD: daggerheart-srd/.build/03_json/abilities.json
 */

import { when, isTargeted } from '../../engine/when.js';

const UNBREAKABLE_CARD_ID = 'srd-abl-unbreakable';

/** Pending HP loss in review-outcome may be `stat: 'currentHP'` or `type: 'damage'` (banner bridge). */
function isPendingHpLossEffect(e) {
  const amt = e.amount ?? 0;
  if (!(amt > 0)) return false;
  if (e.stat === 'currentHP') return true;
  if (e.type === 'damage') return true;
  return false;
}

/**
 * True when total pending HP loss to the feature owner would force a Death Move (reduce to 0 HP).
 */
function wouldMakeDeathMove(table) {
  const id = table.me?.instanceId;
  if (!id) return false;
  const hp = table.me?.currentHP ?? 0;
  if (!(hp > 0)) return false;
  let sum = 0;
  for (const e of table.action?.effects ?? []) {
    if (!isPendingHpLossEffect(e)) continue;
    const tid = e.target?.instanceId ?? e.target?.id;
    if (tid !== id) continue;
    sum += e.amount ?? 0;
  }
  return sum >= hp;
}

function zeroLethalHpLossToMe(table) {
  const id = table.me?.instanceId;
  if (!id) return;
  const hp = table.me?.currentHP ?? 0;
  if (!(hp > 0)) return;
  let sum = 0;
  const mine = [];
  for (const e of table.action?.effects ?? []) {
    if (!isPendingHpLossEffect(e)) continue;
    const tid = e.target?.instanceId ?? e.target?.id;
    if (tid !== id) continue;
    const amt = e.amount ?? 0;
    if (amt > 0) {
      mine.push(e);
      sum += amt;
    }
  }
  if (sum < hp) return;
  for (const e of mine) {
    e.amount = 0;
  }
}

export const Unbreakable = {
  name: 'Unbreakable',
  description:
    'When you mark your last Hit Point, instead of making a death move, you can roll a **d6** and clear a number of Hit Points equal to the result. Then place this card in your vault.',
  chips: [
    when(isTargeted, wouldMakeDeathMove, {
      placements: ['reviewOutcome'],
      name: 'Unbreakable',
      description:
        'Roll a d6 and clear that many Hit Points instead of making a Death Move — then place this card in your vault.',
      onUse(table) {
        const roll = table.rollDie('d6');
        zeroLethalHpLossToMe(table);
        table.me.clearHP(roll);
        table.me.moveDomainCardToVault(UNBREAKABLE_CARD_ID);
        table.action.addNarration(
          `Unbreakable: ${table.me?.name ?? 'You'} roll a d6 (${roll}) and clear ${roll} Hit Point(s) instead of making a Death Move — the card goes to your vault.`
        );
      },
    }),
  ],
};
