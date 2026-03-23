/**
 * SRD item — Gem of Might (roll table 54). daggerheart-srd/items/Gem of Might.md
 *
 * Default: gem is treated as attached to the **primary** weapon (`primaryWeaponId`).
 * Override with `featureState['Gem of Might'].attachedWeaponId` = an SRD weapon id
 * (e.g. secondary weapon) when the host supports attachment choice.
 */

export const GemOfMight = {
  name: 'Gem of Might',
  description:
    'You can attach this gem to a weapon, allowing you to use your Strength when making an attack with that weapon.',
  weaponTraitOverrides: (table, _feature, character) => {
    const chosen = table.feature?.get?.('attachedWeaponId') ?? character?.primaryWeaponId;
    if (!chosen) return {};
    return { [chosen]: 'Strength' };
  },
};
