/**
 * Guardian class features — SRD: daggerheart-srd/classes/Guardian.md
 */

import { when, isActing, isTargeted, hasPhysicalDamage, unwrap } from '../engine/when.js';

function unstoppableActive(table) {
  return table.feature.get('unstoppableActive') === true;
}

function clearUnstoppable(table) {
  table.feature.set('unstoppableActive', false);
  table.feature.set('unstoppableDieValue', undefined);
  table.feature.set('unstoppableDieMax', undefined);
}

/** True when this attack deals ≥1 HP to the primary target (raw `damage` or post-threshold `currentHP` effects). */
function dealtHpToAttackTarget(table) {
  if (table.rolls?.action?.isSuccess !== true) return false;
  const tid = table.action?.target?.instanceId;
  if (!tid) return false;
  const pools = [table.action?.effects ?? [], table.action?.appliedEffects ?? []];
  for (const effects of pools) {
    const hit = effects.some((e) => {
      if (e.target?.instanceId !== tid) return false;
      const amt = typeof e.amount === 'number' ? e.amount : 0;
      if (amt < 1) return false;
      return e.type === 'damage' || e.stat === 'currentHP';
    });
    if (hit) return true;
  }
  return false;
}

function batchAddsRestrainedOrVulnerableToMe(table) {
  return (table.mutationBatch || []).some(
    (m) =>
      m.type === 'addCondition' &&
      m.payload?.instanceId === table.me?.instanceId &&
      (m.payload?.condition === 'Restrained' || m.payload?.condition === 'Vulnerable')
  );
}

export const FrontlineTank = {
  name: 'Frontline Tank',
  description: 'Spend 3 Hope to clear 2 Armor Slots.',
  hopeCost: 3,
  onUse(table) {
    table.me.clearArmor(2);
  },
};

export const Unstoppable = {
  name: 'Unstoppable',
  description:
    'Once per long rest, you can become Unstoppable. You gain an Unstoppable Die. At level 1, your Unstoppable Die is a d4. Place it on your character sheet in the space provided, starting with the 1 value facing up. After you make a damage roll that deals 1 or more Hit Points to a target, increase the Unstoppable Die value by one. When the die\'s value would exceed its maximum value or when the scene ends, remove the die and drop out of Unstoppable. At level 5, your Unstoppable Die increases to a d6.\n\nWhile Unstoppable, you gain the following benefits:\n\n- You reduce the severity of physical damage by one threshold (Severe to Major, Major to Minor, Minor to None).\n- You add the current value of the Unstoppable Die to your damage roll.\n- You can\'t be Restrained or Vulnerable.',
  frequency: 'longRest',
  onUse(table) {
    const level = table.me?.level ?? 1;
    const dieMax = level >= 5 ? 6 : 4;
    table.feature.set('unstoppableActive', true);
    table.feature.set('unstoppableDieValue', 1);
    table.feature.set('unstoppableDieMax', dieMax);
  },
  hooks: {
    onReviewAction(table) {
      const reduceIncoming = unwrap(
        when(isTargeted, hasPhysicalDamage, unstoppableActive, (t) => {
          t.action.reduceIncomingPhysicalSeverityBySteps(1);
        }),
        table
      );
      if (typeof reduceIncoming === 'function') reduceIncoming(table);

      const boostDamage = unwrap(
        when(
          isActing,
          (t) => t.action?.type === 'attack',
          unstoppableActive,
          (t) => {
            const v = t.feature.get('unstoppableDieValue');
            if (typeof v !== 'number' || v <= 0) return;
            const tid = t.action?.target?.instanceId;
            if (!tid) return;
            for (const e of t.action?.effects ?? []) {
              if (e.type !== 'damage' || e.target?.instanceId !== tid) continue;
              if (typeof e.amount === 'number') e.amount += v;
            }
          }
        ),
        table
      );
      if (typeof boostDamage === 'function') boostDamage(table);
    },
    onResolve: when(
      isActing,
      (table) => table.action?.type === 'attack',
      dealtHpToAttackTarget,
      unstoppableActive,
      (table) => {
        const max = table.feature.get('unstoppableDieMax') ?? 4;
        let v = table.feature.get('unstoppableDieValue') ?? 1;
        v += 1;
        if (v > max) {
          clearUnstoppable(table);
        } else {
          table.feature.set('unstoppableDieValue', v);
        }
      }
    ),
    onStateChange: when(unstoppableActive, batchAddsRestrainedOrVulnerableToMe, (table) => {
      if (table.me.hasCondition('Restrained')) table.me.removeCondition('Restrained');
      if (table.me.hasCondition('Vulnerable')) table.me.removeCondition('Vulnerable');
    }),
    onSceneEnd(table) {
      clearUnstoppable(table);
    },
  },
};
