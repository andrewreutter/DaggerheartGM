/**
 * Bone domain — Breaking Blow (Tier 3 / level 8)
 * SRD: daggerheart-srd/abilities/Breaking Blow.md
 *
 * When you make a successful attack, you can mark a Stress to make your next successful attack
 * against that same target deal an extra 2d12 damage.
 */

import { when, isActing } from '../../engine/when.js';

function attackSucceeded(table) {
  return table.rolls?.action?.isSuccess === true;
}

function primaryTargetId(table) {
  return table.action?.target?.instanceId != null
    ? String(table.action.target.instanceId)
    : null;
}

export const BreakingBlow = {
  name: 'Breaking Blow',
  description:
    'When you make a successful attack, you can **mark a Stress** to make the next successful attack against that same target deal an extra **2d12** damage.',
  chips: [
    when(
      isActing,
      (t) => t.action?.type === 'attack',
      attackSucceeded,
      (t) => t.action?.target != null,
      {
        name: 'Breaking Blow',
        placements: ['reviewAction'],
        stressCost: 1,
        description:
          'Mark 1 Stress: the next time you make a successful attack against this target, it deals an extra **2d12** damage.',
        onUse(table) {
          const tid = primaryTargetId(table);
          if (tid == null) return;
          table.feature.set('breakingBlowPendingTargetId', tid);
        },
      }
    ),
  ],
  hooks: {
    onResolve: when(
      isActing,
      (t) => t.action?.type === 'attack',
      (t) => t.feature.get('breakingBlowPendingTargetId') != null,
      (table) => {
        const pending = table.feature.get('breakingBlowPendingTargetId');
        table.feature.set('breakingBlowPrimedTargetId', String(pending));
        table.feature.set('breakingBlowPendingTargetId', null);
      }
    ),
    onReviewAction: when(
      isActing,
      (t) => t.action?.type === 'attack',
      attackSucceeded,
      (t) => t.rolls?.damage != null,
      (t) => {
        const primed = t.feature.get('breakingBlowPrimedTargetId');
        const tid = primaryTargetId(t);
        return primed != null && tid != null && String(primed) === tid;
      },
      (t) =>
        !(t.rolls?.damage?.dice ?? []).some((d) => d?.name === 'Breaking Blow'),
      (table) => {
        table.rolls.damage.addDie({ name: 'Breaking Blow', die: '2d12' });
        table.feature.set('breakingBlowPrimedTargetId', null);
      }
    ),
  },
};
