/**
 * Drakona Ancestry Features (V2)
 *
 * SRD source: daggerheart-srd/ancestries/Drakona.md
 */

import { when, isTargeted, youTakeSevereDamage, effectTargetsMe, isSeverePendingHpLossEffect } from '../engine/when.js';

export const Scales = {
  name: 'Scales',
  description:
    'Your scales act as natural protection. When you would take Severe damage, you can mark a Stress to mark 1 fewer Hit Points.',
  chips: [
    when(
      isTargeted,
      youTakeSevereDamage,
      {
        description: 'Mark a Stress to mark 1 fewer Hit Point.',
        placements: ['reviewOutcome'],
        stressCost: 1,
        isToggle: true,
        // No onUse — the engine gates the hook below
      }
    ),
  ],
  hooks: {
    onReviewOutcome: (table) => {
      const dmg = table.action?.effects?.find(
        (e) => effectTargetsMe(e, table) && isSeverePendingHpLossEffect(e)
      );
      if (dmg && dmg.amount > 0) {
        dmg.amount -= 1;
      }
    },
  },
};

export const ElementalBreath = {
  name: 'Elemental Breath',
  description:
    'Choose an element for your breath (such as electricity, fire, or ice). You can use this breath against a target or group of targets within Very Close range, treating it as an Instinct weapon that deals d8 magic damage using your Proficiency.',
  virtualWeapons: [
    {
      name: 'Elemental Breath',
      trait: 'instinct',
      range: 'veryClose',
      damage: 'd8',
      damageType: 'magic',
      multiTarget: true,
    },
  ],
};
