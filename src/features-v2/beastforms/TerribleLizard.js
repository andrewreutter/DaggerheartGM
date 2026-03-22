/**
 * SRD: Terrible Lizard — daggerheart-srd/beastforms/Terrible Lizard.md
 */

import { when, isActing } from '../engine/when.js';

function severeHpToAdversaryInMelee(table) {
  const tgt = table.action?.target;
  if (!tgt?.isAdversary) return false;
  if (table.me.rangeFrom(tgt) !== 'melee') return false;
  for (const e of table.action?.effects ?? []) {
    if (e.stat !== 'currentHP' || e.target?.instanceId !== tgt.instanceId) continue;
    if (e.damageTier === 'severe' || e.thresholdTier === 'severe') return true;
  }
  return false;
}

export const DevastatingStrikes = {
  name: 'Devastating Strikes',
  description:
    'When you deal Severe damage to a target within Melee range, you can **mark a Stress** to force them to mark an additional Hit Point.',
  chips: [
    when(isActing, (table) => table.action?.type === 'attack', severeHpToAdversaryInMelee, {
      name: 'Devastating Strikes',
      placements: ['reviewOutcome'],
      stressCost: 1,
      description: 'Mark 1 Stress: the target marks 1 additional Hit Point.',
      onUse(table) {
        const tgt = table.action?.target;
        if (!tgt) return;
        for (const e of table.action?.effects ?? []) {
          if (e.stat === 'currentHP' && e.target?.instanceId === tgt.instanceId && typeof e.amount === 'number') {
            e.amount += 1;
            return;
          }
        }
      },
    }),
  ],
};

export const MassiveStride = {
  name: 'Massive Stride',
  description:
    'You can move up to Far range without rolling. You ignore rough terain (at the GM\'s discretion) due to your size.',
};

export const features = [DevastatingStrikes, MassiveStride];
