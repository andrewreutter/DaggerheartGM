/**
 * Splendor domain — Smite (Tier 2 / Level 5)
 * SRD: Once per rest spend 3 Hope to charge; next successful weapon attack doubles damage and deals magic damage.
 */

import { when, isActing } from '../../engine/when.js';

export const Smite = {
  name: 'Smite',
  description:
    'Once per rest, **spend 3 Hope** to charge your powerful smite. When you next successfully attack with a weapon, double the result of your damage roll. This attack deals magic damage regardless of the weapon\'s damage type.',
  chips: [
    {
      placements: ['card'],
      name: 'Smite',
      hopeCost: 3,
      frequency: 'rest',
      description:
        'Spend 3 Hope (once per rest) to charge your smite. Your next successful weapon attack doubles its damage roll and deals magic damage.',
      onUse(table) {
        table.feature.set('smiteCharged', true);
      },
    },
  ],
  hooks: {
    onReviewAction: when(
      isActing,
      (t) => t.feature.get('smiteCharged') === true,
      (t) => t.action?.type === 'attack' && t.action?.weaponId != null,
      (t) => t.rolls?.action?.isSuccess === true,
      (t) => t.rolls?.damage != null,
      (t) => !(t.rolls?.damage?.statics ?? []).some((s) => s.name === 'Smite'),
      (table) => {
        let base = 0;
        for (const d of table.rolls.damage.dice ?? []) {
          if (typeof d.value === 'number') base += d.value;
        }
        for (const s of table.rolls.damage.statics ?? []) {
          if (typeof s.value === 'number') base += s.value;
        }
        if (base > 0) {
          table.rolls.damage.addStatic({ name: 'Smite', value: base });
        }
        const tgtId = table.action?.target?.instanceId;
        const eff = table.action?.effects?.find(
          (e) =>
            e.type === 'damage' &&
            e.target?.instanceId === tgtId &&
            e.amount > 0
        );
        if (eff) eff.damageType = 'magic';
        table.feature.set('smiteCharged', false);
      }
    ),
  },
};
