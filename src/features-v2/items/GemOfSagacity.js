/**
 * SRD item — Gem of Sagacity (roll table 58). daggerheart-srd/items/Gem of Sagacity.md
 *
 * Default: gem is treated as attached to the **primary** weapon (`primaryWeaponId`).
 * Override with `featureState['Gem of Sagacity'].attachedWeaponId` = an SRD weapon id
 * (e.g. secondary weapon) when the host supports attachment choice.
 */

export const GemOfSagacity = {
  name: 'Gem of Sagacity',
  description:
    'You can attach this gem to a weapon, allowing you to use your Knowledge when making an attack with that weapon.',
  weaponTraitOverrides: (table, _feature, character) => {
    const chosen = table.feature?.get?.('attachedWeaponId') ?? character?.primaryWeaponId;
    if (!chosen) return {};
    return { [chosen]: 'Knowledge' };
  },
};
