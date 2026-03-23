import { when, isActing, isSeverePendingHpLossEffect } from '../engine/when.js';

export const Deadly = {
  name: "Deadly",
  description: "When you deal Severe damage, the target must mark an additional HP.",
  hooks: {
    onReviewOutcome: when(isActing, (table) => table.action?.type === 'attack', (table) => {
      const targetId = table.action?.target?.instanceId;
      for (const e of table.action?.effects || []) {
        if (e.stat === 'currentHP' && e.target?.instanceId === targetId && isSeverePendingHpLossEffect(e)) {
          e.amount += 1;
        }
      }
    })
  }
};
