/**
 * SRD consumable — Death Tea (common roll table 58).
 * daggerheart-srd/consumables/Death Tea.md
 */

import { when, isActing } from '../engine/when.js';

/** After drinking: next critical hit on an attack kills the target; clear before long rest or die. */
const PENDING_KEY = 'deathTeaPending';

const OFFENSIVE_TYPES = new Set(['attack', 'spellcast']);

export const DeathTea = {
  name: 'Death Tea',
  description:
    'After you drink this tea, you instantly kill your target when you critically succeed on an attack. If you don\'t critically succeed on an attack before your next long rest, you die.',
  onUse(table) {
    table.feature.set(PENDING_KEY, true);
  },
  hooks: {
    onReviewAction: when(
      isActing,
      (t) => t.feature.get(PENDING_KEY) === true,
      (t) => OFFENSIVE_TYPES.has(t.action?.type),
      (t) => t.rolls?.action?.isSuccess === true,
      (t) => t.rolls?.action?.isCritical === true,
      (t) => t.rolls?.action?.hopeDie != null && t.rolls?.action?.fearDie != null,
      (t) => t.action?.target?.instanceId != null,
      (table) => {
        const tgt = table.action.target;
        table.feature.set(PENDING_KEY, false);
        const hp = tgt.currentHP;
        if (hp != null && hp > 0) {
          tgt.markHP(hp);
          const tid = tgt.instanceId;
          for (const e of table.action?.effects ?? []) {
            if (e.type === 'damage' && e.target?.instanceId === tid) {
              e.amount = 0;
            }
          }
        }
        table.action.addNarration('Death Tea: instant kill on a critical hit.');
      }
    ),
    /** Fires at long rest: if the tea is still waiting for a critical hit, you die. */
    onRest: when(
      (t) => t.action?.type === 'longRest',
      (t) => t.feature.get(PENDING_KEY) === true,
      (table) => {
        const hp = table.me.currentHP;
        if (hp != null && hp > 0) {
          table.me.markHP(hp);
        }
        table.feature.set(PENDING_KEY, false);
      }
    ),
  },
};
