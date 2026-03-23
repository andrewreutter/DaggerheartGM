/**
 * Bone domain — Know Thy Enemy (Tier 1 / SRD level 5 spell card)
 * SRD: daggerheart-srd/abilities/Know Thy Enemy.md
 */

import { when, isActing } from '../../engine/when.js';

function instinctTraitRoll(table) {
  const tk = table.action?.trait;
  if (!tk) return false;
  return String(tk).toLowerCase() === 'instinct';
}

export const KnowThyEnemy = {
  name: 'Know Thy Enemy',
  description:
    'When observing a creature, you can make an **Instinct Roll** against them. On a success, **spend a Hope** and ask the GM for one set of information about the target from the following options:\n\n- Their unmarked Hit Points and Stress.\n- Their Difficulty and damage thresholds.\n- Their tactics and standard attack damage dice.\n- Their features and Experiences.\n\nAdditionally on a success, you can **mark a Stress** to remove a Fear from the GM\'s Fear Pool.',
  hooks: {
    onReviewAction: when(
      isActing,
      (table) => table.action?.type === 'trait',
      instinctTraitRoll,
      (table) => table.feature.get('kteAwaiting') === true,
      (table) => typeof table.rolls?.action?.isSuccess === 'boolean',
      (table) => {
        table.feature.set('kteAwaiting', false);
        if (table.rolls?.action?.isSuccess !== true) {
          table.feature.set('kteTargetId', null);
          return;
        }
        table.feature.set('ktePostSuccess', true);
        table.feature.set('kteHopeUsed', false);
        table.feature.set('kteStressUsed', false);
      }
    ),
  },
  chips: [
    {
      placements: ['card'],
      name: 'Know Thy Enemy',
      description:
        'Choose a creature you are observing. Make an Instinct roll against them; adversaries use their Difficulty as the DC (characters: GM sets the DC, often Evasion). After the roll, use the Review chips on success.',
      selectTargets: (table) => table.actors.filter((a) => a.instanceId !== table.me.instanceId),
      multiSelect: false,
      isDisabled: (table) =>
        table.actors.filter((a) => a.instanceId !== table.me.instanceId).length === 0
          ? 'No other creature to observe.'
          : false,
      onUse(table, chipState) {
        const targetId = (chipState.get?.('selectedTargetIds') || [])[0];
        if (!targetId) return;
        const target = table.actors.find((a) => a.instanceId === targetId);
        if (!target || target.instanceId === table.me.instanceId) return;

        table.feature.set('kteAwaiting', true);
        table.feature.set('kteTargetId', targetId);
        table.feature.set('ktePostSuccess', false);
        table.feature.set('kteHopeUsed', false);
        table.feature.set('kteStressUsed', false);

        const opts = { trait: 'Instinct' };
        if (target.isAdversary && target.effectiveDifficulty != null && Number.isFinite(target.effectiveDifficulty)) {
          opts.difficulty = target.effectiveDifficulty;
        }

        const dcHint =
          target.isAdversary && opts.difficulty != null
            ? ` (vs Difficulty ${opts.difficulty})`
            : target.isCharacter
              ? ` (vs an appropriate DC — often Evasion ${target.evasion ?? '—'}, GM)`
              : '';

        table.me.actionLoop(
          'Know Thy Enemy',
          `Observe ${target.name} and make an Instinct roll against them${dcHint}. On a success, you may spend 1 Hope (Review) to ask the GM for one set of intel (HP/Stress, thresholds, attacks, or features & Experiences). On a success, you may instead or also mark 1 Stress (Review) to remove 1 Fear from the GM's Fear Pool.`,
          opts
        );
      },
    },
    when(
      isActing,
      (table) => table.feature.get('ktePostSuccess') === true,
      (table) => table.feature.get('kteHopeUsed') !== true,
      {
        placements: ['reviewAction'],
        name: 'Know Thy Enemy — ask the GM',
        hopeCost: 1,
        description:
          'Spend 1 Hope: ask the GM for one set of information about the creature you observed (unmarked HP & Stress; Difficulty & thresholds; tactics & attack dice; or features & Experiences).',
        onUse(table) {
          const tid = table.feature.get('kteTargetId');
          const target = tid ? table.actors.find((a) => a.instanceId === tid) : null;
          const label = target?.name ?? 'the creature';
          table.feature.set('kteHopeUsed', true);
          table.me.actionLoop(
            'Know Thy Enemy — insight',
            `You study ${label}. Ask the GM for **one** set of information: unmarked Hit Points and Stress; Difficulty and damage thresholds; tactics and standard attack damage dice; or features and Experiences.`
          );
        },
      }
    ),
    when(
      isActing,
      (table) => table.feature.get('ktePostSuccess') === true,
      (table) => table.feature.get('kteStressUsed') !== true,
      {
        placements: ['reviewAction'],
        name: 'Know Thy Enemy — remove Fear',
        stressCost: 1,
        description:
          "Mark 1 Stress to remove 1 Fear from the GM's Fear Pool (only when the pool has at least 1 Fear).",
        isDisabled: (table) =>
          (table.top.fear ?? 0) < 1 ? 'GM Fear pool is empty (need at least 1 Fear to remove).' : false,
        onUse(table) {
          table.feature.set('kteStressUsed', true);
          table.top.spendFear(1);
        },
      }
    ),
  ],
};
