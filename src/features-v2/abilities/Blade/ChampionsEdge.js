/**
 * Blade domain — Champion's Edge (Tier 2 / level 5)
 * SRD: daggerheart-srd/.build/03_json/abilities.json
 */

import { when, isActing } from '../../engine/when.js';

/** Up to 3 selections, capped by current Hope (1 Hope per option). */
function maxEdgeSelections(table) {
  const h = table.me?.hope;
  if (h == null || h < 1) return 0;
  return Math.min(3, Math.floor(h));
}

export const ChampionsEdge = {
  name: "Champion's Edge",
  description:
    "When you critically succeed on an attack, you can **spend up to 3 Hope** and choose one of the following options for each Hope spent:\n\n- You clear a Hit Point.\n- You clear an Armor Slot.\n- The target must mark an additional Hit Point.\n\nYou can't choose the same option more than once.",
  chips: [
    when(
      isActing,
      (table) =>
        table.action?.type === 'attack' && table.rolls?.action?.isCritical === true,
      {
        name: "Champion's Edge",
        placements: ['reviewAction'],
        multiSelect: true,
        maxSelections: (table) => maxEdgeSelections(table),
        isDisabled: (table) =>
          maxEdgeSelections(table) < 1 ? 'Need at least 1 Hope to spend on Champion\'s Edge.' : false,
        description:
          'Pick 1–3 different options. Each costs 1 Hope: clear 1 HP on yourself, clear 1 Armor Slot on yourself, or your attack target marks 1 additional HP.',
        isSelect: () => [
          {
            id: 'clearHp',
            name: 'Clear a Hit Point',
            description: 'Clear 1 marked Hit Point on yourself.',
          },
          {
            id: 'clearArmor',
            name: 'Clear an Armor Slot',
            description: 'Clear 1 marked Armor Slot on yourself.',
          },
          {
            id: 'extraTargetHp',
            name: 'Target marks +1 HP',
            description: 'The target of your attack marks 1 additional Hit Point.',
          },
        ],
        /**
         * Hope is spent inside `onUse` (not `hopeCost` on the chip): the V2 review bridge runs
         * `deductChipCosts` before `activateChip`, so variable Hope tied to multi-select `selectedIds`
         * must be applied manually.
         */
        onUse(table, chipState) {
          const ids = chipState.get?.('selectedIds');
          if (!Array.isArray(ids) || ids.length === 0) return;
          const allowed = new Set(['clearHp', 'clearArmor', 'extraTargetHp']);
          const unique = new Set(ids);
          if (unique.size !== ids.length) return;
          if (ids.length > 3 || ids.some((id) => !allowed.has(id))) return;
          const n = ids.length;
          const hope = table.me?.hope ?? 0;
          if (hope < n) return;
          table.me.spendHope(n);
          for (const id of ids) {
            if (id === 'clearHp') table.me.clearHP(1);
            else if (id === 'clearArmor') table.me.clearArmor(1);
            else if (id === 'extraTargetHp') {
              const tgt = table.action?.target;
              if (tgt) tgt.markHP(1);
            }
          }
        },
      }
    ),
  ],
};
