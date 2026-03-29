/**
 * Adversary passive — Acidic Form (SRD)
 *
 * **Game Table:** When the Ooze **succeeds on an attack** (attack roll success), the primary target
 * marks **1 Armor Slot** if they have an empty slot, else **1 HP** in addition to normal damage
 * resolution (`{@link youSucceedOnAnAttack}` + `hooks.onReviewOutcome` at damage commit).
 */
import { when, youSucceedOnAnAttack } from "../engine/when.js";

export const AcidicForm = {
  name: "Acidic Form",
  type: "passive",
  description:
    "When the Ooze makes a successful attack, the target must mark an Armor Slot without receiving its benefits (they can still use armor to reduce the damage). If they can't mark an Armor Slot, they must mark an additional HP.",
  runOnVttDamageApplyReviewOutcome: true,
  hooks: {
    onReviewOutcome:when(youSucceedOnAnAttack, (table) => {
      target.armor >= target.maxArmor ? target.markHP(1) : target.markArmor(1);
    }),
  },
};
