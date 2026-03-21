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
        if (!lockedTargetId) return;
        if (table.action?.target?.instanceId !== lockedTargetId) return;

        table.rolls?.action?.addStatic({ name: 'Locked On', value: 100 });
        table.action?.addNarration('This attack automatically succeeds (Locked On).');
        table.feature.set('lockedTargetId', null);
      }
    ),
  },
};
