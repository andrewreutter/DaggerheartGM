/**
 * Splendor domain — Resurrection (Tier 3 / SRD level 10 spell; Recall Cost 2)
 * SRD: daggerheart-srd/abilities/Resurrection.md
 */

import { when, isActing } from '../../engine/when.js';
import { spellcastTraitLabel } from '../Codex/spellcast-label.js';

const RESURRECTION_CARD_ID = 'srd-abl-resurrection';
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function resurrectionLocked(table) {
  const until = table.feature.get('resurrectionCooldownUntil');
  if (until == null) return false;
  const t = typeof until === 'number' ? until : Date.parse(String(until));
  if (Number.isNaN(t)) return false;
  return Date.now() < t;
}

export const Resurrection = {
  name: 'Resurrection',
  description:
    'Make a **Spellcast Roll (20)**. On a success, restore one creature who has been dead no longer than 100 years to full strength. Then roll a **d6**. On a result of 5 or lower, place this card in your vault permanently.\n\nOn a failure, you can\'t cast Resurrection again for a week.',
  hooks: {
    onReviewAction: when(
      isActing,
      (table) =>
        table.action?.type === 'spellcast' &&
        table.feature.get('resurrectionAwaitingSpellcast') === true,
      (table) => typeof table.rolls?.action?.isSuccess === 'boolean',
      (table) => {
        table.feature.set('resurrectionAwaitingSpellcast', false);
        if (table.rolls?.action?.isSuccess === true) {
          table.me.actionLoop(
            'Resurrection',
            'Spellcast succeeds — restore one creature who has been dead no longer than 100 years to full strength (GM restores them at full resources).',
            {}
          );
          const d = table.rollDie('d6');
          table.feature.set('resurrectionLastVaultD6', d);
          if (d <= 5) {
            table.me.moveDomainCardToVault(RESURRECTION_CARD_ID);
            table.me.actionLoop(
              'Resurrection',
              `You rolled ${d} on the d6 — place Resurrection in your vault permanently.`,
              {}
            );
          }
        } else {
          table.feature.set('resurrectionCooldownUntil', Date.now() + WEEK_MS);
          table.me.actionLoop(
            'Resurrection',
            'Spellcast fails — you cannot cast Resurrection again for one week.',
            {}
          );
        }
      }
    ),
    onRest: when(
      (table) =>
        table.action?.type === 'shortRest' ||
        table.action?.type === 'longRest' ||
        table.action?.type === 'rest',
      (table) => {
        table.feature.set('resurrectionAwaitingSpellcast', false);
      }
    ),
  },
  chips: [
    {
      placements: ['card'],
      name: 'Resurrection',
      hopeCost: 2,
      description:
        'Spend 2 Hope (recall). Spellcast (20). On a success, restore a creature dead no longer than 100 years to full strength; roll a d6 — on 5 or lower, this card goes to your vault permanently. On a failure, you cannot cast Resurrection again for a week.',
      isDisabled: (table) =>
        resurrectionLocked(table)
          ? 'Resurrection is on cooldown for one week after a failed cast.'
          : false,
      onUse(table) {
        table.feature.set('resurrectionAwaitingSpellcast', true);
        const trait = spellcastTraitLabel(table);
        table.me.actionLoop(
          'Resurrection',
          `Spend 2 Hope (recall). Make a Spellcast (${trait}) roll (20). On a success, restore one creature who has been dead no longer than 100 years to full strength. Then roll a d6 — on a result of 5 or lower, place this card in your vault permanently. On a failure, you cannot cast Resurrection again for a week.`,
          { trait, difficulty: 20 }
        );
      },
    },
  ],
};
