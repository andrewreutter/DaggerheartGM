/**
 * Valor domain — Lead by Example (Tier 3 / level 9)
 * SRD: daggerheart-srd/abilities/Lead by Example.md — Recall Cost 3.
 * On damage to an adversary: mark a Stress to flag that foe; the next other PC to attack them can clear a Stress or gain a Hope.
 */

import { when, isActing } from '../../engine/when.js';

/** First pending damage effect to an adversary on this action (positive amount). */
function firstAdversaryDamageTargetId(table) {
  for (const e of table.action?.effects ?? []) {
    if (e.type !== 'damage' || !(e.amount > 0)) continue;
    const tid = e.target?.instanceId;
    if (!tid) continue;
    const actor = table.actors.find((a) => a.instanceId === tid);
    if (actor?.isAdversary) return tid;
  }
  return null;
}

function hasDamageToAdversary(table) {
  return firstAdversaryDamageTargetId(table) != null;
}

function allyRewardPredicate(table) {
  const mark = table.feature.get('markedAdversaryId');
  const gid = table.feature.get('grantorInstanceId');
  if (!mark || !gid) return false;
  if (table.me.instanceId === gid) return false;
  if (table.action?.type !== 'attack') return false;
  return (table.action?.targets ?? []).some((t) => t.instanceId === mark);
}

function allyRewardOptions(table) {
  const opts = [];
  if ((table.me?.currentStress ?? 0) > 0) {
    opts.push({ id: 'stress', name: 'Clear a Stress' });
  }
  const hope = table.me?.hope ?? 0;
  const maxHope = table.me?.maxHope ?? 6;
  if (hope < maxHope) {
    opts.push({ id: 'hope', name: 'Gain a Hope' });
  }
  return opts;
}

export const LeadByExample = {
  name: 'Lead by Example',
  description:
    'When you deal damage to an adversary, you can **mark a Stress** and describe how you encourage your allies. The next PC to make an attack against that adversary can clear a Stress or gain a Hope.',
  chips: [
    when(
      isActing,
      (t) => t.rolls?.damage != null,
      hasDamageToAdversary,
      {
        name: 'Lead by Example — encourage allies',
        placements: ['reviewAction'],
        stressCost: 1,
        description:
          'Mark a Stress and describe how you encourage your allies. The next **other** PC to attack that adversary can clear a Stress or gain a Hope.',
        onUse(table) {
          const advId = firstAdversaryDamageTargetId(table);
          if (!advId) return;
          table.feature.set('grantorInstanceId', table.me.instanceId);
          table.feature.set('markedAdversaryId', advId);
        },
      }
    ),
    when(
      allyRewardPredicate,
      (t) => t.rolls?.action != null,
      (t) => allyRewardOptions(t).length > 0,
      {
        name: 'Lead by Example — inspired strike',
        placements: ['reviewAction'],
        showOnOtherSheets: true,
        description:
          'You attack a foe your ally just encouraged you about: clear a Stress **or** gain a Hope (one-time).',
        isSelect: (table) => allyRewardOptions(table),
        isDisabled: (table) =>
          allyRewardOptions(table).length === 0 ? 'No ally in range with a valid reward option.' : false,
        onUse(table, chipState) {
          const sid = chipState?.get?.('selectedId');
          const opts = allyRewardOptions(table);
          if (!opts.some((o) => o.id === sid)) return;
          if (sid === 'stress') table.me.clearStress(1);
          else if (sid === 'hope') table.me.gainHope(1);
          table.feature.set('markedAdversaryId', null);
          table.feature.set('grantorInstanceId', null);
        },
      }
    ),
  ],
  hooks: {
    onRest: when(
      (t) => t.action?.type === 'shortRest' || t.action?.type === 'longRest',
      (table) => {
        table.feature.set('markedAdversaryId', null);
        table.feature.set('grantorInstanceId', null);
      }
    ),
  },
};
