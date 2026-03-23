/**
 * Splendor domain — Salvation Beam (Tier 2 / SRD level 9 spell; Recall Cost 2)
 * SRD: daggerheart-srd/abilities/Salvation Beam.md
 */

import { when, isActing, isWithinFarRangeOfMe } from '../../engine/when.js';
import { spellcastTraitLabel } from '../Codex/spellcast-label.js';

/** PCs within Far range (≤100'); GM confirms a “line” on the map. */
function alliesWithinFarBand(table) {
  return (table.characters ?? []).filter((c) => isWithinFarRangeOfMe(table, c));
}

function stressAmountOptions(table) {
  const max = table.me?.maxStress ?? 6;
  const cur = table.me?.currentStress ?? 0;
  const empty = Math.max(0, max - cur);
  return Array.from({ length: empty }, (_, i) => ({
    id: String(i + 1),
    name: `Mark ${i + 1} Stress — clear ${i + 1} HP total (split among selected allies)`,
  }));
}

/** Split `total` HP clears across `targets` as evenly as possible (remainder to first targets). */
function distributeClearHp(total, targets) {
  const m = targets.length;
  if (m === 0 || total <= 0) return;
  const base = Math.floor(total / m);
  const rem = total % m;
  for (let i = 0; i < m; i++) {
    const amt = base + (i < rem ? 1 : 0);
    targets[i].clearHP(amt);
  }
}

export const SalvationBeam = {
  name: 'Salvation Beam',
  description:
    "Make a **Spellcast Roll (16)**. On a success, **mark any number of Stress** to target a line of allies within Far range. You can clear Hit Points on the targets equal to the number of Stress marked, divided among them however you'd like.",
  hooks: {
    onReviewAction: when(
      isActing,
      (table) =>
        table.action?.type === 'spellcast' &&
        table.feature.get('sbAwaitingSpellcast') === true,
      (table) => typeof table.rolls?.action?.isSuccess === 'boolean',
      (table) => {
        table.feature.set('sbAwaitingSpellcast', false);
        if (table.rolls?.action?.isSuccess === true) {
          table.feature.set('sbPendingHeal', true);
        }
      }
    ),
    onRest: when(
      (table) =>
        table.action?.type === 'shortRest' ||
        table.action?.type === 'longRest' ||
        table.action?.type === 'rest',
      (table) => {
        table.feature.set('sbAwaitingSpellcast', false);
        table.feature.set('sbPendingHeal', false);
      }
    ),
  },
  chips: [
    {
      placements: ['card'],
      name: 'Salvation Beam',
      hopeCost: 2,
      description:
        'Spend 2 Hope (recall). Spellcast (16). On a success, choose how much Stress to mark and which allies in a line within Far range receive healing — HP cleared equals Stress marked, split among targets (automation uses an even split; adjust with the GM).',
      onUse(table) {
        table.feature.set('sbAwaitingSpellcast', true);
        const trait = spellcastTraitLabel(table);
        table.me.actionLoop(
          'Salvation Beam',
          `Spend 2 Hope (recall). Make a Spellcast (${trait}) roll (16). On a success, mark any number of Stress to target a line of allies within Far range. Clear Hit Points on those targets equal to the Stress marked, divided among them as you choose (place tokens to show the line; GM may confirm geometry).`,
          { trait, difficulty: 16 }
        );
      },
    },
    when(
      (table) => table.feature.get('sbPendingHeal') === true,
      {
        placements: ['card'],
        name: 'Salvation Beam — Distribute healing',
        description:
          'After a successful Spellcast (16): choose how many Stress to mark, then select allies in Far range who form your beam’s line. HP cleared equals Stress marked, split evenly among selected allies unless the GM adjusts.',
        isSelect: (table) => stressAmountOptions(table),
        selectTargets: (table) => alliesWithinFarBand(table),
        multiSelect: true,
        isDisabled: (table) => {
          if (stressAmountOptions(table).length === 0) return 'No empty Stress boxes to mark.';
          if (alliesWithinFarBand(table).length === 0) return 'No allies in Far range for the beam.';
          return false;
        },
        onUse(table, chipState) {
          const n = parseInt(String(chipState.get('selectedId') ?? '0'), 10) || 0;
          const rawIds = chipState.get?.('selectedTargetIds') ?? [];
          if (n < 1 || !Array.isArray(rawIds) || rawIds.length === 0) return;

          const eligible = new Set(alliesWithinFarBand(table).map((c) => c.instanceId));
          const ids = [...new Set(rawIds)].filter((id) => eligible.has(id));
          if (ids.length === 0) return;

          const maxEmpty = Math.max(0, (table.me?.maxStress ?? 6) - (table.me?.currentStress ?? 0));
          if (n > maxEmpty) return;

          table.me.markStress(n);
          table.feature.set('sbPendingHeal', false);

          const targets = ids
            .map((id) => table.characters.find((c) => c.instanceId === id))
            .filter(Boolean);
          distributeClearHp(n, targets);

          const names = targets.map((t) => t.name ?? 'Ally').join(', ');
          table.me.actionLoop(
            'Salvation Beam',
            `Marked ${n} Stress and cleared ${n} Hit Points among ${names} (even split among selected allies; GM can adjust distribution or line placement).`
          );
        },
      }
    ),
  ],
};
