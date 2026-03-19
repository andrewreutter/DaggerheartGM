/**
 * Human ancestry builder.
 *
 * Features:
 *   High Stamina — +1 Stress slot (addStatMod maxStress).
 *   Adaptability — On failed roll that used an experience, mark 1 Stress to full reroll (onBanner chip).
 */
export default {
  name: 'Human',
  description: 'Humans are a diverse and adaptable people with a wide range of appearances, cultures, and lifespans. They are known for their resilience and capacity to persevere through hardship.',

  features: [
    {
      name: 'High Stamina',
      description: 'Gain an additional Stress slot.',
      onCharacterRender: (ctx) => ctx.addStatMod('maxStress', 1),
    },
    {
      name: 'Adaptability',
      description: 'When you fail a roll that used an experience, you can **mark a Stress** to reroll the entire roll.',
      onBanner(banner) {
        banner.addChip({
          label: 'Mark 1 Stress to reroll the entire roll (Adaptability)',
          stressCost: 1,
          isVisible: (roll) => roll.isMine && roll.hasExperience && roll.isFailure,
          onChipAck: (roll) => roll.fullReroll(),
        });
      },
    },
  ],
};
