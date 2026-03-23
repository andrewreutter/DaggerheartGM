/**
 * Grace domain — Astral Projection (Level 8 spell)
 * SRD: daggerheart-srd/abilities/Astral Projection.md
 */

import { when, isTargeted, hasDamage } from '../../engine/when.js';

export const AstralProjection = {
  name: 'Astral Projection',
  description:
    "Once per long rest, **mark a Stress** to create a projected copy of yourself that can appear anywhere you've been before.\n\nYou can see and hear through the projection as though it were you and affect the world as though you were there. A creature investigating the projection can tell it's of magical origin. This effect lasts until your next rest or your projection takes any damage.",
  stressCost: 1,
  frequency: 'longRest',
  hooks: {
    onRest(table) {
      table.feature.set('astralProjectionActive', false);
    },
    onReviewAction: when(
      isTargeted,
      hasDamage,
      (table) => table.feature.get('astralProjectionActive') === true,
      (table) => {
        table.feature.set('astralProjectionActive', false);
        table.action?.addNarration(
          'Astral Projection: the projection takes damage — the effect ends. (If the hit was to your body instead, the GM may keep the projection active.)'
        );
      }
    ),
  },
  onUse(table) {
    table.feature.set('astralProjectionActive', true);
    table.me.actionLoop(
      'Astral Projection',
      "Once per long rest — mark 1 Stress: create a projected copy that can appear anywhere you have been before. You see and hear through it and can affect the world as though you were there; investigation can reveal its magical nature. Lasts until your next rest or the projection takes any damage.",
      {}
    );
  },
};
