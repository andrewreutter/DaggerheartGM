/**
 * Grace domain — Encore (Tier 3 / level 10 spell)
 * SRD: When an ally within Close range deals damage to an adversary, make a Spellcast Roll vs that target.
 * On a success, deal the same damage. Recall Cost 1. If the Spellcast succeeds with Fear, move this card to your vault.
 */

import { when, isActing } from '../../engine/when.js';
import { spellcastTraitLabel } from '../Codex/spellcast-label.js';

const ENCORE_CARD_ID = 'srd-abl-encore';

const PENDING_KEY = 'encorePending';
const ACTIVE_KEY = 'encoreSpellcastActive';

/** Sum of raw pending damage to the action's primary target (ally attack vs adversary). */
function allyDamageToActionTarget(table) {
  const t = table.action?.target;
  if (!t) return 0;
  const tid = t.instanceId;
  let sum = 0;
  for (const e of table.action?.effects ?? []) {
    if (e.type !== 'damage' || e.target?.instanceId !== tid || !(e.amount > 0)) continue;
    sum += e.amount;
  }
  return sum;
}

function inferDamageType(table) {
  const tid = table.action?.target?.instanceId;
  if (!tid) return 'physical';
  for (const e of table.action?.effects ?? []) {
    if (e.type === 'damage' && e.target?.instanceId === tid && e.damageType) return e.damageType;
  }
  return 'physical';
}

function encoreReactionWindow(table) {
  if (table.action?.type !== 'attack') return false;
  const me = table.me?.instanceId;
  const actor = table.action?.actor;
  if (!me || !actor || actor.instanceId === me) return false;
  if (!actor.isCharacter) return false;
  const target = table.action?.target;
  if (!target?.isAdversary) return false;
  const band = table.me.rangeFrom(actor);
  if (band !== 'melee' && band !== 'veryClose' && band !== 'close') return false;
  return allyDamageToActionTarget(table) > 0;
}

function succeedWithFear(table) {
  const h = table.rolls?.action?.hopeDie?.value;
  const f = table.rolls?.action?.fearDie?.value;
  return h != null && f != null && f > h && table.rolls?.action?.isSuccess === true;
}

export const Encore = {
  name: 'Encore',
  description:
    'When an ally within Close range deals damage to an adversary, you can make a **Spellcast Roll** against that same target. On a success, you deal the same damage to the target that your ally dealt. If your Spellcast Roll succeeds with Fear, place this card in your vault.',
  chips: [
    when(encoreReactionWindow, {
      name: 'Encore',
      placements: ['reviewAction'],
      hopeCost: 1,
      description:
        'Spend 1 Hope (recall). Spellcast vs the adversary your ally damaged (within Close range of you). On success: deal the same damage. On success with Fear, move this card to your vault.',
      onUse(table) {
        const target = table.action?.target;
        if (!target?.isAdversary) return;
        const amount = allyDamageToActionTarget(table);
        if (amount <= 0) return;
        const dtype = inferDamageType(table);
        const traitLabel = spellcastTraitLabel(table);
        const dc = target.effectiveDifficulty ?? 0;
        const tname = target.name ?? 'target';
        table.feature.set(PENDING_KEY, {
          amount,
          targetId: target.instanceId,
          damageType: dtype,
        });
        table.feature.set(ACTIVE_KEY, true);
        table.me.actionLoop(
          'Encore',
          `Spend 1 Hope (recall). Make a Spellcast (${traitLabel}) roll vs ${tname} (Difficulty ${dc}). On a success, deal the same damage (${amount}) that your ally dealt. On success with Fear, move Encore to your vault.`,
          { trait: traitLabel, difficulty: dc }
        );
      },
    }),
  ],
  hooks: {
    onReviewAction: when(
      isActing,
      (t) => t.action?.type === 'spellcast',
      (t) => t.feature.get(ACTIVE_KEY) === true,
      (table) => {
        const pending = table.feature.get(PENDING_KEY);
        table.feature.set(ACTIVE_KEY, false);
        const tgt = table.action?.target;
        if (!pending?.targetId || !tgt || tgt.instanceId !== pending.targetId) {
          table.feature.set(PENDING_KEY, null);
          return;
        }
        table.feature.set(PENDING_KEY, null);
        const success = table.rolls?.action?.isSuccess === true;
        if (!success || pending.amount <= 0) return;
        const adv = table.adversaries.find((a) => a.instanceId === pending.targetId);
        if (!adv) return;
        table.action.addDamageRoll({
          name: 'Encore',
          dice: `${pending.amount}d1`,
          damageType: pending.damageType || 'physical',
          targets: [adv],
        });
        if (succeedWithFear(table)) {
          table.me.moveDomainCardToVault(ENCORE_CARD_ID);
        }
      }
    ),
  },
};
