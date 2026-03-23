/**
 * SRD consumable — Grindletooth Venom (common roll table 09).
 */

import { when, isActing, unwrap } from '../engine/when.js';

const PENDING_APPLY = 'grindletoothVenomPendingApply';
const VENOM_WEAPON_ID = 'grindletoothVenomWeaponId';

function weaponDamageFor(table, weaponId) {
  const w = table.me.weapons.find((x) => x.id === weaponId);
  return w?.damage ?? '';
}

function isPhysicalWeaponDamage(damageStr) {
  const s = String(damageStr || '').toLowerCase();
  return !/\bmag\b/.test(s);
}

export const GrindletoothVenom = {
  name: 'Grindletooth Venom',
  description:
    'You can apply this venom to a weapon that deals physical damage to add a d6 to your next damage roll with that weapon.',
  onUse(table) {
    table.feature.set(PENDING_APPLY, true);
  },
  hooks: {
    onIntent(table) {
      const runBind = unwrap(
        when(
          isActing,
          (t) => t.action?.type === 'attack',
          (t) => Boolean(t.action?.weaponId),
          (t) => t.feature.get(PENDING_APPLY) === true,
          (t) => isPhysicalWeaponDamage(weaponDamageFor(t, t.action.weaponId)),
          (t) => {
            t.feature.set(VENOM_WEAPON_ID, t.action.weaponId);
            t.feature.set(PENDING_APPLY, false);
          }
        ),
        table
      );
      if (typeof runBind === 'function') runBind(table);

      const runDamage = unwrap(
        when(
          isActing,
          (t) => t.rolls?.damage != null,
          (t) => t.action?.type === 'attack',
          (t) => Boolean(t.action?.weaponId),
          (t) => t.action.weaponId === t.feature.get(VENOM_WEAPON_ID),
          (t) => {
            t.rolls.damage.addDie({ name: 'Grindletooth Venom', die: 'd6' });
            t.feature.set(VENOM_WEAPON_ID, null);
          }
        ),
        table
      );
      if (typeof runDamage === 'function') runDamage(table);
    },
  },
};
