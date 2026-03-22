import { when, isTargeted, hasDamage } from '../engine/when.js';

/**
 * Extract each simple die notation (e.g. d8, d6) from a weapon damage string, expanding qty (2d6 → two d6).
 */
function expandDamageDiceNotations(damageStr) {
  const dice = [];
  const re = /(\d*)d(\d+)/gi;
  let m;
  while ((m = re.exec(String(damageStr)))) {
    const qty = parseInt(m[1] || '1', 10);
    const die = `d${m[2]}`;
    for (let i = 0; i < qty; i++) dice.push(die);
  }
  return dice;
}

export const Parry = {
  name: 'Parry',
  description:
    "When you are attacked, roll this weapon's damage dice. If any of the attacker's damage dice rolled the same value as your dice, the matching results are discarded from the attacker's damage dice before the damage you take is totaled.",
  hooks: {
    onReviewAction: when(
      isTargeted,
      hasDamage,
      (table) => table.action?.type === 'attack',
      (table) => {
        const weaponId = table.activeFeature?._weaponId;
        const weapon = table.me?.weapons?.find((w) => w.id === weaponId);
        const dmgStr = weapon?.damage;
        if (!dmgStr) return;

        const parryDice = expandDamageDiceNotations(dmgStr);
        if (parryDice.length === 0) return;

        const attackerDice = (table.rolls?.damage?.dice ?? []).filter((d) => d.value != null);
        if (attackerDice.length === 0) return;

        const usedIdx = new Set();
        let removedSum = 0;

        for (const dieNotation of parryDice) {
          const face = table.rollDie(dieNotation);
          const idx = attackerDice.findIndex((d, i) => !usedIdx.has(i) && d.value === face);
          if (idx === -1) continue;
          usedIdx.add(idx);
          removedSum += attackerDice[idx].value;
        }

        if (removedSum === 0) return;

        const tgtId = table.me?.instanceId;
        const dmgEffect = table.action?.effects?.find(
          (e) => e.type === 'damage' && e.target?.instanceId === tgtId && e.amount > 0
        );
        if (dmgEffect) {
          dmgEffect.amount = Math.max(0, dmgEffect.amount - removedSum);
        }
      }
    ),
  },
};
