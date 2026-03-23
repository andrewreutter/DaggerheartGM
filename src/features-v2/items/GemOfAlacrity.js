/**
 * SRD item — Gem of Alacrity (roll table 53). daggerheart-srd/items/Gem of Alacrity.md
 *
 * Default: gem is treated as attached to the **primary** weapon (`primaryWeaponId`).
 * Override with `featureState['Gem of Alacrity'].attachedWeaponId` = an SRD weapon id
 * (e.g. secondary weapon) when the host supports attachment choice.
 */

export const GemOfAlacrity = {
  name: 'Gem of Alacrity',
  description:
    'You can attach this gem to a weapon, allowing you to use your Agility when making an attack with that weapon.',
  weaponTraitOverrides: (table, _feature, character) => {
    const chosen = table.feature?.get?.('attachedWeaponId') ?? character?.primaryWeaponId;
    if (!chosen) return {};
    return { [chosen]: 'Agility' };
  },
};
