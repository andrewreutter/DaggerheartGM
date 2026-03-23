/**
 * SRD item — Gem of Insight (roll table 56). daggerheart-srd/items/Gem of Insight.md
 *
 * Default: gem is treated as attached to the **primary** weapon (`primaryWeaponId`).
 * Override with `featureState['Gem of Insight'].attachedWeaponId` = an SRD weapon id
 * (e.g. secondary weapon) when the host supports attachment choice.
 */

export const GemOfInsight = {
  name: 'Gem of Insight',
  description:
    'You can attach this gem to a weapon, allowing you to use your Instinct when making an attack with that weapon.',
  weaponTraitOverrides: (table, _feature, character) => {
    const chosen = table.feature?.get?.('attachedWeaponId') ?? character?.primaryWeaponId;
    if (!chosen) return {};
    return { [chosen]: 'Instinct' };
  },
};
