/**
 * SRD consumable — Redthorn Saliva (common roll table 33).
 */

import { when, isActing, unwrap } from '../engine/when.js';

const PENDING_APPLY = 'redthornSalivaPendingApply';
const SALIVA_WEAPON_ID = 'redthornSalivaWeaponId';

function weaponDamageFor(table, weaponId) {
  const w = table.me.weapons.find((x) => x.id === weaponId);
  return w?.damage ?? '';
}

function isPhysicalWeaponDamage(damageStr) {
  const s = String(damageStr || '').toLowerCase();
  return !/\bmag\b/.test(s);
}

export const RedthornSaliva = {
  name: 'Redthorn Saliva',
  description:
    'You can apply this saliva to a weapon that deals physical damage to add a d12 to your next damage roll with that weapon.',
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
            t.feature.set(SALIVA_WEAPON_ID, t.action.weaponId);
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
          (t) => t.action.weaponId === t.feature.get(SALIVA_WEAPON_ID),
          (t) => {
            t.rolls.damage.addDie({ name: 'Redthorn Saliva', die: 'd12' });
            t.feature.set(SALIVA_WEAPON_ID, null);
          }
        ),
        table
      );
      if (typeof runDamage === 'function') runDamage(table);
    },
  },
};
