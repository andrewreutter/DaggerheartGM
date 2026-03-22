import { when, isActing } from '../engine/when.js';

/**
 * SRD: paired off-hand weapon grants +X to primary weapon damage vs targets in Melee.
 * X = paired weapon tier + 1 (e.g. +2 at T1 … +5 at T4).
 * The V2 module is evaluated in the context of the secondary weapon (`activeFeature._weaponId`);
 * the attack must use the primary weapon (`table.action.weaponId === primaryWeapon.id`).
 */
export const Paired = {
  name: 'Paired',
  description:
    '+X to primary weapon damage to targets within Melee range (X = paired weapon tier + 1).',
  hooks: {
    onIntent: when(
      isActing,
      (table) => {
        const a = table.action;
        if (!a || a.type !== 'attack' || a.range !== 'melee') return false;
        if (!a.weaponId || !table.me?.primaryWeapon?.id) return false;
        if (a.weaponId !== table.me.primaryWeapon.id) return false;
        const af = table.activeFeature;
        const sec = table.me?.secondaryWeapon;
        if (!af?._weaponId || !sec?.id) return false;
        if (af._weaponId !== sec.id) return false;
        return true;
      },
      (table) => {
        const tierRaw = table.source?.tier ?? table.me?.secondaryWeapon?.tier ?? 1;
        const tier =
          typeof tierRaw === 'number'
            ? tierRaw
            : parseInt(String(tierRaw), 10) || 1;
        const bonus = tier + 1;
        table.rolls?.damage?.addStatic({ name: 'Paired', value: bonus });
      }
    ),
  },
};
