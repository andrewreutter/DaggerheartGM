/**
 * Midnight domain — Glyph of Nightfall (Tier 2 domain spell / SRD level 4)
 * SRD: daggerheart-srd/.build/03_json/abilities.json
 */

import { when, isActing } from '../../engine/when.js';
import { spellcastTraitLabel } from '../Codex/spellcast-label.js';

/** SRD “within Very Close range”: Melee or Very Close bands only. */
function withinVeryClose(table, actor) {
  const b = table.me.rangeFrom(actor);
  return b === 'melee' || b === 'veryClose';
}

function glyphReduction(table) {
  const k = Number(table.me?.traits?.knowledge ?? 0);
  return Math.max(1, Math.floor(Number.isFinite(k) ? k : 0));
}

export const GlyphOfNightfall = {
  name: 'Glyph of Nightfall',
  description:
    'Make a **Spellcast Roll** against a target within Very Close range. On a success, **spend a Hope** to conjure a dark glyph upon their body that exposes their weak points, temporarily reducing the target\'s Difficulty by a value equal to your Knowledge (minimum 1).',
  hooks: {
    onReviewAction: when(
      isActing,
      (table) =>
        table.action?.type === 'spellcast' &&
        table.feature.get('glyphOfNightfallAwaiting') === true,
      (table) => typeof table.rolls?.action?.isSuccess === 'boolean',
      (table) => {
        table.feature.set('glyphOfNightfallAwaiting', false);
        if (table.rolls?.action?.isSuccess !== true) {
          table.feature.set('glyphOfNightfallTargetId', null);
          table.feature.set('glyphOfNightfallPendingHope', false);
          return;
        }
        table.feature.set('glyphOfNightfallPendingHope', true);
      }
    ),
  },
  chips: [
    {
      placements: ['card'],
      name: 'Glyph of Nightfall',
      description:
        'Spellcast vs an adversary within Very Close. On success, spend 1 Hope on the banner to reduce their Difficulty by your Knowledge (minimum 1) until it ends (GM).',
      selectTargets: (table) => table.adversaries.filter((a) => withinVeryClose(table, a)),
      multiSelect: false,
      isDisabled: (table) =>
        table.adversaries.filter((a) => withinVeryClose(table, a)).length === 0
          ? 'No adversary within Very Close range (Melee or Very Close).'
          : false,
      onUse(table, chipState) {
        const targetId = (chipState.get?.('selectedTargetIds') || [])[0];
        if (!targetId) return;
        const adv = table.adversaries.find((a) => a.instanceId === targetId);
        if (!adv || !withinVeryClose(table, adv)) return;

        const trait = spellcastTraitLabel(table);
        const dc = adv.effectiveDifficulty;
        const red = glyphReduction(table);
        const opts = { trait };
        if (dc != null && Number.isFinite(dc)) {
          opts.difficulty = dc;
        }

        table.feature.set('glyphOfNightfallAwaiting', true);
        table.feature.set('glyphOfNightfallTargetId', targetId);
        table.feature.set('glyphOfNightfallPendingHope', false);

        table.me.actionLoop(
          'Glyph of Nightfall',
          `Make a Spellcast (${trait}) roll against ${adv.name} within Very Close range${
            opts.difficulty != null ? ` (vs Difficulty ${opts.difficulty})` : ''
          }. On a success, you may spend 1 Hope to conjure a dark glyph: temporarily reduce their Difficulty by ${red} (minimum 1).`,
          opts
        );
      },
    },
    when(
      isActing,
      (table) => table.feature.get('glyphOfNightfallPendingHope') === true,
      {
        placements: ['reviewAction'],
        name: 'Glyph of Nightfall — expose weak points',
        hopeCost: 1,
        description:
          'Spend 1 Hope to apply the glyph: reduce the target adversary’s Difficulty by your Knowledge (minimum 1) until it ends (GM).',
        onUse(table) {
          const tid = table.feature.get('glyphOfNightfallTargetId');
          table.feature.set('glyphOfNightfallPendingHope', false);
          table.feature.set('glyphOfNightfallTargetId', null);
          if (!tid) return;
          const target = table.actors.find((a) => a.instanceId === tid);
          if (!target?.isAdversary) return;
          const red = glyphReduction(table);
          target.applyStatMod('difficulty', -red);
        },
      }
    ),
  ],
};
