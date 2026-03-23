/**
 * Midnight domain — Stealth Expertise (Level 4 ability)
 * SRD: daggerheart-srd/abilities/Stealth Expertise.md
 */

import { when, isActing } from '../../engine/when.js';

/**
 * Expert must be within the SRD "Close range" footprint (≤30'): melee, very close, or close bands.
 * Requires both tokens on the map; otherwise range is unknown and this is false.
 */
function expertWithinCloseRangeOfViewer(table) {
  const oid = table.activeFeature?._ownerInstanceId;
  if (!oid) return false;
  const expert = table.characters?.find((c) => c.instanceId === oid);
  if (!expert || !table.me) return false;
  const band = expert.rangeFrom(table.me);
  return band === 'melee' || band === 'veryClose' || band === 'close';
}

export const StealthExpertise = {
  name: 'Stealth Expertise',
  description:
    'When you roll with Fear while attempting to move unnoticed through a dangerous area, you can **mark a Stress** to roll with Hope instead.\n\nIf an ally within Close range is also attempting to move unnoticed and rolls with Fear, you can **mark a Stress** to change their result to a roll with Hope.',
  chips: [
    when(
      isActing,
      (table) => table.rolls?.action?.fearDie,
      {
        name: 'Stealth Expertise',
        placements: ['reviewAction'],
        stressCost: 1,
        description:
          'Mark 1 Stress to treat this roll as Hope instead of Fear while moving unnoticed through a dangerous area (scene context with GM; V2 cannot verify "unnoticed" or "dangerous").',
        onUse(table) {
          table.rolls?.action?.setOutcome('hope');
        },
      }
    ),
    when(
      (table) =>
        table.action?.actor?.instanceId === table.me?.instanceId &&
        table.rolls?.action?.fearDie &&
        table.me?.instanceId !== table.activeFeature?._ownerInstanceId,
      expertWithinCloseRangeOfViewer,
      {
        name: 'Stealth Expertise — Ally',
        placements: ['reviewAction'],
        showOnOtherSheets: true,
        description:
          'An ally within Close range on the map rolled with Fear while moving unnoticed. Mark 1 Stress on you to change their result to Hope.',
        onUse(table) {
          const oid = table.activeFeature?._ownerInstanceId;
          const expert = table.characters?.find((c) => c.instanceId === oid);
          expert?.markStress(1);
          table.rolls?.action?.setOutcome('hope');
        },
      }
    ),
  ],
};
