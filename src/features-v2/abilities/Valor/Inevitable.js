/**
 * Valor domain — Inevitable (Tier 2 / level 6)
 * SRD: daggerheart-srd/abilities/Inevitable.md
 * When you fail an action roll, your next action roll has advantage.
 */

import { when, isActing } from '../../engine/when.js';

const PENDING_KEY = 'inevitableNextAdvantage';

function actionRollFailed(table) {
  return table.rolls?.action != null && table.rolls.action.isSuccess === false;
}

export const Inevitable = {
  name: 'Inevitable',
  description: 'When you fail an action roll, your next action roll has advantage.',
  hooks: {
    onResolve: when(
      isActing,
      actionRollFailed,
      (table) => {
        table.feature.set(PENDING_KEY, true);
      }
    ),
    onIntent: when(
      isActing,
      (table) => table.rolls?.action != null && table.feature.get(PENDING_KEY) === true,
      (table) => {
        table.rolls.action.addAdvantageDie('Inevitable');
        table.feature.set(PENDING_KEY, false);
      }
    ),
  },
};
