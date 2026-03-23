/**
 * Sage domain — Wild Surge (Tier 2 / level 7 spell)
 * SRD: daggerheart-srd/abilities/Wild Surge.md
 */

import { when, isActing } from '../../engine/when.js';

function isRestAction(table) {
  const t = table.action?.type;
  return t === 'shortRest' || t === 'longRest';
}

/** Active Wild Surge die face (1–6), or inactive when absent / invalid. */
function wildSurgeDieValue(table) {
  const v = table.feature.get('wildSurgeDie');
  return typeof v === 'number' && v >= 1 && v <= 6 ? v : null;
}

function hasActionRoll(table) {
  return table.rolls?.action != null;
}

export const WildSurge = {
  name: 'Wild Surge',
  description:
    'Once per long rest, **mark a Stress** to channel the natural world around you and enhance yourself. Describe how your appearance changes, then place a **d6** on this card with the 1 value facing up.\n\nWhile the Wild Surge Die is active, you add its value to every action roll you make. After you add its value to a roll, increase the Wild Surge Die\'s value by one. When the die\'s value would exceed 6 or you take a rest, this form drops and you must **mark an additional Stress**.',
  stressCost: 1,
  frequency: 'longRest',
  onUse(table) {
    table.feature.set('wildSurgeDie', 1);
    table.feature.set('wildSurgeConsumedThisAction', false);
    table.me.actionLoop(
      'Wild Surge',
      'Wild Surge is active (d6 shows 1). Add that value to each action roll; after each roll, increase the die by 1. When it would exceed 6 or you take a rest, this form ends — mark an additional Stress.'
    );
  },
  hooks: {
    onIntent: when(
      isActing,
      (table) => wildSurgeDieValue(table) != null,
      hasActionRoll,
      (table) => {
        const v = wildSurgeDieValue(table);
        table.rolls.action.addStatic({ name: 'Wild Surge', value: v });
        table.feature.set('wildSurgeConsumedThisAction', true);
      }
    ),
    onResolve: when(
      isActing,
      (table) =>
        table.feature.get('wildSurgeConsumedThisAction') === true &&
        wildSurgeDieValue(table) != null,
      (table) => {
        table.feature.set('wildSurgeConsumedThisAction', false);
        const cur = wildSurgeDieValue(table);
        const next = cur + 1;
        if (next > 6) {
          table.feature.set('wildSurgeDie', null);
          table.me.markStress(1);
        } else {
          table.feature.set('wildSurgeDie', next);
        }
      }
    ),
    onRest: when(
      isRestAction,
      (table) => wildSurgeDieValue(table) != null,
      (table) => {
        table.feature.set('wildSurgeDie', null);
        table.feature.set('wildSurgeConsumedThisAction', false);
        table.me.markStress(1);
      }
    ),
  },
};
