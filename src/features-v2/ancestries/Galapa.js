/**
 * Galapa Ancestry Features (V2)
 *
 * SRD source: daggerheart-srd/ancestries/Galapa.md
 */

import { when } from '../engine/when.js';

/**
 * Blocked: SRD grants +Proficiency to damage thresholds. The V2 table snapshot does
 * not expose proficiency (or tier/level) for passiveStatMods / dynamic thresholds.
 * Revisit when `table.me` (or equivalent) can supply proficiency at character-render time.
 */
export const Shell = {
  name: 'Shell',
  description:
    'Gain a bonus to your damage thresholds equal to your Proficiency.',
};

export const Retract = {
  name: 'Retract',
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
        table.feature.set('retracted', chip.isOn);
        if (chip.isOn) {
          table.me.actionLoop('Retract', 'Retracting into shell for protection.');
        } else {
          table.me.actionLoop('Retract', 'Emerging from shell.');
        }
      },
    },
  ],
  hooks: {
    // Raw damage only — see feature-authoring-guide: Review Action vs Review Outcome.
    onReviewAction: when(
      (table) => table.feature.get('retracted') === true,
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

// Blocked (remaining SRD for Retract): disadvantage on action rolls and “can’t move” need
// engine support (roll pipeline + movement validation). Physical resistance is handled in
// onReviewAction using raw `type: 'damage'` effects (see feature-authoring-guide).
