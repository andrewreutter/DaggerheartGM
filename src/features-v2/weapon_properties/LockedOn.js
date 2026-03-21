import { when, isActing } from '../engine/when.js';

export const LockedOn = {
  name: "Locked On",
  description: "On a successful attack, your next attack against the same target with your primary weapon automatically succeeds.",
  hooks: {
    onResolve: when(
      isActing,
      (table) => table.action?.type === 'attack',
      (table) => table.rolls?.action?.isSuccess === true,
      (table) => {
        const targetId = table.action?.target?.instanceId;
        if (targetId) {
          table.feature.set('lockedTargetId', targetId);
          table.action?.addNarration('Locked on — next attack against this target automatically succeeds.');
        }
      }
    ),
    onIntent: when(
      isActing,
      (table) => table.action?.type === 'attack',
      (table) => {
        const lockedTargetId = table.feature.get('lockedTargetId');
        if (lockedTargetId && table.action?.target?.instanceId === lockedTargetId) {
          table.rolls?.action?.setOutcome('hope');
          table.feature.set('lockedTargetId', null);
          table.action?.addNarration('Locked On — this attack automatically succeeds.');
        }
      }
    ),
  },
};
