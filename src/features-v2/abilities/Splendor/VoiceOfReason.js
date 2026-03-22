/**
 * Splendor domain — Voice of Reason (Tier 1)
 * SRD: Advantage on relevant action rolls; when all Stress is marked, +1 Proficiency on damage rolls.
 */

import { when, isActing } from '../../engine/when.js';

function stressFullyMarked(table) {
  const cur = table.me?.currentStress;
  const max = table.me?.maxStress;
  if (cur == null || max == null || max <= 0) return false;
  return cur >= max;
}

export const VoiceOfReason = {
  name: 'Voice of Reason',
  description:
    'You speak with an unmatched power and authority. You have advantage on action rolls to de-escalate violent situations or convince someone to follow your lead. Additionally, you\'re emboldened in moments of duress. When all of your Stress slots are marked, you gain a +1 bonus to your Proficiency for damage rolls.',
  advantageTriggers: [
    'rolls to de-escalate violent situations or convince someone to follow your lead',
  ],
  hooks: {
    onIntent: when(
      isActing,
      (t) => t.rolls?.damage != null,
      stressFullyMarked,
      (t) => {
        t.rolls.damage.addStatic({ name: 'Voice of Reason', value: 1 });
      }
    ),
  },
};
