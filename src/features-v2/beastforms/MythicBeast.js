/**
 * SRD: Mythic Beast — daggerheart-srd/beastforms/Mythic Beast.md
 */

import { when, isActing } from '../engine/when.js';

export const Evolved = {
  name: 'Evolved',
  description:
    "Pick a Tier 1 or Tier 2 Beastform option and become a larger, more powerful version of that creature. While you're in this form, you retain all traits and features from the original form and gain the following bonuses:\n\n- A +9 bonus to damage rolls\n- A +2 bonus to the trait used by this form\n- A +3 bonus to Evasion\n- Your damage die increases by one size (d6 becomes d8, d8 becomes d10, etc.)",

  passiveStatMods: {
    evasion: 3,
  },
  hooks: {
    onReviewAction: when(
      isActing,
      (table) => table.action?.type === 'attack',
      (table) => {
        const targetId = table.action?.target?.instanceId;
        if (!targetId) return;
        for (const e of table.action?.effects || []) {
          if (e.type !== 'damage' || e.target?.instanceId !== targetId) continue;
          if (typeof e.amount !== 'number') continue;
          e.amount += 9;
        }
      }
    ),
  },
};

export const features = [Evolved];
