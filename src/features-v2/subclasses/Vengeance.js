/**
 * Vengeance subclass features — SRD: daggerheart-srd/subclasses/Vengeance.md
 */

import { when, isActing, isTargeted } from '../engine/when.js';

export const AtEase = {
  name: 'At Ease',
  description: 'Gain an additional Stress slot.',
  passiveStatMods: {
    maxStress: 1,
  },
};

export const Revenge = {
  name: 'Revenge',
  description:
    'When an adversary within Melee range succeeds on an attack against you, you can mark 2 Stress to force the attacker to mark a Hit Point.',
  chips: [
    when(
      isTargeted,
      (table) => table.action?.type === 'attack',
      (table) => table.rolls?.action?.isSuccess === true,
      (table) => {
        const a = table.action?.actor;
        return a && !a.isCharacter && table.me.rangeFrom(a) === 'melee';
      },
      {
        name: 'Revenge',
        placements: ['reviewAction'],
        stressCost: 2,
        onUse(table) {
          table.action.actor.markHP(1);
        },
      }
    ),
  ],
};

function isCharacterTarget(a) {
  return a && (a.isCharacter === true || a.elementType === 'character');
}

function isAdversarySource(a) {
  return a && (a.isAdversary === true || a.elementType === 'adversary');
}

function adversaryIdFromAllyDamageInMyMelee(table) {
  const me = table.me;
  if (!me?.isCharacter) return null;
  for (const e of table.action?.effects || []) {
    if (e.type !== 'damage' || (e.amount ?? 0) <= 0) continue;
    const tgt = e.target;
    if (!isCharacterTarget(tgt) || tgt.instanceId === me.instanceId) continue;
    if (me.rangeFrom(tgt) !== 'melee') continue;
    const src = e.source;
    if (isAdversarySource(src)) return src.instanceId;
  }
  return null;
}

export const ActOfReprisal = {
  name: 'Act of Reprisal',
  description:
    'When an adversary damages an ally within Melee range, you gain a +1 bonus to your Proficiency for the next successful attack you make against that adversary.',
  hooks: {
    onReviewOutcome(table) {
      const id = adversaryIdFromAllyDamageInMyMelee(table);
      if (id) table.feature.set('reprisalAdversaryId', id);
    },
    onIntent: when(
      isActing,
      (table) => table.action?.type === 'attack',
      (table) => {
        const id = table.feature.get('reprisalAdversaryId');
        return Boolean(id && table.action?.target?.instanceId === id);
      },
      (table) => {
        table.rolls?.action?.addStatic({ name: 'Act of Reprisal', value: 1 });
      }
    ),
    onResolve: when(
      isActing,
      (table) => table.action?.type === 'attack',
      (table) => table.rolls?.action?.isSuccess === true,
      (table) => {
        const id = table.feature.get('reprisalAdversaryId');
        if (id && table.action?.target?.instanceId === id) {
          table.feature.set('reprisalAdversaryId', null);
        }
      }
    ),
  },
};

function isPrioritizedAttackTarget(table) {
  const id = table.feature.get('prioritizedAdversaryId');
  const tid = table.action?.target?.instanceId;
  return Boolean(id && tid && id === tid);
}

export const Nemesis = {
  name: 'Nemesis',
  description:
    'Spend 2 Hope to Prioritize an adversary until your next rest. When you make an attack against your Prioritized adversary, you can swap the results of your Hope and Fear Dice. You can only Prioritize one adversary at a time.',
  chips: [
    {
      name: 'Prioritize',
      placements: ['card'],
      hopeCost: 2,
      multiSelect: false,
      selectTargets: (table) => table.adversaries ?? [],
      isDisabled: (table) => (table.adversaries?.length ?? 0) === 0,
      onUse(table, chipState) {
        const targetInstanceId = (chipState.get('selectedTargetIds') || [])[0];
        if (!targetInstanceId) return;
        const adv = table.adversaries.find((a) => a.instanceId === targetInstanceId);
        if (!adv) return;
        table.feature.set('prioritizedAdversaryId', targetInstanceId);
      },
    },
    when(
      isActing,
      (table) => table.action?.type === 'attack',
      isPrioritizedAttackTarget,
      (table) => table.rolls?.action?.hopeDie != null && table.rolls?.action?.fearDie != null,
      {
        name: 'Swap Hope and Fear',
        placements: ['reviewAction'],
        onUse(table) {
          table.rolls?.action?.swapHopeFear?.();
        },
      }
    ),
  ],
  hooks: {
    onRest(table) {
      const t = table.action?.type;
      if (t === 'shortRest' || t === 'longRest') {
        table.feature.set('prioritizedAdversaryId', null);
      }
    },
  },
};
