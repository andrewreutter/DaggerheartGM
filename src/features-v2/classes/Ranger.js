import { when, isActing, youSucceedOnAnAttack, youFailOnAnAttack } from '../engine/when.js';

/**
 * Ranger class features — SRD: daggerheart-srd/classes/Ranger.md
 */

function primaryWeaponDamageExpr(table) {
  const w = table.me?.primaryWeapon;
  if (w?.damage != null) return String(w.damage);
  const firstDie = table.rolls?.damage?.dice?.[0]?.die;
  if (firstDie) return String(firstDie);
  return 'd6';
}

/** Clear other adversaries' `focusedBy` for this Ranger, then tag the hit adversary (v1 table parity). */
function syncFocusedByOnHit(table) {
  const attackerName = table.me?.name;
  const target = table.action?.target;
  if (!attackerName || !target?.isAdversary) return;
  const tid = target.instanceId;
  for (const adv of table.adversaries) {
    if (adv.instanceId !== tid && adv.focusedBy === attackerName) {
      adv.setFocusedBy(null);
    }
  }
  target.setFocusedBy(attackerName);
}

function clearRangerFocusVisuals(table) {
  const n = table.me?.name;
  if (!n) return;
  for (const adv of table.adversaries) {
    if (adv.focusedBy === n) adv.setFocusedBy(null);
  }
  table.me.setFocusTarget(null);
}

/** Primary target of the current action is your Ranger focus (instance id match). */
function againstYourFocus(table) {
  const stored = table.me?.focusTargetInstanceId;
  const targetId = table.action?.target?.instanceId;
  return stored != null && targetId != null && stored === targetId;
}

export const HoldThemOff = {
  name: 'Hold Them Off',
  description:
    'Spend 3 Hope when you succeed on an attack with a weapon to use that same roll against two additional adversaries within range of the attack.',
  chips: [
    when(
      youSucceedOnAnAttack,
      (table) => Boolean(table.action?.weaponId),
      {
        description:
          'Spend 3 Hope to apply your weapon damage to two additional adversaries in range of this attack.',
        placements: ['reviewAction'],
        hopeCost: 3,
        multiSelect: true,
        maxSelections: 2,
        selectTargets: (table) => {
          const primaryId = table.action?.target?.instanceId;
          const band = table.action?.range;
          return table.adversaries.filter(
            (a) =>
              a.instanceId !== primaryId && (band == null || table.me?.rangeFrom(a) === band)
          );
        },
        onUse(table, chip) {
          const ids = chip.get('selectedTargetIds') || [];
          const diceStr = primaryWeaponDamageExpr(table);
          for (const id of ids) {
            const target = table.adversaries.find((a) => a.instanceId === id);
            if (!target) continue;
            table.action?.addDamageRoll({
              name: 'Hold Them Off',
              dice: diceStr,
              damageType: 'physical',
              targets: [target],
            });
          }
        },
      }
    ),
  ],
};

export const RangersFocus = {
  name: "Ranger's Focus",
  description:
    'Spend a Hope and make an attack against a target. On a success, deal your attack\'s normal damage and temporarily make the attack\'s target your Focus. Until this feature ends or you make a different creature your Focus, you gain the following benefits against your Focus:\n\n- You know precisely what direction they are in.\n- When you deal damage to them, they must mark a Stress.\n- When you fail an attack against them, you can end your Ranger\'s Focus feature to reroll your Duality Dice.',
  chips: [
    {
      name: "Attempt Ranger's Focus",
      placements: ['intent'],
      isToggle: true,
      hopeCost: 1,
      description:
        'When enabled, your next weapon attack spends 1 Hope and attempts Ranger\'s Focus (set Focus on a hit).',
      onUse(table, chipState) {
        table.me.setRangerFocusOnNextAttack(!!chipState.isOn);
      },
    },
    when(
      isActing,
      youFailOnAnAttack,
      againstYourFocus,
      {
        name: 'End Focus to reroll',
        placements: ['reviewAction'],
        description: "End Ranger's Focus to reroll your Duality Dice.",
        onUse(table) {
          clearRangerFocusVisuals(table);
          table.rolls?.action?.hopeDie?.reroll();
          table.rolls?.action?.fearDie?.reroll();
        },
      }
    ),
  ],
  hooks: {
    onReviewAction: when(isActing, (table) => {
      if (!table.me.rangerFocusOnNextAttack) return;
      if (table.action?.type !== 'attack') return;
      table.me.spendHope(1);
      table.me.setRangerFocusOnNextAttack(false);
      table.feature.set('rangerFocusStressTargetId', null);
      if (table.rolls?.action?.isSuccess) {
        const tid = table.action?.target?.instanceId ?? null;
        table.me.setFocusTarget(tid);
        if (tid && table.action.target?.isAdversary) {
          syncFocusedByOnHit(table);
          table.feature.set('rangerFocusStressTargetId', tid);
        }
      }
    }),
    onReviewOutcome: when(isActing, (table) => table.action?.type === 'attack', (table) => {
      const tid = table.action?.target?.instanceId;
      if (!tid) return;
      const hasHp = (table.action?.effects || []).some(
        (e) =>
          e.stat === 'currentHP' &&
          e.target?.instanceId === tid &&
          (e.amount ?? 0) > 0
      );
      if (!hasHp) return;

      const fid = table.me.focusTargetInstanceId;
      const stressTid = table.feature.get('rangerFocusStressTargetId');
      const tgt = table.action.target;
      const name = table.me.name;
      const isFocusDamage =
        tid === fid || tid === stressTid || (tgt?.focusedBy && tgt.focusedBy === name);

      if (!isFocusDamage) return;
      tgt.markStress(1);
      if (stressTid) table.feature.set('rangerFocusStressTargetId', null);
    }),
    onSceneEnd: when(
      (table) =>
        table.me?.focusTargetInstanceId != null ||
        table.adversaries.some((a) => a.focusedBy === table.me?.name),
      (table) => {
        clearRangerFocusVisuals(table);
      }
    ),
  },
};
