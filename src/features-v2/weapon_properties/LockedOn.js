import { when, isActing, youSucceedOnAnAttack } from '../engine/when.js';

export const LockedOn = {
  name: 'Locked On',
  description:
    'On a successful attack, your next attack against the same target with your primary weapon automatically succeeds.',
  hooks: {
    onResolve: when(youSucceedOnAnAttack, (table) => {
      const tid = table.action?.target?.instanceId;
      if (!tid) return;
      table.feature.set('lockedOnTargetId', tid);
      table.feature.set('lockedOnArmed', true);
    }),
    onIntent: when(
      isActing,
      (table) => table.action?.type === 'attack',
      (table) =>
        table.feature.get('lockedOnArmed') === true &&
        table.action?.target?.instanceId === table.feature.get('lockedOnTargetId') &&
        table.action?.weaponId &&
        table.me?.primaryWeapon?.id &&
        table.action.weaponId === table.me.primaryWeapon.id,
      (table) => {
        table.rolls?.action?.addStatic({ name: 'Locked On', value: 100 });
        table.feature.set('lockedOnConsuming', true);
      }
    ),
    onReviewAction: when(
      isActing,
      (table) => table.feature.get('lockedOnConsuming') === true,
      (table) => {
        table.feature.set('lockedOnArmed', false);
        table.feature.set('lockedOnTargetId', null);
        table.feature.set('lockedOnConsuming', false);
      }
    ),
  },
};
