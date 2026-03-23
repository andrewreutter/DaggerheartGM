import { when, youSucceedOnAnAttack } from '../engine/when.js';

/** Token top-left to center offset (5×5' token). */
const TOKEN_HALF_FT = 2.5;
/** Max distance from an adversary’s center to the attacker→primary segment (feet). */
const LINE_EPS_FT = 2.5;

function tokenCenter(actor) {
  if (actor?.tokenX == null || actor?.tokenY == null) return null;
  return { x: actor.tokenX + TOKEN_HALF_FT, y: actor.tokenY + TOKEN_HALF_FT };
}

/**
 * Shortest distance from point P to segment AB (all in feet).
 */
function distPointToSegment(px, py, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const abLenSq = abx * abx + aby * aby;
  if (abLenSq === 0) return Math.hypot(apx, apy);
  let t = (apx * abx + apy * aby) / abLenSq;
  t = Math.max(0, Math.min(1, t));
  const qx = ax + t * abx;
  const qy = ay + t * aby;
  return Math.hypot(px - qx, py - qy);
}

function isOnAttackLine(advCenter, attackerCenter, primaryCenter) {
  if (!advCenter || !attackerCenter || !primaryCenter) return false;
  const d = distPointToSegment(
    advCenter.x,
    advCenter.y,
    attackerCenter.x,
    attackerCenter.y,
    primaryCenter.x,
    primaryCenter.y
  );
  return d <= LINE_EPS_FT;
}

const usingLongWeapon = (table) =>
  table.activeFeature?._weaponId != null &&
  table.action?.weaponId === table.activeFeature._weaponId;

export const Long = {
  name: 'Long',
  description:
    "This weapon's attack targets all adversaries in a line within range.",
  hooks: {
    onResolve: when(
      usingLongWeapon,
      youSucceedOnAnAttack,
      (table) => table.action?.target?.isAdversary === true,
      (table) => {
        const me = table.me;
        const primary = table.action?.target;
        if (!me || !primary) return;

        const dmg = table.action?.effects?.find(
          (e) =>
            e.type === 'damage' &&
            e.target?.instanceId === primary.instanceId &&
            e.amount > 0
        );
        const amount = dmg?.amount ?? 0;
        if (amount <= 0) return;

        const aC = tokenCenter(me);
        const pC = tokenCenter(primary);
        if (!aC || !pC) return;

        for (const adv of table.adversaries) {
          if (adv.instanceId === primary.instanceId) continue;
          const c = tokenCenter(adv);
          if (!c) continue;
          if (!isOnAttackLine(c, aC, pC)) continue;
          adv.markHP(amount);
        }
      }
    ),
  },
};
