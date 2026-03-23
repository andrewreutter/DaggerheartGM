/**
 * Galapa Ancestry Features (V2)
 *
 * SRD source: daggerheart-srd/ancestries/Galapa.md
 */

import { when, isActing } from '../engine/when.js';
import { toggleIsOn } from '../engine/chip-system.js';

function isRetracted(table) {
  return toggleIsOn(table, Retract, Retract.chips[0]);
}

export const Shell = {
  name: 'Shell',
  description:
    'Gain a bonus to your damage thresholds equal to your Proficiency.',
  passiveStatMods: {
    majorThreshold: (table) => table.me?.proficiency ?? 1,
    severeThreshold: (table) => table.me?.proficiency ?? 1,
  },
};

export const Retract = {
  name: 'Retract',
  _source: 'ancestry',
  description:
    'Mark a Stress to retract into your shell. While in your shell, you have resistance to physical damage, you have disadvantage on action rolls, and you can\'t move.',
  chips: [
    {
      description:
        'Mark 1 Stress to retract into your shell. While retracted, you have resistance to physical damage, disadvantage on action rolls, and can\'t move.',
      placements: ['card'],
      stressCost: 1,
      isToggle: true,
      onUse(table, chip) {
        const moveLock = "Can't move — retracted into shell.";
        if (chip.isOn) {
          table.me.restrictMovement(moveLock);
          table.me.actionLoop('Retract', 'Retracting into shell for protection.');
        } else {
          table.me.allowMovement(moveLock);
          table.me.actionLoop('Retract', 'Emerging from shell.');
        }
      },
    },
  ],
  hooks: {
    // When retracted and acting, the character's action rolls have disadvantage.
    onIntent: when(
      isActing,
      isRetracted,
      (table) => table.rolls?.action?.addDisadvantageDie('Retract')
    ),
    // Raw damage only — see feature-authoring-guide: Review Action vs Review Outcome.
    onReviewAction: when(
      isRetracted,
      (table) => {
        const physicalDamage = table.action?.effects?.find(
          (e) =>
            e.type === 'damage' &&
            e.target?.instanceId === table.me?.instanceId &&
            e.damageType === 'physical' &&
            e.amount !== undefined &&
            e.amount > 0
        );
        if (physicalDamage) {
          physicalDamage.amount = Math.ceil(physicalDamage.amount / 2);
        }
      }
    ),
  },
};

// Retract is fully implemented: physical resistance (onReviewAction), disadvantage on action rolls
// (onIntent), and movement restriction (restrictMovement / allowMovement chip toggle).
