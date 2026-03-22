/**
 * School of Knowledge subclass (Wizard) — SRD: daggerheart-srd/subclasses/School of Knowledge.md
 */

import { when, isActing } from '../engine/when.js';

const SOURCE_SCOPE = 'SchoolOfKnowledge';

/** Shared subclass row for `table.source` / registry `sourceScopeKey`. */
export const SchoolOfKnowledgeRow = {
  name: 'School of Knowledge',
  sourceScopeKey: SOURCE_SCOPE,
};

function usedExperience(table) {
  const expNames = new Set((table.me?.experiences || []).map((e) => e.name));
  return (table.rolls?.action?.statics || []).some((s) => expNames.has(s.name));
}

/** Extra domain cards — builder/loadout; no action-loop automation (see Impl Notes in tracker). */
export const Prepared = {
  name: 'Prepared',
  description:
    'Take an additional domain card of your level or lower from a domain you have access to.',
};

export const Adept = {
  name: 'Adept',
  description:
    'When you Utilize an Experience, you can **mark a Stress** instead of spending a Hope. If you do, double your Experience modifier for that roll.',
  chips: [
    when(isActing, {
      name: 'Adept',
      placements: ['intent'],
      description:
        'Use Stress instead of Hope for your Experience on this roll and double that Experience modifier.',
      onUse(table) {
        table.source.set('adeptUseStress', true);
      },
    }),
  ],
  hooks: {
    onReviewAction: when(
      isActing,
      (table) => table.source.get('adeptUseStress') === true,
      usedExperience,
      (table) => {
        table.me.markStress(1);
        const expNames = new Set((table.me?.experiences || []).map((e) => e.name));
        for (const s of table.rolls?.action?.statics || []) {
          if (expNames.has(s.name) && typeof s.value === 'number') {
            table.rolls.action.addStatic({ name: 'Adept (double Experience)', value: s.value });
          }
        }
        table.me.gainHope(1);
        table.source.set('adeptUseStress', false);
        table.source.set('adeptConsumedThisRoll', true);
      }
    ),
    onResolve(table) {
      if (!table.me?.isActing) return;
      table.source.set('adeptUseStress', false);
      table.source.set('adeptConsumedThisRoll', false);
    },
  },
};

export const Accomplished = {
  name: 'Accomplished',
  description:
    'Take an additional domain card of your level or lower from a domain you have access to.',
};

export const PerfectRecall = {
  name: 'Perfect Recall',
  description:
    'Once per rest, when you recall a domain card in your vault, you can reduce its Recall Cost by 1.',
  chips: [
    {
      placements: ['card'],
      frequency: 'rest',
      description:
        'Once per rest when you recall a domain card from your vault, reduce its Recall Cost by 1 (host applies on recall).',
      onUse(table) {
        table.me.actionLoop(
          'Perfect Recall',
          'Reduce Recall Cost of one domain card you recall from your vault this rest by 1 Hope.'
        );
      },
    },
  ],
};

export const Brilliant = {
  name: 'Brilliant',
  description:
    'Take an additional domain card of your level or lower from a domain you have access to.',
};

export const HonedExpertise = {
  name: 'Honed Expertise',
  description:
    'When you use an Experience, roll a **d6.** On a result of 5 or higher, you can use it without spending Hope.',
  hooks: {
    onReviewAction: when(
      isActing,
      (table) => !table.source.get('adeptConsumedThisRoll'),
      usedExperience,
      (table) => {
        const r = table.rollDie('d6');
        if (r >= 5) {
          table.me.gainHope(1);
        }
      }
    ),
  },
};
