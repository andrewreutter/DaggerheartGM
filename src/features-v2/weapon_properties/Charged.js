import { when, isActing } from '../engine/when.js';

export const Charged = {
  name: "Charged",
  description: "Mark a Stress to gain a +1 bonus to your Proficiency on a primary weapon attack.",
  /**
   * Prefer the VTT intent strip for Charged; hide the duplicate amber “(Charged)” variant card.
   */
  computeWeaponRenderHints(table) {
    const wid = table.source?.id;
    if (!wid) return {};
    return { [wid]: { hideChargedVariantCard: true } };
  },
  chips: [
    when(
      isActing,
      (table) => table.action?.type === 'attack',
      {
        description: "Mark a Stress to gain +1 Proficiency on this attack.",
        placements: ['intent'],
        stressCost: 1,
        isToggle: true,
        temporaryStatMods: { proficiency: 1 },
      }
    ),
  ],
};
