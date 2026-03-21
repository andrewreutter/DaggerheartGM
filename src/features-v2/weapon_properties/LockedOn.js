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
        }
      }
    ),
    onIntent: when(
      isActing,
      (table) => table.action?.type === 'attack',
      (table) => {
        const lockedTargetId = table.feature.get('lockedTargetId');
        return lockedTargetId && table.action?.target?.instanceId === lockedTargetId;
      },
      (table) => {
        table.rolls?.action?.setOutcome('hope');
        table.action?.addNarration('Locked On: This attack automatically succeeds.');
        table.feature.set('lockedTargetId', null);
      }
    ),
  },
};
