/**
 * Blade domain — Deadly Focus (Tier 2 / level 4)
 * SRD: daggerheart-srd/abilities/Deadly Focus.md
 */

import { when, isActing } from '../../engine/when.js';

function clearDeadlyFocusState(table) {
  table.feature.set('deadlyFocusTargetId', null);
}

function focusedTargetId(table) {
  return table.feature.get('deadlyFocusTargetId');
}

/** True when this mutation batch includes a markHP that defeats the focused adversary. */
function batchKilledFocusedTarget(table) {
  const fid = focusedTargetId(table);
  if (!fid) return false;
  const hit = table.mutationBatch.some(
    (m) => m.type === 'markHP' && m.payload?.instanceId === fid
  );
  if (!hit) return false;
  const t = table.actors.find((a) => a.instanceId === fid);
  return t?.isAdversary === true && (t.currentHP ?? 0) <= 0;
}

function hasDeadlyFocus(table) {
  const id = focusedTargetId(table);
  return id != null && id !== '';
}

function isRestAction(table) {
  const t = table.action?.type;
  return t === 'shortRest' || t === 'longRest';
}

/**
 * +1 Proficiency on attack and damage rolls against the focused target until the
 * focus ends (attack another creature, target defeated, scene ends, or rest).
 */
function applyDeadlyFocusIntent(table) {
  const fid = focusedTargetId(table);
  if (!fid) return;

  if (table.action?.type === 'attack') {
    const tid = table.action?.target?.instanceId;
    if (tid && tid !== fid) {
      clearDeadlyFocusState(table);
      return;
    }
  }

  const focusActor = table.actors.find((a) => a.instanceId === fid);
  if (!focusActor || (focusActor.isAdversary === true && (focusActor.currentHP ?? 0) <= 0)) {
    clearDeadlyFocusState(table);
    return;
  }

  if (
    table.action?.type === 'attack' &&
    table.action?.target?.instanceId === fid &&
    table.rolls?.action &&
    table.rolls?.damage
  ) {
    table.rolls.action.addStatic({ name: 'Deadly Focus', value: 1 });
    table.rolls.damage.addStatic({ name: 'Deadly Focus', value: 1 });
  }
}

export const DeadlyFocus = {
  name: 'Deadly Focus',
  description:
    '**Recall Cost 2.** Once per rest, you can apply all your focus toward a target of your choice. Until you attack another creature, you defeat the target, or the battle ends, gain a +1 bonus to your Proficiency.',
  hooks: {
    onIntent: when(isActing, applyDeadlyFocusIntent),
    onStateChange: when(batchKilledFocusedTarget, clearDeadlyFocusState),
    onRest: when(isRestAction, clearDeadlyFocusState),
    onSceneEnd: when(hasDeadlyFocus, clearDeadlyFocusState),
  },
  chips: [
    {
      placements: ['card'],
      name: 'Deadly Focus',
      hopeCost: 2,
      frequency: 'rest',
      description:
        'Spend 2 Hope (Recall Cost 2). Choose an adversary on the map to focus on. Until you attack a different creature, they are defeated, the scene ends, or you take a rest, gain +1 to your Proficiency on attacks against them (+1 to attack and damage rolls).',
      selectTargets: (table) => table.adversaries ?? [],
      isDisabled: (table) =>
        (table.adversaries?.length ?? 0) === 0 ? 'No adversaries on the table.' : false,
      onUse(table, chip) {
        const id = (chip.get?.('selectedTargetIds') || [])[0];
        if (!id) return;
        const adv = table.adversaries.find((a) => a.instanceId === id);
        if (!adv) return;
        const advName = adv.name ?? 'the target';
        table.feature.set('deadlyFocusTargetId', id);
        table.me.actionLoop(
          'Deadly Focus',
          `You focus on ${advName}. Until you attack another creature, ${advName} is defeated, the battle ends, or you take a rest, you gain +1 to your Proficiency on attacks against them (+1 to attack and damage).`
        );
      },
    },
  ],
};
