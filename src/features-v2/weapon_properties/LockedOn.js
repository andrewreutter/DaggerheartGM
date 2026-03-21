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
        table.feature.set('lockedOnTarget', table.action?.target?.instanceId);
      }
    ),
    onIntent: when(
      isActing,
      (table) => table.action?.type === 'attack',
      (table) => {
        const lockedTarget = table.feature.get('lockedOnTarget');
        if (lockedTarget && table.action?.target?.instanceId === lockedTarget) {
          table.rolls?.action?.setOutcome('hope');
          table.action?.addNarration('This attack automatically succeeds (Locked On).');
          table.feature.set('lockedOnTarget', null);
        }
      }
    ),
  },
};
