import { when, isActing } from '../engine/when.js';

const usingThisWeapon = (table) =>
  table.activeFeature?._weaponId != null &&
  table.action?.weaponId === table.activeFeature._weaponId;

export const Otherworldly = {
  name: 'Otherworldly',
  description: 'On a successful attack, you can deal physical or magic damage.',
  chips: [
    when(
      isActing,
      usingThisWeapon,
      (table) =>
        table.action?.type === 'attack' &&
        table.rolls?.action?.isSuccess === true,
      {
        name: 'Magic damage',
        description: 'Deal this attack’s damage as magic instead of physical.',
        placements: ['reviewAction'],
        onUse(table) {
          const tgtId = table.action?.target?.instanceId;
          const eff = table.action?.effects?.find(
            (e) =>
              e.type === 'damage' &&
              e.target?.instanceId === tgtId &&
              e.amount > 0
          );
          if (eff) eff.damageType = 'magic';
        },
      }
    ),
  ],
};
