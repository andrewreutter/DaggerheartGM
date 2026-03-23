/**
 * Midnight domain — Dark Whispers (Tier 3 / SRD level 6 spell)
 * SRD: daggerheart-srd/.build/03_json/abilities.json
 */

import { when, isActing } from '../../engine/when.js';
import { spellcastTraitLabel } from '../Codex/spellcast-label.js';

export const DarkWhispers = {
  name: 'Dark Whispers',
  description:
    "You can speak into the mind of any person with whom you've made physical contact. Once you've opened a channel with them, they can speak back into your mind. Additionally, you can **mark a Stress** to make a **Spellcast Roll** against them. On a success, you can ask the GM one of the following questions and receive an answer:\n\n- Where are they?\n- What are they doing?\n- What are they afraid of?\n- What do they cherish most in the world?",
  hooks: {
    onReviewAction: when(
      isActing,
      (table) =>
        table.action?.type === 'spellcast' &&
        table.feature.get('darkWhispersAwaiting') === true,
      (table) => typeof table.rolls?.action?.isSuccess === 'boolean',
      (table) => {
        table.feature.set('darkWhispersAwaiting', false);
        const tid = table.feature.get('darkWhispersTargetId');
        table.feature.set('darkWhispersTargetId', null);
        if (table.rolls?.action?.isSuccess !== true) {
          return;
        }
        const target = tid ? table.actors.find((a) => a.instanceId === tid) : null;
        const label = target?.name ?? 'your target';
        table.me.actionLoop(
          'Dark Whispers — insight',
          `Your Spellcast against ${label} succeeded. Ask the GM one question; they answer truthfully: Where are they? · What are they doing? · What are they afraid of? · What do they cherish most in the world?`
        );
      }
    ),
  },
  chips: [
    {
      placements: ['card'],
      name: 'Dark Whispers',
      stressCost: 1,
      description:
        'Mark 1 Stress. Choose a creature with whom you share an open mental channel (physical contact first — GM). Make a Spellcast roll against them. On a success, ask the GM one question from the card; they answer truthfully.',
      selectTargets: (table) => table.actors.filter((a) => a.instanceId !== table.me.instanceId),
      multiSelect: false,
      isDisabled: (table) =>
        table.actors.filter((a) => a.instanceId !== table.me.instanceId).length === 0
          ? 'No other creature to target.'
          : false,
      onUse(table, chipState) {
        const targetId = (chipState.get?.('selectedTargetIds') || [])[0];
        if (!targetId) return;
        const target = table.actors.find((a) => a.instanceId === targetId);
        if (!target || target.instanceId === table.me.instanceId) return;

        const trait = spellcastTraitLabel(table);
        const opts = { trait };
        if (target.isAdversary && target.effectiveDifficulty != null && Number.isFinite(target.effectiveDifficulty)) {
          opts.difficulty = target.effectiveDifficulty;
        }

        table.feature.set('darkWhispersAwaiting', true);
        table.feature.set('darkWhispersTargetId', targetId);

        const dcHint =
          target.isAdversary && opts.difficulty != null
            ? ` (vs Difficulty ${opts.difficulty})`
            : target.isCharacter
              ? ` (vs their Evasion — GM)`
              : '';

        table.me.actionLoop(
          'Dark Whispers',
          `You marked 1 Stress to probe ${target.name} through your linked channel. Make a Spellcast (${trait}) roll against them${dcHint}. On a success, you may ask the GM one question: Where are they? What are they doing? What are they afraid of? What do they cherish most in the world?`,
          opts
        );
      },
    },
  ],
};
