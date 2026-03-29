/**
 * Adversary reaction — Acid Bath (SRD)
 *
 * **Game Table:** When the Burrower takes **Severe** damage from an **attack**, a **reviewOutcome**
 * chip queues a real **`1d10`** splash roll (`table.sheet.actionRoll` → GM `postRoll`) and an
 * **actionLoop** banner for the blood pool (Very Close move-through damage is GM-facing).
 *
 * **FUTURE:** `1d6` when moving through **persistent** blood on the map (tiles + `onTokenMove` /
 * zone bookkeeping) — not automated yet.
 */
import { when, isTargeted, youTakeSevereDamage } from "../engine/when.js";

export const AcidBath = {
  name: "Acid Bath",
  type: "reaction",
  description:
    "When the Burrower takes Severe damage, all creatures within Close range are bathed in their acidic blood, taking **1d10** physical damage. This splash covers the ground within Very Close range with blood, and all creatures other than the Burrower who move through it take **1d6** physical damage.",
  chips: [
    when(
      isTargeted,
      youTakeSevereDamage,
      (table) => table.action?.type === "attack",
      {
        name: "Acid Bath (splash)",
        description:
          "Table dice: **1d10** physical to creatures in **Close** (use `table.me.actorsWithinRangeBand('close')` as a guide). Banner: Very Close blood hazard.",
        placements: ["reviewOutcome"],
        onUse: (table) => {
          table.sheet.actionRoll({
            rollText: "[1d10] physical (Acid Bath splash — Close)",
            displayName: `${table.me.name}: Acid Bath`,
            rollMeta: {
              _attackerInstanceId: table.me.instanceId,
              _attackerType: "adversary",
            },
          });
          table.me.actionLoop(
            "Acid Bath — blood on the ground",
            "Very Close: **1d6** physical if a creature moves through the blood (other than the Burrower). Persistent movement/hazard automation is not implemented yet (FUTURE)."
          );
        },
      }
    ),
  ],
};
