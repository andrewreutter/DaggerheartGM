/**
 * Valor domain — Hold the Line (Tier 3 / SRD level 9)
 * SRD: daggerheart-srd/abilities/Hold the Line.md — spend a Hope; stance until you move, fail with Fear, or GM spends 2 Fear.
 */

import { when, isActing } from '../../engine/when.js';

const ACTIVE_KEY = 'holdTheLineActive';
const RESTRAINED_IDS_KEY = 'holdTheLineRestrainedIds';

function withinVeryCloseBand(band) {
  return band === 'melee' || band === 'veryClose';
}

function clearHoldTheLine(table) {
  const ids = table.feature.get(RESTRAINED_IDS_KEY);
  table.feature.set(ACTIVE_KEY, false);
  table.feature.set(RESTRAINED_IDS_KEY, []);
  if (!Array.isArray(ids)) return;
  for (const id of ids) {
    const adv = table.adversaries.find((a) => a.instanceId === id);
    if (adv?.hasCondition('Restrained')) adv.removeCondition('Restrained');
  }
}

function failedRollWithFear(table) {
  const h = table.rolls?.action?.hopeDie?.value;
  const f = table.rolls?.action?.fearDie?.value;
  if (h == null || f == null) return false;
  return f > h;
}

function handleTokenMove(table) {
  const mover = table.tokenMove?.mover;
  const me = table.me;
  if (!mover || !me?.isCharacter) return;

  if (mover.instanceId === me.instanceId && table.feature.get(ACTIVE_KEY) === true) {
    clearHoldTheLine(table);
    return;
  }

  if (table.feature.get(ACTIVE_KEY) !== true) return;
  if (!mover.isAdversary) return;

  const was = mover.lastPosition?.rangeFrom(me);
  const now = mover.rangeFrom(me);
  if (now == null || !withinVeryCloseBand(now)) return;
  if (was != null && withinVeryCloseBand(was)) return;

  mover.move(
    (t) => t.tokenMove?.mover?.rangeFrom(t.me) === 'melee',
    'In Melee range with you after the pull',
    'Hold the Line — pulled into Melee.'
  );
  mover.addCondition('Restrained');
  const ids = table.feature.get(RESTRAINED_IDS_KEY) ?? [];
  if (!ids.includes(mover.instanceId)) {
    table.feature.set(RESTRAINED_IDS_KEY, [...ids, mover.instanceId]);
  }
}

export const HoldTheLine = {
  name: 'Hold the Line',
  description:
    'Describe the defensive stance you take and **spend a Hope**. If an adversary moves within Very Close range, they\'re pulled into Melee range and _Restrained_.\n\nThis condition lasts until you move or fail a roll with Fear, or the GM spends 2 Fear on their turn to clear it.',
  chips: [
    {
      placements: ['card'],
      name: 'Hold the Line',
      hopeCost: 1,
      description:
        'Spend 1 Hope. Describe your defensive stance. While it lasts, adversaries that move into Very Close range are pulled to Melee and become Restrained (map automation when a token enters that band). Ends when you move, when you fail a roll with Fear (Fear higher than Hope), or when the GM spends 2 Fear (GM chip).',
      onUse(table) {
        table.feature.set(ACTIVE_KEY, true);
        table.feature.set(RESTRAINED_IDS_KEY, []);
        table.me.actionLoop(
          'Hold the Line',
          'Describe your defensive stance. While it lasts, adversaries that move into Very Close range are pulled to Melee and become Restrained (map automation when a token enters that band). The stance and Restrained end when you move, when you fail a roll with Fear (Fear die higher than Hope), or when the GM spends 2 Fear (use the GM chip).',
          {}
        );
      },
    },
    {
      placements: ['card'],
      name: 'GM: Clear Hold the Line (2 Fear)',
      description:
        'GM spends 2 Fear from the Fear pool on the GM\'s turn to end your stance and clear Restrained from affected adversaries.',
      isDisabled: (table) => {
        if (table.feature.get(ACTIVE_KEY) !== true) return 'Hold the Line is not active.';
        if ((table.top.fear ?? 0) < 2) return 'GM needs at least 2 Fear in the pool.';
        return false;
      },
      onUse(table) {
        if ((table.top.fear ?? 0) < 2) return;
        table.top.spendFear(2);
        clearHoldTheLine(table);
      },
    },
  ],
  hooks: {
    onTokenMove: handleTokenMove,
    onReviewOutcome: when(
      isActing,
      (t) => t.feature.get(ACTIVE_KEY) === true,
      (t) => failedRollWithFear(t),
      (table) => {
        clearHoldTheLine(table);
      }
    ),
  },
};
