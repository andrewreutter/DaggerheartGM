/**
 * Codex domain — Sigil of Retribution (Tier 2 / level 6 spell)
 * SRD: daggerheart-srd/abilities/Sigil of Retribution.md
 */

import { when, isActing } from '../../engine/when.js';

/** SRD “within Close range” for map targeting (Melee, Very Close, or Close bands). */
function isWithinCloseRange(table, actor) {
  const b = table.me.rangeFrom(actor);
  return b === 'melee' || b === 'veryClose' || b === 'close';
}

function markedAdversaryAttackDamagedAlly(table) {
  const mark = table.feature.get('markedAdversaryInstanceId');
  if (!mark) return false;
  const atk = table.action?.attacker;
  if (!atk?.isAdversary || atk.instanceId !== mark) return false;
  if (table.action?.type !== 'attack') return false;
  return (table.action?.effects ?? []).some(
    (e) =>
      e.stat === 'currentHP' &&
      (e.amount ?? 0) > 0 &&
      (e.target?.elementType === 'character' || e.target?.isCharacter === true)
  );
}

function attackingMarkedAdversarySuccessfully(table) {
  const mark = table.feature.get('markedAdversaryInstanceId');
  if (!mark) return false;
  if (table.action?.type !== 'attack') return false;
  const tgt = table.action?.target;
  if (!tgt?.isAdversary || tgt.instanceId !== mark) return false;
  return table.rolls?.action?.isSuccess === true;
}

function hasSigilDamageDice(table) {
  return (table.feature.get('sigilTokenCount') ?? 0) > 0;
}

function batchKilledMarkedAdversary(table) {
  const mark = table.feature.get('markedAdversaryInstanceId');
  if (!mark) return false;
  const hit = table.mutationBatch.some(
    (m) => m.type === 'markHP' && m.payload?.instanceId === mark
  );
  if (!hit) return false;
  const adv = table.actors.find((a) => a.instanceId === mark);
  return adv?.isAdversary === true && adv.currentHP === 0;
}

export const SigilOfRetribution = {
  name: 'Sigil of Retribution',
  description:
    'Mark an adversary within Close range with a sigil of retribution. The GM gains a Fear. When the marked adversary deals damage to you or your allies, place a **d8** on this card. You can hold a number of **d8s** equal to your level. When you successfully attack the marked adversary, roll the dice on this card and add the total to your damage roll, then clear the dice. This effect ends when the marked adversary is defeated or you cast Sigil of Retribution again.',
  chips: [
    {
      placements: ['card'],
      name: 'Cast Sigil of Retribution',
      description:
        'Choose an adversary within Close range: mark them (Recall Cost 2). The GM gains 1 Fear. Replaces any previous sigil on this card and clears stored d8s.',
      selectTargets: (table) => table.adversaries.filter((a) => isWithinCloseRange(table, a)),
      multiSelect: false,
      isDisabled: (table) =>
        table.adversaries.filter((a) => isWithinCloseRange(table, a)).length === 0
          ? 'No adversary within Close range (Melee–Close).'
          : false,
      onUse(table, chip) {
        const id = (chip.get?.('selectedTargetIds') || [])[0];
        if (!id) return;
        const adv = table.adversaries.find((a) => a.instanceId === id);
        if (!adv || !isWithinCloseRange(table, adv)) return;
        table.top.gainFear(1);
        table.feature.set('markedAdversaryInstanceId', id);
        table.feature.set('sigilTokenCount', 0);
        table.me.actionLoop(
          'Sigil of Retribution',
          `Mark ${adv.name} with a sigil of retribution (Recall Cost 2). The GM gains 1 Fear. When the marked adversary deals Hit Point damage to you or your allies, place a d8 on this card (up to your level). When you successfully attack the marked adversary, roll those d8s and add the total to your damage; then clear the dice. Ends when the target is defeated or you cast this again.`,
          {}
        );
      },
    },
  ],
  hooks: {
    onReviewOutcome: when(
      markedAdversaryAttackDamagedAlly,
      (table) => {
        const lv = table.me.level ?? 1;
        const cur = table.feature.get('sigilTokenCount') ?? 0;
        if (cur >= lv) return;
        table.feature.set('sigilTokenCount', cur + 1);
      }
    ),
    onReviewAction: when(
      isActing,
      attackingMarkedAdversarySuccessfully,
      hasSigilDamageDice,
      (table) => {
        const n = table.feature.get('sigilTokenCount') ?? 0;
        if (n <= 0) return;
        table.rolls?.damage?.addDie({
          name: 'Sigil of Retribution',
          die: `${n}d8`,
        });
        table.feature.set('sigilTokenCount', 0);
      }
    ),
    onStateChange: when(
      batchKilledMarkedAdversary,
      (table) => {
        table.feature.set('markedAdversaryInstanceId', null);
        table.feature.set('sigilTokenCount', 0);
      }
    ),
  },
};
