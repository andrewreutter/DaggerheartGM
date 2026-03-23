/**
 * Blade domain — Gore and Glory (Tier 3 / level 9)
 * SRD: daggerheart-srd/abilities/Gore and Glory.md
 */

import { when, isActing } from '../../engine/when.js';

function totalHpLossToTarget(table, tid) {
  let sum = 0;
  for (const pool of [table.action?.effects ?? [], table.action?.appliedEffects ?? []]) {
    for (const e of pool) {
      if (e.target?.instanceId !== tid) continue;
      if (e.stat === 'currentHP') sum += e.amount ?? 0;
      if (e.type === 'damage') sum += e.amount ?? 0;
    }
  }
  return sum;
}

/** Weapon attack: Blade domain physical strike with a weapon card (not Spellcast). */
function isWeaponAttack(table) {
  return (
    table.action?.type === 'attack' &&
    table.action?.weaponId != null &&
    table.rolls?.damage != null
  );
}

function isCriticalWeaponAttack(table) {
  return isWeaponAttack(table) && table.rolls?.action?.isCritical === true;
}

function wouldDefeatEnemyFromWeaponAttack(table) {
  if (!isWeaponAttack(table)) return false;
  if (table.rolls?.action?.isSuccess !== true) return false;
  const tid = table.action?.target?.instanceId;
  if (!tid) return false;
  const tgt = table.actors.find((a) => a.instanceId === tid);
  if (!tgt || tgt.isAdversary !== true) return false;
  const cur = tgt.currentHP ?? 0;
  if (cur < 1) return false;
  return totalHpLossToTarget(table, tid) >= cur;
}

function hopeOrStressOptions() {
  return [
    { id: 'gainHope', name: 'Gain 1 Hope', description: 'Gain 1 Hope.' },
    { id: 'clearStress', name: 'Clear 1 Stress', description: 'Clear 1 marked Stress.' },
  ];
}

function applyHopeOrStressChoice(table, chip) {
  const id = chip.get?.('selectedId');
  if (id === 'gainHope') table.me.gainHope(1);
  else if (id === 'clearStress') table.me.clearStress(1);
}

export const GoreAndGlory = {
  name: 'Gore and Glory',
  description:
    'When you critically succeed on a weapon attack, gain an additional Hope or clear an additional Stress.\n\nAdditionally, when you deal enough damage to defeat an enemy, gain a Hope or clear a Stress.',
  chips: [
    when(isActing, isCriticalWeaponAttack, {
      name: 'Gore and Glory — Critical',
      placements: ['reviewAction'],
      description:
        'You critically succeed on a weapon attack: gain 1 Hope or clear 1 Stress.',
      isSelect: hopeOrStressOptions,
      onUse(table, chip) {
        applyHopeOrStressChoice(table, chip);
      },
    }),
    when(isActing, wouldDefeatEnemyFromWeaponAttack, {
      name: 'Gore and Glory — Defeat',
      placements: ['reviewOutcome'],
      description:
        'You deal enough damage with this weapon attack to defeat this adversary: gain 1 Hope or clear 1 Stress.',
      isSelect: hopeOrStressOptions,
      onUse(table, chip) {
        applyHopeOrStressChoice(table, chip);
      },
    }),
  ],
};
