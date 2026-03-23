/**
 * SRD consumable — Homet's Secret Potion (common roll table 32).
 * daggerheart-srd/consumables/Homets Secret Potion.md
 */

import { when, isActing } from '../engine/when.js';

/** Feature-state key: potion drunk; next qualifying successful attack becomes a critical. */
const PENDING_CRIT = 'hometSecretPotionPendingCrit';

const OFFENSIVE_TYPES = new Set(['attack', 'spellcast']);

export const HometsSecretPotion = {
  name: "Homet's Secret Potion",
  description:
    'After drinking this potion, the next successful attack you make critically succeeds.',
  onUse(table) {
    table.feature.set(PENDING_CRIT, true);
  },
  hooks: {
    onReviewAction: when(
      isActing,
      (t) => t.feature.get(PENDING_CRIT) === true,
      (t) => OFFENSIVE_TYPES.has(t.action?.type),
      (t) => t.rolls?.action?.isSuccess === true,
      (t) => t.rolls?.action?.hopeDie != null && t.rolls?.action?.fearDie != null,
      (table) => {
        table.rolls.action.setActionCritical(true);
        table.feature.set(PENDING_CRIT, false);
      }
    ),
  },
};
