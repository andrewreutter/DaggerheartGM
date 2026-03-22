/**
 * Blade domain — Get Back Up (Tier 1)
 * SRD: daggerheart-srd/.build/03_json/abilities.json
 */

import { when, isTargeted } from '../../engine/when.js';
import { reduceIncomingHpByOneThreshold } from '../../engine/armor-review-outcome.js';

/** Severe HP loss: VTT may set `damageTier`/`thresholdTier`, or tests use amount ≥ 3 (see Scales ancestry). */
function isSevereIncomingHpEffect(e, id) {
  const tid = e.target?.instanceId ?? e.target?.id;
  if (e.stat !== 'currentHP' || tid !== id || !(e.amount > 0)) return false;
  const amt = e.amount;
  return (
    e.damageTier === 'severe' ||
    e.thresholdTier === 'severe' ||
    (e.damageTier == null && e.thresholdTier == null && amt >= 3)
  );
}

function hasSevereHpToMe(table) {
  const id = table.me?.instanceId;
  if (!id) return false;
  return (table.action?.effects ?? []).some((e) => isSevereIncomingHpEffect(e, id));
}

export const GetBackUp = {
  name: 'Get Back Up',
  description:
    'When you take Severe damage, you can **mark a Stress** to reduce the severity by one threshold.',
  chips: [
    when(
      isTargeted,
      hasSevereHpToMe,
      {
        placements: ['reviewOutcome'],
        name: 'Get Back Up',
        stressCost: 1,
        description:
          'Mark a Stress to reduce this Severe damage by one threshold (toward Major).',
        onUse(table) {
          reduceIncomingHpByOneThreshold(table);
        },
      }
    ),
  ],
};
