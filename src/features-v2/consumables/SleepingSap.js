/**
 * SRD consumable — Sleeping Sap (common roll table 50).
 * daggerheart-srd/consumables/Sleeping Sap.md
 */

export const SleepingSap = {
  name: 'Sleeping Sap',
  description:
    "You can drink this potion to fall asleep for a full night's rest. You clear all Stress upon waking.",
  onUse(table) {
    const marked = table.me.currentStress ?? 0;
    if (marked > 0) table.me.clearStress(marked);
  },
};
