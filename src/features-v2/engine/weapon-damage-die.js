/**
 * Resolve which damage die entry in a roll corresponds to the weapon's base damage,
 * using `table.source` (registry weapon row from `loadCharacterFeatures`) when available.
 */

import { parseLeadingDamageDice } from '../../client/lib/dice-utils.js';

/**
 * Leading weapon damage die notation from a damage string (e.g. `d8+1` → `d8`).
 * Defaults to `d8` when the string does not parse.
 *
 * @param {string} [damageStr]
 * @returns {string}
 */
export function leadingDamageDieFromString(damageStr) {
  const p = parseLeadingDamageDice(String(damageStr ?? '').trim());
  return p?.die ?? 'd8';
}

/**
 * Find the damage die pool entry that represents this weapon's damage.
 * Prefers matching `table.source.damage` notation to the rolled dice; falls back
 * to the legacy heuristic (name === 'weapon', then first simple dN die).
 *
 * @param {object} table — snapshot from `buildTableSnapshot` (may include `source`)
 * @param {object[]} damageDice — `table.rolls.damage.dice`
 * @returns {object | undefined}
 */
export function findWeaponDamageDieForPool(table, damageDice) {
  const list = damageDice ?? [];
  const dmgStr = table.source?.damage;
  if (dmgStr) {
    const parsed = parseLeadingDamageDice(String(dmgStr).trim());
    if (parsed?.die) {
      const qty = parsed.qty === '' ? '1' : parsed.qty;
      const fullNotation = qty === '1' ? parsed.die : `${qty}${parsed.die}`;
      const match = list.find((d) => {
        const dDie = String(d.die);
        return dDie === fullNotation || dDie === parsed.die;
      });
      if (match && match.value != null) return match;
    }
  }
  return (
    list.find((d) => d.name === 'weapon' && /^d\d+$/.test(String(d.die))) ??
    list.find((d) => /^d\d+$/.test(String(d.die)))
  );
}
