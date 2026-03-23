/**
 * Grace domain — Thought Delver (Tier 2 / level 5 spell)
 * SRD: Spend Hope for surface thoughts within Far range; Spellcast vs target to delve deeper.
 */

import { spellcastTraitLabel } from '../Codex/spellcast-label.js';

/** “Within Far range” — not Very Far (≤ 100 ft between tokens). */
function isWithinFarRange(table, actor) {
  const b = table.me.rangeFrom(actor);
  return b === 'melee' || b === 'veryClose' || b === 'close' || b === 'far';
}

function thoughtDelverTargets(table) {
  const meId = table.me?.instanceId;
  const otherPcs = table.characters.filter(
    (c) => c.instanceId !== meId && isWithinFarRange(table, c)
  );
  const advs = table.adversaries.filter((a) => isWithinFarRange(table, a));
  return [...otherPcs, ...advs];
}

export const ThoughtDelver = {
  name: 'Thought Delver',
  description:
    'You can peek into the minds of others. **Spend a Hope** to read the vague surface thoughts of a target within Far range. Make a **Spellcast Roll** against the target to delve for deeper, more hidden thoughts.\n\nOn a roll with Fear, the target might, at the GM\'s discretion, become aware that you\'re reading their thoughts.',
  chips: [
    {
      placements: ['card'],
      name: 'Thought Delver',
      hopeCost: 1,
      description:
        'Spend 1 Hope to read vague surface thoughts of a chosen target within Far range, then make a Spellcast roll vs that target to delve deeper. On Fear, the target might notice (GM).',
      selectTargets: (table) => thoughtDelverTargets(table),
      isDisabled: (table) =>
        thoughtDelverTargets(table).length === 0 ? 'No target in range for Thought Delver.' : false,
      onUse(table, chip) {
        const ids = chip.get?.('selectedTargetIds') || [];
        const id = ids[0];
        if (!id) return;
        const actor = table.actors.find((a) => a.instanceId === id);
        if (!actor || !isWithinFarRange(table, actor)) return;
        const trait = spellcastTraitLabel(table);
        const label = actor.name ?? 'the target';
        table.me.actionLoop(
          'Thought Delver',
          `Spend 1 Hope to read vague surface thoughts of ${label} within Far range, then make a Spellcast (${trait}) roll against them to delve for deeper, more hidden thoughts. On a roll with Fear, ${label} might, at the GM's discretion, become aware that you are reading their thoughts.`,
          { trait }
        );
      },
    },
  ],
};
