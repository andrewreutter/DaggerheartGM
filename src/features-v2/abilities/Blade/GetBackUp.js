/**
 * Blade domain — Get Back Up (Tier 1)
 * SRD: daggerheart-srd/.build/03_json/abilities.json
 */

import { when, isTargeted, youTakeSevereDamage } from '../../engine/when.js';
import { reduceIncomingHpByOneThreshold } from '../../engine/armor-review-outcome.js';

export const GetBackUp = {
  name: 'Get Back Up',
  description:
    'When you take Severe damage, you can **mark a Stress** to reduce the severity by one threshold.',
  chips: [
    when(
      isTargeted,
      youTakeSevereDamage,
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
