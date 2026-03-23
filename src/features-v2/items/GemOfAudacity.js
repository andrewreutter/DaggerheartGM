/**
 * SRD item — Gem of Audacity (roll table 57). daggerheart-srd/items/Gem of Audacity.md
 *
 * Default: gem is treated as attached to the **primary** weapon (`primaryWeaponId`).
 * Override with `featureState['Gem of Audacity'].attachedWeaponId` = an SRD weapon id
 * (e.g. secondary weapon) when the host supports attachment choice.
 */

export const GemOfAudacity = {
  name: 'Gem of Audacity',
  description:
    'You can attach this gem to a weapon, allowing you to use your Presence when making an attack with that weapon.',
  weaponTraitOverrides: (table, _feature, character) => {
    const chosen = table.feature?.get?.('attachedWeaponId') ?? character?.primaryWeaponId;
    if (!chosen) return {};
    return { [chosen]: 'Presence' };
  },
};
