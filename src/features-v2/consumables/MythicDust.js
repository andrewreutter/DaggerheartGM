/**
 * SRD consumable — Mythic Dust (common roll table 35).
 * daggerheart-srd/consumables/Mythic Dust.md
 */

import { when, isActing, unwrap } from '../engine/when.js';

const PENDING_APPLY = 'mythicDustPendingApply';
const DUST_WEAPON_ID = 'mythicDustWeaponId';

function weaponDamageFor(table, weaponId) {
  const w = table.me.weapons.find((x) => x.id === weaponId);
  return w?.damage ?? '';
}

function isMagicWeaponDamage(damageStr) {
  const s = String(damageStr || '').toLowerCase();
  return /\bmag\b/.test(s);
}

export const MythicDust = {
  name: 'Mythic Dust',
  description:
    'You can apply this dust to a weapon that deals magic damage to add a d12 to your next damage roll with that weapon.',
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
          (t) => isMagicWeaponDamage(weaponDamageFor(t, t.action.weaponId)),
          (t) => {
            t.feature.set(DUST_WEAPON_ID, t.action.weaponId);
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
          (t) => t.action.weaponId === t.feature.get(DUST_WEAPON_ID),
          (t) => {
            t.rolls.damage.addDie({ name: 'Mythic Dust', die: 'd12' });
            t.feature.set(DUST_WEAPON_ID, null);
          }
        ),
        table
      );
      if (typeof runDamage === 'function') runDamage(table);
    },
  },
};
