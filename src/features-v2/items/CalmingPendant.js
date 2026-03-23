/**
 * SRD item — Calming Pendant (roll table 29).
 * When you would mark your last Stress, roll a d6; on 5+, don't mark it.
 */
export const CalmingPendant = {
  name: 'Calming Pendant',
  description:
    "When you would mark your last Stress, roll a d6. On a result of 5 or higher, don't mark it.",
  hooks: {
    onReviewOutcome(table) {
      const stressEffect = table.action?.effects?.find(
        (e) =>
          e.stat === 'currentStress' &&
          e.target?.instanceId === table.me?.instanceId &&
          e.amount > 0
      );
      if (!stressEffect) return;
      const t = stressEffect.target;
      const max = t?.maxStress ?? 0;
      const current = t?.currentStress ?? 0;
      // "Last Stress": a single mark that fills the final empty box.
      if (stressEffect.amount !== 1 || current !== max - 1) return;

      const roll = table.rollDie('d6');
      if (roll >= 5) {
        stressEffect.amount = 0;
      }
    },
  },
};
