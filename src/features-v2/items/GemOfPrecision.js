/**
 * SRD item — Gem of Precision (roll table 55). daggerheart-srd/items/Gem of Precision.md
 *
 * Default: gem is treated as attached to the **primary** weapon (`primaryWeaponId`).
 * Override with `featureState['Gem of Precision'].attachedWeaponId` = an SRD weapon id
 * (e.g. secondary weapon) when the host supports attachment choice.
 */

export const GemOfPrecision = {
  name: 'Gem of Precision',
  description:
    'You can attach this gem to a weapon, allowing you to use your Finesse when making an attack with that weapon.',
  weaponTraitOverrides: (table, _feature, character) => {
    const chosen = table.feature?.get?.('attachedWeaponId') ?? character?.primaryWeaponId;
    if (!chosen) return {};
    return { [chosen]: 'Finesse' };
  },
};
