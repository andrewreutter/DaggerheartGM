/**
 * Midnight domain — Twilight Toll (Tier 2 domain ability / SRD level 9)
 * SRD: daggerheart-srd/.build/03_json/abilities.json
 */

import { when, isActing } from '../../engine/when.js';

/** “Within Far range” for map purposes — not Very Far (≤ 100'). */
function isWithinFarRange(table, actor) {
  const b = table.me.rangeFrom(actor);
  return b === 'melee' || b === 'veryClose' || b === 'close' || b === 'far';
}

function twilightTollFarTargets(table) {
  return table.actors.filter(
    (a) => a.instanceId !== table.me.instanceId && isWithinFarRange(table, a)
  );
}

function markedTargetId(table) {
  return table.feature.get('twilightTollTargetId') ?? null;
}

function actionIncludesMarkedTarget(table, markId) {
  if (!markId) return false;
  const ids = table.action?.targetInstanceIds ?? [];
  if (ids.includes(markId)) return true;
  return table.action?.target?.instanceId === markId;
}

/** True when the roll has no damage component (non-attack / no damage dice). */
function hasNoDamageRoll(table) {
  const d = table.rolls?.damage;
  if (d == null) return true;
  const dice = d.dice ?? [];
  const statics = d.statics ?? [];
  return dice.length === 0 && statics.length === 0;
}

function canGainToken(table) {
  const mark = markedTargetId(table);
  if (!mark) return false;
  if (!actionIncludesMarkedTarget(table, mark)) return false;
  if (table.rolls?.action?.isSuccess !== true) return false;
  return hasNoDamageRoll(table);
}

function canSpendTokensOnDamage(table) {
  const mark = markedTargetId(table);
  if (!mark) return false;
  const n = table.feature.get('twilightTollTokens') ?? 0;
  if (n < 1) return false;
  if (table.action?.target?.instanceId !== mark) return false;
  return table.rolls?.damage != null;
}

export const TwilightToll = {
  name: 'Twilight Toll',
  description:
    'Choose a target within Far range. When you succeed on an action roll against them that doesn\'t result in making a damage roll, place a token on this card. When you deal damage to this target, spend any number of tokens to add a **d12** for each token spent to your damage roll. You can only hold Twilight Toll on one creature at a time.\n\nWhen you choose a new target or take a rest, clear all unspent tokens.',
  hooks: {
    onRest(table) {
      table.feature.set('twilightTollTokens', 0);
    },
    onReviewAction: when(isActing, canGainToken, (table) => {
      const cur = table.feature.get('twilightTollTokens') ?? 0;
      table.feature.set('twilightTollTokens', cur + 1);
    }),
  },
  chips: [
    {
      placements: ['card'],
      name: 'Twilight Toll — mark target',
      description:
        'Choose a creature within Far range. Only one mark at a time; changing targets clears your tokens.',
      selectTargets: (table) => twilightTollFarTargets(table),
      multiSelect: false,
      isDisabled: (table) =>
        twilightTollFarTargets(table).length === 0
          ? 'No creature within Far range (Melee–Far) to mark.'
          : false,
      onUse(table, chipState) {
        const targetId = (chipState.get?.('selectedTargetIds') || [])[0];
        if (!targetId) return;
        const target = table.actors.find((a) => a.instanceId === targetId);
        if (!target || !isWithinFarRange(table, target)) return;

        const prev = table.feature.get('twilightTollTargetId');
        table.feature.set('twilightTollTargetId', targetId);
        if (prev != null && prev !== targetId) {
          table.feature.set('twilightTollTokens', 0);
        }

        table.me.actionLoop(
          'Twilight Toll',
          `Twilight Toll is marked on ${target.name}. Succeed on a non-damage action roll against them to gain a token; on damage, spend tokens in Review for +d12 each.`
        );
      },
    },
    when(isActing, canSpendTokensOnDamage, {
      placements: ['reviewAction'],
      name: 'Twilight Toll',
      description: 'Spend any number of tokens to add one d12 to this damage roll per token.',
      isDisabled: (table) =>
        (table.feature.get('twilightTollTokens') ?? 0) < 1
          ? 'No Twilight Toll tokens (gain tokens on successful non-damage actions vs your marked target).'
          : false,
      isSelect: (table) => {
        const max = Math.min(table.feature.get('twilightTollTokens') ?? 0, 20);
        if (max < 1) return [];
        return Array.from({ length: max }, (_, i) => {
          const n = i + 1;
          return {
            id: String(n),
            name: `Spend ${n} token${n === 1 ? '' : 's'} (+${n}d12)`,
          };
        });
      },
      onUse(table, chip) {
        const raw = chip.get?.('selectedId');
        const want = Math.max(0, Math.floor(Number(raw)) || 0);
        const have = table.feature.get('twilightTollTokens') ?? 0;
        const spend = Math.min(want, have);
        if (spend < 1 || !table.rolls?.damage) return;
        for (let i = 0; i < spend; i += 1) {
          table.rolls.damage.addDie({ name: `Twilight Toll (${i + 1})`, die: 'd12' });
        }
        table.feature.set('twilightTollTokens', have - spend);
      },
    }),
  ],
};
